import { Navigate, useSearchParams } from 'react-router-dom';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  const [searchParams] = useSearchParams();

  // Allow through if there's an exchange code (auth callback in progress)
  const hasExchangeCode = searchParams.has('code');

  if (!token && !hasExchangeCode) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
