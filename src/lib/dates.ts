export function parseApiTimestamp(value: string): Date {
  const trimmed = value.trim();
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T");

  return new Date(hasTimezone ? normalized : `${normalized}Z`);
}

export function formatRelativeTime(value: string): string {
  const parsed = parseApiTimestamp(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const seconds = Math.round((parsed.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(seconds);

  if (absSeconds < 60) {
    return "now";
  }

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  const [unit, divisor] =
    units.find(([, unitSeconds]) => absSeconds >= unitSeconds) ?? units.at(-1)!;

  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
    Math.round(seconds / divisor),
    unit,
  );
}

export function formatMonthYear(value: string): string {
  const parsed = parseApiTimestamp(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function formatShortDate(value: string): string {
  const parsed = parseApiTimestamp(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}
