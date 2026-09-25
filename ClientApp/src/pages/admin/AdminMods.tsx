import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, RefreshCw, Search, ShieldCheck, ShieldOff, Bot, User, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

// Admin → Mod en canales. Da o quita mod al bot y al dueño en los canales de Twitch con el
// token del streamer (Twitch no deja hacerlo con otro token). Cada cambio queda registrado.

type Target = 'bot' | 'owner';

interface ChannelRow {
    userId: number;
    login: string;
    displayName: string;
    avatarUrl: string | null;
    /** null = no aplica (su propio canal) o no se pudo consultar */
    botIsMod: boolean | null;
    ownerIsMod: boolean | null;
    isOwnChannel: boolean;
    isBotChannel: boolean;
    error: string | null;
}

interface Account { login: string; displayName: string }

interface LogItem {
    id: number;
    channelLogin: string;
    target: Target;
    targetLogin: string;
    action: 'add' | 'remove';
    success: boolean;
    error: string | null;
    adminLogin: string;
    createdAt: string;
}

const ERRORS: Record<string, string> = {
    token_expired: 'Token del streamer vencido: tiene que volver a entrar a Decatron.',
    token_invalid: 'Token del streamer inválido: tiene que volver a entrar a Decatron.',
    missing_scope: 'El token no tiene permiso para mods (entró antes de que se pidiera): tiene que volver a entrar.',
    user_banned: 'Esa cuenta está baneada en el canal: primero hay que desbanearla.',
    is_vip: 'Esa cuenta es VIP en el canal: Twitch pide quitarle el VIP antes de darle mod.',
    rate_limited: 'Twitch pidió esperar un momento. Intenta de nuevo.',
    own_channel: 'Es su propio canal.',
    bot_not_found: 'No se encontró la cuenta del bot en Twitch.',
    owner_without_twitch: 'Tu cuenta no tiene Twitch conectado.',
    failed: 'No se pudo hablar con Twitch.',
};

const errorText = (code: string | null | undefined) =>
    !code ? '' : ERRORS[code] ?? (code.startsWith('twitch_') ? `Twitch respondió ${code.slice(7)}.` : code);

const card = 'bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151]';

