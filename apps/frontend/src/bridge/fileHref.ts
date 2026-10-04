/**
 * The backend answers with relative `/api/...` paths for files it serves; the
 * mock hands back `blob:` URLs it made in the page. Anything already absolute is
 * left alone, and a relative path is hung off the API base.
 */
export function resolveFileHref(url: string): string {
  if (/^(https?:|blob:|data:)/.test(url)) return url
  const base = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'
  return `${base}${url}`
}
