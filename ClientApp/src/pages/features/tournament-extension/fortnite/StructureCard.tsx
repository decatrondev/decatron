import React, { useState } from 'react';
import { Shuffle, UsersRound, Plus, Trash2, Loader2, AlertTriangle, Check, CalendarDays, Crown, X } from 'lucide-react';
import api from '../../../../services/api';
import type { FortniteFormat, FortniteGroup, FortniteSession } from './types';
import { SESSION_STATUS_LABELS, inputClass, labelClass, cardClass, primaryButton, secondaryButton } from './types';

// Estructura del torneo de Fortnite: armar equipos (sorteo de solos), grupos
// cuando no entran todos en un lobby (al azar, editables) con su final, y las
// sesiones con N partidas. Ver .dev/torneos/15-fortnite.md F2.

type Message = { ok: boolean; text: string } | null;

export default function StructureCard({ editionId, data, onChanged }: { editionId: number; data: FortniteFormat; onChanged: () => void }) {
    const [message, setMessage] = useState<Message>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const base = `/admin/tournament/editions/${editionId}/fortnite`;

    const run = async (key: string, fn: () => Promise<string | void>) => {
        setBusy(key);
        setMessage(null);
        try {
            const text = await fn();
            if (text) setMessage({ ok: true, text });
            onChanged();
        } catch (err: any) {
            setMessage({ ok: false, text: err?.response?.data?.message || 'No se pudo completar la acción' });
        } finally {
            setBusy(null);
        }
    };

    const playingTeams = data.teams.filter((t) => t.playing);
    const teamName = (id: number) => data.teams.find((t) => t.id === id)?.name || `Equipo ${id}`;
    const stageGroups = data.groups.filter((g) => !g.isFinal);
    const finalGroup = data.groups.find((g) => g.isFinal) || null;
    const needsGroups = playingTeams.length > data.teamsPerLobby;

    const buildTeams = () =>
        run('build', async () => {
            const res = await api.post(`${base}/teams/build`);
            const r = res.data.result;
            const parts = [`${r.createdTeams} equipo(s) nuevo(s).`];
            if (r.incompleteTeamPlayers > 0) parts.push(`${r.incompleteTeamPlayers} jugador(es) quedaron en un equipo incompleto (igual puede jugar).`);
            if (r.solosWithoutTeam > 0) parts.push(`${r.solosWithoutTeam} jugador(es) sin equipo: el sorteo está apagado.`);
            return parts.join(' ');
        });

    return (
        <div className="space-y-4 4xl:space-y-6">
            {message && (
                <p className={`text-sm 4xl:text-base flex items-center gap-1 ${message.ok ? 'text-[#16a34a]' : 'text-red-600 dark:text-red-400'}`}>
                    {message.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {message.text}
                </p>
            )}

            {/* Equipos */}
            <section className={cardClass}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc] 4xl:text-lg flex items-center gap-2">
                            <UsersRound className="w-4 h-4 text-[#2563eb]" /> Equipos
                        </h3>
                        <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                            {playingTeams.length} {data.teamSize === 1 ? 'jugador(es) listos' : 'equipo(s) listos'} · {data.approvedWithoutTeam} aprobado(s) sin equipo.{' '}
                            {data.teamSize === 1
                                ? 'En Solo cada jugador es su propio equipo.'
                                : 'Arma los equipos cuando cierres las inscripciones; los que ya armaron equipo por código se respetan.'}
                        </p>
                    </div>
                    <button type="button" onClick={buildTeams} disabled={busy != null || data.approvedWithoutTeam === 0} className={primaryButton}>
                        {busy === 'build' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
                        Armar equipos
                    </button>
                </div>
            </section>

            {/* Grupos */}
            <section className={cardClass}>
                <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc] 4xl:text-lg">Grupos</h3>
                <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                    Entran {data.teamsPerLobby} {data.teamSize === 1 ? 'jugadores' : 'equipos'} por lobby.{' '}
                    {needsGroups
                        ? `Hay ${playingTeams.length}: hay que dividir en grupos y los mejores de cada uno pasan a la final.`
                        : 'Por ahora entran todos en un solo lobby: no hace falta dividir en grupos.'}
                </p>
                {needsGroups && <GenerateGroupsForm base={base} busy={busy} run={run} hasGroups={stageGroups.length > 0} />}

                {stageGroups.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 4xl:grid-cols-4 gap-3 4xl:gap-4">
                        {stageGroups.map((g) => (
                            <GroupBox key={g.id} group={g} base={base} data={data} teamName={teamName} busy={busy} run={run} />
                        ))}
                    </div>
                )}

                {stageGroups.length > 0 && (
                    <div className="pt-2">
                        {finalGroup ? (
                            <div className="max-w-2xl">
                                <GroupBox group={finalGroup} base={base} data={data} teamName={teamName} busy={busy} run={run} />
                                <p className="text-[11px] 4xl:text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    Por ahora los clasificados se agregan a mano; cuando exista la tabla de puntos (F5) se podrán pasar solos.
                                </p>
                            </div>
                        ) : (
                            <button type="button" disabled={busy != null} onClick={() => run('final', async () => void (await api.post(`${base}/groups/final`)))} className={secondaryButton}>
                                <Crown className="w-4 h-4" /> Crear final
                            </button>
                        )}
                    </div>
                )}
            </section>

            <SessionsSection base={base} data={data} busy={busy} run={run} />
        </div>
    );
}

