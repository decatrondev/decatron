import { Navigate, useSearchParams, useLocation } from 'react-router-dom';

function parseAuthProvider(token: string | null): string {
  if (!token) return '';
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(window.atob(base64));
    return claims.AuthProvider || 'twitch';
  } catch { return 'twitch'; }
}

// Routes that Discord-only users CAN access
const DISCORD_ALLOWED_EXACT = ['/dashboard', '/settings'];
const DISCORD_ALLOWED_PREFIX = ['/me', '/dashboard/docs'];

function isDiscordAllowed(pathname: string): boolean {
  if (DISCORD_ALLOWED_EXACT.includes(pathname)) return true;
  return DISCORD_ALLOWED_PREFIX.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Allow through if there's an exchange code (auth callback in progress)
  const hasExchangeCode = searchParams.has('code');

  if (!token && !hasExchangeCode) {
    return <Navigate to="/login" replace />;
  }

  // Discord-only users: redirect to /me if accessing streamer routes
  const authProvider = parseAuthProvider(token);
  if (authProvider === 'discord' && !isDiscordAllowed(location.pathname)) {
    return <Navigate to="/me" replace />;
  }

  return <>{children}</>;
}
