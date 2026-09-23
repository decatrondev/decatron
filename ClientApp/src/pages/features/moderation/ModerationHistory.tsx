import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, CheckCircle, Undo2, Search, ChevronLeft, ChevronRight, Bot } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import api from '../../../services/api';

interface HistoryItem {
    id: number;
    username: string;
    detail: string;
    severity: string;
    action: string;
    strikeLevel: number;
    message: string | null;
    filter: string;
    executedBy: string | null;
    createdAt: string;
    undoneAt: string | null;
    undoneBy: string | null;
    canUndo: boolean;
}

const FILTER_LABELS: Record<string, string> = {
    banned_words: 'Palabra prohibida',
    links: 'Link',
    caps: 'Mayúsculas',
    symbols: 'Símbolos',
    emotes: 'Emotes',
    length: 'Mensaje largo',
    repetition: 'Repetido',
    copypasta: 'Copypasta',
    zalgo: 'Zalgo',
    mentions: 'Menciones',
    account_age: 'Cuenta nueva',
    bot_phrases: 'Frase de bot',
    nuke: 'Nuke',
    strikes: 'Strikes',
    panic: 'Modo pánico'
};

const ACTION_LABELS: Record<string, string> = {
    warning: 'Advertencia',
    delete: 'Mensaje borrado',
    ban: 'Ban',
    reset_strikes: 'Strikes a 0',
    add_word: 'Agregó una palabra',
    del_word: 'Quitó una palabra',
    add_link: 'Permitió un dominio',
    del_link: 'Quitó un dominio',
    panic_on: 'Activó el pánico',
    panic_off: 'Apagó el pánico'
};

function actionLabel(action: string) {
    if (ACTION_LABELS[action]) return ACTION_LABELS[action];
    // timeout_1m, timeout_10m, timeout_600s (nuke)...
    const m = /^timeout_(\d+)(s|m|h)$/.exec(action);
    if (!m) return action;
    const seconds = Number(m[1]) * (m[2] === 'h' ? 3600 : m[2] === 'm' ? 60 : 1);
    if (seconds >= 3600 && seconds % 3600 === 0) return `Timeout ${seconds / 3600} h`;
    if (seconds >= 60 && seconds % 60 === 0) return `Timeout ${seconds / 60} min`;
    return `Timeout ${seconds} s`;
}

function actionColor(item: HistoryItem) {
    if (item.severity === 'comando') return 'bg-[#e2e8f0] text-[#334155] dark:bg-[#374151] dark:text-[#e2e8f0]';
    if (item.action === 'ban') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (item.action.startsWith('timeout')) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
}

