import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import { File, Paths } from 'expo-file-system';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError, loadSession, setToken, setUnauthenticatedHandler, type Envelope } from './api';
import { configureFormatting } from './format';
import { getPushToken, registerForPush, resetPushRegistration } from './push';
import { queryPersister } from './queryCache';
import { toast } from '@/components/toast';
import type { User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string, company?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Whether the signed-in user's role has an ability (same matrix as the API's `can:` checks). */
  can: (ability: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

/** Last known profile, so opening the app without signal doesn't sign the manager out. */
const profileFile = new File(Paths.document, 'profile.json');

function cacheProfile(u: User | null) {
  try {
    if (u) profileFile.write(JSON.stringify(u));
    else if (profileFile.exists) profileFile.delete();
  } catch {
    /* best effort */
  }
}

function cachedProfile(): User | null {
  try {
    return profileFile.exists ? (JSON.parse(profileFile.textSync()) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((u: User | null) => {
    setUser(u);
    if (u?.tenant) configureFormatting({ currency: u.tenant.currency, timezone: u.tenant.timezone });
  }, []);

  const clear = useCallback(() => {
    apply(null);
    cacheProfile(null);
    qc.clear();
    void queryPersister.removeClient(); // never show this user's saved screens to the next one
  }, [apply, qc]);

  const refresh = useCallback(async () => {
    const res = await api.get<Envelope<{ user: User }>>('/auth/me');
    apply(res.data.user);
    cacheProfile(res.data.user);
  }, [apply]);

  useEffect(() => {
    setUnauthenticatedHandler((message) => {
      clear();
      // Plan no longer includes the app, or the session expired: say why on the sign-in screen.
      if (message && message !== 'Unauthenticated.') toast.error(message);
    });
    (async () => {
      const session = await loadSession();
      if (session.token) {
        // Open straight away with the saved profile; the server check runs in the background.
        const saved = cachedProfile();
        if (saved) {
          apply(saved);
          setLoading(false);
          refresh()
            .then(registerForPush)
            .catch(() => {
              // 401 has already signed out; offline: keep the saved profile, retry when back.
              const sub = Network.addNetworkStateListener((s) => {
                if (!s.isConnected) return;
                sub.remove();
                refresh().then(registerForPush).catch(() => undefined);
              });
            });
          return;
        }
        try {
          await refresh();
          registerForPush();
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 401)) {
            const sub = Network.addNetworkStateListener((s) => {
              if (!s.isConnected) return;
              sub.remove();
              refresh().then(registerForPush).catch(() => undefined);
            });
          }
        }
      }
      setLoading(false);
    })();
  }, [apply, clear, refresh]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      refresh,
      can: (ability) => !!user?.abilities.includes(ability),
      async login(login, password, company) {
        const res = await api.post<Envelope<{ token: string; user: User }>>('/auth/token', {
          login: login.trim(),
          password,
          company: company?.trim() || undefined,
          app: 'manager',
          device_name: `Servon Manager · ${Device.manufacturer ?? ''} ${Device.modelName ?? 'Phone'}`.trim().slice(0, 100),
        });
        await setToken(res.data.token);
        apply(res.data.user);
        cacheProfile(res.data.user);
        registerForPush();
      },
      async logout() {
        try {
          await api.post('/auth/logout', { device_token: getPushToken() });
          resetPushRegistration();
        } catch {
          /* already signed out on the server */
        }
        await setToken(null);
        clear();
      },
    }),
    [user, loading, refresh, apply, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
