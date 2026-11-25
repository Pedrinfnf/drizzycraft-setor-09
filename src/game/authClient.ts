import { CLOUD_CONFIG, isCloudConfigured } from '../config/cloudConfig';
import { cloudSync } from './cloudSync';
import type { SaveDataV4 } from './saveSystem';

export type AuthProvider = 'email' | 'google' | 'guest';

export interface AuthUser {
  id: string;
  nickname: string;
  email: string;
  provider: AuthProvider;
  avatarUrl?: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  cloudSave: Record<string, unknown> | null;
  mode: 'remote' | 'local';
  updatedAt: number;
}

export interface AuthResult {
  ok: boolean;
  session?: AuthSession;
  error?: string;
  configured?: boolean;
  message?: string;
  migratedGuestSave?: boolean;
}

export interface SignUpParams {
  nickname: string;
  email: string;
  password: string;
  guestSave?: Record<string, unknown> | null;
}

export interface LoginParams {
  email: string;
  password: string;
  guestSave?: Record<string, unknown> | null;
}

interface LocalAccountRecord {
  id: string;
  nickname: string;
  email: string;
  salt: string;
  passwordHash: string;
  provider: AuthProvider;
  avatarUrl?: string;
  cloudSave: Record<string, unknown> | null;
  updatedAt: number;
}

const SESSION_STORAGE_KEY = 'diddycraft_auth_session_v1';
const LOCAL_ACCOUNTS_STORAGE_KEY = 'diddycraft_local_accounts_v1';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

function safeStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // ignore
  }
  return null;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function randomHex(byteCount = 16): string {
  const bytes = new Uint8Array(byteCount);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteCount; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

async function hashLocalPassword(password: string, salt: string): Promise<string> {
  const input = `${salt}:${password}`;
  if (
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof crypto.subtle.digest === 'function'
  ) {
    const encoded = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return bytesToHex(new Uint8Array(digest));
  }
  // Deterministic fallback when running outside secure context without SubtleCrypto
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

function loadLocalAccounts(): LocalAccountRecord[] {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(LOCAL_ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalAccountRecord[]) : [];
  } catch {
    return [];
  }
}

function saveLocalAccounts(accounts: LocalAccountRecord[]): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(LOCAL_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // ignore quota errors
  }
}

function persistSession(session: AuthSession | null): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    if (!session) {
      storage.removeItem(SESSION_STORAGE_KEY);
    } else {
      storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // ignore
  }
}

