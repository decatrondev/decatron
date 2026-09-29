import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, Check, AlertTriangle, Monitor, Copy, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import { REGION_LABELS } from './shared';
import { CUT } from './broadcast';
import { EpicAccountSelect, EpicAccountCard, type EpicAccountOption } from './FortniteEpicAccount';
import FortniteMatchday from './FortniteMatchday';

// Contenido de "Mi inscripcion" — extraido de MyTournamentPage.tsx el 24-08-2026
// para poder montarlo tanto en la pagina completa /mi-panel (deep link, destino del
// redirect de login) como dentro de un modal sobre la pagina principal del torneo
// (pedido del usuario: la pagina aparte se veia "perdida" en pantallas 2K/4K, mejor
// como modal centrado sobre lo que ya estaba mirando).

export interface MyStatus {
    registered: boolean;
    registrationOpen?: boolean;
    game?: string;
    region?: string;
    mode?: string;
    teamSize?: number | null;
    participant?: {
        id: number;
        displayName: string;
        status: string;
        riotId: string | null;
        riotTagLine: string | null;
        linkedRiotAccountId: number | null;
        smurfFlagNote: string | null;
        gameAccountName?: string | null;
        gameAccountVerified?: boolean;
    };
    epicAccounts?: EpicAccountOption[] | null;
    eligibleRiotAccounts?: { id: number; riotId: string; riotTagLine: string }[];
    group?: { id: number; name: string; joinCode: string | null; roster: string[]; full: boolean } | null;
    overlay?: { url: string; enabledWidgets: string[]; theme: string } | null;
}

const PARTICIPANT_STATUS_LABELS: Record<string, string> = {
    pending_approval: 'Pendiente de aprobación',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    checked_in: 'Check-in hecho',
    active: 'Activo',
    eliminated: 'Eliminado',
    withdrawn: 'Retirado',
};

const OVERLAY_WIDGET_LABELS: Record<string, string> = {
    'lp-actual': 'LP actual',
    'shell-inventory': 'Inventario',
    'castigo-activo': 'Castigo activo',
    racha: 'Racha',
};

export function isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
}

