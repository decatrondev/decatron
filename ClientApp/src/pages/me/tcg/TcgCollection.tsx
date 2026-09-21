import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../../services/api';
import TcgPageHeader from './TcgPageHeader';
import CardSlab from './CardSlab';

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

const STATUS_LABELS: Record<string, string> = {
    active: 'Activa',
    grading_in_progress: 'En gradeo',
    frozen_pending_payment: 'Esperando pago',
};

const PAGE_SIZE = 24;

interface CollectionCard {
    instanceId: number;
    cardId: string;
    level: number;
    status: string;
    name: string | null;
    rarity: string | null;
    imageUrl: string | null;
}

export default function TcgCollection() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const rarity = searchParams.get('rarity') || '';
    const status = searchParams.get('status') || '';
    const grade = searchParams.get('grade') || '';
    const element = searchParams.get('element') || '';
    const cardClass = searchParams.get('cardClass') || '';
    const origin = searchParams.get('origin') || '';
    const animated = searchParams.get('animated') || '';
    const sort = searchParams.get('sort') || '';
    const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
    const search = searchParams.get('search') || '';

    const [items, setItems] = useState<CollectionCard[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [elements, setElements] = useState<string[]>([]);
    const [classes, setClasses] = useState<string[]>([]);

    // Elementos y clases salen del backend, no hardcodeados: los define el lado de
    // generación y se van agregando.
    useEffect(() => {
        api.get('/tcg/filters')
            .then((res) => {
                setElements(res.data?.elements ?? []);
                setClasses(res.data?.classes ?? []);
            })
            .catch((err) => console.error('Error loading filters:', err));
    }, []);

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
        if (status) params.status = status;
        if (search) params.search = search;
        if (grade) params.grade = grade;
        if (element) params.element = element;
        if (cardClass) params.cardClass = cardClass;
        if (origin) params.origin = origin;
        if (animated) params.animated = animated;
        if (sort) params.sort = sort;
        api.get('/tcg/collection', { params })
            .then((res) => {
                setItems(Array.isArray(res.data?.items) ? res.data.items : []);
                setTotalCount(res.data?.totalCount ?? 0);
            })
            .catch((err) => console.error('Error loading collection:', err))
            .finally(() => setLoading(false));
    }, [page, rarity, status, search, grade, element, cardClass, origin, animated, sort]);

    const hayFiltros = !!(rarity || status || search || grade || element || cardClass || origin || animated || sort);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    return (
        <div className="space-y-6">
            <TcgPageHeader title="Mi colección" subtitle={`${totalCount} carta${totalCount === 1 ? '' : 's'}`} />

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
                    value={grade}
                    onChange={(e) => updateParams({ grade: e.target.value })}
                    className="bg-[#1a1b1e] border border-[#374151] rounded-xl px-3 py-2 text-sm text-white"
                >
                    <option value="">Todo grado</option>
                    <option value="0">Sin gradear</option>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => (
                        <option key={g} value={g}>Grado {g}</option>
                    ))}
                </select>

                <select
                    value={element}
                    onChange={(e) => updateParams({ element: e.target.value })}
                    className="bg-[#1a1b1e] border border-[#374151] rounded-xl px-3 py-2 text-sm text-white"
                >
                    <option value="">Todo elemento</option>
                    {elements.map((el) => <option key={el} value={el}>{el}</option>)}
                </select>

                <select
                    value={cardClass}
                    onChange={(e) => updateParams({ cardClass: e.target.value })}
                    className="bg-[#1a1b1e] border border-[#374151] rounded-xl px-3 py-2 text-sm text-white"
                >
                    <option value="">Toda clase</option>
                    {classes.map((cl) => <option key={cl} value={cl}>{cl}</option>)}
                </select>

                <select
                    value={origin}
                    onChange={(e) => updateParams({ origin: e.target.value })}
                    className="bg-[#1a1b1e] border border-[#374151] rounded-xl px-3 py-2 text-sm text-white"
                >
                    <option value="">Todo origen</option>
                    <option value="pulled">De sobre pago</option>
                    <option value="claimed">Claim diario</option>
                    <option value="free_pack">De sobre gratis</option>
                </select>

                <select
                    value={status}
                    onChange={(e) => updateParams({ status: e.target.value })}
                    className="bg-[#1a1b1e] border border-[#374151] rounded-xl px-3 py-2 text-sm text-white"
                >
                    <option value="">Todo estado</option>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>

                <select
                    value={animated}
                    onChange={(e) => updateParams({ animated: e.target.value })}
                    className="bg-[#1a1b1e] border border-[#374151] rounded-xl px-3 py-2 text-sm text-white"
                >
                    <option value="">Animadas y no</option>
                    <option value="true">Solo animadas</option>
                    <option value="false">Sin animar</option>
                </select>

                <select
                    value={sort}
                    onChange={(e) => updateParams({ sort: e.target.value })}
                    className="bg-[#1a1b1e] border border-[#374151] rounded-xl px-3 py-2 text-sm text-white"
                >
                    <option value="">Más recientes</option>
                    <option value="oldest">Más antiguas</option>
                    <option value="value_desc">Más valiosas</option>
                    <option value="value_asc">Menos valiosas</option>
                    <option value="grade_desc">Mejor grado</option>
                    <option value="rarity_desc">Mejor rareza</option>
                    <option value="name_asc">Nombre A-Z</option>
                </select>

                {hayFiltros && (
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
                <p className="text-[#64748b] dark:text-[#94a3b8]">
                    {totalCount === 0 && !rarity && !status && !search
                        ? 'Todavía no tenés cartas. Andá a la tienda y abrí un sobre.'
                        : 'Ninguna carta coincide con estos filtros.'}
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {items.map((c) => (
                            <button
                                key={c.instanceId}
                                onClick={() => navigate(`/me/tcg/collection/${c.instanceId}`)}
                                className={`text-left rounded-xl border p-3 flex flex-col gap-1 hover:brightness-110 transition-all ${RARITY_STYLES[c.rarity || 'N']}`}
                            >
                                <div className="mb-1">
                                    <CardSlab level={c.level} name={c.name} rarity={c.rarity} imageUrl={c.imageUrl} compact />
                                </div>
                                <div className="text-xs font-bold uppercase tracking-wide">{c.rarity}</div>
                                <div className="font-semibold text-white truncate">{c.name || '???'}</div>
                                <div className="text-xs text-[#94a3b8]">
                                    {c.level > 0 ? `Gradeada ${c.level}` : 'Sin gradear'}
                                </div>
                                {c.status !== 'active' && (
                                    <div className="text-[10px] font-bold text-blue-300">{STATUS_LABELS[c.status] || c.status}</div>
                                )}
                            </button>
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
