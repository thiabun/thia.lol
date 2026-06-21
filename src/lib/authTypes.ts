export type AuthUser = {
  id: number;
  handle: string;
  email: string;
  role: string;
  status: string;
  displayName: string;
  avatarUrl: string | null;
};

export type AuthProfile = {
  displayName: string;
  bio: string;
  location: string;
  avatarUrl: string | null;
  bannerUrl?: string | null;
  profileAccent?: string | null;
  profileBackground?: string | null;
  profileTheme?: string | null;
  links: string[];
  traits: string[];
};

export type AuthSession = {
  user: AuthUser;
  profile: AuthProfile;
  csrfToken: string;
};

export type TwoFactorLoginChallenge = {
  twoFactorRequired: true;
  challengeId: string;
  expiresAt: string;
};

export type LoginResult = AuthSession | TwoFactorLoginChallenge;

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  handle: string;
  displayName: string;
};

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | undefined;
  profile: AuthProfile | undefined;
  csrfToken: string | undefined;
  login: (input: LoginInput) => Promise<LoginResult>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthSession>;
  clearSession: () => void;
  runWithAuth: <T>(
    task: (csrfToken: string) => Promise<T>,
    options?: { retryOnCsrf?: boolean },
  ) => Promise<T>;
};