export default function MyTournamentPanel({ channelName, editionSlug }: { channelName: string; editionSlug: string }) {
    const loggedIn = isLoggedIn();
    const [status, setStatus] = useState<MyStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    // silent = refrescar sin tapar el panel con el spinner (ej. al vincular una
    // cuenta de Epic a mitad del formulario, para no perder lo escrito).
    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        setLoadError('');
        try {
            const res = await api.get(`/me/tournament/${channelName}/${editionSlug}`);
            setStatus(res.data);
        } catch (err: any) {
            setLoadError(err?.response?.data?.message || 'Error cargando tu inscripción');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (loggedIn) load();
        else setLoading(false);
    }, [channelName, editionSlug]);

    if (!loggedIn) {
        const path = `torneos/${channelName}/${editionSlug}/mi-panel`;
        return (
            <div className="space-y-4 py-4">
                <h3 className="font-scoreboard font-black text-4xl leading-none">Inicia sesión para inscribirte</h3>
                <p className="text-base text-[color:var(--t-muted)] max-w-md">
                    Cada jugador se inscribe con su propia cuenta de Decatron (Twitch, Kick o Discord). Así eliges tu cuenta del juego y ves tu panel del
                    torneo.
                </p>
                <a
                    href={`/login?redirect=${encodeURIComponent(path)}`}
                    className="inline-flex font-scoreboard font-extrabold text-xl px-7 py-3 bg-[color:var(--t-primary)] text-[color:var(--t-on-primary)] hover:brightness-110"
                    style={{ clipPath: CUT }}
                >
                    Iniciar sesión
                </a>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-[color:var(--t-accent)]" />
            </div>
        );
    }

    if (loadError || !status) {
        return (
            <div className="flex items-center justify-center py-16 text-center px-4">
                <p className="text-[color:var(--t-live)]">{loadError || 'Torneo no encontrado'}</p>
            </div>
        );
    }

    const isFortnite = status.game === 'fortnite';
    const registered = status.registered;
    const participant = status.participant;
    const approved = participant?.status === 'approved';
    const hasTeamStep = (status.mode === 'aram_teams' || isFortnite) && (status.teamSize || 1) > 1;
    const isSoloQ = !isFortnite && status.mode !== 'aram_teams';

    // Pasos del jugador, en orden. Cada uno dice si ya esta listo.
    const accountDone = isFortnite ? !!participant?.gameAccountName : !!participant?.riotId;
    const steps: { key: string; title: string; done: boolean }[] = [
        { key: 'signup', title: 'Inscripción', done: registered && approved },
        { key: 'account', title: isFortnite ? 'Cuenta de Epic' : 'Cuenta de Riot', done: registered && accountDone },
        ...(hasTeamStep ? [{ key: 'team', title: 'Equipo', done: !!status.group?.full }] : []),
        ...(isFortnite ? [{ key: 'matchday', title: 'Día de partida', done: false }] : []),
    ];

    return (
        <div className="space-y-8 4xl:space-y-10">
            <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
                {steps.map((st, i) => (
                    <li key={st.key}>
                        <span className="block h-1.5" style={{ background: st.done ? 'var(--t-primary)' : 'var(--t-surface-raised)' }} />
                        <span className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold" style={{ color: st.done ? 'var(--t-ink)' : 'var(--t-muted)' }}>
                            {st.done ? <Check className="w-3.5 h-3.5 flex-shrink-0" /> : <span className="font-scoreboard font-black">{i + 1}</span>}
                            <span className="truncate">{st.title}</span>
                        </span>
                    </li>
                ))}
            </ol>

            <Step n={1} title="Inscripción">
                {!registered ? (
                    <RegisterForm
                        registrationOpen={!!status.registrationOpen}
                        game={status.game}
                        mode={status.mode}
                        region={status.region || ''}
                        eligibleRiotAccounts={status.eligibleRiotAccounts || []}
                        epicAccounts={status.epicAccounts || []}
                        onRegistered={() => load()}
                        onAccountsChanged={() => load(true)}
                    />
                ) : (
                    <RegistrationStatus name={participant!.displayName} status={participant!.status} />
                )}
            </Step>

            <Step n={2} title={isFortnite ? 'Cuenta de Epic' : 'Cuenta de Riot'}>
                {!registered ? (
                    <p className="text-base text-[color:var(--t-muted)]">La eliges al inscribirte, en el paso 1.</p>
                ) : isFortnite ? (
                    <EpicAccountCard
                        channelName={channelName}
                        editionSlug={editionSlug}
                        current={participant!.gameAccountName || null}
                        verified={!!participant!.gameAccountVerified}
                        accounts={status.epicAccounts || []}
                        onChanged={() => load(true)}
                    />
                ) : isSoloQ ? (
                    <RiotAccountPicker
                        channelName={channelName}
                        editionSlug={editionSlug}
                        region={status.region || ''}
                        participant={participant!}
                        eligibleAccounts={status.eligibleRiotAccounts || []}
                        onChanged={() => load()}
                    />
                ) : (
                    <p className="text-base">
                        {participant!.riotId ? (
                            <>
                                Juegas con <strong>{participant!.riotId}#{participant!.riotTagLine}</strong>.
                            </>
                        ) : (
                            <span className="text-[color:var(--t-muted)]">Sin cuenta de Riot elegida.</span>
                        )}
                    </p>
                )}
            </Step>

            {hasTeamStep && (
                <Step n={3} title="Equipo">
                    {!registered ? (
                        <p className="text-base text-[color:var(--t-muted)]">Después de inscribirte puedes crear tu equipo o unirte con un código.</p>
                    ) : (
                        <GroupSection
                            channelName={channelName}
                            editionSlug={editionSlug}
                            teamSize={status.teamSize!}
                            isFortnite={isFortnite}
                            group={status.group || null}
                            onChanged={() => load()}
                        />
                    )}
                </Step>
            )}

            {isFortnite && (
                <Step n={hasTeamStep ? 4 : 3} title="Día de partida">
                    {approved ? (
                        <FortniteMatchday channelName={channelName} editionSlug={editionSlug} />
                    ) : (
                        <p className="text-base text-[color:var(--t-muted)]">
                            Cuando el organizador apruebe tu inscripción, aquí haces el check-in, ves el código de cada partida y reportas tu resultado.
                        </p>
                    )}
                </Step>
            )}

            {registered && isSoloQ && (
                <OverlaySection channelName={channelName} editionSlug={editionSlug} overlay={status.overlay || null} onChanged={() => load()} />
            )}
        </div>
    );
}

