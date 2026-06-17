type TestEnv = Record<string, string | undefined>;

export const smokeTestConfig = {
  baseURL: "https://thia.lol",
  auth: {
    accounts: [
      {
        email: "smoke1@thia.lol",
        password: "thia-smoke-test-2026",
      },
      {
        email: "smoke2@thia.lol",
        password: "thia-smoke-test-2026",
      },
      {
        email: "smoke3@thia.lol",
        password: "thia-smoke-test-2026",
      },
      {
        email: "smoke4@thia.lol",
        password: "thia-smoke-test-2026",
      },
    ],
  },
  followTargetHandle: "thia",
} as const;

export function shouldUseSmokeTestConfig(env: TestEnv = process.env) {
  return env.THIA_USE_TEST_CONFIG === "1" || env.PLAYWRIGHT_NO_WEBSERVER === "1";
}

export function applySmokeTestConfigToEnv(env: TestEnv = process.env) {
  if (!shouldUseSmokeTestConfig(env)) {
    return;
  }

  const configuredEnv = {
    THIA_BASE_URL: smokeTestConfig.baseURL,
    THIA_FOLLOW_TARGET_HANDLE: smokeTestConfig.followTargetHandle,
  };

  for (const [key, value] of Object.entries(configuredEnv)) {
    env[key] ??= value;
  }
}

export function getTestCredentialsFromConfig(
  env: TestEnv = process.env,
  accountIndex = 0,
) {
  if (env.THIA_TEST_EMAIL || env.THIA_TEST_PASSWORD) {
    return {
      email: env.THIA_TEST_EMAIL,
      password: env.THIA_TEST_PASSWORD,
    };
  }

  if (!shouldUseSmokeTestConfig(env)) {
    return {
      email: undefined,
      password: undefined,
    };
  }

  const accounts = smokeTestConfig.auth.accounts;
  const requestedIndex = Number.isFinite(accountIndex) ? Math.trunc(accountIndex) : 0;
  const index = Math.abs(requestedIndex) % accounts.length;
  const account = accounts[index];

  return {
    email: account.email,
    password: account.password,
  };
}
