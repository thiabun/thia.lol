export function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

export function formatCountWithUnit(count: number, singular: string): string {
  return `${count.toLocaleString()} ${pluralize(count, singular)}`;
}
