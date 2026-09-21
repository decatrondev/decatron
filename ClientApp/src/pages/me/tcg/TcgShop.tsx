import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Loader2, Check, X, Minus, Plus, PackageOpen, Gift, Clock } from 'lucide-react';
import api from '../../../services/api';
import TcgPageHeader from './TcgPageHeader';

// Tienda de sobres — ver .dev/plans/TCG_CARTAS_COLECCIONABLES_PLAN.md seccion 4.
// Solo se compra: los sobres van al inventario sin abrir. Abrirlos es otra vista
// (/me/tcg/open), asi se pueden acumular y abrir cuando se quiera.
//
// Arriba de la tienda paga van los sobres gratis: uno de cada tipo por ventana de
// tiempo, con la ventana propia de cada tier. Caen al mismo inventario y se abren en
// la misma vista; lo que cambia es que sus cartas valen 1 de catalogo y que no tienen
// piso de rareza garantizado.

const RARITY_STYLES: Record<string, string> = {
    N: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    R: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    SR: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    SSR: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
    UR: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    LR: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    MR: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
};

const MAX_QUANTITY = 50;

function tierKeyFromName(name: string): string {
    return name.trim().toLowerCase();
}

interface Sobre {
    id: number;
    name: string;
    cardCount: number;
    priceCoins: number;
    guaranteedFloorRarity: string;
}

interface FreePack {
    sobreTierId: number;
    name: string;
    cardCount: number;
    cooldownHours: number;
    available: boolean;
    availableAt: string | null;
}

function formatCadence(hours: number): string {
    if (hours < 48) return `cada ${hours} h`;
    return `cada ${Math.round(hours / 24)} días`;
}

