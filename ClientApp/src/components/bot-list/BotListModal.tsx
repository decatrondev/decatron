import { useEffect } from 'react';
import { X } from 'lucide-react';
import BotListManager from './BotListManager';

/** La lista de bots en una ventana, para abrirla desde otras herramientas sin salir de ellas */
export default function BotListModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ds-input/60"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Lista de bots"
        >
            <div
                className="panel-scale w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-ds-bg border border-ds-border p-6"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4 mb-4">
                    <h2 className="text-2xl font-black text-ds-text">Lista de bots</h2>
                    <button onClick={onClose} className="ds-btn ds-btn--ghost ds-icon-btn" aria-label="Cerrar">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <BotListManager compact />
            </div>
        </div>
    );
}
