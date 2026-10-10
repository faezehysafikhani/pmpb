import * as React from 'react';
import { login as apiLogin, loadSession, logout as apiLogout, requestCaptcha } from '../services/backend/auth';
import type { Captcha, Session } from '../services/backend/auth';
import { sessionEvents } from '../services/api';

/**
 * Who is signed in. The backend decides everything about a session (tokens, permissions, CAPTCHA after a failed
 * attempt); this only keeps the answer and offers `can()` for showing or hiding controls - never for enforcing anything.
 */
interface AuthState {
  session: Session | null;
  /** True until the stored session (if any) has been checked once. */
  restoring: boolean;
  captcha: Captcha | null;
  signIn: (identifier: string, password: string, captchaAnswer?: string) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
  refreshCaptcha: () => Promise<void>;
  can: (permission: string) => boolean;
}

const AuthContext = React.createContext<AuthState>(null as unknown as AuthState);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = React.useState<Session | null>(null);
  const [restoring, setRestoring] = React.useState(true);
  const [captcha, setCaptcha] = React.useState<Captcha | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    loadSession().then(restored => {
      if (!cancelled) {
        setSession(restored);
        setRestoring(false);
      }
    });
    const expired = () => setSession(null);
    sessionEvents.addEventListener('expired', expired);
    return () => {
      cancelled = true;
      sessionEvents.removeEventListener('expired', expired);
    };
  }, []);

  const refreshCaptcha = React.useCallback(async () => setCaptcha(await requestCaptcha()), []);

  const signIn = React.useCallback(async (identifier: string, password: string, captchaAnswer?: string) => {
    const outcome = await apiLogin(identifier, password, captcha && captchaAnswer ? { id: captcha.captchaId, answer: captchaAnswer } : undefined);
    if (outcome.kind === 'ok') {
      setCaptcha(null);
      setSession(outcome.session);
      return { ok: true };
    }
    // After a failed attempt the backend wants a solved CAPTCHA for the next one (and a fresh image each time).
    if (outcome.kind === 'captcha' || captcha) await refreshCaptcha();
    return { ok: false, message: outcome.message };
  }, [captcha, refreshCaptcha]);

  const signOut = React.useCallback(async () => {
    await apiLogout();
    setSession(null);
    setCaptcha(null);
  }, []);

  const can = React.useCallback((permission: string) => !!session?.permissions.includes(permission), [session]);

  const value = React.useMemo(
    () => ({ session, restoring, captcha, signIn, signOut, refreshCaptcha, can }),
    [session, restoring, captcha, signIn, signOut, refreshCaptcha, can]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => React.useContext(AuthContext);
