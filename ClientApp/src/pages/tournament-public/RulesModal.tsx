import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';
import { renderMarkdown, EmptyState } from './shared';

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

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 4xl:p-8 z-50" onClick={onClose}>
            <div
                className="bg-[#0F1729] border border-[#232C42] rounded-xl w-full max-w-2xl 4xl:max-w-3xl 5xl:max-w-4xl max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 4xl:p-6 border-b border-[#232C42] flex items-center justify-between sticky top-0 bg-[#0F1729] z-10">
                    <h3 className="font-display font-bold text-[#EDF0F7] text-lg 4xl:text-xl">Normas</h3>
                    <button onClick={onClose} className="text-[#7C8AA6] hover:text-[#EDF0F7]">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex gap-1.5 p-4 4xl:p-6 pb-0">
                    <button onClick={() => setRulesTab('general')}
                        className={`font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded ${rulesTab === 'general' ? 'bg-[#3ED6C4] text-[#0B1120]' : 'bg-[#131B2E] text-[#7C8AA6]'}`}>
                        Generales
                    </button>
                    <button onClick={() => setRulesTab('punishments')}
                        className={`font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded ${rulesTab === 'punishments' ? 'bg-[#3ED6C4] text-[#0B1120]' : 'bg-[#131B2E] text-[#7C8AA6]'}`}>
                        {shellItemName}s
                    </button>
                </div>
                {!rules ? (
                    <div className="p-5 4xl:p-6"><EmptyState text="Cargando normas..." /></div>
                ) : (
                    <div
                        className="p-5 4xl:p-6 text-sm 4xl:text-base text-[#EDF0F7] leading-relaxed [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-lg [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:font-bold [&_h3]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:text-[#B8C1D6]"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(rulesTab === 'general' ? rules.general : rules.punishments) || '<p class="text-[#7C8AA6]">Sin normas cargadas todavía.</p>' }}
                    />
                )}
            </div>
        </div>
    );
}
