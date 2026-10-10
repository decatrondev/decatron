import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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

const FILTER_KEYS = ['banned_words', 'links', 'caps', 'symbols', 'emotes', 'length', 'repetition', 'copypasta', 'zalgo', 'mentions', 'account_age', 'bot_phrases', 'nuke', 'strikes', 'panic'];
const ACTION_KEYS = ['warning', 'delete', 'ban', 'reset_strikes', 'add_word', 'del_word', 'add_link', 'del_link', 'panic_on', 'panic_off'];

function actionLabel(t: TFunction, action: string) {
    if (ACTION_KEYS.includes(action)) return t(`history.actions.${action}`);
    // timeout_1m, timeout_10m, timeout_600s (nuke)...
    const m = /^timeout_(\d+)(s|m|h)$/.exec(action);
    if (!m) return action;
    const seconds = Number(m[1]) * (m[2] === 'h' ? 3600 : m[2] === 'm' ? 60 : 1);
    if (seconds >= 3600 && seconds % 3600 === 0) return t('history.timeoutH', { n: seconds / 3600 });
    if (seconds >= 60 && seconds % 60 === 0) return t('history.timeoutMin', { n: seconds / 60 });
    return t('history.timeoutS', { n: seconds });
}

/** Neutra para acciones de mods, roja para ban, ámbar para el resto de sanciones (son estados). */
function actionTone(item: HistoryItem): 'danger' | 'warn' | undefined {
    if (item.severity === 'comando') return undefined;
    if (item.action === 'ban') return 'danger';
    return 'warn';
}