/** Un paso del panel, con su numero y titulo. */
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
    return (
        <section className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3">
            <span className="font-scoreboard font-black text-4xl leading-none text-[color:var(--t-accent)]">{n}</span>
            <div className="min-w-0 space-y-3">
                <h3 className="font-scoreboard font-black text-2xl leading-none pt-1.5">{title}</h3>
                {children}
            </div>
        </section>
    );
}

const STATUS_HELP: Record<string, string> = {
    pending_approval: 'El organizador todavía tiene que aprobar tu inscripción.',
    approved: 'Ya estás dentro del torneo.',
    rejected: 'El organizador rechazó tu inscripción. Si crees que es un error, escríbele.',
    checked_in: 'Hiciste el check-in.',
    active: 'Estás jugando el torneo.',
    eliminated: 'Quedaste fuera del torneo.',
    withdrawn: 'Te retiraste del torneo.',
};

function RegistrationStatus({ name, status }: { name: string; status: string }) {
    const tone = status === 'approved' || status === 'active' || status === 'checked_in' ? 'var(--t-primary)' : status === 'rejected' ? 'var(--t-live)' : 'var(--t-secondary)';
    return (
        <div className="p-4 bg-[color:var(--t-surface)]" style={{ boxShadow: `inset 3px 0 0 ${tone}, inset 0 0 0 1px var(--t-line)` }}>
            <p className="font-semibold text-lg">{name}</p>
            <p className="text-base mt-0.5">
                <strong>{PARTICIPANT_STATUS_LABELS[status] || status}.</strong> <span className="text-[color:var(--t-muted)]">{STATUS_HELP[status] || ''}</span>
            </p>
        </div>
    );
}

