/**
 * ParticipantsTab - Gestión de participantes del giveaway en curso: quién entró, cuándo, su peso y
 * probabilidad de salir, sus roles y en qué estado está. Las acciones son las mismas que los comandos de chat.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Search, RefreshCw, Dices, Repeat, UserMinus, Lock, Unlock, Flag, Check, X } from 'lucide-react';
import api from '../../../../../services/api';
import { TabShell } from './SettingsExtras';

type PStatus = 'participating' | 'pending' | 'confirmed' | 'expired' | 'backup' | 'replaced';

interface Row {
    id: number;
    platform: string;
    username: string;
    displayName: string;
    enteredAt: string;
    entryCount: number;
    weight: number;
    probability: number;
    rank: number;
    isFollower: boolean;
    isSubscriber: boolean;
    subscriptionTier: number | null;
    isVip: boolean;
    isModerator: boolean;
    status: PStatus;
    place: number | null;
    reason: string | null;
    canWin: boolean;
}

interface Detail {
    giveawayId: number;
    status: string;
    entriesClosed: boolean;
    numberOfWinners: number;
    keepOpen: boolean;
    total: number;
    participants: Row[];
}

const STATUS: Record<PStatus, { label: string; cls: string }> = {
    participating: { label: 'Participando', cls: 'text-ds-accent' },
    pending: { label: 'Ganador · esperando respuesta', cls: 'text-ds-warn' },
    confirmed: { label: 'Ganador · confirmado', cls: 'text-ds-accent' },
    expired: { label: 'Ganador · no respondió', cls: 'text-ds-danger' },
    backup: { label: 'Respaldo', cls: 'text-ds-soft' },
    replaced: { label: 'Reemplazado', cls: 'text-ds-danger' },
};

const FILTERS: { id: string; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'participating', label: 'Participando' },
    { id: 'winners', label: 'Ganadores' },
    { id: 'out', label: 'Reemplazados' },
];

const pct = (p: number) => (p <= 0 ? '—' : `${(p * 100).toFixed(p < 0.1 ? 1 : 0)} %`);
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const Roles: React.FC<{ r: Row }> = ({ r }) => {
    const roles: string[] = [];
    if (r.isModerator) roles.push('Mod');
    if (r.isVip) roles.push('VIP');
    if (r.isSubscriber) roles.push(r.subscriptionTier ? `Sub T${r.subscriptionTier}` : 'Sub');
    if (r.isFollower) roles.push('Seguidor');
    return <span className="text-ds-soft">{roles.length ? roles.join(' · ') : '—'}</span>;
};

export const ParticipantsTab: React.FC = () => {
    const [detail, setDetail] = useState<Detail | null>(null);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [busy, setBusy] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

    const load = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            const res = await api.get('/giveaway/participants/detail');
            setDetail(res.data?.success ? res.data.detail : null);
        } catch {
            setDetail(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const timer = setInterval(() => load(true), 5000);
        return () => clearInterval(timer);
    }, [load]);

    const act = async (action: string, username?: string) => {
        setBusy(`${action}:${username ?? ''}`);
        try {
            const res = await api.post(`/giveaway/participants/${action}`, { username });
            setNotice({ ok: !!res.data?.success, text: res.data?.message ?? 'Hecho' });
        } catch (e: any) {
            setNotice({ ok: false, text: e?.response?.data?.message ?? `No se pudo hacer (error ${e?.response?.status ?? 'de conexión'})` });
        } finally {
            setBusy(null);
            await load(true);
            setTimeout(() => setNotice(null), 5000);
        }
    };

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase().replace(/^@/, '');
        return (detail?.participants ?? []).filter((r) => {
            if (q && !r.username.toLowerCase().includes(q) && !r.displayName.toLowerCase().includes(q)) return false;
            if (filter === 'participating') return r.status === 'participating';
            if (filter === 'winners') return r.status === 'pending' || r.status === 'confirmed' || r.status === 'expired' || r.status === 'backup';
            if (filter === 'out') return r.status === 'replaced';
            return true;
        });
    }, [detail, query, filter]);

    // «¿Participa?»: lo que se escribió coincide exactamente con alguien
    const exact = useMemo(() => {
        const q = query.trim().toLowerCase().replace(/^@/, '');
        return q ? (detail?.participants ?? []).find((r) => r.username.toLowerCase() === q) : undefined;
    }, [detail, query]);

    const counts = useMemo(() => {
        const list = detail?.participants ?? [];
        return {
            winners: list.filter((r) => r.status === 'pending' || r.status === 'confirmed' || r.status === 'expired').length,
            confirmed: list.filter((r) => r.status === 'confirmed').length,
        };
    }, [detail]);

    const drawn = !!detail && detail.status !== 'active';

    return (
        <TabShell icon={<Users className="w-6 h-6 text-ds-text" />} title="Participantes" subtitle="Quién entró, su peso y probabilidad, y en qué estado está cada persona">
            {loading && !detail ? (
                <p className="text-ds-soft">Cargando participantes…</p>
            ) : !detail ? (
                <div className="rounded-lg border border-ds-border bg-ds-raised p-8 text-center text-ds-soft">
                    No hay un giveaway en curso. Cuando inicies uno, aquí verás a quienes entran.
                </div>
            ) : (
                <>
                    {/* Resumen y control de la participación */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-lg border border-ds-border bg-ds-raised px-4 py-2">
                            <span className="text-2xl font-black text-ds-text">{detail.total}</span>{' '}
                            <span className="text-ds-soft text-sm">participantes</span>
                        </div>
                        <div className="rounded-lg border border-ds-border bg-ds-raised px-4 py-2">
                            <span className="text-2xl font-black text-ds-text">{counts.confirmed}</span>
                            <span className="text-ds-soft text-sm"> / {detail.numberOfWinners} confirmados</span>
                        </div>
                        <span className={`text-sm font-semibold ${detail.entriesClosed ? 'text-ds-danger' : 'text-ds-accent'}`}>
                            {detail.entriesClosed ? 'Participación cerrada' : 'Participación abierta'}
                        </span>
                        <div className="ml-auto flex flex-wrap gap-2">
                            {detail.status !== 'completed' && detail.status !== 'cancelled' && (
                                <button className="ds-btn ds-btn--secondary" disabled={busy !== null} onClick={() => act(detail.entriesClosed ? 'open' : 'close')}>
                                    {detail.entriesClosed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                    {detail.entriesClosed ? 'Abrir participación' : 'Cerrar participación'}
                                </button>
                            )}
                            {detail.status === 'selecting_winners' && (
                                <button className="ds-btn ds-btn--secondary" disabled={busy !== null} onClick={() => act('finish')}>
                                    <Flag className="w-4 h-4" />Terminar giveaway
                                </button>
                            )}
                            <button className="ds-btn ds-btn--secondary" onClick={() => load()} aria-label="Actualizar">
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {notice && (
                        <div className={`rounded-lg border px-4 py-2 text-sm ${notice.ok ? 'border-ds-accent text-ds-accent' : 'border-ds-danger text-ds-danger'}`}>{notice.text}</div>
                    )}

                    {/* Buscar y comprobar si alguien participa */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[220px]">
                            <Search className="w-4 h-4 text-ds-soft absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Buscar un usuario para ver si participa"
                                className="w-full rounded-lg border border-ds-border bg-ds-bg pl-9 pr-3 py-2 text-ds-text"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {FILTERS.map((f) => (
                                <button key={f.id} onClick={() => setFilter(f.id)} className={`ds-btn ${filter === f.id ? 'ds-btn--primary' : 'ds-btn--secondary'}`}>{f.label}</button>
                            ))}
                        </div>
                    </div>
                    {query.trim() && (
                        <div className={`flex items-center gap-2 text-sm font-semibold ${exact ? 'text-ds-accent' : 'text-ds-danger'}`}>
                            {exact ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            {exact ? `@${exact.username} está participando (${STATUS[exact.status].label.toLowerCase()})` : `@${query.trim().replace(/^@/, '')} no aparece en este giveaway`}
                        </div>
                    )}

                    {/* Tabla */}
                    <div className="overflow-x-auto rounded-lg border border-ds-border">
                        <table className="w-full text-sm">
                            <thead className="bg-ds-raised text-ds-soft text-left">
                                <tr>
                                    <th className="px-3 py-2">#</th>
                                    <th className="px-3 py-2">Usuario</th>
                                    <th className="px-3 py-2">Estado</th>
                                    <th className="px-3 py-2">Rango</th>
                                    <th className="px-3 py-2 text-right">Peso</th>
                                    <th className="px-3 py-2 text-right">Probabilidad</th>
                                    <th className="px-3 py-2">Entró</th>
                                    <th className="px-3 py-2 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 && (
                                    <tr><td colSpan={8} className="px-3 py-8 text-center text-ds-soft">Nadie coincide con ese filtro.</td></tr>
                                )}
                                {rows.map((r) => (
                                    <tr key={r.id} className="border-t border-ds-border">
                                        <td className="px-3 py-2 text-ds-soft">{r.rank}</td>
                                        <td className="px-3 py-2">
                                            <span className="font-semibold text-ds-text">{r.displayName}</span>
                                            {r.platform !== 'twitch' && <span className="ml-2 text-xs text-ds-soft uppercase">{r.platform}</span>}
                                            {r.entryCount > 1 && <span className="ml-2 text-xs text-ds-soft">{r.entryCount} entradas</span>}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`font-semibold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}{r.place ? ` (lugar ${r.place})` : ''}</span>
                                            {r.reason && <div className="text-xs text-ds-soft">{r.reason}</div>}
                                        </td>
                                        <td className="px-3 py-2"><Roles r={r} /></td>
                                        <td className="px-3 py-2 text-right tabular-nums">{r.weight.toFixed(2)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{pct(r.probability)}</td>
                                        <td className="px-3 py-2 text-ds-soft tabular-nums">{time(r.enteredAt)}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex justify-end gap-1">
                                                {(r.status === 'participating' || r.status === 'replaced') && r.canWin && detail.status !== 'completed' && (
                                                    <button className="ds-btn ds-btn--secondary" title={drawn ? 'Hacerlo ganador' : 'Sortear: este usuario gana'} disabled={busy !== null} onClick={() => act('choose', r.username)}>
                                                        <Dices className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {(r.status === 'pending' || r.status === 'expired' || r.status === 'confirmed') && (
                                                    <button className="ds-btn ds-btn--secondary" title="Re-sortear a este ganador" disabled={busy !== null} onClick={() => act('reroll', r.username)}>
                                                        <Repeat className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {r.status === 'participating' && (
                                                    <button className="ds-btn ds-btn--secondary" title="Sacar del giveaway" disabled={busy !== null} onClick={() => act('remove', r.username)}>
                                                        <UserMinus className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-ds-soft">
                        La probabilidad cuenta solo a quienes hoy pueden salir sorteados según tus reglas (no a los ganadores ni a los descartados). Se actualiza cada 5 segundos.
                    </p>
                </>
            )}
        </TabShell>
    );
};
