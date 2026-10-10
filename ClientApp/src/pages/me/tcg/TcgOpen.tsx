import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Check, X, ShoppingBag } from 'lucide-react';
import api from '../../../services/api';
import TcgPageHeader from './TcgPageHeader';
import PackOpeningOverlay, { type PulledCard } from './PackOpeningOverlay';

// Sobres sin abrir del jugador — ver .dev/plans/TCG_CARTAS_COLECCIONABLES_PLAN.md
// seccion 4. Se compran en /me/tcg/shop y se acumulan acá hasta que se abren.

const RARITY_STYLES: Record<string, string> = {
    N: 'bg-ds-faint/20 text-ds-soft border-ds-border/40',
    R: 'bg-ds-accent/20 text-ds-accent-text border-ds-accent/40',
    SR: 'bg-ds-accent/20 text-ds-accent-text border-ds-accent/40',
    SSR: 'bg-ds-accent/20 text-ds-accent-text border-ds-accent/40',
    UR: 'bg-ds-warn/20 text-ds-warn border-ds-warn/40',
    LR: 'bg-ds-warn/20 text-ds-warn border-ds-warn/40',
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
                <Loader2 className="w-8 h-8 animate-spin text-ds-accent-text" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 max-w-sm flex items-start gap-2 px-4 py-3 rounded-lg border font-semibold ${toast.type === 'success' ? 'bg-ds-accent/20 border-ds-ok/40 text-ds-ok' : 'bg-ds-danger-solid/20 border-ds-danger/40 text-ds-danger'}`}>
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
                        className="flex items-center gap-2 bg-ds-bg border border-ds-border hover:border-ds-accent text-ds-text px-4 py-2 rounded-lg transition-colors"
                    >
                        <ShoppingBag className="w-4 h-4" />
                        Comprar más
                    </button>
                }
            />

            {packs.length === 0 ? (
                <div className="bg-ds-bg border border-ds-border rounded-lg p-10 text-center">
                    <p className="text-ds-soft">No tenés sobres sin abrir.</p>
                    <button
                        onClick={() => navigate('/me/tcg/shop')}
                        className="mt-4 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent font-bold px-6 py-2.5 rounded-lg transition-colors"
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
                            className={`group relative bg-ds-bg border rounded-lg p-4 flex flex-col gap-2 text-center transition-colors disabled:opacity-50 ${p.isFree ? 'border-ds-ok/40 hover:border-ds-ok/40' : 'border-ds-border hover:border-ds-accent'}`}
                        >
                            <span className={`absolute top-3 right-3 min-w-[1.75rem] px-2 py-0.5 rounded-full text-ds-on-accent text-xs font-bold tabular-nums ${p.isFree ? 'bg-ds-accent' : 'bg-ds-accent'}`}>
                                {p.count}
                            </span>
                            {p.isFree && (
                                <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-ds-accent/20 border border-ds-ok/40 text-ds-ok text-[10px] font-bold tracking-wide">
                                    GRATIS
                                </span>
                            )}
                            <img
                                src={`/tcg-packs/${tierKeyFromName(p.name)}_closed.webp`}
                                alt={p.name}
                                className="w-full aspect-square object-contain transition-transform group-hover:scale-105"
                            />
                            <span className="font-bold text-ds-text">{p.name}</span>
                            <span className="text-xs text-ds-soft">{p.cardCount} cartas</span>
                            {p.isFree ? (
                                <span className="inline-block w-fit mx-auto text-xs font-bold px-2 py-1 rounded-full border bg-ds-accent/10 text-ds-ok border-ds-ok/40">
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