function RegisterForm({
    registrationOpen,
    game,
    mode,
    region,
    eligibleRiotAccounts,
    epicAccounts,
    onRegistered,
    onAccountsChanged,
}: {
    registrationOpen: boolean;
    game?: string;
    mode?: string;
    region: string;
    eligibleRiotAccounts: { id: number; riotId: string; riotTagLine: string }[];
    epicAccounts: EpicAccountOption[];
    onRegistered: () => void;
    onAccountsChanged: () => void;
}) {
    const { channelName, editionSlug } = useParams<{ channelName: string; editionSlug: string }>();
    const [displayName, setDisplayName] = useState('');
    const [primaryRole, setPrimaryRole] = useState('');
    const [userRiotAccountId, setUserRiotAccountId] = useState<number | null>(eligibleRiotAccounts[0]?.id ?? null);
    const [gameAccountId, setGameAccountId] = useState<number | null>(epicAccounts[0]?.id ?? null);
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

    if (!registrationOpen) {
        return <p className="text-base text-[color:var(--t-muted)]">Las inscripciones no están abiertas para este torneo todavía.</p>;
    }

    const isFortnite = game === 'fortnite';
    const needsRiotAccount = mode === 'aram_teams';
    // ARAM es random/blind pick, no hay seleccion de linea — pedir el rol ahi no
    // cumple ninguna funcion (el sorteo de equipos es puro random, no balancea por
    // rol). Se mantiene para otros modos por si a futuro importa. Pedido del
    // usuario 24-08-2026.
    const showRole = mode !== 'aram_teams' && !isFortnite;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setResult(null);
        try {
            await api.post(`/me/tournament/${channelName}/${editionSlug}/register`, {
                displayName,
                primaryRole: showRole ? (primaryRole || null) : null,
                userRiotAccountId: needsRiotAccount ? userRiotAccountId : null,
                gameAccountId: isFortnite ? gameAccountId : null,
            });
            onRegistered();
        } catch (err: any) {
            setResult({ ok: false, text: err?.response?.data?.message || 'Error enviando la inscripción' });
        } finally {
            setSaving(false);
        }
    };

    if (needsRiotAccount && eligibleRiotAccounts.length === 0) {
        return (
            <div className="p-4 rounded-lg border border-dashed border-[color:var(--t-line)] space-y-2">
                <p className="text-sm text-[color:var(--t-muted)]">
                    Para inscribirte necesitas una cuenta de Riot verificada de la región{' '}
                    <span className="font-bold text-[color:var(--t-ink)]">{(REGION_LABELS[region] || region.toUpperCase())}</span> y todavía no tienes ninguna.
                </p>
                <Link to="/settings" className="text-sm text-[color:var(--t-accent)] hover:underline">
                    Vincúlala en Settings
                </Link>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="text-sm font-semibold text-[color:var(--t-muted)]">Nombre público</label>
                <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-[color:var(--t-line)] bg-[color:var(--t-surface)] text-[color:var(--t-ink)] text-sm"
                />
            </div>
            {isFortnite && (
                <EpicAccountSelect
                    accounts={epicAccounts}
                    value={gameAccountId}
                    onChange={setGameAccountId}
                    onAccountsChanged={onAccountsChanged}
                />
            )}
            {needsRiotAccount && (
                <div>
                    <label className="text-sm font-semibold text-[color:var(--t-muted)]">Cuenta de Riot ({(REGION_LABELS[region] || region.toUpperCase())})</label>
                    <select
                        value={userRiotAccountId ?? ''}
                        onChange={(e) => setUserRiotAccountId(Number(e.target.value))}
                        required
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[color:var(--t-line)] bg-[color:var(--t-surface)] text-[color:var(--t-ink)] text-sm"
                    >
                        {eligibleRiotAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.riotId}#{a.riotTagLine}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {showRole && (
                <div>
                    <label className="text-sm font-semibold text-[color:var(--t-muted)]">Rol principal</label>
                    <select
                        value={primaryRole}
                        onChange={(e) => setPrimaryRole(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[color:var(--t-line)] bg-[color:var(--t-surface)] text-[color:var(--t-ink)] text-sm"
                    >
                        <option value="">—</option>
                        <option value="top">Top</option>
                        <option value="jungle">Jungla</option>
                        <option value="mid">Mid</option>
                        <option value="adc">Adc</option>
                        <option value="support">Support</option>
                    </select>
                </div>
            )}
            {!needsRiotAccount && !isFortnite && <p className="text-xs text-[color:var(--t-muted)]">Después de inscribirte podrás vincular tu cuenta de Riot desde acá mismo.</p>}
            {result && !result.ok && <p className="text-sm text-[color:var(--t-live)]">{result.text}</p>}
            <button
                type="submit"
                disabled={saving || (isFortnite && gameAccountId == null)}
                className="w-full py-2.5 rounded-lg bg-[color:var(--t-primary)] text-[color:var(--t-on-primary)] font-bold text-sm hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Enviar inscripción
            </button>
        </form>
    );
}

function GroupSection({
    channelName,
    editionSlug,
    teamSize,
    isFortnite,
    group,
    onChanged,
}: {
    channelName: string;
    editionSlug: string;
    teamSize: number;
    isFortnite: boolean;
    group: NonNullable<MyStatus['group']> | null;
    onChanged: () => void;
}) {
    const [joinCode, setJoinCode] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const handleCreate = async () => {
        setSaving(true);
        setError('');
        try {
            await api.post(`/me/tournament/${channelName}/${editionSlug}/group`);
            onChanged();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Error armando el grupo');
        } finally {
            setSaving(false);
        }
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            await api.post(`/me/tournament/${channelName}/${editionSlug}/group/join`, { joinCode });
            onChanged();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Error uniéndote al grupo');
        } finally {
            setSaving(false);
        }
    };

    const copyCode = () => {
        if (!group?.joinCode) return;
        navigator.clipboard.writeText(group.joinCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <section className="space-y-3">
            {isFortnite ? (
                <p className="text-xs text-[color:var(--t-muted)]">
                    Los equipos son de {teamSize}. Uno de ustedes crea el equipo y comparte el código; los demás se unen con ese código.
                </p>
            ) : (
            <p className="text-sm text-[color:var(--t-muted)]">
                Por defecto entras solo y el sistema te sortea en un equipo de {teamSize}. Si quieres jugar con alguien en particular, crea un grupo aquí y
                compártele el código; los demás lugares se completan con jugadores al azar.
            </p>
            )}

            {group ? (
                <div className="p-4 rounded-lg border border-[color:var(--t-accent)] bg-[color:var(--t-accent-soft)] space-y-2">
                    <p className="text-base text-[color:var(--t-accent)]">
                        {group.roster.join(', ')} ({group.roster.length}/{teamSize})
                    </p>
                    {!group.full && group.joinCode && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-[color:var(--t-muted)]">Código para compartir:</span>
                            <code className="text-sm font-mono px-2 py-1 rounded bg-[color:var(--t-surface-raised)] text-[color:var(--t-ink)] tracking-widest">{group.joinCode}</code>
                            <button type="button" onClick={copyCode} className="p-1 rounded text-[color:var(--t-muted)] hover:text-[color:var(--t-accent)]">
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                            {copied && <span className="text-xs text-[color:var(--t-accent)]">copiado</span>}
                        </div>
                    )}
                    {group.full && (
                        <p className="text-xs text-[color:var(--t-muted)]">{isFortnite ? 'Equipo completo.' : 'Grupo completo — listo para el sorteo del bracket.'}</p>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={saving}
                        className="w-full py-2.5 rounded-lg bg-[color:var(--t-surface-raised)] border border-[color:var(--t-line)] text-[color:var(--t-ink)] font-bold text-sm hover:border-[color:var(--t-accent)] disabled:opacity-50"
                    >
                        {isFortnite ? 'Crear equipo' : 'Armar grupo nuevo'}
                    </button>
                    <form onSubmit={handleJoin} className="flex items-center gap-2">
                        <input
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="Código de un amigo"
                            className="flex-1 px-3 py-2 rounded-lg border border-[color:var(--t-line)] bg-[color:var(--t-surface)] text-[color:var(--t-ink)] text-sm font-mono tracking-widest"
                        />
                        <button
                            type="submit"
                            disabled={saving || !joinCode}
                            className="px-4 py-2 rounded-lg bg-[color:var(--t-primary)] text-[color:var(--t-on-primary)] font-bold text-sm hover:brightness-110 disabled:opacity-50"
                        >
                            Unirme
                        </button>
                    </form>
                </div>
            )}
            {error && (
                <p className="text-sm text-[color:var(--t-live)] flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> {error}
                </p>
            )}
        </section>
    );
}

function RiotAccountPicker({
    channelName,
    editionSlug,
    region,
    participant,
    eligibleAccounts,
    onChanged,
}: {
    channelName: string;
    editionSlug: string;
    region: string;
    participant: NonNullable<MyStatus['participant']>;
    eligibleAccounts: { id: number; riotId: string; riotTagLine: string }[];
    onChanged: () => void;
}) {
    const [picking, setPicking] = useState<number | null>(null);
    const [error, setError] = useState('');

    const handlePick = async (userRiotAccountId: number) => {
        setPicking(userRiotAccountId);
        setError('');
        try {
            await api.post(`/me/tournament/${channelName}/${editionSlug}/riot-account`, { userRiotAccountId });
            onChanged();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Error eligiendo la cuenta');
        } finally {
            setPicking(null);
        }
    };

    return (
        <section className="space-y-3">
            {participant.linkedRiotAccountId ? (
                <div className="space-y-2">
                    <p className="text-base text-[color:var(--t-accent)]">
                        Usando: {participant.riotId}#{participant.riotTagLine}
                    </p>
                    {participant.smurfFlagNote && (
                        <p className="text-xs text-[color:var(--t-gold)] flex items-start gap-1.5 bg-[color:var(--t-gold-soft)] border border-[color:var(--t-gold-line)] rounded-lg px-3 py-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {participant.smurfFlagNote}
                        </p>
                    )}
                </div>
            ) : eligibleAccounts.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-[color:var(--t-line)] space-y-2">
                    <p className="text-sm text-[color:var(--t-muted)]">
                        No tienes ninguna cuenta de Riot verificada de la región <span className="font-bold text-[color:var(--t-ink)]">{(REGION_LABELS[region] || region.toUpperCase())}</span>{' '}
                        todavía.
                    </p>
                    <Link to="/settings" className="text-sm text-[color:var(--t-accent)] hover:underline">
                        Vincúlala en Settings
                    </Link>
                </div>
            ) : (
                <div className="space-y-2">
                    <p className="text-xs text-[color:var(--t-muted)]">Elige cuál de tus cuentas verificadas de {(REGION_LABELS[region] || region.toUpperCase())} vas a usar en este torneo:</p>
                    {eligibleAccounts.map((a) => (
                        <button
                            key={a.id}
                            onClick={() => handlePick(a.id)}
                            disabled={picking !== null}
                            className="w-full text-left px-4 py-3 rounded-lg border border-[color:var(--t-line)] bg-[color:var(--t-surface)] hover:border-[color:var(--t-accent)] disabled:opacity-50 flex items-center justify-between"
                        >
                            <span className="text-base">
                                {a.riotId}#{a.riotTagLine}
                            </span>
                            {picking === a.id ? <Loader2 className="w-4 h-4 animate-spin text-[color:var(--t-accent)]" /> : <Check className="w-4 h-4 text-[color:var(--t-muted)]" />}
                        </button>
                    ))}
                    <Link to="/settings" className="text-xs text-[color:var(--t-muted)] hover:text-[color:var(--t-accent)] inline-block">
                        + Vincular otra cuenta en Settings
                    </Link>
                </div>
            )}
            {error && (
                <p className="text-sm text-[color:var(--t-live)] flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> {error}
                </p>
            )}
        </section>
    );
}

function OverlaySection({
    channelName,
    editionSlug,
    overlay,
    onChanged,
}: {
    channelName: string;
    editionSlug: string;
    overlay: { url: string; enabledWidgets: string[]; theme: string } | null;
    onChanged: () => void;
}) {
    const [widgets, setWidgets] = useState<string[]>(overlay?.enabledWidgets || ['lp-actual', 'shell-inventory', 'racha']);
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    const toggleWidget = (w: string) => setWidgets((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]));

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            await api.post(`/me/tournament/${channelName}/${editionSlug}/overlay`, { enabledWidgets: widgets, theme: 'dark' });
            onChanged();
        } catch (err) {
            console.error('Error generando overlay', err);
        } finally {
            setGenerating(false);
        }
    };

    const fullUrl = overlay ? `${window.location.origin}${overlay.url}` : '';
    const copyUrl = () => {
        navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <section className="space-y-3">
            <h2 className="font-scoreboard font-black font-bold flex items-center gap-2">
                <Monitor className="w-4 h-4" /> Mi overlay para OBS
            </h2>
            <div className="flex flex-wrap gap-3">
                {Object.entries(OVERLAY_WIDGET_LABELS).map(([w, label]) => (
                    <label key={w} className="flex items-center gap-1.5 text-xs text-[color:var(--t-muted)]">
                        <input type="checkbox" checked={widgets.includes(w)} onChange={() => toggleWidget(w)} />
                        {label}
                    </label>
                ))}
            </div>
            {overlay && (
                <div className="flex items-center gap-2">
                    <code className="text-xs px-2 py-1.5 rounded bg-[color:var(--t-surface-raised)] text-[color:var(--t-muted)] truncate max-w-[280px]">{fullUrl}</code>
                    <button onClick={copyUrl} className="p-1.5 rounded text-[color:var(--t-muted)] hover:text-[color:var(--t-accent)]">
                        <Copy className="w-4 h-4" />
                    </button>
                    {copied && <span className="text-xs text-[color:var(--t-accent)]">copiado</span>}
                </div>
            )}
            <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2 rounded-lg bg-[color:var(--t-surface-raised)] border border-[color:var(--t-line)] text-[color:var(--t-ink)] font-bold text-sm hover:border-[color:var(--t-accent)] disabled:opacity-50"
            >
                {generating ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} {overlay ? 'Regenerar link' : 'Generar link de overlay'}
            </button>
            {overlay && <p className="text-xs text-[color:var(--t-muted)]">Regenerar invalida el link anterior — usalo solo si se filtró.</p>}
        </section>
    );
}
