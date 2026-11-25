/**
 * Public client-side Cloud Auth & Save configuration for DrizzyCraft: Setor 09.
 * Safe to commit to GitHub Pages: ONLY public anon/client keys belong here.
 * NEVER place service_role or admin secrets in this file.
 *
 * To activate Global Cloud Save + Google Sign-In on GitHub Pages:
 * 1. Create a free Supabase project (https://supabase.com) OR Firebase project (https://console.firebase.google.com).
 * 2. Apply `supabase_schema.sql` (or `firestore.rules`) for strict per-user RLS/Security Rules.
 * 3. Enable Email/Password & Google OAuth and add `pedrinfnf.github.io` + `localhost` to Authorized Domains.
 * 4. Fill in `supabaseUrl` + `supabaseAnonKey` (or `firebaseApiKey` + `firebaseProjectId` + `firebaseAuthDomain`) below.
 */

export type CloudProviderKind = 'supabase' | 'firebase' | 'none';

export interface CloudConfig {
  provider: CloudProviderKind;
  authorizedDomain: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  firebaseApiKey: string;
  firebaseAuthDomain: string;
  firebaseProjectId: string;
}

export const CLOUD_CONFIG: CloudConfig = {
  provider: 'none',
  authorizedDomain: 'pedrinfnf.github.io',
  supabaseUrl: '',
  supabaseAnonKey: '',
  firebaseApiKey: '',
  firebaseAuthDomain: '',
  firebaseProjectId: '',
};

export function isCloudConfigured(cfg: CloudConfig = CLOUD_CONFIG): boolean {
  if (cfg.provider === 'supabase') {
    return cfg.supabaseUrl.trim().startsWith('https://') && cfg.supabaseAnonKey.trim().length > 20;
  }
  if (cfg.provider === 'firebase') {
    return cfg.firebaseApiKey.trim().length > 10 && cfg.firebaseProjectId.trim().length > 2;
  }
  return false;
}
