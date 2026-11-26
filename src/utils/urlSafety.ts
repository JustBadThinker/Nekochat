/**
 * Pure URL safety sanitizer (zero React Native runtime dependency so Node unit tests can import directly).
 */

export function sanitizeExternalHttpUrl(rawUrl?: string | null): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}
