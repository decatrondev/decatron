import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Search, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import api from '../../../services/api';
import TcgPageHeader from './TcgPageHeader';

const RARITY_STYLES: Record<string, string> = {
    N: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    R: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    SR: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    SSR: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
    UR: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    LR: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    MR: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
};

const RARITIES = ['N', 'R', 'SR', 'SSR', 'UR', 'LR', 'MR'];
const PAGE_SIZE = 30;

interface DexCard {
    cardId: string;
    name: string | null;
    rarity: string;
    element: string | null;
    cardClass: string | null;
    animated: boolean;
    owned: boolean;
    imageUrl: string | null;
}

export default function TcgDex() {
    const [searchParams, setSearchParams] = useSearchParams();

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const rarity = searchParams.get('rarity') || '';
    const owned = searchParams.get('owned') || '';
    const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
    const search = searchParams.get('search') || '';

    const [items, setItems] = useState<DexCard[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [totalCards, setTotalCards] = useState(0);
    const [ownedCount, setOwnedCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const updateParams = (patch: Record<string, string>) => {
        const next = new URLSearchParams(searchParams);
        for (const [k, v] of Object.entries(patch)) {
            if (v) next.set(k, v); else next.delete(k);
        }
        if (!('page' in patch)) next.set('page', '1');
        setSearchParams(next);
    };

    useEffect(() => {
        setLoading(true);
        const params: Record<string, string | number> = { page, pageSize: PAGE_SIZE };
        if (rarity) params.rarity = rarity;
        if (owned) params.owned = owned;
        if (search) params.search = search;
        api.get('/tcg/dex', { params })
            .then((res) => {
                setItems(Array.isArray(res.data?.items) ? res.data.items : []);
                setTotalCount(res.data?.totalCount ?? 0);
                setTotalCards(res.data?.totalCards ?? 0);
                setOwnedCount(res.data?.ownedCount ?? 0);
            })
            .catch((err) => console.error('Error loading dex:', err))
            .finally(() => setLoading(false));
    }, [page, rarity, owned, search]);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    return (
        <div className="space-y-6">
            <TcgPageHeader
                title="Catálogo"
                subtitle={totalCards > 0 ? `Descubriste ${ownedCount} de ${totalCards} cartas` : undefined}
            />

            <div className="flex flex-wrap gap-3 items-center">
                <form
                    onSubmit={(e) => { e.preventDefault(); updateParams({ search: searchInput }); }}
                    className="flex items-center gap-2 bg-[#1a1b1e] border border-[#374151] rounded-xl px-3 py-2"
                >
                    <Search className="w-4 h-4 text-[#64748b]" />
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Buscar por nombre..."
                        className="bg-transparent text-sm text-white placeholder-[#64748b] outline-none w-40"
                    />
                </form>

                <select
                    value={rarity}
                    onChange={(e) => updateParams({ rarity: e.target.value })}
                    className="bg-[#1a1b1e] border border-[#374151] rounded-xl px-3 py-2 text-sm text-white"
                >
                    <option value="">Toda rareza</option>
                    {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>

                <select
                    value={owned}
                    onChange={(e) => updateParams({ owned: e.target.value })}
                    className="bg-[#1a1b1e] border border-[#374151] rounded-xl px-3 py-2 text-sm text-white"
                >
                    <option value="">Descubiertas y no</option>
                    <option value="true">Solo descubiertas</option>
                    <option value="false">Solo sin descubrir</option>
                </select>

                {(rarity || owned || search) && (
                    <button
                        onClick={() => { setSearchInput(''); setSearchParams({}); }}
                        className="text-sm text-[#94a3b8] hover:text-white underline"
                    >
                        Limpiar filtros
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center min-h-[300px]">
                    <Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" />
                </div>
            ) : items.length === 0 ? (
                <p className="text-[#64748b] dark:text-[#94a3b8]">Ninguna carta coincide con estos filtros.</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {items.map((c) => (
                            <div
                                key={c.cardId}
                                className={`rounded-xl border p-3 flex flex-col gap-1 ${c.owned ? RARITY_STYLES[c.rarity] : 'bg-black/20 border-[#374151] opacity-70'}`}
                            >
                                {c.owned && c.imageUrl ? (
                                    <img src={c.imageUrl} alt={c.name || 'carta'} loading="lazy" className="w-full aspect-[3/4] object-cover rounded-lg mb-1 bg-black/20" />
                                ) : (
                                    <div className="w-full aspect-[3/4] rounded-lg mb-1 bg-black/30 flex items-center justify-center">
                                        <Lock className="w-6 h-6 text-[#475569]" />
                                    </div>
                                )}
                                <div className="text-xs font-bold uppercase tracking-wide">{c.rarity}</div>
                                <div className="font-semibold text-white truncate">{c.owned ? (c.name || '???') : 'Sin descubrir'}</div>
                                {c.owned && <div className="text-xs text-[#94a3b8]">{c.element} · {c.cardClass}</div>}
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4">
                            <button
                                onClick={() => updateParams({ page: String(page - 1) })}
                                disabled={page <= 1}
                                className="p-2 rounded-lg bg-[#1a1b1e] border border-[#374151] disabled:opacity-30 text-white"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm text-[#94a3b8]">Página {page} de {totalPages}</span>
                            <button
                                onClick={() => updateParams({ page: String(page + 1) })}
                                disabled={page >= totalPages}
                                className="p-2 rounded-lg bg-[#1a1b1e] border border-[#374151] disabled:opacity-30 text-white"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