function readStoredSession(): AuthSession | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed || !parsed.token || !parsed.user || !parsed.user.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function tryApiFetch<T>(
  url: string,
  init: RequestInit,
  timeoutMs = 2500,
): Promise<{ reachable: boolean; status: number; data: T | null }> {
  if (typeof fetch !== 'function') {
    return { reachable: false, status: 0, data: null };
  }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const resp = await fetch(url, {
      ...init,
      signal: controller?.signal,
    });
    const contentType = resp.headers.get('content-type') || '';
    // Static hosts (e.g. GitHub Pages) return HTML 404 for /api/* -> treat as unreachable backend
    if (!contentType.includes('application/json')) {
      return { reachable: false, status: resp.status, data: null };
    }
    const data = (await resp.json()) as T;
    return { reachable: true, status: resp.status, data };
  } catch {
    return { reachable: false, status: 0, data: null };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isSupabaseAuthActive(): boolean {
  return CLOUD_CONFIG.provider === 'supabase' && isCloudConfigured(CLOUD_CONFIG);
}

function supabaseBaseUrl(): string {
  return CLOUD_CONFIG.supabaseUrl.replace(/\/+$/, '');
}

interface SupabaseAuthUserPayload {
  id?: string;
  email?: string;
  app_metadata?: { provider?: string };
  user_metadata?: { nickname?: string; full_name?: string; name?: string; avatar_url?: string };
}

function mapSupabaseUser(u: SupabaseAuthUserPayload, fallbackNick?: string): AuthUser {
  const email = (u.email || '').trim().toLowerCase();
  const nick =
    (u.user_metadata?.nickname ||
      u.user_metadata?.full_name ||
      u.user_metadata?.name ||
      fallbackNick ||
      email.split('@')[0] ||
      'Survivor').trim();
  const providerRaw = u.app_metadata?.provider;
  const provider: AuthProvider = providerRaw === 'google' ? 'google' : 'email';
  return {
    id: u.id || `sb_${randomHex(8)}`,
    nickname: nick.slice(0, 24),
    email,
    provider,
    avatarUrl: u.user_metadata?.avatar_url,
  };
}

async function supabaseAuthFetch<T>(
  path: string,
  init: RequestInit,
  accessToken?: string,
  timeoutMs = 7000,
): Promise<{ reachable: boolean; ok: boolean; status: number; data: T | null }> {
  if (typeof fetch !== 'function') {
    return { reachable: false, ok: false, status: 0, data: null };
  }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const headers: Record<string, string> = {
      apikey: CLOUD_CONFIG.supabaseAnonKey,
      ...(init.headers as Record<string, string> | undefined),
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    const resp = await fetch(`${supabaseBaseUrl()}${path}`, {
      ...init,
      headers,
      signal: controller?.signal,
    });
    const text = await resp.text();
    let data: T | null = null;
    if (text) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        data = null;
      }
    }
    return { reachable: true, ok: resp.ok, status: resp.status, data };
  } catch {
    return { reachable: false, ok: false, status: 0, data: null };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const authClient = {
  isValidEmail,

  getSession(): AuthSession | null {
    return readStoredSession();
  },

  async refreshSession(): Promise<AuthSession | null> {
    const current = readStoredSession();
    if (!current) return null;
    if (current.mode === 'local') return current;

    if (isSupabaseAuthActive()) {
      const sb = await supabaseAuthFetch<SupabaseAuthUserPayload>(
        '/auth/v1/user',
        { method: 'GET' },
        current.token,
      );
      if (!sb.reachable) return current;
      if (sb.status === 401 || sb.status === 403) {
        persistSession(null);
        cloudSync.setCredentials(null);
        return null;
      }
      if (sb.ok && sb.data?.id) {
        const user = mapSupabaseUser(sb.data, current.user.nickname);
        cloudSync.setCredentials({ uid: user.id, accessToken: current.token });
        const fetched = (await cloudSync.fetchSave()) as unknown as Record<string, unknown> | null;
        const refreshed: AuthSession = {
          token: current.token,
          user,
          cloudSave: fetched ?? current.cloudSave ?? null,
          mode: 'remote',
          updatedAt: Date.now(),
        };
        persistSession(refreshed);
        return refreshed;
      }
      return current;
    }

    const resp = await tryApiFetch<{
      ok: boolean;
      user?: AuthUser;
      cloudSave?: Record<string, unknown> | null;
    }>('/api/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${current.token}` },
    });

    if (!resp.reachable) return current;
    if (resp.status === 401) {
      persistSession(null);
      return null;
    }
    if (resp.data?.ok && resp.data.user) {
      const refreshed: AuthSession = {
        token: current.token,
        user: resp.data.user,
        cloudSave: resp.data.cloudSave ?? null,
        mode: 'remote',
        updatedAt: Date.now(),
      };
      persistSession(refreshed);
      return refreshed;
    }
    return current;
  },

  async consumeOAuthCallbackFromUrl(): Promise<AuthSession | null> {
    if (typeof window === 'undefined') return null;
    const hash = window.location.hash || '';
    const sbMatch = hash.match(/access_token=([^&]+)/);
    if (sbMatch && isSupabaseAuthActive()) {
      const accessToken = decodeURIComponent(sbMatch[1]);
      try {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch {
        // ignore
      }
      const sb = await supabaseAuthFetch<SupabaseAuthUserPayload>(
        '/auth/v1/user',
        { method: 'GET' },
        accessToken,
      );
      if (sb.reachable && sb.ok && sb.data?.id) {
        const user = mapSupabaseUser(sb.data);
        cloudSync.setCredentials({ uid: user.id, accessToken });
        const cloudSave = (await cloudSync.fetchSave()) as unknown as Record<string, unknown> | null;
        const session: AuthSession = {
          token: accessToken,
          user,
          cloudSave,
          mode: 'remote',
          updatedAt: Date.now(),
        };
        persistSession(session);
        return session;
      }
      return null;
    }

    const match = hash.match(/auth_token=([^&]+)/);
    if (!match) return null;
    const token = decodeURIComponent(match[1]);
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
      // ignore
    }

    const resp = await tryApiFetch<{
      ok: boolean;
      user?: AuthUser;
      cloudSave?: Record<string, unknown> | null;
    }>('/api/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (resp.reachable && resp.data?.ok && resp.data.user) {
      const session: AuthSession = {
        token,
        user: resp.data.user,
        cloudSave: resp.data.cloudSave ?? null,
        mode: 'remote',
        updatedAt: Date.now(),
      };
      persistSession(session);
      return session;
    }
    return null;
  },

  async signUp({ nickname, email, password, guestSave }: SignUpParams): Promise<AuthResult> {
    const cleanNick = (nickname || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    if (cleanNick.length < 2 || cleanNick.length > 24) {
      return { ok: false, error: 'Nickname deve ter entre 2 e 24 caracteres.' };
    }
    if (!isValidEmail(cleanEmail)) {
      return { ok: false, error: 'Email inválido.' };
    }
    if (!password || password.length < 6) {
      return { ok: false, error: 'Senha deve ter pelo menos 6 caracteres.' };
    }

    if (isSupabaseAuthActive()) {
      const sb = await supabaseAuthFetch<{
        access_token?: string;
        user?: SupabaseAuthUserPayload;
        msg?: string;
        error_description?: string;
      }>('/auth/v1/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          data: { nickname: cleanNick },
        }),
      });
      if (sb.reachable) {
        if (!sb.ok || !sb.data?.access_token || !sb.data.user?.id) {
          return {
            ok: false,
            error: sb.data?.msg || sb.data?.error_description || 'Erro ao criar conta na nuvem.',
          };
        }
        const user = mapSupabaseUser(sb.data.user, cleanNick);
        const token = sb.data.access_token;
        cloudSync.setCredentials({ uid: user.id, accessToken: token });
        let uploadedSave: Record<string, unknown> | null = null;
        if (guestSave) {
          const ok = await cloudSync.uploadSave(guestSave as unknown as SaveDataV4);
          if (ok) uploadedSave = { ...guestSave };
        }
        const session: AuthSession = {
          token,
          user,
          cloudSave: uploadedSave,
          mode: 'remote',
          updatedAt: Date.now(),
        };
        persistSession(session);
        return {
          ok: true,
          session,
          migratedGuestSave: Boolean(guestSave && uploadedSave),
        };
      }
    }

    const remote = await tryApiFetch<{
      ok: boolean;
      token?: string;
      user?: AuthUser;
      cloudSave?: Record<string, unknown> | null;
      error?: string;
    }>('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: cleanNick, email: cleanEmail, password, guestSave }),
    });

    if (remote.reachable) {
      if (!remote.data?.ok || !remote.data.token || !remote.data.user) {
        return { ok: false, error: remote.data?.error || 'Erro ao criar conta.' };
      }
      const session: AuthSession = {
        token: remote.data.token,
        user: remote.data.user,
        cloudSave: remote.data.cloudSave ?? null,
        mode: 'remote',
        updatedAt: Date.now(),
      };
      persistSession(session);
      return {
        ok: true,
        session,
        migratedGuestSave: Boolean(guestSave && session.cloudSave),
      };
    }

    // Local fallback for static hosting (GitHub Pages / offline)
    const accounts = loadLocalAccounts();
    if (accounts.some((a) => a.email === cleanEmail)) {
      return { ok: false, error: 'Este email já está cadastrado.' };
    }

    const salt = randomHex(16);
    const passwordHash = await hashLocalPassword(password, salt);
    const now = Date.now();
    const record: LocalAccountRecord = {
      id: `local_${randomHex(8)}`,
      nickname: cleanNick,
      email: cleanEmail,
      salt,
      passwordHash,
      provider: 'email',
      cloudSave: guestSave ? { ...guestSave } : null,
      updatedAt: now,
    };
    accounts.push(record);
    saveLocalAccounts(accounts);

    const session: AuthSession = {
      token: `local_tok_${randomHex(16)}`,
      user: {
        id: record.id,
        nickname: record.nickname,
        email: record.email,
        provider: 'email',
      },
      cloudSave: record.cloudSave,
      mode: 'local',
      updatedAt: now,
    };
    persistSession(session);
    return {
      ok: true,
      session,
      migratedGuestSave: Boolean(guestSave && record.cloudSave),
    };
  },

  async login({ email, password, guestSave }: LoginParams): Promise<AuthResult> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!isValidEmail(cleanEmail) || !password) {
      return { ok: false, error: 'Informe um email válido e sua senha.' };
    }

    if (isSupabaseAuthActive()) {
      const sb = await supabaseAuthFetch<{
        access_token?: string;
        user?: SupabaseAuthUserPayload;
        msg?: string;
        error_description?: string;
      }>('/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });
      if (sb.reachable) {
        if (!sb.ok || !sb.data?.access_token || !sb.data.user?.id) {
          return {
            ok: false,
            error: sb.data?.error_description || sb.data?.msg || 'Email ou senha incorretos.',
          };
        }
        const user = mapSupabaseUser(sb.data.user);
        const token = sb.data.access_token;
        cloudSync.setCredentials({ uid: user.id, accessToken: token });
        let cloudSave = (await cloudSync.fetchSave()) as unknown as Record<string, unknown> | null;
        let migratedGuestSave = false;
        if (!cloudSave && guestSave) {
          const ok = await cloudSync.uploadSave(guestSave as unknown as SaveDataV4);
          if (ok) {
            cloudSave = { ...guestSave };
            migratedGuestSave = true;
          }
        }
        const session: AuthSession = {
          token,
          user,
          cloudSave,
          mode: 'remote',
          updatedAt: Date.now(),
        };
        persistSession(session);
        return { ok: true, session, migratedGuestSave };
      }
    }

    const remote = await tryApiFetch<{
      ok: boolean;
      token?: string;
      user?: AuthUser;
      cloudSave?: Record<string, unknown> | null;
      error?: string;
    }>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password, guestSave }),
    });

    if (remote.reachable) {
      if (!remote.data?.ok || !remote.data.token || !remote.data.user) {
        return { ok: false, error: remote.data?.error || 'Email ou senha incorretos.' };
      }
      const session: AuthSession = {
        token: remote.data.token,
        user: remote.data.user,
        cloudSave: remote.data.cloudSave ?? null,
        mode: 'remote',
        updatedAt: Date.now(),
      };
      persistSession(session);
      return {
        ok: true,
        session,
        migratedGuestSave: Boolean(guestSave && session.cloudSave),
      };
    }

    // Local fallback
    const accounts = loadLocalAccounts();
    const found = accounts.find((a) => a.email === cleanEmail);
    if (!found) {
      return { ok: false, error: 'Email ou senha incorretos.' };
    }
    const checkHash = await hashLocalPassword(password, found.salt);
    if (checkHash !== found.passwordHash) {
      return { ok: false, error: 'Email ou senha incorretos.' };
    }

    let migratedGuestSave = false;
    if (!found.cloudSave && guestSave) {
      found.cloudSave = { ...guestSave };
      found.updatedAt = Date.now();
      saveLocalAccounts(accounts);
      migratedGuestSave = true;
    }

    const session: AuthSession = {
      token: `local_tok_${randomHex(16)}`,
      user: {
        id: found.id,
        nickname: found.nickname,
        email: found.email,
        provider: found.provider,
        avatarUrl: found.avatarUrl,
      },
      cloudSave: found.cloudSave,
      mode: 'local',
      updatedAt: Date.now(),
    };
    persistSession(session);
    return { ok: true, session, migratedGuestSave };
  },

  async loginWithGoogle(): Promise<AuthResult> {
    if (isSupabaseAuthActive()) {
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname}`
          : 'https://pedrinfnf.github.io/drizzycraft-setor-09/';
      const authUrl = `${supabaseBaseUrl()}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(
        redirectTo,
      )}`;
      if (typeof window !== 'undefined') {
        window.location.href = authUrl;
      }
      return { ok: true, configured: true };
    }

    const remote = await tryApiFetch<{
      ok: boolean;
      configured?: boolean;
      authUrl?: string;
      message?: string;
      error?: string;
    }>('/api/auth/google?mode=json', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (remote.reachable && remote.data) {
      if (remote.data.ok && remote.data.authUrl) {
        if (typeof window !== 'undefined') {
          window.location.href = remote.data.authUrl;
        }
        return { ok: true, configured: true };
      }
      const msg =
        remote.data.message ||
        remote.data.error ||
        'Google OAuth requer GOOGLE_CLIENT_ID configurado no servidor.';
      return { ok: false, configured: false, error: msg, message: msg };
    }

    const fallbackMsg =
      'Google OAuth requer servidor backend com GOOGLE_CLIENT_ID configurado.';
    return {
      ok: false,
      configured: false,
      error: fallbackMsg,
      message: fallbackMsg,
    };
  },

  async logout(): Promise<void> {
    const current = readStoredSession();
    persistSession(null);
    cloudSync.setCredentials(null);
    if (current && current.mode === 'remote') {
      if (isSupabaseAuthActive()) {
        await supabaseAuthFetch('/auth/v1/logout', { method: 'POST' }, current.token);
        return;
      }
      await tryApiFetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${current.token}` },
      });
    }
  },

  async syncCloudSave(saveData: Record<string, unknown>): Promise<{
    ok: boolean;
    mode: 'remote' | 'local';
    updatedAt?: number;
    error?: string;
  }> {
    const current = readStoredSession();
    if (!current) {
      return { ok: false, mode: 'local', error: 'Usuário não autenticado.' };
    }

    if (current.mode === 'remote') {
      if (isSupabaseAuthActive()) {
        cloudSync.setCredentials({ uid: current.user.id, accessToken: current.token });
        const ok = await cloudSync.uploadSave(saveData as unknown as SaveDataV4);
        if (ok) {
          const updatedAt = Date.now();
          persistSession({ ...current, cloudSave: { ...saveData }, updatedAt });
          return { ok: true, mode: 'remote', updatedAt };
        }
      }

      const remote = await tryApiFetch<{
        ok: boolean;
        updatedAt?: number;
        error?: string;
      }>('/api/cloud-save', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${current.token}`,
        },
        body: JSON.stringify({ saveData }),
      });

      if (remote.reachable) {
        if (!remote.data?.ok) {
          return {
            ok: false,
            mode: 'remote',
            error: remote.data?.error || 'Falha ao sincronizar save na nuvem.',
          };
        }
        const updatedAt = remote.data.updatedAt ?? Date.now();
        persistSession({
          ...current,
          cloudSave: { ...saveData },
          updatedAt,
        });
        return { ok: true, mode: 'remote', updatedAt };
      }
    }

    // Local fallback persistence
    const now = Date.now();
    const accounts = loadLocalAccounts();
    const idx = accounts.findIndex((a) => a.id === current.user.id || a.email === current.user.email);
    if (idx >= 0) {
      accounts[idx].cloudSave = { ...saveData };
      accounts[idx].updatedAt = now;
      saveLocalAccounts(accounts);
    }
    persistSession({
      ...current,
      cloudSave: { ...saveData },
      updatedAt: now,
    });
    return { ok: true, mode: 'local', updatedAt: now };
  },

  async fetchCloudSave(): Promise<Record<string, unknown> | null> {
    const current = readStoredSession();
    if (!current) return null;
    if (current.mode === 'remote') {
      if (isSupabaseAuthActive()) {
        cloudSync.setCredentials({ uid: current.user.id, accessToken: current.token });
        const fetched = (await cloudSync.fetchSave()) as unknown as Record<string, unknown> | null;
        if (fetched) {
          persistSession({ ...current, cloudSave: fetched, updatedAt: Date.now() });
          return fetched;
        }
      }

      const remote = await tryApiFetch<{
        ok: boolean;
        cloudSave?: Record<string, unknown> | null;
      }>('/api/cloud-save', {
        method: 'GET',
        headers: { Authorization: `Bearer ${current.token}` },
      });
      if (remote.reachable && remote.data?.ok) {
        const cloudSave = remote.data.cloudSave ?? null;
        persistSession({ ...current, cloudSave, updatedAt: Date.now() });
        return cloudSave;
      }
    }
    return current.cloudSave ?? null;
  },
};
