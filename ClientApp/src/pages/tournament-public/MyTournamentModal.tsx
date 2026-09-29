import { useEffect } from 'react';
import { X } from 'lucide-react';
import MyTournamentPanel from './MyTournamentPanel';

// "Mi inscripción" sobre la pagina del torneo (rediseño de transmision, R2): panel
// lateral en PC y pantalla completa en celular, con los colores del torneo (hereda
// las variables --t-* de la pagina). El contenido vive en MyTournamentPanel.

export default function MyTournamentModal({ channelName, editionSlug, onClose }: { channelName: string; editionSlug: string; onClose: () => void }) {
    // Esc cierra y la pagina de atras no se desplaza mientras esta abierto.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Mi inscripción">
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm motion-safe:animate-[fadeIn_150ms_ease-out]" onClick={onClose} />
            <aside
                className="relative w-full sm:max-w-[34rem] 4xl:max-w-[40rem] h-full overflow-y-auto motion-safe:animate-[slideInRight_220ms_ease-out]"
                style={{ background: 'var(--t-bg)', color: 'var(--t-ink)', boxShadow: '-1px 0 0 var(--t-line)' }}
            >
                <div
                    className="sticky top-0 z-10 px-5 4xl:px-7 py-4 flex items-center justify-between backdrop-blur-md"
                    style={{ background: 'color-mix(in srgb, var(--t-bg) 90%, transparent)', borderBottom: '1px solid var(--t-line)' }}
                >
                    <h2 className="font-scoreboard font-black text-3xl leading-none">Mi inscripción</h2>
                    <button onClick={onClose} aria-label="Cerrar" className="p-1" style={{ color: 'var(--t-muted)' }}>
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="px-5 4xl:px-7 py-6">
                    <MyTournamentPanel channelName={channelName} editionSlug={editionSlug} />
                </div>
            </aside>
        </div>
    );
}
