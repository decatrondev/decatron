import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

type Category = 'default' | 'custom' | 'microcommands' | 'scripting';

interface CommandItem {
    category: Category;
    name: string;
    description: string;
    restriction?: string;
}

const CATEGORY_LABELS: Record<Category, string> = {
    default: 'sistema',
    custom: 'custom',
    microcommands: 'micro',
    scripting: 'script',
};

const CATEGORY_ORDER: Category[] = ['default', 'custom', 'microcommands', 'scripting'];

const RESTRICTION_LABELS: Record<string, string> = {
    mod: 'mods',
    vip: 'vips',
    sub: 'subs',
};

export default function PublicCommandsPage() {
    const { channelName } = useParams<{ channelName: string }>();
    const [items, setItems] = useState<CommandItem[]>([]);
    const [displayName, setDisplayName] = useState('');
    const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get(`/public/commands/${channelName}`);
                if (res.data?.success) {
                    setItems(res.data.items || []);
                    setDisplayName(res.data.displayName || res.data.channel || channelName || '');
                    setStatus('ok');
                } else {
                    setStatus('error');
                }
            } catch (err: any) {
                if (err?.response?.status === 404) {
                    setStatus('notfound');
                } else {
                    console.error('Error cargando comandos públicos', err);
                    setStatus('error');
                }
            }
        })();
    }, [channelName]);

    const grouped = CATEGORY_ORDER
        .map(category => ({ category, list: items.filter(i => i.category === category) }))
        .filter(g => g.list.length > 0);

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-[#d4d4d8] font-mono relative overflow-x-hidden">
            {/* Textura de fondo: scanlines + grid sutil */}
            <div
                className="pointer-events-none fixed inset-0 opacity-[0.04]"
                style={{
                    backgroundImage:
                        'linear-gradient(#39ff14 1px, transparent 1px), linear-gradient(90deg, #39ff14 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}
            />
            <div
                className="pointer-events-none fixed inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, #fff 0px, transparent 1px, transparent 2px)',
                }}
            />

            <div className="relative max-w-3xl mx-auto px-5 py-14 sm:py-20">
                {/* Prompt header */}
                <div className="mb-10 animate-[fadeInUp_0.5s_ease-out]">
                    <p className="text-[#39ff14] text-sm mb-2">
                        <span className="opacity-60">guest@decatron</span>
                        <span className="opacity-40">:</span>
                        <span className="opacity-90">~</span>
                        <span className="opacity-40">$</span>{' '}
                        <span className="text-[#d4d4d8]">./comandos --canal={channelName}</span>
                        <span className="inline-block w-2 h-4 bg-[#39ff14] ml-1 align-middle animate-[blink_1s_step-end_infinite]" />
                    </p>
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                        {displayName || channelName}
                        <span className="text-[#39ff14]">_</span>
                    </h1>
                    <p className="text-sm text-[#71717a] mt-2">
                        {status === 'ok' && `${items.length} comando${items.length === 1 ? '' : 's'} disponible${items.length === 1 ? '' : 's'} en este canal`}
                    </p>
                </div>

                {status === 'loading' && (
                    <p className="text-[#71717a] text-sm animate-pulse">cargando comandos...</p>
                )}

                {status === 'notfound' && (
                    <div className="border border-[#3f3f46] rounded-lg p-6 bg-[#111114]">
                        <p className="text-red-400 text-sm">error: canal "{channelName}" no encontrado</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="border border-[#3f3f46] rounded-lg p-6 bg-[#111114]">
                        <p className="text-red-400 text-sm">error: no se pudo cargar la lista de comandos</p>
                    </div>
                )}

                {status === 'ok' && items.length === 0 && (
                    <div className="border border-[#3f3f46] rounded-lg p-6 bg-[#111114]">
                        <p className="text-[#71717a] text-sm"># este canal todavía no tiene comandos públicos</p>
                    </div>
                )}

                {status === 'ok' && grouped.map((group, gi) => (
                    <div
                        key={group.category}
                        className="mb-8 animate-[fadeInUp_0.5s_ease-out_backwards]"
                        style={{ animationDelay: `${100 + gi * 80}ms` }}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-[#39ff14] text-xs">#</span>
                            <span className="text-xs uppercase tracking-widest text-[#a1a1aa] font-bold">
                                {CATEGORY_LABELS[group.category]}
                            </span>
                            <span className="text-[#3f3f46] text-xs">({group.list.length})</span>
                            <span className="flex-1 border-t border-dashed border-[#27272a] ml-2" />
                        </div>

                        <div className="border-l-2 border-[#27272a] pl-4 space-y-1">
                            {group.list.map((item, i) => (
                                <div
                                    key={`${item.category}-${item.name}-${i}`}
                                    className="group flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5 hover:bg-[#111114] hover:pl-2 -ml-2 pr-2 rounded transition-all"
                                >
                                    <span className="text-white font-bold text-sm">
                                        {item.name}
                                    </span>
                                    {item.restriction && RESTRICTION_LABELS[item.restriction] && (
                                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#39ff14]/10 text-[#39ff14] border border-[#39ff14]/20">
                                            {RESTRICTION_LABELS[item.restriction]}
                                        </span>
                                    )}
                                    {item.description && (
                                        <span className="text-[#71717a] text-sm">
                                            {item.description}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                <div className="mt-16 pt-6 border-t border-[#27272a] text-xs text-[#3f3f46] flex items-center justify-between flex-wrap gap-2">
                    <span>generado por decatron bot</span>
                    <span className="text-[#39ff14]/60">twitch.decatron.net</span>
                </div>
            </div>

            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
            `}</style>
        </div>
    );
}
