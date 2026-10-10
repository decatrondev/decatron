import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import type { SettingsCtx } from './types';

/** Notificaciones emergentes de Configuración. */
export default function SettingsToasts({ s }: { s: SettingsCtx }) {
    const { toasts, setToasts } = s;
    return (
        <>
                    <div className="fixed bottom-4 right-4 z-[100] space-y-3 w-full max-w-xs">
                        {toasts.map((toast) => (
                            <div
                                key={toast.id}
                                className={`flex items-start gap-3 p-4 rounded-lg border ${toast.type === 'success'
                                    ? 'bg-ds-ok/10 border-ds-ok/30 '
                                    : 'bg-ds-danger/10 border-ds-danger/30 '
                                    } animate-fade-in-right`}
                            >
                                <div className={`flex-shrink-0 ${toast.type === 'success' ? 'text-ds-ok' : 'text-ds-danger'}`}>
                                    {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                                </div>
                                <p className={`flex-1 text-sm font-medium ${toast.type === 'success' ? 'text-ds-ok' : 'text-ds-danger'}`}>
                                    {toast.message}
                                </p>
                                <button
                                    onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                                    className="text-ds-soft hover:text-ds-text"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <style>{`
                        @keyframes fade-in-right {
                            from {
                                opacity: 0;
                                transform: translateX(100%);
                            }
                            to {
                                opacity: 1;
                                transform: translateX(0);
                            }
                        }
                        .animate-fade-in-right {
                            animation: fade-in-right 0.3s ease-out;
                        }
                    `}</style>
        </>
    );
}
