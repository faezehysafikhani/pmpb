import { api, tokenStore } from '../api';

export interface BackendUser {
  id: string;
  tenantId: string;
  email: string | null;
  displayName: string;
  isActive: boolean;
  lastLoginAtUtc: string | null;
  roles: string[];
  username: string | null;
  phoneNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  isSystem: boolean;
}

export interface Session {
  user: BackendUser;
  permissions: string[];
}

export interface Captcha {
  captchaId: string;
  imageDataUrl: string;
}

export type LoginOutcome =
  | { kind: 'ok'; session: Session }
  | { kind: 'captcha'; message: string }       // the next attempt must include a solved CAPTCHA
  | { kind: 'failed'; message: string };

export async function requestCaptcha(): Promise<Captcha | null> {
  const result = await api.post<Captcha>('/api/identity/auth/captcha');
  return result.ok && result.value ? result.value : null;
}

export async function login(identifier: string, password: string, captcha?: { id: string; answer: string }): Promise<LoginOutcome> {
  const result = await api.post<{ accessToken: string; refreshToken: string; user: BackendUser }>('/api/identity/auth/login', {
    identifier,
    password,
    captchaId: captcha?.id,
    captchaAnswer: captcha?.answer
  });

  if (!result.ok || !result.value) {
    const error = result.error;
    return {
      kind: error?.code === 'unauthorized.captcha_required' ? 'captcha' : 'failed',
      message: error?.message || 'ورود انجام نشد.'
    };
  }

  tokenStore.set(result.value.accessToken, result.value.refreshToken);
  const session = await loadSession();
  return session ? { kind: 'ok', session } : { kind: 'failed', message: 'اطلاعات کاربر دریافت نشد.' };
}

/** The signed-in user and what they may do, or null when there is no (valid) session. */
export async function loadSession(): Promise<Session | null> {
  if (!tokenStore.access) return null;
  const result = await api.get<{ user: BackendUser; permissions: string[] }>('/api/identity/auth/me');
  return result.ok && result.value ? { user: result.value.user, permissions: result.value.permissions } : null;
}

export async function logout(): Promise<void> {
  const refreshToken = tokenStore.refresh;
  tokenStore.clear();
  if (refreshToken) await api.post('/api/identity/auth/logout', { refreshToken });
}
