import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';
import { renderMarkdown } from './shared';

// Modal de normas — vuelve a ser modal (pedido del usuario 24-08-2026, habia
// pasado a vivir dentro de la tab Info en la reestructuracion previa de esta misma
// sesion). Mismo criterio de tamaño que MyTournamentModal.tsx para HD/2K/4K.

export default function RulesModal({
    channelName, editionSlug, shellItemName, onClose,
}: { channelName: string; editionSlug: string; shellItemName: string; onClose: () => void }) {
    const [rules, setRules] = useState<{ general: string; punishments: string } | null>(null);
    const [rulesTab, setRulesTab] = useState<'general' | 'punishments'>('general');

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get(`/public/tournament/${channelName}/${editionSlug}/rules`);
                setRules({ general: res.data.general, punishments: res.data.punishments });
            } catch (err) {
                console.error('Error cargando normas', err);
            }
        })();
    }, [channelName, editionSlug]);

    const tabBtn = (on: boolean) =>
        on ? { background: 'var(--t-ink)', color: 'var(--t-bg)' } : { background: 'var(--t-surface-raised)', color: 'var(--t-muted)' };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 4xl:p-8 z-50" onClick={onClose} role="dialog" aria-modal="true" aria-label="Normas">
            <div
                className="w-full max-w-2xl 4xl:max-w-3xl 5xl:max-w-4xl max-h-[85vh] overflow-y-auto"
                style={{ background: 'var(--t-surface)', color: 'var(--t-ink)', boxShadow: '0 0 0 1px var(--t-line)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 4xl:p-6 flex items-center justify-between sticky top-0 z-10" style={{ background: 'var(--t-surface)', borderBottom: '1px solid var(--t-line)' }}>
                    <h3 className="font-scoreboard font-black text-3xl 4xl:text-4xl leading-none">Normas</h3>
                    <button onClick={onClose} aria-label="Cerrar" style={{ color: 'var(--t-muted)' }}>
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="flex gap-1 p-4 4xl:p-6 pb-0">
                    <button onClick={() => setRulesTab('general')} className="px-3 py-1.5 font-scoreboard font-extrabold text-base" style={tabBtn(rulesTab === 'general')}>
                        Generales
                    </button>
                    <button onClick={() => setRulesTab('punishments')} className="px-3 py-1.5 font-scoreboard font-extrabold text-base" style={tabBtn(rulesTab === 'punishments')}>
                        {shellItemName}s
                    </button>
                </div>
                {!rules ? (
                    <p className="p-5 4xl:p-6" style={{ color: 'var(--t-muted)' }}>Cargando normas…</p>
                ) : (
                    <div
                        className="p-5 4xl:p-6 text-base 4xl:text-lg leading-relaxed max-w-[70ch] [&_h2]:font-scoreboard [&_h2]:font-black [&_h2]:text-2xl [&_h2]:mt-4 [&_h2]:mb-1 [&_h3]:font-bold [&_h3]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:opacity-90"
                        dangerouslySetInnerHTML={{
                            __html:
                                renderMarkdown(rulesTab === 'general' ? rules.general : rules.punishments) ||
                                '<p style="color:var(--t-muted)">El organizador todavía no publicó estas normas.</p>',
                        }}
                    />
                )}
            </div>
        </div>
    );
}