function formatDate(value: string) {
    return new Date(value).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const input = 'w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc]';
const text = 'text-[#1e293b] dark:text-[#f8fafc]';
const hint = 'text-sm text-[#64748b] dark:text-[#94a3b8]';

export default function ModerationHistory() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();

    const [items, setItems] = useState<HistoryItem[] | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 25;
    const [search, setSearch] = useState('');
    const [user, setUser] = useState('');
    const [filter, setFilter] = useState('');
    const [kind, setKind] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [expanded, setExpanded] = useState<number | null>(null);
    const [undoing, setUndoing] = useState<number | null>(null);
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const showNotice = (type: 'success' | 'error', text: string) => {
        setNotice({ type, text });
        setTimeout(() => setNotice(null), 4000);
    };

    const load = async () => {
        try {
            const res = await api.get('/moderation/history', {
                params: { page, pageSize, user: user || undefined, filter: filter || undefined, kind: kind || undefined, from: from || undefined, to: to || undefined }
            });
            if (res.data.success) {
                setItems(res.data.items);
                setTotal(res.data.total);
            }
        } catch {
            showNotice('error', 'No se pudo cargar el historial');
            setItems([]);
        }
    };

    useEffect(() => {
        if (permissionsLoading) return;
        if (!hasMinimumLevel('moderation')) {
            navigate('/dashboard');
            return;
        }
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading, page, user, filter, kind, from, to]);

    // Buscar al dejar de escribir
    useEffect(() => {
        const id = setTimeout(() => { setPage(1); setUser(search.trim()); }, 400);
        return () => clearTimeout(id);
    }, [search]);

    const undo = async (item: HistoryItem) => {
        const lifts = item.action === 'ban' || item.action.startsWith('timeout');
        const question = lifts
            ? `¿Quitar ${item.action === 'ban' ? 'el ban' : 'el timeout'} a ${item.username}${item.strikeLevel > 0 ? ' y devolverle el strike' : ''}?`
            : `¿Devolverle el strike a ${item.username}?${item.action === 'delete' ? ' El mensaje borrado no se puede recuperar.' : ''}`;
        if (!window.confirm(question)) return;

        setUndoing(item.id);
        try {
            const res = await api.post(`/moderation/history/${item.id}/undo`);
            const parts: string[] = [];
            if (res.data.lifted === true) parts.push(item.action === 'ban' ? 'ban quitado' : 'timeout quitado');
            if (res.data.lifted === false) parts.push('la sanción ya había vencido');
            if (res.data.strikeReturned) parts.push('strike devuelto');
            else if (item.strikeLevel > 0) parts.push('ya no tenía strikes que devolver');
            showNotice('success', `Listo: ${parts.length ? parts.join(', ') : 'marcado como deshecho'}.`);
            await load();
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
            showNotice('error', message ?? 'No se pudo deshacer');
        } finally {
            setUndoing(null);
        }
    };

    if (!permissionsLoading && !hasMinimumLevel('moderation')) return null;

    const pages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <div className="panel-scale bg-[#f8fafc] dark:bg-[#1B1C1D] p-4 sm:p-6">
            <div className="max-w-7xl mx-auto mb-6">
                <button
                    onClick={() => navigate('/moderation')}
                    className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#3b82f6] mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver a Moderación
                </button>
                <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Historial de moderación</h1>
                <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">
                    Quién fue sancionado, por qué y quién lo hizo. Puedes quitar un timeout o un ban y devolver el strike.
                </p>
            </div>

            {notice && (
                <div className="max-w-7xl mx-auto mb-4">
                    <div className={`flex items-center gap-2 p-4 rounded-lg ${notice.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                        {notice.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                        <span className="font-semibold">{notice.text}</span>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto space-y-4">
                {/* Filtros */}
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="relative col-span-2 lg:col-span-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Usuario o mod" className={`${input} pl-9`} />
                    </div>
                    <select value={kind} onChange={(e) => { setPage(1); setKind(e.target.value); }} className={`${input} col-span-2 sm:col-span-1`} aria-label="Tipo">
                        <option value="">Todo</option>
                        <option value="sanctions">Solo sanciones</option>
                        <option value="commands">Solo acciones de mods</option>
                    </select>
                    <select value={filter} onChange={(e) => { setPage(1); setFilter(e.target.value); }} className={`${input} col-span-2 sm:col-span-1`} aria-label="Motivo">
                        <option value="">Cualquier motivo</option>
                        {Object.entries(FILTER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} className={input} aria-label="Desde" />
                    <input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} className={input} aria-label="Hasta" />
                </div>

                {/* Lista */}
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
                    <div className="hidden lg:grid grid-cols-[8rem_minmax(0,1fr)_13rem_minmax(0,1.4fr)_9rem_9rem] gap-4 px-5 py-3 border-b border-[#e2e8f0] dark:border-[#374151] text-xs font-bold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">
                        <span>Fecha</span><span>Usuario</span><span>Acción</span><span>Motivo</span><span>Quién</span><span className="text-right">Deshacer</span>
                    </div>

                    {items === null ? (
                        <p className={`${hint} text-center py-12`}>Cargando…</p>
                    ) : items.length === 0 ? (
                        <p className={`${hint} text-center py-12`}>No hay acciones con estos filtros.</p>
                    ) : items.map(item => (
                        <div key={item.id} className={`border-b last:border-b-0 border-[#e2e8f0] dark:border-[#374151] ${item.undoneAt ? 'opacity-60' : ''}`}>
                            <div
                                className="grid grid-cols-2 lg:grid-cols-[8rem_minmax(0,1fr)_13rem_minmax(0,1.4fr)_9rem_9rem] gap-x-4 gap-y-2 px-5 py-3 items-center cursor-pointer hover:bg-[#f8fafc] dark:hover:bg-[#262626]"
                                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                            >
                                <span className={`${hint} order-2 lg:order-none text-right lg:text-left`}>{formatDate(item.createdAt)}</span>
                                <span className={`font-bold truncate order-1 lg:order-none ${text}`}>{item.username}</span>
                                <span className="order-3 lg:order-none">
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${actionColor(item)}`}>{actionLabel(item.action)}</span>
                                    {item.strikeLevel > 0 && <span className={`ml-2 text-xs whitespace-nowrap ${hint}`}>strike {item.strikeLevel}/5</span>}
                                </span>
                                <span className={`truncate order-4 lg:order-none text-right lg:text-left ${text}`}>
                                    <span className="font-semibold">{FILTER_LABELS[item.filter] ?? item.filter}</span>
                                    {item.detail && <span className={hint}> · {item.detail}</span>}
                                </span>
                                <span className={`order-5 lg:order-none flex items-center gap-1 text-sm truncate ${text}`}>
                                    {item.executedBy ? item.executedBy : <><Bot className="w-4 h-4 shrink-0 text-[#2563eb]" /> Automático</>}
                                </span>
                                <span className="order-6 lg:order-none text-right text-xs">
                                    {item.undoneAt ? (
                                        <span className={`text-xs ${hint}`}>Deshecho{item.undoneBy ? ` por ${item.undoneBy}` : ''}</span>
                                    ) : item.canUndo ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); undo(item); }}
                                            disabled={undoing === item.id}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-lg border border-[#2563eb] text-[#2563eb] hover:bg-[#2563eb] hover:text-white disabled:opacity-50 transition-colors"
                                        >
                                            <Undo2 className="w-4 h-4" />
                                            {undoing === item.id ? '…' : 'Deshacer'}
                                        </button>
                                    ) : null}
                                </span>
                            </div>
                            {expanded === item.id && (
                                <div className="px-5 pb-4">
                                    <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${hint}`}>Mensaje original</p>
                                    <p className={`text-sm p-3 rounded-lg bg-[#f1f5f9] dark:bg-[#262626] break-words ${text}`}>
                                        {item.message || 'No se guardó el mensaje.'}
                                    </p>
                                    {item.undoneAt && <p className={`text-xs mt-2 ${hint}`}>Deshecho el {formatDate(item.undoneAt)}</p>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Paginación */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className={hint}>{total} {total === 1 ? 'acción' : 'acciones'}</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            aria-label="Página anterior"
                            className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] disabled:opacity-40"
                        >
                            <ChevronLeft className={`w-4 h-4 ${text}`} />
                        </button>
                        <span className={`text-sm ${text}`}>Página {page} de {pages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(pages, p + 1))}
                            disabled={page >= pages}
                            aria-label="Página siguiente"
                            className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] disabled:opacity-40"
                        >
                            <ChevronRight className={`w-4 h-4 ${text}`} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
