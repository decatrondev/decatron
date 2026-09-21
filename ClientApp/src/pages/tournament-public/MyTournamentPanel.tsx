import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, Check, AlertTriangle, Monitor, Copy, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import { REGION_LABELS } from './shared';

// Contenido de "Mi inscripcion" — extraido de MyTournamentPage.tsx el 24-08-2026
// para poder montarlo tanto en la pagina completa /mi-panel (deep link, destino del
// redirect de login) como dentro de un modal sobre la pagina principal del torneo
// (pedido del usuario: la pagina aparte se veia "perdida" en pantallas 2K/4K, mejor
// como modal centrado sobre lo que ya estaba mirando).

export interface MyStatus {
    registered: boolean;
    registrationOpen?: boolean;
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
    };
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

    const load = async () => {
        setLoading(true);
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
            <div className="text-center space-y-4 py-6">
                <p className="font-mono text-xs tracking-[0.3em] text-[#7C8AA6]">MI PANEL</p>
                <h2 className="font-display font-bold text-2xl">Iniciá sesión para inscribirte</h2>
                <p className="text-sm text-[#7C8AA6] max-w-sm mx-auto">
                    Cada participante se anota con su propia cuenta de Twitch — así podés vincular tu cuenta de Riot y generar tu propio link de overlay, sin
                    depender del organizador.
                </p>
                <a
                    href={`/login?redirect=${encodeURIComponent(path)}`}
                    className="inline-block font-mono text-xs tracking-wider uppercase px-5 py-3 rounded bg-[#3ED6C4] text-[#0B1120] font-bold hover:bg-[#5EE8D8] transition-colors"
                >
                    Iniciar sesión con Twitch
                </a>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-[#3ED6C4]" />
            </div>
        );
    }

    if (loadError || !status) {
        return (
            <div className="flex items-center justify-center py-16 text-center px-4">
                <p className="text-[#E8677A]">{loadError || 'Torneo no encontrado'}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 4xl:space-y-10">
            {!status.registered ? (
                <RegisterForm
                    registrationOpen={!!status.registrationOpen}
                    mode={status.mode}
                    region={status.region || ''}
                    eligibleRiotAccounts={status.eligibleRiotAccounts || []}
                    onRegistered={load}
                />
            ) : (
                <div className="space-y-8">
                    <div className="p-4 rounded-lg border border-[#232C42] bg-[#0F1729]">
                        <p className="font-display font-bold">{status.participant!.displayName}</p>
                        <p className="font-mono text-xs text-[#7C8AA6] mt-1">
                            {PARTICIPANT_STATUS_LABELS[status.participant!.status] || status.participant!.status}
                        </p>
                    </div>

                    {status.mode === 'aram_teams' && (status.teamSize || 1) > 1 && (
                        <GroupSection
                            channelName={channelName}
                            editionSlug={editionSlug}
                            teamSize={status.teamSize!}
                            group={status.group || null}
                            onChanged={load}
                        />
                    )}

                    {status.mode !== 'aram_teams' && (
                        <RiotAccountPicker
                            channelName={channelName}
                            editionSlug={editionSlug}
                            region={status.region || ''}
                            participant={status.participant!}
                            eligibleAccounts={status.eligibleRiotAccounts || []}
                            onChanged={load}
                        />
                    )}

                    {status.mode !== 'aram_teams' && (
                        <OverlaySection channelName={channelName} editionSlug={editionSlug} overlay={status.overlay || null} onChanged={load} />
                    )}
                </div>
            )}
        </div>
    );
}

