/**
 * Decatron Coach · League of Legends. Ajustes del coach (nombre, tono, qué comenta) y
 * estado en vivo: fase del cliente que manda Decatron Desktop y lo último que dijo.
 * Fase 2 del plan (.dev/plans/LOL_COACH_PLAN.md). Textos en el namespace `games` (lolCoach.*).
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MovedToLiveNotice } from './live-overlay/MovedToLiveNotice';
import { ArrowLeft, Gamepad2, Loader2, Save, Monitor, Download, MessageSquareText } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { useDesktopDownload } from '../../hooks/useDesktopDownload';
import api from '../../services/api';
import type { LivePhaseInfo } from './game-overlays/types';

interface Settings {
    enabled: boolean; coachName: string; tone: 'analyst' | 'hype' | 'troll';
    commentPicks: boolean; postGameSummary: boolean; showOnOverlay: boolean;
    champPool: string; notes: string;
    voiceEnabled: boolean; voiceId: string; voiceKinds: string[];
    briefing: boolean; tiltCheck: boolean; lobbyComments: boolean; dailyGoal: string;
    predictionsEnabled: boolean; predictionStartPoints: number; predictionCloseMinutes: number;
}
interface Voice { id: string; name: string; language: string; gender: string }
interface CoachMsg { kind: string; comment: string; suggestion?: string | null; runes?: string | null; spells?: string | null; build?: string | null; matchup?: string | null; tips: string[]; coachName: string; at: string; }
interface State { desktopConnected: boolean; clientConnected: boolean; summoner?: string | null; phase?: LivePhaseInfo | null; history: CoachMsg[]; callsThisSelect: number; maxCallsPerSelect: number; callsToday: number; hasCredits: boolean; }

const TONES: Settings['tone'][] = ['analyst', 'hype', 'troll'];
const VOICE_KINDS = ['my_turn', 'final', 'postgame', 'briefing', 'lobby', 'tilt', 'pick'];

export default function LolCoachConfig() {
    const navigate = useNavigate();
    const { t } = useTranslation('games', { keyPrefix: 'lolCoach' });
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const canEdit = hasMinimumLevel('control_total');
    const download = useDesktopDownload();

    const [settings, setSettings] = useState<Settings | null>(null);
    const [meta, setMeta] = useState<{ aiAvailable: boolean; linkedAccounts: number; voiceAvailable: boolean; voices: Voice[] } | null>(null);
    const [state, setState] = useState<State | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

    const load = useCallback(async () => {
        try {
            const [s, st] = await Promise.all([api.get('/lol-coach/settings'), api.get('/lol-coach/state')]);
            setSettings(s.data.settings); setMeta({ aiAvailable: s.data.aiAvailable, linkedAccounts: s.data.linkedAccounts, voiceAvailable: s.data.voiceAvailable, voices: s.data.voices ?? [] }); setState(st.data);
        } catch { setMessage({ text: t('loadError'), error: true }); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        const id = setInterval(async () => { try { setState((await api.get('/lol-coach/state')).data); } catch { /* sin cambios */ } }, 4000);
        return () => clearInterval(id);
    }, []);

    const update = (patch: Partial<Settings>) => setSettings(p => p ? { ...p, ...patch } : p);
    const toggleKind = (k: string) => { if (!settings) return; const has = settings.voiceKinds.includes(k); update({ voiceKinds: has ? settings.voiceKinds.filter(x => x !== k) : [...settings.voiceKinds, k] }); };
    const save = async () => {
        if (!settings) return;
        setSaving(true); setMessage(null);
        try { const r = await api.put('/lol-coach/settings', settings); setSettings(r.data); setMessage({ text: t('saved') }); }
        catch (e: any) { setMessage({ text: e?.response?.data?.message || t('saveError'), error: true }); }
        finally { setSaving(false); }
    };

    if (permissionsLoading || loading) return <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">{t('loading')}</div>;
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
                        <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-3"><Gamepad2 className="w-8 h-8 text-[#c8aa6e]" /> {t('title')}</h1>
                        <p className={muted}>{t('subtitle')}</p>
                    </div>
                </div>
                {canEdit && (
                    <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-[#9146FF] hover:bg-[#7c3aed] text-white text-sm inline-flex items-center gap-2 disabled:opacity-50">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t('save')}
                    </button>
                )}
            </div>

            {message && <div className={`p-3 rounded-lg text-sm ${message.error ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'}`}>{message.text}</div>}

            <MovedToLiveNotice />

            {/* Requisitos */}
            <div className={card}>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <Req ok={(meta?.linkedAccounts ?? 0) > 0} label={t('req.account')} hint={<Link to="/overlays/games" className="underline">{t('req.accountHint')}</Link>} />
                    <Req ok={!!state?.desktopConnected} label={t('req.desktop')} hint={<a href={download.url} className="underline inline-flex items-center gap-1"><Download className="w-3 h-3" /> {download.label}</a>} />
                    <Req ok={!!state?.clientConnected} label={`${t('req.client')}${state?.summoner ? ` (${state.summoner})` : ''}`} hint={t('req.clientHint')} />
                </div>
                {meta && !meta.aiAvailable && <p className="mt-3 text-sm text-red-600">{t('aiUnavailable')}</p>}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Ajustes */}
                <div className={`${card} space-y-5`}>
                    <label className="flex items-center justify-between cursor-pointer">
                        <div><div className={label}>{t('enabled')}</div><div className={muted}>{t('enabledHint')}</div></div>
                        <input type="checkbox" className="w-5 h-5" checked={settings.enabled} onChange={e => update({ enabled: e.target.checked })} disabled={!canEdit} />
                    </label>
                    <div>
                        <div className={label}>{t('coachName')}</div>
                        <div className={muted}>{t('coachNameHint')}</div>
                        <input className={`${input} mt-1`} value={settings.coachName} maxLength={40} onChange={e => update({ coachName: e.target.value })} disabled={!canEdit} />
                    </div>
                    <div>
                        <div className={label}>{t('tone')}</div>
                        <div className="grid grid-cols-3 gap-2 mt-1">
                            {TONES.map(tone => (
                                <button key={tone} disabled={!canEdit} onClick={() => update({ tone })} className={`p-3 rounded-lg border text-left ${settings.tone === tone ? 'border-[#9146FF] bg-[#9146FF]/10' : 'border-[#e2e8f0] dark:border-[#374151]'}`}>
                                    <div className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">{t(`tones.${tone}.label`)}</div>
                                    <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">{t(`tones.${tone}.desc`)}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <Check checked={settings.briefing} onChange={v => update({ briefing: v })} disabled={!canEdit} label={t('briefing')} hint={t('briefingHint')} />
                    <Check checked={settings.lobbyComments} onChange={v => update({ lobbyComments: v })} disabled={!canEdit} label={t('lobby')} hint={t('lobbyHint')} />
                    <Check checked={settings.tiltCheck} onChange={v => update({ tiltCheck: v })} disabled={!canEdit} label={t('tilt')} hint={t('tiltHint')} />
                    <div>
                        <div className={label}>{t('dailyGoal')} <span className="font-normal text-[#94a3b8]">({t('optional')})</span></div>
                        <div className={muted}>{t('dailyGoalHint')}</div>
                        <input className={`${input} mt-1`} value={settings.dailyGoal} maxLength={200} placeholder={t('dailyGoalPlaceholder')} onChange={e => update({ dailyGoal: e.target.value })} disabled={!canEdit} />
                    </div>
                    <Check checked={settings.commentPicks} onChange={v => update({ commentPicks: v })} disabled={!canEdit} label={t('commentPicks')} hint={t('commentPicksHint')} />
                    <Check checked={settings.postGameSummary} onChange={v => update({ postGameSummary: v })} disabled={!canEdit} label={t('postGame')} hint={t('postGameHint')} />
                    <Check checked={settings.showOnOverlay} onChange={v => update({ showOnOverlay: v })} disabled={!canEdit} label={t('showOnOverlay')} hint={t('showOnOverlayHint')} />
                    <div>
                        <div className={label}>{t('champPool')} <span className="font-normal text-[#94a3b8]">({t('optional')})</span></div>
                        <div className={muted}>{t('champPoolHint')}</div>
                        <input className={`${input} mt-1`} value={settings.champPool} maxLength={400} placeholder="Caitlyn, Jhin, Varus" onChange={e => update({ champPool: e.target.value })} disabled={!canEdit} />
                    </div>
                    <div>
                        <div className={label}>{t('notes')} <span className="font-normal text-[#94a3b8]">({t('optional')})</span></div>
                        <div className={muted}>{t('notesHint')}</div>
                        <textarea className={`${input} mt-1`} rows={3} value={settings.notes} maxLength={600} onChange={e => update({ notes: e.target.value })} disabled={!canEdit} />
                    </div>
                    <div className="pt-4 border-t border-[#e2e8f0] dark:border-[#374151] space-y-3">
                        <Check checked={settings.predictionsEnabled} onChange={v => update({ predictionsEnabled: v })} disabled={!canEdit} label={t('predictions')} hint={t('predictionsHint')} />
                        {settings.predictionsEnabled && (
                            <div className="grid grid-cols-2 gap-3">
                                <div><div className={label}>{t('predStartPoints')}</div><input type="number" className={`${input} mt-1`} min={100} max={100000} value={settings.predictionStartPoints} onChange={e => update({ predictionStartPoints: Number(e.target.value) })} disabled={!canEdit} /></div>
                                <div><div className={label}>{t('predCloseMinutes')}</div><input type="number" className={`${input} mt-1`} min={1} max={20} value={settings.predictionCloseMinutes} onChange={e => update({ predictionCloseMinutes: Number(e.target.value) })} disabled={!canEdit} /></div>
                                <p className="col-span-2 text-xs text-[#94a3b8]">{t('predCommands')}: <code>!pred win 200</code>, <code>!pred loss</code> ({t('predDefault')}), <code>!pred</code> ({t('predBalance')}), <code>!predtop</code>. {t('predMin')}</p>
                            </div>
                        )}
                    </div>
                    <div className="pt-4 border-t border-[#e2e8f0] dark:border-[#374151] space-y-3">
                        <Check checked={settings.voiceEnabled} onChange={v => update({ voiceEnabled: v })} disabled={!canEdit || !meta?.voiceAvailable} label={t('voice')} hint={t('voiceHint')} />
                        {settings.voiceEnabled && (
                            <>
                                <div>
                                    <div className={label}>{t('voiceId')}</div>
                                    <select className={`${input} mt-1`} value={settings.voiceId} onChange={e => update({ voiceId: e.target.value })} disabled={!canEdit}>
                                        <option value="">{t('voiceDefault')}</option>
                                        {(meta?.voices ?? []).map(v => <option key={v.id} value={v.id}>{v.name} · {v.language.toUpperCase()} · {v.gender === 'f' ? t('voiceFemale') : t('voiceMale')}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <div className={label}>{t('voiceWhen')}</div>
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                        {VOICE_KINDS.map(k => (
                                            <Check key={k} checked={settings.voiceKinds.includes(k)} onChange={() => toggleKind(k)} disabled={!canEdit} label={t(`voiceKinds.${k}`)} />
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <p className="text-xs text-[#94a3b8]">{t('chatCommands')}: <code>!matchup</code>, <code>!build</code> (<code>!runas</code>), <code>!vs &lt;{t('champion')}&gt;</code>, <code>!duo</code>, <code>!pool</code>, <code>!meta</code> {t('forEveryone')}; <code>!coach</code> {t('andSet')} <code>!meta &lt;{t('text')}&gt;</code> {t('forMods')}. {t('enableIn')}</p>
                </div>

                {/* En vivo */}
                <div className="space-y-6">
                    <div className={card}>
                        <div className="flex items-center gap-2 mb-3"><Monitor className="w-4 h-4 text-[#94a3b8]" /><span className={label}>{t('live.title')}</span></div>
                        {state && (
                            <p className={`text-xs mb-3 ${state.hasCredits ? 'text-[#94a3b8]' : 'text-amber-500'}`}>
                                {t('live.callsToday')}: {state.callsToday}
                                {!state.hasCredits && <> · {t('live.noCredits')} <a href="/supporters" className="underline">{t('live.seePlans')}</a></>}
                            </p>
                        )}
                        {!state?.clientConnected ? <p className={muted}>{t('live.noClient')}</p> : (
                            <div className="space-y-2 text-sm">
                                <div className="text-[#1e293b] dark:text-[#f8fafc] font-semibold">{t(`phases.${phase?.phase ?? 'none'}`)}{phase?.queueName ? ` · ${phase.queueName}` : ''}</div>
                                {phase?.lobby?.length ? (
                                    <div className={muted}>
                                        <div>{t('live.lobby')}:</div>
                                        <ul className="ml-4 list-disc">
                                            {phase.lobby.map((m, i) => (
                                                <li key={i}>
                                                    <span className="text-[#1e293b] dark:text-[#f8fafc]">{m.name}</span>{m.isMe ? ` (${t('live.you')})` : ''}
                                                    {m.scout && <> · {m.scout.tier ? `${m.scout.tier.charAt(0)}${m.scout.tier.slice(1).toLowerCase()} ${m.scout.division ?? ''} ${m.scout.lp ?? 0} LP` : t('live.unranked')}
                                                        {m.scout.games > 0 && <> · {t('live.last20')}: {m.scout.winRate}% {m.scout.streak !== 0 && <span className={m.scout.streak > 0 ? 'text-green-500' : 'text-red-500'}>({m.scout.streak > 0 ? '+' : ''}{m.scout.streak})</span>}</>}
                                                        {m.scout.topChampions.length > 0 && <> · {m.scout.topChampions.join(', ')}</>}</>}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}
                                {cs && (
                                    <div className="space-y-1">
                                        <Team label={t('live.myTeam')} picks={cs.myTeam} />
                                        <Team label={t('live.enemy')} picks={cs.theirTeam} />
                                        {(cs.myBans.length + cs.theirBans.length) > 0 && <div className={muted}>{t('live.bans')}: {[...cs.myBans, ...cs.theirBans].map(b => b.name).join(', ')}</div>}
                                        <div className={muted}>{cs.myTurn ? t('live.yourTurn') : cs.timerPhase ?? ''} · {t('live.aiCalls')}: {state.callsThisSelect}/{state.maxCallsPerSelect}</div>
                                    </div>
                                )}
                                {phase?.game && <div className={muted}>{phase.game.champion?.name}{phase.game.position ? ` · ${phase.game.position}` : ''} — {t('live.silent')}</div>}
                                {phase?.postGame && <div className={muted}>{phase.postGame.win ? t('live.victory') : t('live.defeat')} · {phase.postGame.kills}/{phase.postGame.deaths}/{phase.postGame.assists}{phase.postGame.pointsDelta != null ? ` · ${phase.postGame.pointsDelta > 0 ? '+' : ''}${phase.postGame.pointsDelta} LP` : ''}</div>}
                            </div>
                        )}
                    </div>
                    <div className={card}>
                        <div className="flex items-center gap-2 mb-3"><MessageSquareText className="w-4 h-4 text-[#94a3b8]" /><span className={label}>{t('history.title')}</span></div>
                        {!state?.history?.length ? <p className={muted}>{t('history.empty')}</p> : (
                            <div className="space-y-3">
                                {state.history.map((m, i) => (
                                    <div key={i} className="p-3 rounded-lg bg-[#f8fafc] dark:bg-[#222324] text-sm">
                                        <div className="flex justify-between text-xs text-[#94a3b8]"><span>{t(`kinds.${m.kind}`, { defaultValue: m.kind })} · {m.coachName}</span><span>{new Date(m.at).toLocaleTimeString()}</span></div>
                                        <div className="text-[#1e293b] dark:text-[#f8fafc] mt-1">{m.comment}</div>
                                        {m.suggestion && <div className="mt-1"><b>{t('history.suggestion')}:</b> {m.suggestion}</div>}
                                        {m.matchup && <div className="mt-1"><b>{t('history.matchup')}:</b> {m.matchup}</div>}
                                        {(m.runes || m.spells || m.build) && <div className="mt-1 text-[#64748b] dark:text-[#94a3b8]">{[m.runes, m.spells, m.build].filter(Boolean).join(' · ')}</div>}
                                        {m.tips?.length > 0 && <ul className="mt-1 list-disc ml-5 text-[#64748b] dark:text-[#94a3b8]">{m.tips.map((tip, j) => <li key={j}>{tip}</li>)}</ul>}
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