export default function AdminMods() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [bot, setBot] = useState<Account | null>(null);
    const [owner, setOwner] = useState<Account | null>(null);
    const [channels, setChannels] = useState<ChannelRow[]>([]);
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
    const [log, setLog] = useState<LogItem[] | null>(null);
    const [showLog, setShowLog] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await api.get('/admin/mods/channels');
            if (!res.data.success) {
                setLoadError(errorText(res.data.error));
            } else {
                setBot(res.data.bot);
                setOwner(res.data.owner);
                setChannels(res.data.channels);
                setRowErrors({});
            }
        } catch {
            setLoadError('No se pudieron cargar los canales.');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadLog = useCallback(async () => {
        try {
            const res = await api.get('/admin/mods/log');
            setLog(res.data.items ?? []);
        } catch {
            setLog([]);
        }
    }, []);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (showLog) loadLog(); }, [showLog, loadLog]);

    const setMod = async (row: ChannelRow, target: Target, add: boolean) => {
        const who = target === 'bot' ? bot?.displayName : owner?.displayName;
        if (!add && !window.confirm(`¿Quitar mod a ${who} en el canal de ${row.displayName}?`)) return;

        const key = `${row.userId}:${target}`;
        setBusy(key);
        setRowErrors(e => { const next = { ...e }; delete next[row.userId]; return next; });
        try {
            const res = await api.post(`/admin/mods/channels/${row.userId}`, { target, action: add ? 'add' : 'remove' });
            if (res.data.success) {
                setChannels(cs => cs.map(c => c.userId !== row.userId ? c
                    : target === 'bot' ? { ...c, botIsMod: add } : { ...c, ownerIsMod: add }));
            } else {
                setRowErrors(e => ({ ...e, [row.userId]: errorText(res.data.error) }));
            }
            if (showLog) loadLog();
        } catch {
            setRowErrors(e => ({ ...e, [row.userId]: errorText('failed') }));
        } finally {
            setBusy(null);
        }
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? channels.filter(c => c.login.includes(q) || c.displayName.toLowerCase().includes(q)) : channels;
    }, [channels, search]);

    const counts = useMemo(() => {
        const withBot = channels.filter(c => !c.isBotChannel && !c.error);
        const withOwner = channels.filter(c => !c.isOwnChannel && !c.error);
        return {
            bot: withBot.filter(c => c.botIsMod).length, botTotal: withBot.length,
            owner: withOwner.filter(c => c.ownerIsMod).length, ownerTotal: withOwner.length,
            unreachable: channels.filter(c => c.error).length,
        };
    }, [channels]);

    return (
        <div className="panel-scale max-w-5xl mx-auto">
            <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-2 text-sm text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] mb-2"
            >
                <ArrowLeft className="w-4 h-4" /> Volver a Admin
            </button>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Mod en canales</h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mt-2 max-w-2xl">
                        Da o quita mod al bot y a ti en los canales de Twitch conectados. Se hace con el token del
                        streamer, porque Twitch no permite otro, y cada cambio queda registrado.
                    </p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] hover:bg-[#f8fafc] dark:hover:bg-[#262626] disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
                </button>
            </div>

            {loadError && (
                <div className="p-4 mb-6 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                    {loadError}
                </div>
            )}

            {loading && channels.length === 0 ? (
                <div className="flex items-center justify-center gap-3 py-24 text-[#64748b] dark:text-[#94a3b8] font-bold">
                    <Loader2 className="w-5 h-5 animate-spin" /> Consultando los mods de cada canal en Twitch…
                </div>
            ) : !loadError && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                        <Stat icon={<Bot className="w-5 h-5" />} label={`${bot?.displayName ?? 'Bot'} es mod`} value={`${counts.bot} de ${counts.botTotal}`} />
                        <Stat icon={<User className="w-5 h-5" />} label={`${owner?.displayName ?? 'Tú'} eres mod`} value={`${counts.owner} de ${counts.ownerTotal}`} />
                        <Stat icon={<ShieldOff className="w-5 h-5" />} label="Sin token utilizable" value={String(counts.unreachable)} muted />
                    </div>

                    <div className="relative mb-4">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar canal"
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] text-sm text-[#1e293b] dark:text-[#f8fafc] outline-none focus:border-[#2563eb]"
                        />
                    </div>

                    <div className={`${card} divide-y divide-[#e2e8f0] dark:divide-[#374151]`}>
                        <div className="hidden md:grid grid-cols-[1fr_220px_220px] gap-4 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[#94a3b8]">
                            <span>Canal</span>
                            <span className="flex items-center gap-1.5"><Bot className="w-3.5 h-3.5" /> {bot?.displayName}</span>
                            <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {owner?.displayName}</span>
                        </div>
                        {filtered.length === 0 && (
                            <p className="text-center text-[#64748b] dark:text-[#94a3b8] py-10">Ningún canal coincide.</p>
                        )}
                        {filtered.map(row => (
                            <div key={row.userId} className="px-4 py-3">
                                <div className="grid grid-cols-1 md:grid-cols-[1fr_240px_240px] gap-3 md:gap-4 md:items-center">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {row.avatarUrl
                                            ? <img src={row.avatarUrl} alt="" className="w-10 h-10 rounded-full shrink-0" />
                                            : <div className="w-10 h-10 rounded-full shrink-0 bg-[#e2e8f0] dark:bg-[#374151]" />}
                                        <div className="min-w-0">
                                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] truncate">{row.displayName}</p>
                                            <a href={`https://twitch.tv/${row.login}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#64748b] dark:text-[#94a3b8] hover:underline truncate block">@{row.login}</a>
                                        </div>
                                    </div>
                                    {row.error ? (
                                        <p className="md:col-span-2 text-sm text-amber-700 dark:text-amber-400">{errorText(row.error)}</p>
                                    ) : (
                                        <>
                                            <ModCell
                                                label={bot?.displayName ?? 'Bot'}
                                                icon={<Bot className="w-3.5 h-3.5" />}
                                                isMod={row.botIsMod}
                                                notApplicable={row.isBotChannel}
                                                busy={busy === `${row.userId}:bot`}
                                                disabled={busy !== null}
                                                onChange={add => setMod(row, 'bot', add)}
                                            />
                                            <ModCell
                                                label={owner?.displayName ?? 'Tú'}
                                                icon={<User className="w-3.5 h-3.5" />}
                                                isMod={row.ownerIsMod}
                                                notApplicable={row.isOwnChannel}
                                                busy={busy === `${row.userId}:owner`}
                                                disabled={busy !== null}
                                                onChange={add => setMod(row, 'owner', add)}
                                            />
                                        </>
                                    )}
                                </div>
                                {rowErrors[row.userId] && (
                                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">{rowErrors[row.userId]}</p>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className={`${card} mt-6`}>
                        <button onClick={() => setShowLog(s => !s)} className="w-full flex items-center gap-2 px-4 py-3 font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            <History className="w-4 h-4" /> Registro de cambios
                            <span className="ml-auto text-sm font-normal text-[#94a3b8]">{showLog ? 'Ocultar' : 'Ver'}</span>
                        </button>
                        {showLog && (
                            <div className="border-t border-[#e2e8f0] dark:border-[#374151] divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                                {log === null && <p className="px-4 py-4 text-sm text-[#94a3b8]">Cargando…</p>}
                                {log?.length === 0 && <p className="px-4 py-4 text-sm text-[#94a3b8]">Todavía no hay cambios.</p>}
                                {log?.map(item => (
                                    <div key={item.id} className="px-4 py-2.5 flex flex-wrap items-baseline gap-x-2 text-sm">
                                        <span className={item.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{item.success ? '✓' : '✗'}</span>
                                        <span className="text-[#1e293b] dark:text-[#f8fafc]">
                                            {item.action === 'add' ? 'Dio' : 'Quitó'} mod a <b>{item.targetLogin}</b> en <b>{item.channelLogin}</b>
                                        </span>
                                        {!item.success && <span className="text-red-600 dark:text-red-400">· {errorText(item.error)}</span>}
                                        <span className="ml-auto text-xs text-[#94a3b8]">
                                            {item.adminLogin} · {new Date(item.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function Stat({ icon, label, value, muted }: { icon: React.ReactNode; label: string; value: string; muted?: boolean }) {
    return (
        <div className={`${card} p-4 flex items-center gap-3`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${muted ? 'bg-[#f1f5f9] dark:bg-[#262626] text-[#94a3b8]' : 'bg-[#eff6ff] dark:bg-[#1e3a8a]/30 text-[#2563eb]'}`}>{icon}</div>
            <div className="min-w-0">
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] truncate">{label}</p>
                <p className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">{value}</p>
            </div>
        </div>
    );
}

function ModCell({ label, icon, isMod, notApplicable, busy, disabled, onChange }: {
    label: string; icon: React.ReactNode; isMod: boolean | null; notApplicable: boolean; busy: boolean; disabled: boolean; onChange: (add: boolean) => void;
}) {
    // En móvil no hay encabezado de columnas: cada celda dice de quién es
    const who = <span className="md:hidden flex items-center gap-1 text-xs text-[#94a3b8] w-36 shrink-0 min-w-0"><span className="shrink-0">{icon}</span><span className="truncate">{label}</span></span>;

    if (notApplicable) {
        return <div className="flex items-center gap-2">{who}<span className="text-sm text-[#94a3b8]">Su propio canal</span></div>;
    }

    return (
        <div className="flex items-center gap-2">
            {who}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${isMod ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-[#f1f5f9] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8]'}`}>
                {isMod ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                {isMod ? 'Mod' : 'No es mod'}
            </span>
            <button
                onClick={() => onChange(!isMod)}
                disabled={disabled}
                className={`ml-auto md:ml-0 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors disabled:opacity-50 ${isMod
                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]'}`}
            >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isMod ? 'Quitar' : 'Dar mod'}
            </button>
        </div>
    );
}
