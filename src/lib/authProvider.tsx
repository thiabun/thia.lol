import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiClientError, apiGet, apiPost } from "./apiClient";
import { AuthContext } from "./authContext";
import type {
  AuthContextValue,
  AuthSession,
  AuthStatus,
  LoginInput,
  RegisterInput,
} from "./authTypes";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | undefined>();
  const [status, setStatus] = useState<AuthStatus>("loading");

  const applySession = useCallback((nextSession: AuthSession) => {
    setSession(nextSession);
    setStatus("authenticated");
  }, []);

  useEffect(() => {
    let active = true;

    apiGet<AuthSession>("/auth/me")
      .then((nextSession) => {
        if (active) {
          applySession(nextSession);
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setSession(undefined);
        setStatus("anonymous");

        if (error instanceof ApiClientError && error.status === 401) {
          return;
        }
      });

    return () => {
      active = false;
    };
  }, [applySession]);

  const login = useCallback(
    async (input: LoginInput) => {
      applySession(await apiPost<AuthSession>("/auth/login", input));
    },
    [applySession],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      applySession(await apiPost<AuthSession>("/auth/register", input));
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await apiPost<{ loggedOut: boolean }>("/auth/logout", {}, session?.csrfToken);
    } finally {
      setSession(undefined);
      setStatus("anonymous");
    }
  }, [session?.csrfToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user,
      profile: session?.profile,
      csrfToken: session?.csrfToken,
      login,
      register,
      logout,
    }),
    [login, logout, register, session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
