/**
 * Decatron Coach · League of Legends. Ajustes del coach (nombre, tono, qué comenta) y
 * estado en vivo: fase del cliente que manda Decatron Desktop y lo último que dijo.
 * Fase 2 del plan (.dev/plans/LOL_COACH_PLAN.md). Textos en español como el panel de
 * Game Overlays; i18n pendiente junto con ese panel.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Gamepad2, Loader2, Save, Monitor, Download, MessageSquareText } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { useDesktopDownload } from '../../hooks/useDesktopDownload';
import api from '../../services/api';
import type { LivePhaseInfo } from './game-overlays/types';

interface Settings {
    enabled: boolean; coachName: string; tone: 'analyst' | 'hype' | 'troll';
    commentPicks: boolean; postGameSummary: boolean; showOnOverlay: boolean;
    champPool: string; notes: string;
}
interface CoachMsg { kind: string; comment: string; suggestion?: string | null; runes?: string | null; spells?: string | null; build?: string | null; matchup?: string | null; tips: string[]; coachName: string; at: string; }
interface State { desktopConnected: boolean; clientConnected: boolean; summoner?: string | null; phase?: LivePhaseInfo | null; history: CoachMsg[]; callsThisSelect: number; maxCallsPerSelect: number; }

const TONES: Record<Settings['tone'], { label: string; desc: string }> = {
    analyst: { label: 'Analista', desc: 'Tranquilo, concreto, útil.' },
    hype: { label: 'Hype', desc: 'Caster con energía, frases cortas.' },
    troll: { label: 'Troll', desc: 'Sarcástico, se burla con cariño. Nunca tóxico con otros.' },
};
const PHASE_LABEL: Record<string, string> = { none: 'En el cliente', lobby: 'En lobby', matchmaking: 'Buscando partida', champselect: 'Selección de campeón', ingame: 'En partida', postgame: 'Fin de partida' };
const KIND_LABEL: Record<string, string> = { pick: 'Pick / ban', my_turn: 'Tu turno', final: 'Plan final', postgame: 'Post-partida' };

export default function LolCoachConfig() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const canEdit = hasMinimumLevel('control_total');
    const download = useDesktopDownload();

    const [settings, setSettings] = useState<Settings | null>(null);
    const [meta, setMeta] = useState<{ aiAvailable: boolean; linkedAccounts: number } | null>(null);
    const [state, setState] = useState<State | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

    const load = useCallback(async () => {
        try {
            const [s, st] = await Promise.all([api.get('/lol-coach/settings'), api.get('/lol-coach/state')]);
            setSettings(s.data.settings); setMeta({ aiAvailable: s.data.aiAvailable, linkedAccounts: s.data.linkedAccounts }); setState(st.data);
        } catch { setMessage({ text: 'No se pudo cargar.', error: true }); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        const id = setInterval(async () => { try { setState((await api.get('/lol-coach/state')).data); } catch { /* sin cambios */ } }, 4000);
        return () => clearInterval(id);
    }, []);

    const update = (patch: Partial<Settings>) => setSettings(p => p ? { ...p, ...patch } : p);
    const save = async () => {
        if (!settings) return;
        setSaving(true); setMessage(null);
        try { const r = await api.put('/lol-coach/settings', settings); setSettings(r.data); setMessage({ text: 'Guardado. La app se entera sola.' }); }
        catch (e: any) { setMessage({ text: e?.response?.data?.message || 'No se pudo guardar.', error: true }); }
        finally { setSaving(false); }
    };

    if (permissionsLoading || loading) return <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">Cargando…</div>;
    if (!hasMinimumLevel('moderation')) { navigate('/dashboard'); return null; }
    if (!settings) return null;

    const card = 'bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]';
    const label = 'text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]';
    const muted = 'text-sm text-[#64748b] dark:text-[#94a3b8]';
    const input = 'w-full px-3 py-2 rounded-lg bg-white dark:bg-[#222324] border border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc] text-sm';
    const phase = state?.phase;
    const cs = phase?.champSelect;

    return (
        <div className="max-w-[1200px] mx-auto space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/features')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#222324]"><ArrowLeft className="w-5 h-5 text-[#64748b]" /></button>
                    <div>
                        <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-3"><Gamepad2 className="w-8 h-8 text-[#c8aa6e]" /> Decatron Coach · LoL</h1>
                        <p className={muted}>Comenta la selección de campeón, te da runas/spells/build al lockear y una opinión al terminar. En partida se calla (reglas de Riot).</p>
                    </div>
                </div>
                {canEdit && (
                    <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-[#9146FF] hover:bg-[#7c3aed] text-white text-sm inline-flex items-center gap-2 disabled:opacity-50">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
                    </button>
                )}
            </div>

            {message && <div className={`p-3 rounded-lg text-sm ${message.error ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'}`}>{message.text}</div>}

            {/* Requisitos */}
            <div className={card}>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <Req ok={(meta?.linkedAccounts ?? 0) > 0} label="Cuenta de LoL vinculada" hint={<Link to="/overlays/games" className="underline">Overlays → Game Overlays → Cuentas</Link>} />
                    <Req ok={!!state?.desktopConnected} label="Decatron Desktop conectado" hint={<a href={download.url} className="underline inline-flex items-center gap-1"><Download className="w-3 h-3" /> {download.label}</a>} />
                    <Req ok={!!state?.clientConnected} label={`Cliente de LoL abierto${state?.summoner ? ` (${state.summoner})` : ''}`} hint="Abre League of Legends con la app corriendo" />
                </div>
                {meta && !meta.aiAvailable && <p className="mt-3 text-sm text-red-600">La IA no está configurada en el servidor (OpenRouter). Avisa al admin.</p>}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Ajustes */}
                <div className={`${card} space-y-5`}>
                    <label className="flex items-center justify-between cursor-pointer">
                        <div><div className={label}>Coach activo</div><div className={muted}>Empieza a comentar en la próxima selección de campeón.</div></div>
                        <input type="checkbox" className="w-5 h-5" checked={settings.enabled} onChange={e => update({ enabled: e.target.checked })} disabled={!canEdit} />
                    </label>
                    <div>
                        <div className={label}>Nombre del coach</div>
                        <div className={muted}>Así se presenta en el overlay y en el chat (`!coach`). Ponle el que quieras: Jarvis, Sensei, Coach…</div>
                        <input className={`${input} mt-1`} value={settings.coachName} maxLength={40} onChange={e => update({ coachName: e.target.value })} disabled={!canEdit} />
                    </div>
                    <div>
                        <div className={label}>Tono</div>
                        <div className="grid grid-cols-3 gap-2 mt-1">
                            {(Object.keys(TONES) as Settings['tone'][]).map(t => (
                                <button key={t} disabled={!canEdit} onClick={() => update({ tone: t })} className={`p-3 rounded-lg border text-left ${settings.tone === t ? 'border-[#9146FF] bg-[#9146FF]/10' : 'border-[#e2e8f0] dark:border-[#374151]'}`}>
                                    <div className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">{TONES[t].label}</div>
                                    <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">{TONES[t].desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <Check checked={settings.commentPicks} onChange={v => update({ commentPicks: v })} disabled={!canEdit} label="Comentar cada pick y ban" hint="Hasta 8 comentarios por selección. Si lo apagas, solo habla en tu turno y al final (2 llamadas)." />
                    <Check checked={settings.postGameSummary} onChange={v => update({ postGameSummary: v })} disabled={!canEdit} label="Opinión automática al terminar la partida" hint="Si lo apagas, solo con !coach (mods)." />
                    <Check checked={settings.showOnOverlay} onChange={v => update({ showOnOverlay: v })} disabled={!canEdit} label="Mostrar lo que dice en el overlay" hint='Widget "Coach dice" en Game Overlays → Diseño. Si lo apagas, solo lo ves tú en la app y con los comandos.' />
                    <div>
                        <div className={label}>Tu champ pool <span className="font-normal text-[#94a3b8]">(opcional)</span></div>
                        <div className={muted}>Separado por comas. Si lo dejas vacío, usa tus campeones más jugados de las últimas 20.</div>
                        <input className={`${input} mt-1`} value={settings.champPool} maxLength={400} placeholder="Caitlyn, Jhin, Varus" onChange={e => update({ champPool: e.target.value })} disabled={!canEdit} />
                    </div>
                    <div>
                        <div className={label}>Notas para el coach <span className="font-normal text-[#94a3b8]">(opcional)</span></div>
                        <div className={muted}>Van al prompt tal cual: "odio jugar tanques", "soy support pero me ponen mid", "no me recomiendes Yasuo".</div>
                        <textarea className={`${input} mt-1`} rows={3} value={settings.notes} maxLength={600} onChange={e => update({ notes: e.target.value })} disabled={!canEdit} />
                    </div>
                    <p className="text-xs text-[#94a3b8]">Comandos del chat: <code>!matchup</code>, <code>!build</code> (<code>!runas</code>) para todos; <code>!coach</code> para mods. Se activan en Comandos → Juegos.</p>
                </div>

                {/* En vivo */}
                <div className="space-y-6">
                    <div className={card}>
                        <div className="flex items-center gap-2 mb-3"><Monitor className="w-4 h-4 text-[#94a3b8]" /><span className={label}>Ahora mismo</span></div>
                        {!state?.clientConnected ? <p className={muted}>Sin cliente de LoL. Cuando abras el juego con Decatron Desktop, aquí ves la fase y los picks en tiempo real.</p> : (
                            <div className="space-y-2 text-sm">
                                <div className="text-[#1e293b] dark:text-[#f8fafc] font-semibold">{PHASE_LABEL[phase?.phase ?? 'none']}{phase?.queueName ? ` · ${phase.queueName}` : ''}</div>
                                {phase?.lobby?.length ? <div className={muted}>Lobby: {phase.lobby.map(m => m.name + (m.isMe ? ' (tú)' : '')).join(', ')}</div> : null}
                                {cs && (
                                    <div className="space-y-1">
                                        <Team label="Tu equipo" picks={cs.myTeam} />
                                        <Team label="Rival" picks={cs.theirTeam} />
                                        {(cs.myBans.length + cs.theirBans.length) > 0 && <div className={muted}>Bans: {[...cs.myBans, ...cs.theirBans].map(b => b.name).join(', ')}</div>}
                                        <div className={muted}>{cs.myTurn ? '¡Te toca elegir!' : cs.timerPhase ?? ''} · llamadas IA en esta selección: {state.callsThisSelect}/{state.maxCallsPerSelect}</div>
                                    </div>
                                )}
                                {phase?.game && <div className={muted}>{phase.game.champion?.name}{phase.game.position ? ` · ${phase.game.position}` : ''} — el coach está en silencio hasta que termine.</div>}
                                {phase?.postGame && <div className={muted}>{phase.postGame.win ? 'Victoria' : 'Derrota'} · {phase.postGame.kills}/{phase.postGame.deaths}/{phase.postGame.assists}{phase.postGame.pointsDelta != null ? ` · ${phase.postGame.pointsDelta > 0 ? '+' : ''}${phase.postGame.pointsDelta} LP` : ''}</div>}
                            </div>
                        )}
                    </div>
                    <div className={card}>
                        <div className="flex items-center gap-2 mb-3"><MessageSquareText className="w-4 h-4 text-[#94a3b8]" /><span className={label}>Lo último que dijo</span></div>
                        {!state?.history?.length ? <p className={muted}>Todavía nada. Aparece aquí cada comentario, con runas/build/tips cuando los da.</p> : (
                            <div className="space-y-3">
                                {state.history.map((m, i) => (
                                    <div key={i} className="p-3 rounded-lg bg-[#f8fafc] dark:bg-[#222324] text-sm">
                                        <div className="flex justify-between text-xs text-[#94a3b8]"><span>{KIND_LABEL[m.kind] ?? m.kind} · {m.coachName}</span><span>{new Date(m.at).toLocaleTimeString()}</span></div>
                                        <div className="text-[#1e293b] dark:text-[#f8fafc] mt-1">{m.comment}</div>
                                        {m.suggestion && <div className="mt-1"><b>Sugerencia:</b> {m.suggestion}</div>}
                                        {m.matchup && <div className="mt-1"><b>Matchup:</b> {m.matchup}</div>}
                                        {(m.runes || m.spells || m.build) && <div className="mt-1 text-[#64748b] dark:text-[#94a3b8]">{[m.runes, m.spells, m.build].filter(Boolean).join(' · ')}</div>}
                                        {m.tips?.length > 0 && <ul className="mt-1 list-disc ml-5 text-[#64748b] dark:text-[#94a3b8]">{m.tips.map((t, j) => <li key={j}>{t}</li>)}</ul>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Req({ ok, label, hint }: { ok: boolean; label: string; hint: ReactNode }) {
    return (
        <div className="flex items-start gap-2">
            <span className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
            <div><div className="font-semibold text-[#1e293b] dark:text-[#f8fafc]">{label}</div>{!ok && <div className="text-[#64748b] dark:text-[#94a3b8]">{hint}</div>}</div>
        </div>
    );
}

function Check({ checked, onChange, disabled, label, hint }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; hint?: string }) {
    return (
        <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 mt-1" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} />
            <div><div className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">{label}</div>{hint && <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">{hint}</div>}</div>
        </label>
    );
}

function Team({ label, picks }: { label: string; picks: { cellId: number; champion?: { name: string; icon?: string | null } | null; isMe: boolean; locked: boolean; position?: string | null }[] }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-xs text-[#94a3b8] w-16">{label}</span>
            {picks.map(p => (
                <div key={p.cellId} title={`${p.champion?.name ?? '—'}${p.position ? ` · ${p.position}` : ''}`} className={`w-8 h-8 rounded overflow-hidden bg-[#1c1f26] border-2 ${p.isMe ? 'border-[#c8aa6e]' : 'border-transparent'} ${p.champion && !p.locked ? 'opacity-50' : ''}`}>
                    {p.champion?.icon && <img src={p.champion.icon} alt="" className="w-full h-full object-cover" />}
                </div>
            ))}
        </div>
    );
}
