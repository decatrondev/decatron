import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Undo2, Search, ChevronLeft, ChevronRight, Bot } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import api from '../../../services/api';
import { Badge, Button, IconButton, Input, Select } from '../../../components/ds';
import ModalShell from '../../../components/dashboard/ModalShell';
import { useToast } from '../../../components/dashboard/toast';
import { ModerationPage, hintCls } from './parts';

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

/** Neutra para acciones de mods, roja para ban, ámbar para el resto de sanciones (son estados). */
function actionTone(item: HistoryItem): 'danger' | 'warn' | undefined {
    if (item.severity === 'comando') return undefined;
    if (item.action === 'ban') return 'danger';
    return 'warn';
}

function formatDate(value: string) {
    return new Date(value).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ModerationHistory() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const { toast, showToast } = useToast(4000);

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
    const [confirmItem, setConfirmItem] = useState<HistoryItem | null>(null);

    const showNotice = (type: 'success' | 'error', text: string) => showToast(text, type);

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

    /** Pregunta de confirmación según lo que se va a deshacer. */
    const undoQuestion = (item: HistoryItem) => {
        const lifts = item.action === 'ban' || item.action.startsWith('timeout');
        return lifts
            ? `¿Quitar ${item.action === 'ban' ? 'el ban' : 'el timeout'} a ${item.username}${item.strikeLevel > 0 ? ' y devolverle el strike' : ''}?`
            : `¿Devolverle el strike a ${item.username}?${item.action === 'delete' ? ' El mensaje borrado no se puede recuperar.' : ''}`;
    };

    const undo = async (item: HistoryItem) => {
        setConfirmItem(null);
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
    const grid = 'lg:grid-cols-[8rem_minmax(0,1fr)_13rem_minmax(0,1.4fr)_9rem_9rem]';

    return (
        <ModerationPage
            wide
            title="Historial de moderación"
            subtitle="Quién fue sancionado, por qué y quién lo hizo. Puedes quitar un timeout o un ban y devolver el strike."
            toast={toast}
        >
            <div className="space-y-4">
                {/* Filtros */}
                <div className="bg-ds-surface rounded-lg border border-ds-border p-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="relative col-span-2 lg:col-span-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ds-faint" />
                        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Usuario o mod" className="pl-9" />
                    </div>
                    <Select value={kind} onChange={(e) => { setPage(1); setKind(e.target.value); }} className="col-span-2 sm:col-span-1" aria-label="Tipo">
                        <option value="">Todo</option>
                        <option value="sanctions">Solo sanciones</option>
                        <option value="commands">Solo acciones de mods</option>
                    </Select>
                    <Select value={filter} onChange={(e) => { setPage(1); setFilter(e.target.value); }} className="col-span-2 sm:col-span-1" aria-label="Motivo">
                        <option value="">Cualquier motivo</option>
                        {Object.entries(FILTER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </Select>
                    <Input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} aria-label="Desde" />
                    <Input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} aria-label="Hasta" />
                </div>

                {/* Lista */}
                <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
                    <div className={`hidden lg:grid ${grid} gap-4 px-5 py-3 border-b border-ds-border text-xs font-bold uppercase tracking-wider text-ds-soft`}>
                        <span>Fecha</span><span>Usuario</span><span>Acción</span><span>Motivo</span><span>Quién</span><span className="text-right">Deshacer</span>
                    </div>

                    {items === null ? (
                        <p className={`${hintCls} text-center py-12`}>Cargando…</p>
                    ) : items.length === 0 ? (
                        <p className={`${hintCls} text-center py-12`}>No hay acciones con estos filtros.</p>
                    ) : items.map(item => (
                        <div key={item.id} className={`border-b last:border-b-0 border-ds-border ${item.undoneAt ? 'opacity-60' : ''}`}>
                            <div
                                className={`grid grid-cols-2 ${grid} gap-x-4 gap-y-2 px-5 py-3 items-center cursor-pointer hover:bg-ds-raised`}
                                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                            >
                                <span className={`${hintCls} order-2 lg:order-none text-right lg:text-left`}>{formatDate(item.createdAt)}</span>
                                <span className="font-bold truncate order-1 lg:order-none text-ds-text">{item.username}</span>
                                <span className="order-3 lg:order-none">
                                    <Badge tone={actionTone(item)}>{actionLabel(item.action)}</Badge>
                                    {item.strikeLevel > 0 && <span className={`ml-2 text-xs whitespace-nowrap ${hintCls}`}>strike {item.strikeLevel}/5</span>}
                                </span>
                                <span className="truncate order-4 lg:order-none text-right lg:text-left text-ds-text">
                                    <span className="font-semibold">{FILTER_LABELS[item.filter] ?? item.filter}</span>
                                    {item.detail && <span className={hintCls}> · {item.detail}</span>}
                                </span>
                                <span className="order-5 lg:order-none flex items-center gap-1 text-sm truncate text-ds-text">
                                    {item.executedBy ? item.executedBy : <><Bot className="w-4 h-4 shrink-0 text-ds-accent-text" /> Automático</>}
                                </span>
                                <span className="order-6 lg:order-none text-right text-xs">
                                    {item.undoneAt ? (
                                        <span className={`text-xs ${hintCls}`}>Deshecho{item.undoneBy ? ` por ${item.undoneBy}` : ''}</span>
                                    ) : item.canUndo ? (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            icon={<Undo2 />}
                                            loading={undoing === item.id}
                                            disabled={undoing === item.id}
                                            onClick={(e) => { e.stopPropagation(); setConfirmItem(item); }}
                                        >
                                            Deshacer
                                        </Button>
                                    ) : null}
                                </span>
                            </div>
                            {expanded === item.id && (
                                <div className="px-5 pb-4">
                                    <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${hintCls}`}>Mensaje original</p>
                                    <p className="text-sm p-3 rounded-lg bg-ds-bg border border-ds-border break-words text-ds-text">
                                        {item.message || 'No se guardó el mensaje.'}
                                    </p>
                                    {item.undoneAt && <p className={`text-xs mt-2 ${hintCls}`}>Deshecho el {formatDate(item.undoneAt)}</p>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Paginación */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className={hintCls}>{total} {total === 1 ? 'acción' : 'acciones'}</span>
                    <div className="flex items-center gap-2">
                        <IconButton variant="secondary" size="sm" label="Página anterior" icon={<ChevronLeft />} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} />
                        <span className="text-sm text-ds-text">Página {page} de {pages}</span>
                        <IconButton variant="secondary" size="sm" label="Página siguiente" icon={<ChevronRight />} onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} />
                    </div>
                </div>
            </div>

            {confirmItem && (
                <ModalShell
                    title="Deshacer sanción"
                    onClose={() => setConfirmItem(null)}
                    actions={
                        <>
                            <Button variant="secondary" onClick={() => setConfirmItem(null)}>Cancelar</Button>
                            <Button onClick={() => undo(confirmItem)}>Deshacer</Button>
                        </>
                    }
                >
                    {undoQuestion(confirmItem)}
                </ModalShell>
            )}
        </ModerationPage>
    );
}