function GenerateGroupsForm({
    base,
    busy,
    run,
    hasGroups,
}: {
    base: string;
    busy: string | null;
    run: (key: string, fn: () => Promise<string | void>) => void;
    hasGroups: boolean;
}) {
    const [groupCount, setGroupCount] = useState('');
    const [qualifyCount, setQualifyCount] = useState('');

    const generate = () => {
        if (hasGroups && !window.confirm('Se rearman todos los grupos al azar y se borran sus sesiones. ¿Seguir?')) return;
        run('groups', async () => {
            const res = await api.post(`${base}/groups/generate`, {
                groupCount: groupCount ? Number(groupCount) : null,
                qualifyCount: qualifyCount ? Number(qualifyCount) : null,
            });
            return `${res.data.groups} grupos armados al azar. Puedes mover equipos entre grupos.`;
        });
    };

    return (
        <div className="flex items-end gap-3 flex-wrap">
            <div className="w-40 4xl:w-52">
                <label className={labelClass}>Cantidad de grupos</label>
                <input type="number" min={2} value={groupCount} onChange={(e) => setGroupCount(e.target.value)} placeholder="Automático" className={inputClass} />
            </div>
            <div className="w-40 4xl:w-52">
                <label className={labelClass}>Pasan a la final por grupo</label>
                <input type="number" min={1} value={qualifyCount} onChange={(e) => setQualifyCount(e.target.value)} placeholder="Automático" className={inputClass} />
            </div>
            <button type="button" onClick={generate} disabled={busy != null} className={primaryButton}>
                {busy === 'groups' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
                {hasGroups ? 'Rearmar grupos al azar' : 'Armar grupos al azar'}
            </button>
        </div>
    );
}

function GroupBox({
    group,
    base,
    data,
    teamName,
    busy,
    run,
}: {
    group: FortniteGroup;
    base: string;
    data: FortniteFormat;
    teamName: (id: number) => string;
    busy: string | null;
    run: (key: string, fn: () => Promise<string | void>) => void;
}) {
    const [adding, setAdding] = useState('');
    const [editingName, setEditingName] = useState(group.name);
    const [qualify, setQualify] = useState(group.qualifyCount?.toString() ?? '');

    const candidates = data.teams.filter((t) => t.playing && !group.teamIds.includes(t.id));
    const full = group.teamIds.length >= data.teamsPerLobby;

    const saveGroup = () =>
        run(`g${group.id}`, async () => {
            await api.put(`${base}/groups/${group.id}`, { name: editingName, qualifyCount: qualify ? Number(qualify) : null });
            return 'Grupo guardado.';
        });

    return (
        <div className={`p-3 4xl:p-5 rounded-lg border space-y-2 ${group.isFinal ? 'border-amber-300 dark:border-amber-800' : 'border-[#e2e8f0] dark:border-[#374151]'}`}>
            <div className="flex items-center gap-2">
                {group.isFinal && <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                <input value={editingName} onChange={(e) => setEditingName(e.target.value)} onBlur={() => editingName !== group.name && saveGroup()} className={inputClass + ' mt-0 font-bold'} />
                <span className="text-xs font-mono text-[#64748b] dark:text-[#94a3b8] flex-shrink-0">
                    {group.teamIds.length}/{data.teamsPerLobby}
                </span>
                <button
                    type="button"
                    title="Borrar grupo"
                    disabled={busy != null}
                    onClick={() => {
                        if (!window.confirm(`¿Borrar "${group.name}" y sus sesiones?`)) return;
                        run(`g${group.id}`, async () => void (await api.delete(`${base}/groups/${group.id}`)));
                    }}
                    className="p-1.5 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 flex-shrink-0"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
            {!group.isFinal && (
                <div className="flex items-center gap-2 text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                    Pasan a la final:
                    <input
                        type="number"
                        min={1}
                        value={qualify}
                        onChange={(e) => setQualify(e.target.value)}
                        onBlur={() => qualify !== (group.qualifyCount?.toString() ?? '') && saveGroup()}
                        className="w-16 px-2 py-1 rounded border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                    />
                </div>
            )}
            <div className="flex flex-wrap gap-1.5">
                {group.teamIds.length === 0 && <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">Sin equipos</span>}
                {group.teamIds.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#f8fafc] dark:bg-[#262626] text-xs 4xl:text-sm text-[#1e293b] dark:text-[#f8fafc]">
                        {teamName(id)}
                        <button
                            type="button"
                            title="Sacar del grupo"
                            disabled={busy != null}
                            onClick={() => run(`g${group.id}`, async () => void (await api.delete(`${base}/groups/${group.id}/teams/${id}`)))}
                            className="text-[#64748b] hover:text-red-600"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
            </div>
            {!full && candidates.length > 0 && (
                <div className="flex items-center gap-2">
                    <select value={adding} onChange={(e) => setAdding(e.target.value)} className={inputClass + ' mt-0'}>
                        <option value="">{group.isFinal ? 'Agregar clasificado…' : 'Mover un equipo a este grupo…'}</option>
                        {candidates.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        disabled={!adding || busy != null}
                        onClick={() =>
                            run(`g${group.id}`, async () => {
                                await api.post(`${base}/groups/${group.id}/teams`, { teamId: Number(adding) });
                                setAdding('');
                            })
                        }
                        className={secondaryButton}
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}

// datetime-local trabaja en hora local sin zona; el backend guarda UTC.
function toLocalInput(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SessionsSection({
    base,
    data,
    busy,
    run,
}: {
    base: string;
    data: FortniteFormat;
    busy: string | null;
    run: (key: string, fn: () => Promise<string | void>) => void;
}) {
    const [editing, setEditing] = useState<FortniteSession | 'new' | null>(null);
    const groupName = (id: number | null) => (id == null ? 'Todos (un solo lobby)' : data.groups.find((g) => g.id === id)?.name || 'Grupo');

    return (
        <section className={cardClass}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc] 4xl:text-lg flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-[#2563eb]" /> Sesiones
                    </h3>
                    <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                        Cada sesión es un día de juego con varias partidas personalizadas. Los puntos se suman entre todas las partidas.
                    </p>
                </div>
                {editing == null && (
                    <button type="button" onClick={() => setEditing('new')} className={primaryButton}>
                        <Plus className="w-4 h-4" /> Nueva sesión
                    </button>
                )}
            </div>

            {editing != null && (
                <SessionForm
                    key={editing === 'new' ? 'new' : editing.id}
                    base={base}
                    data={data}
                    session={editing === 'new' ? null : editing}
                    busy={busy}
                    run={run}
                    onClose={() => setEditing(null)}
                />
            )}

            {data.sessions.length === 0 ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Todavía no hay sesiones.</p>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 4xl:grid-cols-3 gap-2 4xl:gap-3">
                    {data.sessions.map((s) => (
                        <div key={s.id} className="p-3 4xl:p-5 rounded-lg border border-[#e2e8f0] dark:border-[#374151] flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] truncate 4xl:text-lg">{s.name}</p>
                                <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                                    {groupName(s.groupId)} · {s.games.length} partida(s) ·{' '}
                                    {s.scheduledAt ? new Date(s.scheduledAt.endsWith('Z') ? s.scheduledAt : s.scheduledAt + 'Z').toLocaleString() : 'sin fecha'} ·{' '}
                                    {SESSION_STATUS_LABELS[s.status] || s.status}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button type="button" onClick={() => setEditing(s)} className={secondaryButton}>
                                    Editar
                                </button>
                                {s.status === 'scheduled' && (
                                    <button
                                        type="button"
                                        title="Borrar sesión"
                                        disabled={busy != null}
                                        onClick={() => {
                                            if (!window.confirm(`¿Borrar la sesión "${s.name}"?`)) return;
                                            run(`s${s.id}`, async () => void (await api.delete(`${base}/sessions/${s.id}`)));
                                        }}
                                        className="p-2 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function SessionForm({
    base,
    data,
    session,
    busy,
    run,
    onClose,
}: {
    base: string;
    data: FortniteFormat;
    session: FortniteSession | null;
    busy: string | null;
    run: (key: string, fn: () => Promise<string | void>) => void;
    onClose: () => void;
}) {
    const [name, setName] = useState(session?.name ?? `Sesión ${data.sessions.length + 1}`);
    const [groupId, setGroupId] = useState<string>(session?.groupId?.toString() ?? '');
    const [scheduledAt, setScheduledAt] = useState(toLocalInput(session?.scheduledAt ?? null));
    const [games, setGames] = useState(session?.games.length ?? 6);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const body = {
            name,
            groupId: groupId ? Number(groupId) : null,
            scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
            games,
        };
        run('session', async () => {
            if (session) await api.put(`${base}/sessions/${session.id}`, body);
            else await api.post(`${base}/sessions`, body);
            onClose();
        });
    };

    return (
        <form onSubmit={submit} className="p-3 4xl:p-5 rounded-lg bg-[#f8fafc] dark:bg-[#262626] grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-end">
            <div>
                <label className={labelClass}>Nombre</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className={inputClass} />
            </div>
            <div>
                <label className={labelClass}>Quiénes juegan</label>
                <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputClass}>
                    <option value="">Todos (un solo lobby)</option>
                    {data.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                            {g.name}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <label className={labelClass}>Fecha y hora</label>
                <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={inputClass} />
            </div>
            <div>
                <label className={labelClass}>Partidas</label>
                <input type="number" min={1} max={20} value={games} onChange={(e) => setGames(Number(e.target.value))} className={inputClass} />
            </div>
            <div className="md:col-span-2 xl:col-span-4 flex items-center gap-2">
                <button type="submit" disabled={busy != null} className={primaryButton}>
                    {busy === 'session' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {session ? 'Guardar sesión' : 'Crear sesión'}
                </button>
                <button type="button" onClick={onClose} className={secondaryButton}>
                    Cancelar
                </button>
            </div>
        </form>
    );
}
