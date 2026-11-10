// Keep return navigation local; preserve the original query and fragment verbatim.
export function localLoginReturn(value: string | null | undefined): string | null {
  if (!value || value.length > 8192 || /[\\\x00-\x1f\x7f]/.test(value)) return null;
  const path = value.startsWith('/') ? value : `/${value}`;
  let route: string;
  try { route = decodeURIComponent(path.split(/[?#]/, 1)[0]); } catch { return null; }
  if (/[%\\:\x00-\x1f\x7f]/.test(route) || route.startsWith('//')
      || route.split('/').some(part => part === '.' || part === '..')
      || /^\/login(?:\/|$)/i.test(route) || /^\/api\//i.test(route)) return null;
  return path;
}

export function currentLoginReturn(): string {
  return localLoginReturn(window.location.pathname + window.location.search + window.location.hash) ?? '/dashboard';
}

export function loginUrlFor(value: string): string {
  return `/login?redirect=${encodeURIComponent(localLoginReturn(value) ?? '/dashboard')}`;
}
