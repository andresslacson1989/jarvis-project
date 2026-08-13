const MAX_INERT_CONTENT_LENGTH = 100_000;

/**
 * Converts untrusted content to a bounded plain-text value.
 * React renders this return value as text; it is never interpreted as markup.
 */
export function toInertText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.slice(0, MAX_INERT_CONTENT_LENGTH);
}