function RegisterForm({
    registrationOpen,
    mode,
    region,
    eligibleRiotAccounts,
    onRegistered,
}: {
    registrationOpen: boolean;
    mode?: string;
    region: string;
    eligibleRiotAccounts: { id: number; riotId: string; riotTagLine: string }[];
    onRegistered: () => void;
}) {
    const { channelName, editionSlug } = useParams<{ channelName: string; editionSlug: string }>();
    const [displayName, setDisplayName] = useState('');
    const [primaryRole, setPrimaryRole] = useState('');
    const [userRiotAccountId, setUserRiotAccountId] = useState<number | null>(eligibleRiotAccounts[0]?.id ?? null);
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

    if (!registrationOpen) {
        return <p className="font-mono text-sm text-[#7C8AA6]">Las inscripciones no están abiertas para este torneo todavía.</p>;
    }

    const needsRiotAccount = mode === 'aram_teams';
    // ARAM es random/blind pick, no hay seleccion de linea — pedir el rol ahi no
    // cumple ninguna funcion (el sorteo de equipos es puro random, no balancea por
    // rol). Se mantiene para otros modos por si a futuro importa. Pedido del
    // usuario 24-08-2026.
    const showRole = mode !== 'aram_teams';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setResult(null);
        try {
            await api.post(`/me/tournament/${channelName}/${editionSlug}/register`, {
                displayName,
                primaryRole: showRole ? (primaryRole || null) : null,
                userRiotAccountId: needsRiotAccount ? userRiotAccountId : null,
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
            <div className="p-4 rounded-lg border border-dashed border-[#232C42] space-y-2">
                <p className="text-sm text-[#7C8AA6]">
                    Para inscribirte necesitás una cuenta de Riot verificada de la región{' '}
                    <span className="font-bold text-[#EDF0F7]">{(REGION_LABELS[region] || region.toUpperCase())}</span> — todavía no tenés ninguna.
                </p>
                <Link to="/settings" className="text-sm text-[#3ED6C4] hover:underline">
                    Vincularla en Settings →
                </Link>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="font-mono text-[10px] uppercase tracking-wider text-[#7C8AA6]">Nombre público</label>
                <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-[#232C42] bg-[#0F1729] text-[#EDF0F7] text-sm"
                />
            </div>
            {needsRiotAccount && (
                <div>
                    <label className="font-mono text-[10px] uppercase tracking-wider text-[#7C8AA6]">Cuenta de Riot ({(REGION_LABELS[region] || region.toUpperCase())})</label>
                    <select
                        value={userRiotAccountId ?? ''}
                        onChange={(e) => setUserRiotAccountId(Number(e.target.value))}
                        required
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#232C42] bg-[#0F1729] text-[#EDF0F7] text-sm"
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
                    <label className="font-mono text-[10px] uppercase tracking-wider text-[#7C8AA6]">Rol principal</label>
                    <select
                        value={primaryRole}
                        onChange={(e) => setPrimaryRole(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#232C42] bg-[#0F1729] text-[#EDF0F7] text-sm"
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
            {!needsRiotAccount && <p className="text-[10px] text-[#7C8AA6]">Después de inscribirte vas a poder vincular tu cuenta de Riot desde acá mismo.</p>}
            {result && !result.ok && <p className="text-sm text-[#E8677A]">{result.text}</p>}
            <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-lg bg-[#3ED6C4] text-[#0B1120] font-bold text-sm hover:bg-[#5EE8D8] disabled:opacity-50 flex items-center justify-center gap-1.5"
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
    group,
    onChanged,
}: {
    channelName: string;
    editionSlug: string;
    teamSize: number;
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
            <h2 className="font-display font-bold">Mi dúo / grupo</h2>
            <p className="text-xs text-[#7C8AA6]">
                Por defecto te anotás solo y el sistema te sortea un equipo de {teamSize} al azar. Si querés jugar con alguien puntual, armá un grupo acá y
                compartile el código — el resto de los solos se sortea igual para completar lo que falte.
            </p>

            {group ? (
                <div className="p-4 rounded-lg border border-[#3ED6C4]/40 bg-[#132A2A] space-y-2">
                    <p className="font-mono text-sm text-[#3ED6C4]">
                        {group.roster.join(', ')} ({group.roster.length}/{teamSize})
                    </p>
                    {!group.full && group.joinCode && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-[#7C8AA6]">Código para compartir:</span>
                            <code className="text-sm font-mono px-2 py-1 rounded bg-[#131B2E] text-[#EDF0F7] tracking-widest">{group.joinCode}</code>
                            <button type="button" onClick={copyCode} className="p-1 rounded text-[#7C8AA6] hover:text-[#3ED6C4]">
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                            {copied && <span className="text-[10px] text-[#3ED6C4]">copiado</span>}
                        </div>
                    )}
                    {group.full && <p className="text-xs text-[#7C8AA6]">Grupo completo — listo para el sorteo del bracket.</p>}
                </div>
            ) : (
                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={saving}
                        className="w-full py-2.5 rounded-lg bg-[#131B2E] border border-[#232C42] text-[#EDF0F7] font-bold text-sm hover:border-[#3ED6C4]/50 disabled:opacity-50"
                    >
                        Armar grupo nuevo
                    </button>
                    <form onSubmit={handleJoin} className="flex items-center gap-2">
                        <input
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="Código de un amigo"
                            className="flex-1 px-3 py-2 rounded-lg border border-[#232C42] bg-[#0F1729] text-[#EDF0F7] text-sm font-mono tracking-widest"
                        />
                        <button
                            type="submit"
                            disabled={saving || !joinCode}
                            className="px-4 py-2 rounded-lg bg-[#3ED6C4] text-[#0B1120] font-bold text-sm hover:bg-[#5EE8D8] disabled:opacity-50"
                        >
                            Unirme
                        </button>
                    </form>
                </div>
            )}
            {error && (
                <p className="text-sm text-[#E8677A] flex items-center gap-1">
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
            <h2 className="font-display font-bold flex items-center gap-2">
                Cuenta de Riot para este torneo
                {participant.linkedRiotAccountId && <ShieldCheck className="w-4 h-4 text-[#3ED6C4]" />}
            </h2>

            {participant.linkedRiotAccountId ? (
                <div className="space-y-2">
                    <p className="font-mono text-sm text-[#3ED6C4]">
                        Usando: {participant.riotId}#{participant.riotTagLine}
                    </p>
                    {participant.smurfFlagNote && (
                        <p className="text-xs text-[#E8B04B] flex items-start gap-1.5 bg-[#E8B04B]/10 border border-[#E8B04B]/30 rounded-lg px-3 py-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {participant.smurfFlagNote}
                        </p>
                    )}
                </div>
            ) : eligibleAccounts.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-[#232C42] space-y-2">
                    <p className="text-sm text-[#7C8AA6]">
                        No tenés ninguna cuenta de Riot verificada para la región <span className="font-bold text-[#EDF0F7]">{(REGION_LABELS[region] || region.toUpperCase())}</span>{' '}
                        todavía.
                    </p>
                    <Link to="/settings" className="text-sm text-[#3ED6C4] hover:underline">
                        Vincularla en Settings →
                    </Link>
                </div>
            ) : (
                <div className="space-y-2">
                    <p className="text-xs text-[#7C8AA6]">Elegí cuál de tus cuentas verificadas de {(REGION_LABELS[region] || region.toUpperCase())} vas a usar en este torneo:</p>
                    {eligibleAccounts.map((a) => (
                        <button
                            key={a.id}
                            onClick={() => handlePick(a.id)}
                            disabled={picking !== null}
                            className="w-full text-left px-4 py-3 rounded-lg border border-[#232C42] bg-[#0F1729] hover:border-[#3ED6C4]/50 disabled:opacity-50 flex items-center justify-between"
                        >
                            <span className="font-mono text-sm">
                                {a.riotId}#{a.riotTagLine}
                            </span>
                            {picking === a.id ? <Loader2 className="w-4 h-4 animate-spin text-[#3ED6C4]" /> : <Check className="w-4 h-4 text-[#7C8AA6]" />}
                        </button>
                    ))}
                    <Link to="/settings" className="text-xs text-[#7C8AA6] hover:text-[#3ED6C4] inline-block">
                        + Vincular otra cuenta en Settings
                    </Link>
                </div>
            )}
            {error && (
                <p className="text-sm text-[#E8677A] flex items-center gap-1">
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
            <h2 className="font-display font-bold flex items-center gap-2">
                <Monitor className="w-4 h-4" /> Mi overlay para OBS
            </h2>
            <div className="flex flex-wrap gap-3">
                {Object.entries(OVERLAY_WIDGET_LABELS).map(([w, label]) => (
                    <label key={w} className="flex items-center gap-1.5 text-xs text-[#B8C1D6]">
                        <input type="checkbox" checked={widgets.includes(w)} onChange={() => toggleWidget(w)} />
                        {label}
                    </label>
                ))}
            </div>
            {overlay && (
                <div className="flex items-center gap-2">
                    <code className="text-xs px-2 py-1.5 rounded bg-[#131B2E] text-[#B8C1D6] truncate max-w-[280px]">{fullUrl}</code>
                    <button onClick={copyUrl} className="p-1.5 rounded text-[#7C8AA6] hover:text-[#3ED6C4]">
                        <Copy className="w-4 h-4" />
                    </button>
                    {copied && <span className="text-xs text-[#3ED6C4]">copiado</span>}
                </div>
            )}
            <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2 rounded-lg bg-[#131B2E] border border-[#232C42] text-[#EDF0F7] font-bold text-sm hover:border-[#3ED6C4]/50 disabled:opacity-50"
            >
                {generating ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} {overlay ? 'Regenerar link' : 'Generar link de overlay'}
            </button>
            {overlay && <p className="text-[10px] text-[#7C8AA6]">Regenerar invalida el link anterior — usalo solo si se filtró.</p>}
        </section>
    );
}
