import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    addToast: (message: string, type?: ToastType) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => removeToast(id), 3000); // Auto-dismiss
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg border-l-4 transition-all animate-slide-in-right min-w-[300px] max-w-md bg-ds-surface text-ds-text ${
                            toast.type === 'success' ? 'border-ds-ok/40' :
                            toast.type === 'error' ? 'border-ds-danger/40' :
                            toast.type === 'warning' ? 'border-ds-warn/40' :
                            'border-ds-accent'
                        }`}
                    >
                        {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-ds-ok" />}
                        {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-ds-danger" />}
                        {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-ds-warn" />}
                        {toast.type === 'info' && <Info className="w-5 h-5 text-ds-accent-text" />}
                        
                        <p className="text-sm font-medium flex-1">{toast.message}</p>
                        
                        <button 
                            onClick={() => removeToast(toast.id)}
                            className="p-1 hover:bg-ds-bg rounded-full text-ds-soft hover:text-ds-soft transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
