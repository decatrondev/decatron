import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { Alert, Button } from '../ds';

/** Barra informativa de «tu nivel no permite esto» (la versión leve: la página se sigue usando). */
export function PermissionNotice({ children }: { children: ReactNode }) {
    return <Alert tone="info">{children}</Alert>;
}

/** Pantalla completa de «no tienes acceso a esta sección», con salida al dashboard. */
export function AccessDenied({ title, message, backLabel, onBack }: { title: string; message: string; backLabel: string; onBack: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-16">
            <div className="bg-ds-danger/10 border border-ds-danger/30 rounded-lg p-8 max-w-md text-center">
                <Lock className="w-16 h-16 text-ds-danger mx-auto mb-4" />
                <h2 className="text-2xl font-black text-ds-danger mb-2">{title}</h2>
                <p className="text-ds-soft mb-6">{message}</p>
                <Button size="lg" onClick={onBack}>{backLabel}</Button>
            </div>
        </div>
    );
}

/** Texto centrado mientras carga una pantalla. */
export function LoadingText({ children }: { children: ReactNode }) {
    return <div className="text-center py-8 text-ds-soft">{children}</div>;
}
