import bcrypt from "bcryptjs";

const passwordHashCost = 10;
const dummyPasswordHash =
  "$2b$10$TwH3M0FcCMHMY8Jvl6FfR.jSUGkYmtfyLeJBfawYLxhuBjXezpQP6";

export async function hashPhpPassword(password: string): Promise<string> {
  const hash = await bcrypt.hash(password, passwordHashCost);

  return hash.replace(/^\$2[ab]\$/u, "$2y$");
}

export async function verifyPhpPassword(password: string, hash: string): Promise<boolean> {
  const normalizedHash = hash.replace(/^\$2y\$/u, "$2b$");

  return bcrypt.compare(password, normalizedHash);
}

export function verifyPhpPasswordOrDummy(
  password: string,
  hash: string | null | undefined,
): Promise<boolean> {
  return verifyPhpPassword(
    password,
    typeof hash === "string" ? hash : dummyPasswordHash,
  );
}
