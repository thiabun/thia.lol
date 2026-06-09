import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ApiClientError,
  apiGet,
  apiPost,
  authSessionExpiredEventName,
} from "./apiClient";
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

  const clearSession = useCallback(() => {
    setSession(undefined);
    setStatus("anonymous");
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const nextSession = await apiGet<AuthSession>("/auth/me");
      applySession(nextSession);
      return nextSession;
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        clearSession();
      }

      throw error;
    }
  }, [applySession, clearSession]);

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

        clearSession();

        if (error instanceof ApiClientError && error.status === 401) {
          return;
        }
      });

    return () => {
      active = false;
    };
  }, [applySession, clearSession]);

  useEffect(() => {
    window.addEventListener(authSessionExpiredEventName, clearSession);

    return () => {
      window.removeEventListener(authSessionExpiredEventName, clearSession);
    };
  }, [clearSession]);

  const login = useCallback(
    async (input: LoginInput) => {
      await apiPost<AuthSession>("/auth/login", input);

      try {
        await refreshSession();
      } catch (error) {
        clearSession();
        throw new Error(
          error instanceof ApiClientError && error.status === 401
            ? "Login did not persist. Use https://thia.lol and allow cookies, then try again."
            : "Login could not be verified.",
          { cause: error },
        );
      }
    },
    [clearSession, refreshSession],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      await apiPost<AuthSession>("/auth/register", input);

      try {
        await refreshSession();
      } catch (error) {
        clearSession();
        throw new Error(
          error instanceof ApiClientError && error.status === 401
            ? "Registration succeeded, but the login session did not persist. Use https://thia.lol and allow cookies, then log in."
            : "Registration session could not be verified.",
          { cause: error },
        );
      }
    },
    [clearSession, refreshSession],
  );

  const logout = useCallback(async () => {
    try {
      await apiPost<{ loggedOut: boolean }>("/auth/logout", {}, session?.csrfToken);
    } finally {
      clearSession();
    }
  }, [clearSession, session?.csrfToken]);

  const runWithAuth = useCallback(
    async <T,>(
      task: (csrfToken: string) => Promise<T>,
      options: { retryOnCsrf?: boolean } = {},
    ): Promise<T> => {
      if (!session?.csrfToken) {
        clearSession();
        throw new Error("Log in to continue.");
      }

      try {
        return await task(session.csrfToken);
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) {
          clearSession();
          throw new Error("Your session expired. Log in again.", { cause: error });
        }

        if (
          options.retryOnCsrf === true &&
          error instanceof ApiClientError &&
          error.status === 403 &&
          error.message.toLowerCase().includes("csrf")
        ) {
          const refreshed = await refreshSession();
          return task(refreshed.csrfToken);
        }

        throw error;
      }
    },
    [clearSession, refreshSession, session],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user,
      profile: session?.profile,
      csrfToken: session?.csrfToken,
      login,
      register,
      logout,
      refreshSession,
      clearSession,
      runWithAuth,
    }),
    [
      clearSession,
      login,
      logout,
      refreshSession,
      register,
      runWithAuth,
      session,
      status,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
