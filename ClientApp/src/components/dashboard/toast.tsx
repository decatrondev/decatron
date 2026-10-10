import { useCallback, useEffect, useRef, useState } from 'react';
import { Toast } from '../ds';

export interface ToastState { message: string; type: 'success' | 'error' | 'info' }

/** Aviso emergente de las páginas del panel: `showToast(texto, tipo)` y `<ToastHost toast={toast} />` una vez en la página. */
export function useToast(ms = 3000) {
    const [toast, setToast] = useState<ToastState | null>(null);
    const timer = useRef<number | undefined>(undefined);
    const showToast = useCallback((message: string, type: ToastState['type'] = 'success') => {
        setToast({ message, type });
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setToast(null), ms);
    }, [ms]);
    useEffect(() => () => window.clearTimeout(timer.current), []);
    return { toast, showToast };
}

export function ToastHost({ toast }: { toast: ToastState | null }) {
    if (!toast) return null;
    const tone = toast.type === 'success' ? 'ok' : toast.type === 'error' ? 'danger' : 'info';
    return <div className="fixed top-4 right-4 z-50 max-w-sm"><Toast tone={tone}>{toast.message}</Toast></div>;
}
