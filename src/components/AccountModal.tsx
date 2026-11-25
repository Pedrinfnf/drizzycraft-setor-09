import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { authClient, type AuthSession } from '../game/authClient';
import { saveSystem } from '../game/saveSystem';
import type { Language } from '../game/types';
import { t } from '../i18n/translations';

export interface AccountModalProps {
  language: Language;
  session: AuthSession | null;
  onSessionChange: (s: AuthSession | null) => void;
  onClose: () => void;
  onCloudSync?: () => void;
}

type AuthTab = 'login' | 'signup';

export const AccountModal: React.FC<AccountModalProps> = ({
  language,
  session,
  onSessionChange,
  onClose,
  onCloudSync,
}) => {
  const [tab, setTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const handleGoogleLogin = async () => {
    setStatus(null);
    setBusy(true);
    try {
      const res = await authClient.loginWithGoogle();
      if (res && typeof res === 'object') {
        if ('session' in res && res.session) {
          onSessionChange(res.session);
          setStatus({ kind: 'ok', text: t(language, 'account.cloudSynced') });
          return;
        }
        if ('ok' in res && !res.ok) {
          setStatus({
            kind: 'info',
            text:
              ('message' in res && typeof res.message === 'string' && res.message) ||
              t(language, 'account.googleUnavailable'),
          });
          return;
        }
      }
      setStatus({ kind: 'info', text: t(language, 'account.googleUnavailable') });
    } catch {
      setStatus({ kind: 'info', text: t(language, 'account.googleUnavailable') });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedNick = nickname.trim();

    if (!authClient.isValidEmail(trimmedEmail)) {
      setStatus({ kind: 'err', text: t(language, 'account.errorInvalidEmail') });
      return;
    }
    if (tab === 'signup' && trimmedNick.length < 3) {
      setStatus({ kind: 'err', text: t(language, 'account.errorShortNickname') });
      return;
    }
    if (password.length < 6) {
      setStatus({ kind: 'err', text: t(language, 'account.errorShortPassword') });
      return;
    }

    setBusy(true);
    try {
      const guestSave = saveSystem.load() as unknown as Record<string, unknown>;
      if (tab === 'signup') {
        const res = await authClient.signUp({
          nickname: trimmedNick,
          email: trimmedEmail,
          password,
          guestSave,
        });
        if (res.ok && res.session) {
          onSessionChange(res.session);
          setPassword('');
          setStatus({ kind: 'ok', text: t(language, 'account.migrationBadge') });
        } else {
          setStatus({ kind: 'err', text: res.error || res.message || 'Falha ao criar conta.' });
        }
      } else {
        const res = await authClient.login({
          email: trimmedEmail,
          password,
          guestSave,
        });
        if (res.ok && res.session) {
          onSessionChange(res.session);
          setPassword('');
          setStatus({ kind: 'ok', text: t(language, 'account.cloudSynced') });
        } else {
          setStatus({ kind: 'err', text: res.error || res.message || 'Credenciais inválidas.' });
        }
      }
    } catch {
      setStatus({ kind: 'err', text: 'Erro de comunicação ao autenticar.' });
    } finally {
      setBusy(false);
    }
  };

  const handleCloudSync = async () => {
    setSyncing(true);
    setStatus(null);
    try {
      const data = saveSystem.load() as unknown as Record<string, unknown>;
      const res = await authClient.syncCloudSave(data);
      onCloudSync?.();
      if (!res.ok) {
        setStatus({ kind: 'err', text: res.error || 'Falha ao sincronizar.' });
      } else {
        setStatus({ kind: 'ok', text: t(language, 'account.cloudSynced') });
      }
    } catch {
      setStatus({ kind: 'err', text: 'Não foi possível sincronizar agora.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await authClient.logout();
      onSessionChange(null);
      setStatus({ kind: 'info', text: t(language, 'account.guestTitle') });
    } finally {
      setBusy(false);
    }
  };

  const isSignedIn = Boolean(session && session.user && session.user.provider !== 'guest');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(language, 'account.title')}
      data-testid="account-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 backdrop-blur-md p-2 sm:p-4"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="horror-panel tactical-grid-bg w-full max-w-lg max-h-full flex flex-col overflow-hidden text-slate-100 animate-tactical-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/35 bg-slate-950/90 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-1.5 h-6 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.65)] shrink-0" />
            <div className="min-w-0">
              <h2 className="font-horror text-lg sm:text-xl font-extrabold tracking-wider uppercase text-white leading-none truncate">
                {t(language, 'account.title')}
              </h2>
              <div className="text-[10px] font-tech uppercase tracking-[0.16em] text-cyan-300 mt-0.5 truncate">
                SAVE V4 NA NUVEM · CROSSPLAY ID
              </div>
            </div>
          </div>

          <button
            type="button"
            data-testid="account-close-btn"
            onClick={onClose}
            aria-label={t(language, 'common.close')}
            className="horror-btn horror-btn-danger px-3 py-1.5 text-[11px] font-tech font-bold uppercase text-white flex items-center gap-1 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>{t(language, 'common.close')}</span>
          </button>
        </div>

        {/* Status Banner */}
        {status && (
          <div
            role="status"
            data-testid="account-status-banner"
            className={`px-4 py-2 text-xs font-tech font-bold border-b flex items-center justify-between gap-2 ${
              status.kind === 'ok'
                ? 'bg-emerald-950/85 border-emerald-500/50 text-emerald-200'
                : status.kind === 'err'
                ? 'bg-red-950/85 border-red-500/50 text-red-200'
                : 'bg-amber-950/85 border-amber-500/50 text-amber-200'
            }`}
          >
            <span>{status.text}</span>
            <button
              type="button"
              onClick={() => setStatus(null)}
              className="opacity-75 hover:opacity-100 cursor-pointer shrink-0"
              aria-label={t(language, 'common.close')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto horror-scroll p-4 space-y-4">
          {isSignedIn && session ? (
            /* Signed-In Profile View */
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/85 border border-emerald-500/50 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 bg-emerald-950/80 border border-emerald-400/70 flex items-center justify-center text-emerald-300 shrink-0">
                      <User className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-tech uppercase tracking-widest text-emerald-400">
                        {t(language, 'account.profileTitle')}
                      </div>
                      <div
                        data-testid="account-profile-nickname"
                        className="font-horror text-xl font-extrabold text-white truncate"
                      >
                        {session.user.nickname}
                      </div>
                      <div className="text-xs font-tech text-slate-400 truncate">
                        {session.user.email}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-1 text-[10px] font-tech font-bold uppercase bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 shrink-0">
                    {session.user.provider.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-tech text-emerald-300 bg-emerald-950/40 border border-emerald-500/35 px-3 py-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{t(language, 'account.migrationBadge')}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  data-testid="account-cloud-sync-btn"
                  disabled={syncing}
                  onClick={handleCloudSync}
                  className="horror-btn horror-btn-amber py-2.5 px-3 text-xs font-tech font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  {syncing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Cloud className="w-4 h-4" />
                  )}
                  <span>{t(language, 'account.cloudSync')}</span>
                </button>

                <button
                  type="button"
                  data-testid="account-logout-btn"
                  disabled={busy}
                  onClick={handleLogout}
                  className="horror-btn horror-btn-danger py-2.5 px-3 text-xs font-tech font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t(language, 'account.logout')}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Guest / Auth Forms View */
            <>
              {/* Guest Mode Info + Automatic Progress Migration Badge */}
              <div className="p-3 bg-slate-950/85 border border-amber-500/45 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-tech font-extrabold uppercase tracking-wider text-amber-300">
                    {t(language, 'account.guestTitle')}
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-950/80 border border-emerald-500/50 text-[9px] font-tech font-bold uppercase text-emerald-300">
                    <CheckCircle2 className="w-3 h-3" />
                    AUTO-MIGRAÇÃO
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {t(language, 'account.guestDesc')}
                </p>
              </div>

              {/* Google OAuth Button */}
              <button
                type="button"
                data-testid="account-google-btn"
                disabled={busy}
                onClick={handleGoogleLogin}
                className="horror-btn w-full py-2.5 px-4 border-slate-500/80 hover:border-cyan-400 flex items-center justify-center gap-2.5 text-xs font-tech font-extrabold uppercase tracking-wider text-white cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12S6.6 21.8 12 21.8c6.9 0 9.6-4.8 9.6-7.3 0-.5-.1-.9-.1-1.3H12z"
                  />
                </svg>
                <span>{t(language, 'account.googleBtn')}</span>
              </button>

              {/* Login / Sign Up Tabs */}
              <div
                role="tablist"
                aria-label="Modo de autenticação"
                className="grid grid-cols-2 gap-1.5"
              >
                <button
                  type="button"
                  role="tab"
                  data-testid="account-tab-login"
                  aria-selected={tab === 'login'}
                  onClick={() => {
                    setTab('login');
                    setStatus(null);
                  }}
                  className={`py-2 px-3 text-xs font-tech font-bold uppercase tracking-wider border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    tab === 'login'
                      ? 'bg-red-950/75 border-amber-400 text-amber-200'
                      : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{t(language, 'account.tabLogin')}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  data-testid="account-tab-signup"
                  aria-selected={tab === 'signup'}
                  onClick={() => {
                    setTab('signup');
                    setStatus(null);
                  }}
                  className={`py-2 px-3 text-xs font-tech font-bold uppercase tracking-wider border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    tab === 'signup'
                      ? 'bg-red-950/75 border-amber-400 text-amber-200'
                      : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{t(language, 'account.tabSignUp')}</span>
                </button>
              </div>

              {/* Email / Nickname / Password Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {tab === 'signup' && (
                  <div className="space-y-1">
                    <label
                      htmlFor="account-nickname-input"
                      className="text-[11px] font-tech font-bold uppercase tracking-wider text-slate-300"
                    >
                      {t(language, 'account.nicknameLabel')}
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="account-nickname-input"
                        data-testid="account-nickname-input"
                        type="text"
                        autoComplete="username"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder={t(language, 'account.nicknamePlaceholder')}
                        className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none pl-9 pr-3 py-2 text-xs font-tech text-white"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label
                    htmlFor="account-email-input"
                    className="text-[11px] font-tech font-bold uppercase tracking-wider text-slate-300"
                  >
                    {t(language, 'account.emailLabel')}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="account-email-input"
                      data-testid="account-email-input"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t(language, 'account.emailPlaceholder')}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none pl-9 pr-3 py-2 text-xs font-tech text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="account-password-input"
                    className="text-[11px] font-tech font-bold uppercase tracking-wider text-slate-300"
                  >
                    {t(language, 'account.passwordLabel')}
                  </label>
                  <div className="relative">
                    <input
                      id="account-password-input"
                      data-testid="account-password-input"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t(language, 'account.passwordPlaceholder')}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none pl-3 pr-10 py-2 text-xs font-tech text-white"
                    />
                    <button
                      type="button"
                      data-testid="account-toggle-password-btn"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword
                          ? t(language, 'account.hidePassword')
                          : t(language, 'account.showPassword')
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  data-testid="account-submit-btn"
                  disabled={busy}
                  className="horror-btn horror-btn-primary w-full py-2.5 px-4 text-xs font-horror font-extrabold uppercase tracking-widest cursor-pointer"
                >
                  {busy
                    ? t(language, 'common.loading')
                    : tab === 'signup'
                    ? t(language, 'account.signUpBtn')
                    : t(language, 'account.loginBtn')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
