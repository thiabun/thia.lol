export function distinctSecondaryText(
  primary: string | null | undefined,
  secondary: string | null | undefined,
): string | undefined {
  const trimmed = secondary?.replace(/\s+/gu, " ").trim();

  if (!trimmed) {
    return undefined;
  }

  return normalizeDisplayText(primary) === normalizeDisplayText(trimmed)
    ? undefined
    : trimmed;
}

export function distinctContextText(
  candidate: string | null | undefined,
  ...context: Array<string | null | undefined>
): string | undefined {
  const trimmed = candidate?.replace(/\s+/gu, " ").trim();

  if (!trimmed) {
    return undefined;
  }

  const normalized = normalizeDisplayText(trimmed).replace(/^[@/]/u, "");
  const duplicatesContext = context.some(
    (value) =>
      normalizeDisplayText(value).replace(/^[@/]/u, "") === normalized,
  );

  return duplicatesContext ? undefined : trimmed;
}

function normalizeDisplayText(value: string | null | undefined): string {
  return (
    value
      ?.replace(/\s+/gu, " ")
      .trim()
      .replace(/[.!?]+$/u, "")
      .toLocaleLowerCase() ?? ""
  );
}
