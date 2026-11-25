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

export const authClient = {
  isValidEmail,

  getSession(): AuthSession | null {
    return readStoredSession();
  },

  async refreshSession(): Promise<AuthSession | null> {
    const current = readStoredSession();
    if (!current) return null;
    if (current.mode === 'local') return current;

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
    if (current && current.mode === 'remote') {
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
