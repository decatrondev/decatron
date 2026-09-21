import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Check, X, ShoppingBag } from 'lucide-react';
import api from '../../../services/api';
import TcgPageHeader from './TcgPageHeader';
import PackOpeningOverlay, { type PulledCard } from './PackOpeningOverlay';

// Sobres sin abrir del jugador — ver .dev/plans/TCG_CARTAS_COLECCIONABLES_PLAN.md
// seccion 4. Se compran en /me/tcg/shop y se acumulan acá hasta que se abren.

const RARITY_STYLES: Record<string, string> = {
    N: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    R: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    SR: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    SSR: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
    UR: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    LR: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    MR: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
};

function tierKeyFromName(name: string): string {
    return name.trim().toLowerCase();
}

interface PackStack {
    sobreTierId: number;
    name: string;
    cardCount: number;
    guaranteedFloorRarity: string;
    /** Reclamado gratis: sus cartas valen 1 y no tiene piso de rareza garantizado. */
    isFree: boolean;
    count: number;
}

// Un mismo tier puede tener stack pago y stack gratis a la vez, y no dan lo mismo al
// abrirlos — la key y el endpoint tienen que distinguirlos.
const stackKey = (p: PackStack) => `${p.sobreTierId}-${p.isFree}`;

export default function TcgOpen() {
    const navigate = useNavigate();
    const [packs, setPacks] = useState<PackStack[]>([]);
    const [loading, setLoading] = useState(true);
    const [openingPack, setOpeningPack] = useState<PackStack | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 5000);
        return () => clearTimeout(t);
    }, [toast]);

    const load = () =>
        api.get('/tcg/packs')
            .then((res) => setPacks(Array.isArray(res.data) ? res.data : []))
            .catch((err) => console.error('Error loading packs:', err));

    useEffect(() => {
        load().finally(() => setLoading(false));
    }, []);

    const handleOpen = async (pack: PackStack): Promise<PulledCard[]> => {
        const res = await api.post(`/tcg/sobres/${pack.sobreTierId}/open?isFree=${pack.isFree}`);
        await load();
        return res.data.cards;
    };

    const totalUnopened = packs.reduce((sum, p) => sum + p.count, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 max-w-sm flex items-start gap-2 px-4 py-3 rounded-xl shadow-xl border font-semibold ${toast.type === 'success' ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'bg-red-500/20 border-red-500/40 text-red-300'}`}>
                    {toast.type === 'success' ? <Check className="w-5 h-5 shrink-0" /> : <X className="w-5 h-5 shrink-0" />}
                    <p>{toast.text}</p>
                </div>
            )}

            <TcgPageHeader
                title="Abrir sobres"
                subtitle={totalUnopened > 0 ? `Tenés ${totalUnopened} sobre${totalUnopened === 1 ? '' : 's'} sin abrir` : undefined}
                right={
                    <button
                        onClick={() => navigate('/me/tcg/shop')}
                        className="flex items-center gap-2 bg-[#1a1b1e] border border-[#374151] hover:border-[#2563eb] text-white px-4 py-2 rounded-xl transition-colors"
                    >
                        <ShoppingBag className="w-4 h-4" />
                        Comprar más
                    </button>
                }
            />

            {packs.length === 0 ? (
                <div className="bg-[#1a1b1e] border border-[#374151] rounded-2xl p-10 text-center">
                    <p className="text-[#94a3b8]">No tenés sobres sin abrir.</p>
                    <button
                        onClick={() => navigate('/me/tcg/shop')}
                        className="mt-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold px-6 py-2.5 rounded-xl transition-colors"
                    >
                        Ir a la tienda
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {packs.map((p) => (
                        <button
                            key={stackKey(p)}
                            onClick={() => setOpeningPack(p)}
                            disabled={openingPack != null}
                            className={`group relative bg-[#1a1b1e] border rounded-2xl p-4 flex flex-col gap-2 text-center transition-colors disabled:opacity-50 ${p.isFree ? 'border-green-500/40 hover:border-green-500' : 'border-[#374151] hover:border-[#2563eb]'}`}
                        >
                            <span className={`absolute top-3 right-3 min-w-[1.75rem] px-2 py-0.5 rounded-full text-white text-xs font-bold tabular-nums ${p.isFree ? 'bg-green-600' : 'bg-[#2563eb]'}`}>
                                {p.count}
                            </span>
                            {p.isFree && (
                                <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/40 text-green-300 text-[10px] font-bold tracking-wide">
                                    GRATIS
                                </span>
                            )}
                            <img
                                src={`/tcg-packs/${tierKeyFromName(p.name)}_closed.webp`}
                                alt={p.name}
                                className="w-full aspect-square object-contain transition-transform group-hover:scale-105"
                            />
                            <span className="font-bold text-white">{p.name}</span>
                            <span className="text-xs text-[#94a3b8]">{p.cardCount} cartas</span>
                            {p.isFree ? (
                                <span className="inline-block w-fit mx-auto text-xs font-bold px-2 py-1 rounded-full border bg-green-500/10 text-green-300 border-green-500/30">
                                    Sin piso · valen 1
                                </span>
                            ) : (
                                <span className={`inline-block w-fit mx-auto text-xs font-bold px-2 py-1 rounded-full border ${RARITY_STYLES[p.guaranteedFloorRarity] || ''}`}>
                                    Piso: {p.guaranteedFloorRarity}+
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {openingPack && (
                <PackOpeningOverlay
                    tierKey={tierKeyFromName(openingPack.name)}
                    tierName={openingPack.name}
                    onOpen={() => handleOpen(openingPack)}
                    onClose={() => setOpeningPack(null)}
                    onError={(msg) => setToast({ type: 'error', text: msg })}
                    onViewCollection={() => navigate('/me/tcg/collection')}
                />
            )}
        </div>
    );
}
