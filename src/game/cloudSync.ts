import { CLOUD_CONFIG, isCloudConfigured, type CloudConfig } from '../config/cloudConfig';
import type { SaveDataV4 } from './saveSystem';

export type CloudSyncState = 'synced' | 'saving' | 'offline';

export interface CloudAuthCredentials {
  uid: string;
  accessToken: string;
}

type StatusListener = (status: CloudSyncState) => void;

/**
 * Bulletproof Cloud Save Manager for DrizzyCraft: Setor 09.
 * - Uses pure REST `fetch(..., { keepalive: true })` with `Authorization: Bearer <token>`
 *   (NEVER `sendBeacon`, which drops auth headers).
 * - Automatically flushes pending saves on `visibilitychange`, `pagehide`, and `beforeunload`
 *   so closing/minimizing Chrome on Android never loses progress.
 * - Supports Supabase Postgres REST (`user_saves`) and Firebase Firestore REST (`users/{uid}`).
 */
export class CloudSyncManager {
  private status: CloudSyncState = 'offline';
  private listeners = new Set<StatusListener>();
  private credentials: CloudAuthCredentials | null = null;
  private pendingSave: SaveDataV4 | null = null;
  private lifecycleBound = false;
  private config: CloudConfig;

  constructor(config: CloudConfig = CLOUD_CONFIG) {
    this.config = config;
  }

  getStatus(): CloudSyncState {
    return this.status;
  }

  private setStatus(next: CloudSyncState): void {
    if (this.status === next) return;
    this.status = next;
    for (const cb of this.listeners) {
      try {
        cb(next);
      } catch {
        // isolate UI subscriber errors
      }
    }
  }

  subscribeStatus(cb: StatusListener): () => void {
    this.listeners.add(cb);
    cb(this.status);
    return () => this.listeners.delete(cb);
  }

  setCredentials(creds: CloudAuthCredentials | null): void {
    this.credentials = creds;
    if (!creds || !isCloudConfigured(this.config)) {
      this.setStatus('offline');
    } else {
      this.setStatus('synced');
      this.bindAndroidCloseShield();
    }
  }

  /**
   * Builds the exact authenticated REST request for uploading a user's SaveDataV4.
   * Exported for deterministic unit testing of headers, keepalive, and endpoint paths.
   */
  buildUploadRequest(
    save: SaveDataV4,
    creds: CloudAuthCredentials,
    cfg: CloudConfig = this.config
  ): { url: string; init: RequestInit } | null {
    if (!isCloudConfigured(cfg)) return null;

    if (cfg.provider === 'supabase') {
      const base = cfg.supabaseUrl.replace(/\/+$/, '');
      return {
        url: `${base}/rest/v1/user_saves?on_conflict=user_id`,
        init: {
          method: 'POST',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            apikey: cfg.supabaseAnonKey,
            Authorization: `Bearer ${creds.accessToken}`,
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            user_id: creds.uid,
            save_data: save,
            updated_at: new Date(save.updatedAt || Date.now()).toISOString(),
          }),
        },
      };
    }

    if (cfg.provider === 'firebase') {
      const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        cfg.firebaseProjectId
      )}/databases/(default)/documents/users/${encodeURIComponent(creds.uid)}`;
      return {
        url,
        init: {
          method: 'PATCH',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${creds.accessToken}`,
          },
          body: JSON.stringify({
            fields: {
              saveJson: { stringValue: JSON.stringify(save) },
              updatedAt: { integerValue: String(save.updatedAt || Date.now()) },
            },
          }),
        },
      };
    }

    return null;
  }

  async uploadSave(save: SaveDataV4): Promise<boolean> {
    this.pendingSave = save;
    if (!this.credentials || !isCloudConfigured(this.config) || typeof fetch !== 'function') {
      this.setStatus('offline');
      return false;
    }

    const req = this.buildUploadRequest(save, this.credentials, this.config);
    if (!req) {
      this.setStatus('offline');
      return false;
    }

    this.setStatus('saving');
    try {
      const res = await fetch(req.url, req.init);
      if (res.ok) {
        this.pendingSave = null;
        this.setStatus('synced');
        return true;
      }
      this.setStatus('offline');
      return false;
    } catch {
      this.setStatus('offline');
      return false;
    }
  }

  async fetchSave(): Promise<SaveDataV4 | null> {
    if (!this.credentials || !isCloudConfigured(this.config) || typeof fetch !== 'function') {
      return null;
    }

    try {
      if (this.config.provider === 'supabase') {
        const base = this.config.supabaseUrl.replace(/\/+$/, '');
        const url = `${base}/rest/v1/user_saves?user_id=eq.${encodeURIComponent(
          this.credentials.uid
        )}&select=save_data`;
        const res = await fetch(url, {
          headers: {
            apikey: this.config.supabaseAnonKey,
            Authorization: `Bearer ${this.credentials.accessToken}`,
          },
        });
        if (!res.ok) return null;
        const rows = (await res.json()) as Array<{ save_data?: SaveDataV4 }>;
        return rows[0]?.save_data ?? null;
      }

      if (this.config.provider === 'firebase') {
        const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
          this.config.firebaseProjectId
        )}/databases/(default)/documents/users/${encodeURIComponent(this.credentials.uid)}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${this.credentials.accessToken}`,
          },
        });
        if (!res.ok) return null;
        const doc = (await res.json()) as { fields?: { saveJson?: { stringValue?: string } } };
        const raw = doc.fields?.saveJson?.stringValue;
        return raw ? (JSON.parse(raw) as SaveDataV4) : null;
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Flushes any pending save synchronously via `fetch(..., { keepalive: true })`
   * when Android/iOS/Desktop tabs are hidden or closed.
   */
  flushKeepalive(): void {
    if (!this.pendingSave || !this.credentials || !isCloudConfigured(this.config)) return;
    if (typeof fetch !== 'function') return;
    const req = this.buildUploadRequest(this.pendingSave, this.credentials, this.config);
    if (!req) return;
    try {
      void fetch(req.url, req.init);
    } catch {
      // ignore unload network errors
    }
  }

  bindAndroidCloseShield(): void {
    if (this.lifecycleBound || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    this.lifecycleBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushKeepalive();
      }
    });
    window.addEventListener('pagehide', () => this.flushKeepalive());
    window.addEventListener('beforeunload', () => this.flushKeepalive());
  }
}

export const cloudSync = new CloudSyncManager();