function formatDate(value: string, lang: string) {
    return new Date(value).toLocaleString(lang, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ModerationHistory() {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation('moderation');
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
            showNotice('error', t('history.loadFailed'));
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
        const extra = item.strikeLevel > 0;
        return lifts
            ? t(item.action === 'ban' ? (extra ? 'history.undo.qBanStrike' : 'history.undo.qBan') : (extra ? 'history.undo.qTimeoutStrike' : 'history.undo.qTimeout'), { user: item.username })
            : t('history.undo.qStrike', { user: item.username }) + (item.action === 'delete' ? ' ' + t('history.undo.deletedNote') : '');
    };

    const undo = async (item: HistoryItem) => {
        setConfirmItem(null);
        setUndoing(item.id);
        try {
            const res = await api.post(`/moderation/history/${item.id}/undo`);
            const parts: string[] = [];
            if (res.data.lifted === true) parts.push(item.action === 'ban' ? t('history.undo.banLifted') : t('history.undo.timeoutLifted'));
            if (res.data.lifted === false) parts.push(t('history.undo.expired'));
            if (res.data.strikeReturned) parts.push(t('history.undo.strikeReturned'));
            else if (item.strikeLevel > 0) parts.push(t('history.undo.noStrikes'));
            showNotice('success', t('history.undo.done', { details: parts.length ? parts.join(', ') : t('history.undo.markedUndone') }));
            await load();
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
            showNotice('error', message ?? t('history.undo.failed'));
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
            title={t('history.title')}
            subtitle={t('history.subtitle')}
            toast={toast}
        >
            <div className="space-y-4">
                {/* Filtros */}
                <div className="bg-ds-surface rounded-lg border border-ds-border p-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="relative col-span-2 lg:col-span-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ds-faint" />
                        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('history.filters.userOrMod')} className="pl-9" />
                    </div>
                    <Select value={kind} onChange={(e) => { setPage(1); setKind(e.target.value); }} className="col-span-2 sm:col-span-1" aria-label={t('history.filters.type')}>
                        <option value="">{t('history.filters.all')}</option>
                        <option value="sanctions">{t('history.filters.sanctions')}</option>
                        <option value="commands">{t('history.filters.modActions')}</option>
                    </Select>
                    <Select value={filter} onChange={(e) => { setPage(1); setFilter(e.target.value); }} className="col-span-2 sm:col-span-1" aria-label={t('history.filters.reason')}>
                        <option value="">{t('history.filters.anyReason')}</option>
                        {FILTER_KEYS.map(k => <option key={k} value={k}>{t(`history.filter.${k}`)}</option>)}
                    </Select>
                    <Input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} aria-label={t('history.filters.from')} />
                    <Input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} aria-label={t('history.filters.to')} />
                </div>

                {/* Lista */}
                <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
                    <div className={`hidden lg:grid ${grid} gap-4 px-5 py-3 border-b border-ds-border text-xs font-bold uppercase tracking-wider text-ds-soft`}>
                        <span>{t('history.cols.date')}</span><span>{t('history.cols.user')}</span><span>{t('history.cols.action')}</span><span>{t('history.cols.reason')}</span><span>{t('history.cols.who')}</span><span className="text-right">{t('history.cols.undo')}</span>
                    </div>

                    {items === null ? (
                        <p className={`${hintCls} text-center py-12`}>{t('common.loading')}</p>
                    ) : items.length === 0 ? (
                        <p className={`${hintCls} text-center py-12`}>{t('history.empty')}</p>
                    ) : items.map(item => (
                        <div key={item.id} className={`border-b last:border-b-0 border-ds-border ${item.undoneAt ? 'opacity-60' : ''}`}>
                            <div
                                className={`grid grid-cols-2 ${grid} gap-x-4 gap-y-2 px-5 py-3 items-center cursor-pointer hover:bg-ds-raised`}
                                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                            >
                                <span className={`${hintCls} order-2 lg:order-none text-right lg:text-left`}>{formatDate(item.createdAt, i18n.language)}</span>
                                <span className="font-bold truncate order-1 lg:order-none text-ds-text">{item.username}</span>
                                <span className="order-3 lg:order-none">
                                    <Badge tone={actionTone(item)}>{actionLabel(t, item.action)}</Badge>
                                    {item.strikeLevel > 0 && <span className={`ml-2 text-xs whitespace-nowrap ${hintCls}`}>{t('history.strikeOf', { n: item.strikeLevel })}</span>}
                                </span>
                                <span className="truncate order-4 lg:order-none text-right lg:text-left text-ds-text">
                                    <span className="font-semibold">{FILTER_KEYS.includes(item.filter) ? t(`history.filter.${item.filter}`) : item.filter}</span>
                                    {item.detail && <span className={hintCls}> · {item.detail}</span>}
                                </span>
                                <span className="order-5 lg:order-none flex items-center gap-1 text-sm truncate text-ds-text">
                                    {item.executedBy ? item.executedBy : <><Bot className="w-4 h-4 shrink-0 text-ds-accent-text" /> {t('history.automatic')}</>}
                                </span>
                                <span className="order-6 lg:order-none text-right text-xs">
                                    {item.undoneAt ? (
                                        <span className={`text-xs ${hintCls}`}>{item.undoneBy ? t('history.undoneBy', { user: item.undoneBy }) : t('history.undone')}</span>
                                    ) : item.canUndo ? (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            icon={<Undo2 />}
                                            loading={undoing === item.id}
                                            disabled={undoing === item.id}
                                            onClick={(e) => { e.stopPropagation(); setConfirmItem(item); }}
                                        >
                                            {t('history.cols.undo')}
                                        </Button>
                                    ) : null}
                                </span>
                            </div>
                            {expanded === item.id && (
                                <div className="px-5 pb-4">
                                    <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${hintCls}`}>{t('history.original')}</p>
                                    <p className="text-sm p-3 rounded-lg bg-ds-bg border border-ds-border break-words text-ds-text">
                                        {item.message || t('history.noMessage')}
                                    </p>
                                    {item.undoneAt && <p className={`text-xs mt-2 ${hintCls}`}>{t('history.undoneOn', { date: formatDate(item.undoneAt, i18n.language) })}</p>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Paginación */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className={hintCls}>{t('history.count', { count: total })}</span>
                    <div className="flex items-center gap-2">
                        <IconButton variant="secondary" size="sm" label={t('history.prevPage')} icon={<ChevronLeft />} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} />
                        <span className="text-sm text-ds-text">{t('history.pageOf', { page, pages })}</span>
                        <IconButton variant="secondary" size="sm" label={t('history.nextPage')} icon={<ChevronRight />} onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} />
                    </div>
                </div>
            </div>

            {confirmItem && (
                <ModalShell
                    title={t('history.undo.title')}
                    onClose={() => setConfirmItem(null)}
                    actions={
                        <>
                            <Button variant="secondary" onClick={() => setConfirmItem(null)}>{t('history.undo.cancel')}</Button>
                            <Button onClick={() => undo(confirmItem)}>{t('history.cols.undo')}</Button>
                        </>
                    }
                >
                    {undoQuestion(confirmItem)}
                </ModalShell>
            )}
        </ModerationPage>
    );
}
