import { Suspense, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import ErrorBoundary from './ErrorBoundary';

interface SafeRouteProps {
    children: ReactNode;
    name?: string;
}

const LoadingFallback = () => (
    <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
);

export default function SafeRoute({ children, name }: SafeRouteProps) {
    return (
        <ErrorBoundary name={name}>
            <Suspense fallback={<LoadingFallback />}>
                {children}
            </Suspense>
        </ErrorBoundary>
    );
}