/** Cuanto falta para que vuelva a estar disponible, en la unidad mas grande que aplique. */
function formatCountdown(iso: string): string {
    const msLeft = new Date(iso).getTime() - Date.now();
    if (msLeft <= 0) return 'ya';

    const totalMinutes = Math.ceil(msLeft / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

export default function TcgShop() {
    const navigate = useNavigate();
    const [balance, setBalance] = useState<number | null>(null);
    const [sobres, setSobres] = useState<Sobre[]>([]);
    const [quantities, setQuantities] = useState<Record<number, number>>({});
    const [loading, setLoading] = useState(true);
    const [buying, setBuying] = useState<number | null>(null);
    const [unopenedTotal, setUnopenedTotal] = useState(0);
    const [freePacks, setFreePacks] = useState<FreePack[]>([]);
    const [claiming, setClaiming] = useState<number | null>(null);
    const [, forceTick] = useState(0);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 5000);
        return () => clearTimeout(t);
    }, [toast]);

    // Los contadores se redibujan solos cada minuto: sin esto, el que espera con la
    // pestaña abierta ve "1h 0m" congelado y cree que se colgó.
    useEffect(() => {
        const t = setInterval(() => forceTick((n) => n + 1), 60000);
        return () => clearInterval(t);
    }, []);

    const loadPacks = () =>
        api.get('/tcg/packs').then((res) => {
            const items = Array.isArray(res.data) ? res.data : [];
            setUnopenedTotal(items.reduce((sum: number, p: { count: number }) => sum + p.count, 0));
        });

    const loadFreePacks = () =>
        api.get('/tcg/free-packs').then((res) => {
            setFreePacks(Array.isArray(res.data) ? res.data : []);
        });

    useEffect(() => {
        Promise.all([api.get('/tcg/balance'), api.get('/tcg/sobres'), loadPacks(), loadFreePacks()])
            .then(([balanceRes, sobresRes]) => {
                setBalance(balanceRes.data.balance);
                setSobres(Array.isArray(sobresRes.data) ? sobresRes.data : []);
            })
            .catch((err) => console.error('Error loading shop:', err))
            .finally(() => setLoading(false));
    }, []);

    const handleClaimFree = async (pack: FreePack) => {
        setClaiming(pack.sobreTierId);
        try {
            await api.post(`/tcg/sobres/${pack.sobreTierId}/claim-free`);
            await Promise.all([loadPacks(), loadFreePacks()]);
            setToast({
                type: 'success',
                text: `Reclamaste el sobre ${pack.name} gratis. Está en "Abrir sobres".`,
            });
        } catch (err: any) {
            setToast({ type: 'error', text: err?.response?.data?.error || 'Error al reclamar el sobre gratis.' });
            loadFreePacks();
        } finally {
            setClaiming(null);
        }
    };

    const quantityFor = (id: number) => quantities[id] ?? 1;

    const setQuantity = (id: number, value: number) => {
        setQuantities((q) => ({ ...q, [id]: Math.min(MAX_QUANTITY, Math.max(1, value)) }));
    };

    const handleBuy = async (sobre: Sobre) => {
        const quantity = quantityFor(sobre.id);
        const total = sobre.priceCoins * quantity;

        if (balance != null && balance < total) {
            setToast({ type: 'error', text: `Te faltan ${(total - balance).toLocaleString()} DecaCoins.` });
            return;
        }

        setBuying(sobre.id);
        try {
            const res = await api.post(`/tcg/sobres/${sobre.id}/buy`, { quantity });
            setBalance(res.data.newBalance);
            await loadPacks();
            setQuantity(sobre.id, 1);
            setToast({
                type: 'success',
                text: quantity === 1
                    ? `Compraste 1 sobre ${sobre.name}. Está en "Abrir sobres".`
                    : `Compraste ${quantity} sobres ${sobre.name}. Están en "Abrir sobres".`,
            });
        } catch (err: any) {
            setToast({ type: 'error', text: err?.response?.data?.error || 'Error al comprar el sobre.' });
        } finally {
            setBuying(null);
        }
    };

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
                title="Tienda de sobres"
                subtitle="Comprá sobres con tus DecaCoins. Los abrís cuando quieras."
                balance={balance}
                right={
                    unopenedTotal > 0 ? (
                        <button
                            onClick={() => navigate('/me/tcg/open')}
                            className="flex items-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold px-4 py-2 rounded-xl transition-colors"
                        >
                            <PackageOpen className="w-4 h-4" />
                            Abrir ({unopenedTotal})
                        </button>
                    ) : undefined
                }
            />

            {freePacks.length > 0 && (
                <div className="space-y-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Gift className="w-5 h-5 text-green-400" />
                            Sobres gratis
                        </h2>
                        <p className="text-xs text-[#94a3b8]">
                            Uno de cada tipo por ventana. Sin piso de rareza garantizado, y sus cartas
                            valen 1 de catálogo aunque las gradees.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                        {freePacks.map((p) => (
                            <div
                                key={p.sobreTierId}
                                className={`relative bg-[#1a1b1e] border rounded-2xl p-4 flex flex-col gap-3 text-center transition-colors ${p.available ? 'border-green-500/50' : 'border-[#374151]'}`}
                            >
                                <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/40 text-green-300 text-[10px] font-bold tracking-wide">
                                    GRATIS
                                </span>
                                <img
                                    src={`/tcg-packs/${tierKeyFromName(p.name)}_closed.webp`}
                                    alt={p.name}
                                    className={`w-full aspect-square object-contain ${p.available ? '' : 'opacity-40 grayscale'}`}
                                />
                                <div>
                                    <div className="font-bold text-white">{p.name}</div>
                                    <div className="text-xs text-[#94a3b8]">
                                        {p.cardCount} cartas · {formatCadence(p.cooldownHours)}
                                    </div>
                                </div>

                                {p.available ? (
                                    <button
                                        onClick={() => handleClaimFree(p)}
                                        disabled={claiming != null}
                                        className="mt-auto bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-2"
                                    >
                                        {claiming === p.sobreTierId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                                        Reclamar
                                    </button>
                                ) : (
                                    <div className="mt-auto bg-black/30 text-[#94a3b8] font-bold py-2 rounded-xl flex items-center justify-center gap-2 tabular-nums">
                                        <Clock className="w-4 h-4" />
                                        {p.availableAt ? formatCountdown(p.availableAt) : '—'}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {freePacks.length > 0 && sobres.length > 0 && (
                <h2 className="text-lg font-bold text-white flex items-center gap-2 pt-2">
                    <Coins className="w-5 h-5 text-[#eab308]" />
                    Comprar sobres
                </h2>
            )}

            {sobres.length === 0 ? (
                <p className="text-[#64748b] dark:text-[#94a3b8]">No hay sobres disponibles ahora mismo.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {sobres.map((s) => {
                        const quantity = quantityFor(s.id);
                        const total = s.priceCoins * quantity;
                        const canAfford = balance == null || balance >= total;
                        return (
                            <div key={s.id} className="bg-[#1a1b1e] border border-[#374151] rounded-2xl p-4 flex flex-col gap-3 text-center">
                                <img
                                    src={`/tcg-packs/${tierKeyFromName(s.name)}_closed.webp`}
                                    alt={s.name}
                                    className="w-full aspect-square object-contain"
                                />
                                <div>
                                    <div className="font-bold text-white">{s.name}</div>
                                    <div className="text-xs text-[#94a3b8]">{s.cardCount} cartas</div>
                                </div>
                                <div className={`inline-block w-fit mx-auto text-xs font-bold px-2 py-1 rounded-full border ${RARITY_STYLES[s.guaranteedFloorRarity] || ''}`}>
                                    Piso: {s.guaranteedFloorRarity}+
                                </div>

                                <div className="flex items-center justify-center gap-2">
                                    <button
                                        onClick={() => setQuantity(s.id, quantity - 1)}
                                        disabled={quantity <= 1}
                                        className="p-1.5 rounded-lg bg-black/30 hover:bg-black/50 disabled:opacity-30 text-white transition-colors"
                                        aria-label="Menos"
                                    >
                                        <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="w-8 text-center font-bold text-white tabular-nums">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(s.id, quantity + 1)}
                                        disabled={quantity >= MAX_QUANTITY}
                                        className="p-1.5 rounded-lg bg-black/30 hover:bg-black/50 disabled:opacity-30 text-white transition-colors"
                                        aria-label="Más"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div className="flex items-center justify-center gap-1 text-[#eab308] font-bold">
                                    <Coins className="w-4 h-4" /> {total.toLocaleString()}
                                </div>

                                <button
                                    onClick={() => handleBuy(s)}
                                    disabled={buying != null || !canAfford}
                                    title={canAfford ? undefined : 'No te alcanzan los DecaCoins'}
                                    className="bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    {buying === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : canAfford ? 'Comprar' : 'Sin fondos'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
