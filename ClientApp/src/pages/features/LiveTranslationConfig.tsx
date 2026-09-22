import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDesktopDownload } from '../../hooks/useDesktopDownload';
import { ArrowLeft, Languages, Loader2, Save, Square, Monitor, Chrome, Download, Radio, Users, Coins, Clock } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import api from '../../services/api';

interface Settings {
    enabled: boolean;
    sourceLanguage: string;
    targetLanguages: string[];
    voiceEngine: string;
    voices: Record<string, string>;
    announceInChat: boolean;
    announceMessage: string | null;
    backgroundVolume: number;
}

interface Voice { id: string; name: string; language: string; gender: string }
interface Engine { name: string; configured: boolean; supportsCloning: boolean; voices: Voice[] }

interface LiveStatus {
    configured: boolean;
    session: null | {
        active: boolean; login: string; languages: string[]; listeners: Record<string, number>;
        activePipelines: string[]; speechSeconds: number; segments: number; creditsUsed: number;
        startedAt: string; lastError: string | null; notice?: string | null;
    };
    credits: { totalAvailable: number; isUnlimited: boolean; tier: string };
}

interface SessionRow {
    id: number; startedAt: string; endedAt: string | null; speechSeconds: number; segments: number;
    charsByLanguage: Record<string, number>; peakListeners: number; creditsUsed: number; endReason: string | null;
}

const LANG_NAMES: Record<string, string> = { en: 'English', es: 'Español', pt: 'Português', fr: 'Français', de: 'Deutsch', it: 'Italiano', ja: '日本語', ko: '한국어', ru: 'Русский' };
const EXTENSION_URL = 'https://github.com/decatrondev/decatron-extension';

const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60), sec = Math.round(s % 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(sec).padStart(2, '0')}`;
};

export default function LiveTranslationConfig() {
    const navigate = useNavigate();
    const { t } = useTranslation(['features']);
    const download = useDesktopDownload();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const canEdit = hasMinimumLevel('control_total');

    const [settings, setSettings] = useState<Settings | null>(null);
    const [engines, setEngines] = useState<Engine[]>([]);
    const [languages, setLanguages] = useState<string[]>([]);
    const [status, setStatus] = useState<LiveStatus | null>(null);
    const [sessions, setSessions] = useState<SessionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

    const load = useCallback(async () => {
        try {
            const [s, v, st, h] = await Promise.all([
                api.get('/live-translation/settings'),
                api.get('/live-translation/voices'),
                api.get('/live-translation/status'),
                api.get('/live-translation/sessions?limit=20'),
            ]);
            setSettings({ ...s.data, voices: s.data.voices ?? {}, targetLanguages: s.data.targetLanguages ?? [] });
            setEngines(v.data.engines ?? []);
            setLanguages(v.data.languages ?? []);
            setStatus(st.data);
            setSessions(h.data ?? []);
        } catch {
            setMessage({ text: t('liveTranslation.loadError'), error: true });
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { load(); }, [load]);

    // Estado en vivo cada 5 s mientras la página esté abierta.
    useEffect(() => {
        const id = setInterval(async () => {
            try { const st = await api.get('/live-translation/status'); setStatus(st.data); } catch { /* sin cambios */ }
        }, 5000);
        return () => clearInterval(id);
    }, []);

    const engine = useMemo(() => engines.find(e => e.name === settings?.voiceEngine) ?? engines[0], [engines, settings?.voiceEngine]);

    const update = (patch: Partial<Settings>) => setSettings(prev => prev ? { ...prev, ...patch } : prev);

    const toggleLang = (lang: string) => {
        if (!settings) return;
        const has = settings.targetLanguages.includes(lang);
        update({ targetLanguages: has ? settings.targetLanguages.filter(l => l !== lang) : [...settings.targetLanguages, lang] });
    };

    const save = async () => {
        if (!settings) return;
        setSaving(true); setMessage(null);
        try {
            const res = await api.put('/live-translation/settings', settings);
            setSettings({ ...res.data, voices: res.data.voices ?? {}, targetLanguages: res.data.targetLanguages ?? [] });
            setMessage({ text: t('liveTranslation.saved') });
        } catch (e: any) {
            setMessage({ text: e?.response?.data?.message || t('liveTranslation.saveError'), error: true });
        } finally {
            setSaving(false);
        }
    };

    const stop = async () => {
        if (!confirm(t('liveTranslation.confirmStop'))) return;
        try { await api.post('/live-translation/stop'); load(); } catch { setMessage({ text: t('liveTranslation.saveError'), error: true }); }
    };

    if (permissionsLoading || loading) {
        return <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">{t('liveTranslation.loading')}</div>;
    }
    if (!hasMinimumLevel('moderation')) { navigate('/dashboard'); return null; }
    if (!settings) return null;

    const session = status?.session ?? null;
    const card = 'bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]';
    const label = 'text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]';
    const muted = 'text-sm text-[#64748b] dark:text-[#94a3b8]';
    const input = 'w-full px-3 py-2 rounded-lg bg-white dark:bg-[#222324] border border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc] text-sm';

    return (
        <div className="max-w-[1200px] mx-auto space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/features')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#222324]">
                        <ArrowLeft className="w-5 h-5 text-[#64748b]" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-3">
                            <Languages className="w-8 h-8 text-[#9146FF]" /> {t('liveTranslation.title')}
                        </h1>
                        <p className={`${muted} mt-1`}>{t('liveTranslation.subtitle')}</p>
                    </div>
                </div>
                {canEdit && (
                    <button onClick={save} disabled={saving}
                            className="px-4 py-2 rounded-lg bg-[#9146FF] hover:bg-[#a970ff] text-white font-semibold flex items-center gap-2 disabled:opacity-50">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t('liveTranslation.save')}
                    </button>
                )}
            </div>

            {message && (
                <div className={`p-3 rounded-lg text-sm ${message.error ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'}`}>
                    {message.text}
                </div>
            )}

            {status && !status.configured && (
                <div className="p-3 rounded-lg text-sm bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300">{t('liveTranslation.notConfigured')}</div>
            )}

            {/* Sesión en vivo */}
            <div className={card}>
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${session ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
                        <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                            {session ? t('liveTranslation.live.active') : t('liveTranslation.live.idle')}
                        </h2>
                    </div>
                    {session && canEdit && (
                        <button onClick={stop} className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold flex items-center gap-2">
                            <Square className="w-4 h-4" /> {t('liveTranslation.live.stop')}
                        </button>
                    )}
                </div>
                {session ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Stat icon={<Clock className="w-4 h-4" />} value={fmtDuration(session.speechSeconds)} label={t('liveTranslation.live.spoken')} />
                        <Stat icon={<Radio className="w-4 h-4" />} value={String(session.segments)} label={t('liveTranslation.live.phrases')} />
                        <Stat icon={<Users className="w-4 h-4" />} value={String(Object.values(session.listeners).reduce((a, b) => a + b, 0))} label={t('liveTranslation.live.listeners')} />
                        <Stat icon={<Coins className="w-4 h-4" />} value={session.creditsUsed.toLocaleString()} label={t('liveTranslation.live.credits')} />
                        <div className="col-span-2 md:col-span-4 flex flex-wrap gap-2 mt-1">
                            {session.languages.map(l => (
                                <span key={l} className={`px-3 py-1 rounded-full text-xs font-semibold ${session.activePipelines.includes(l) ? 'bg-[#9146FF]/15 text-[#7c3aed] dark:text-[#bf94ff]' : 'bg-gray-100 dark:bg-[#222324] text-[#64748b]'}`}>
                                    {LANG_NAMES[l] || l.toUpperCase()} · {session.listeners[l] ?? 0}
                                </span>
                            ))}
                        </div>
                        {session.notice && <p className="col-span-2 md:col-span-4 text-sm text-amber-500">{session.notice}</p>}
                        {session.lastError && <p className="col-span-2 md:col-span-4 text-sm text-red-500">{session.lastError}</p>}
                    </div>
                ) : (
                    <p className={muted}>{t('liveTranslation.live.hint')}</p>
                )}
                {status && (
                    <p className={`${muted} mt-4`}>
                        {status.credits.isUnlimited ? t('liveTranslation.live.unlimited') : t('liveTranslation.live.balance', { n: status.credits.totalAvailable.toLocaleString() })}
                    </p>
                )}
            </div>

            {/* Cómo funciona / descargas */}
            <div className="grid md:grid-cols-2 gap-4">
                <a href={download.url} target="_blank" rel="noreferrer" className={`${card} hover:border-[#9146FF] transition-colors flex gap-4 items-start`}>
                    <div className="w-10 h-10 rounded-lg bg-[#9146FF] text-white flex items-center justify-center shrink-0"><Monitor className="w-5 h-5" /></div>
                    <div>
                        <div className={label}>{t('liveTranslation.steps.app.title')}</div>
                        <p className={`${muted} mt-1`}>{t('liveTranslation.steps.app.text')}</p>
                        <span className="text-sm text-[#7c3aed] dark:text-[#bf94ff] mt-2 inline-flex items-center gap-1"><Download className="w-4 h-4" /> {download.label}</span>
                        {/* El card ya es un <a>: no se puede anidar otro enlace. */}
                        <span role="link" tabIndex={0} className={`${muted} text-xs mt-1 block underline-offset-2 hover:underline`}
                              onClick={e => { e.preventDefault(); e.stopPropagation(); window.open(download.releasesUrl, '_blank', 'noopener'); }}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); window.open(download.releasesUrl, '_blank', 'noopener'); } }}>
                            {download.otherPlatformsLabel}
                        </span>
                    </div>
                </a>
                <a href={EXTENSION_URL} target="_blank" rel="noreferrer" className={`${card} hover:border-[#9146FF] transition-colors flex gap-4 items-start`}>
                    <div className="w-10 h-10 rounded-lg bg-[#1e293b] dark:bg-[#374151] text-white flex items-center justify-center shrink-0"><Chrome className="w-5 h-5" /></div>
                    <div>
                        <div className={label}>{t('liveTranslation.steps.ext.title')}</div>
                        <p className={`${muted} mt-1`}>{t('liveTranslation.steps.ext.text')}</p>
                        <span className="text-sm text-[#7c3aed] dark:text-[#bf94ff] mt-2 inline-flex items-center gap-1"><Download className="w-4 h-4" /> {t('liveTranslation.steps.ext.cta')}</span>
                    </div>
                </a>
            </div>

            {/* Configuración */}
            <div className={card}>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">{t('liveTranslation.config.title')}</h2>
                        <p className={muted}>{t('liveTranslation.config.subtitle')}</p>
                    </div>
                    <button onClick={() => canEdit && update({ enabled: !settings.enabled })} disabled={!canEdit}
                            className={`relative w-14 h-8 rounded-full transition-colors ${settings.enabled ? 'bg-[#9146FF]' : 'bg-gray-300 dark:bg-gray-600'} disabled:opacity-50`}
                            aria-label={t('liveTranslation.config.enabled')}>
                        <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${settings.enabled ? 'translate-x-6' : ''}`} />
                    </button>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <div className={label}>{t('liveTranslation.config.source')}</div>
                        <p className={`${muted} mb-2`}>{t('liveTranslation.config.sourceHint')}</p>
                        <select className={input} value={settings.sourceLanguage} disabled={!canEdit}
                                onChange={e => update({ sourceLanguage: e.target.value, targetLanguages: settings.targetLanguages.filter(l => l !== e.target.value) })}>
                            {languages.map(l => <option key={l} value={l}>{LANG_NAMES[l] || l}</option>)}
                        </select>
                    </div>
                    <div>
                        <div className={label}>{t('liveTranslation.config.targets')}</div>
                        <p className={`${muted} mb-2`}>{t('liveTranslation.config.targetsHint')}</p>
                        <div className="flex flex-wrap gap-2">
                            {languages.filter(l => l !== settings.sourceLanguage).map(l => {
                                const on = settings.targetLanguages.includes(l);
                                return (
                                    <button key={l} type="button" disabled={!canEdit} onClick={() => toggleLang(l)}
                                            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${on ? 'bg-[#9146FF] border-[#9146FF] text-white' : 'border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc] hover:border-[#9146FF]'}`}>
                                        {LANG_NAMES[l] || l}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Voces por idioma */}
                <div className="mt-6">
                    <div className={label}>{t('liveTranslation.config.voices')}</div>
                    <p className={`${muted} mb-3`}>{t('liveTranslation.config.voicesHint')}</p>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <div className={`${muted} mb-1`}>{t('liveTranslation.config.engine')}</div>
                            <select className={input} value={settings.voiceEngine} disabled={!canEdit} onChange={e => update({ voiceEngine: e.target.value, voices: {} })}>
                                {engines.map(e => (
                                    <option key={e.name} value={e.name} disabled={!e.configured}>
                                        {e.name === 'deepgram' ? 'Deepgram Aura' : e.name === 'fish' ? 'Fish Audio' : e.name === 'piper' ? t('liveTranslation.config.enginePiper') : e.name}{e.name !== 'piper' && e.configured ? ` (${t('liveTranslation.config.enginePremium')})` : ''}{!e.configured ? ` (${t('liveTranslation.config.soon')})` : ''}
                                    </option>
                                ))}
                            </select>
                            <p className={`${muted} mt-1`}>{t('liveTranslation.config.engineHint')}</p>
                        </div>
                        {settings.targetLanguages.map(lang => {
                            const options = (engine?.voices ?? []).filter(v => v.language === lang);
                            return (
                                <div key={lang}>
                                    <div className={`${muted} mb-1`}>{LANG_NAMES[lang] || lang}</div>
                                    {engine?.voices?.length ? (
                                        <select className={input} value={settings.voices[lang] ?? ''} disabled={!canEdit}
                                                onChange={e => update({ voices: { ...settings.voices, [lang]: e.target.value } })}>
                                            <option value="">{t('liveTranslation.config.defaultVoice')}</option>
                                            {options.map(v => <option key={v.id} value={v.id}>{v.name} ({v.gender === 'f' ? '♀' : '♂'})</option>)}
                                        </select>
                                    ) : (
                                        <input className={input} placeholder={t('liveTranslation.config.voiceIdPlaceholder')} value={settings.voices[lang] ?? ''} disabled={!canEdit}
                                               onChange={e => update({ voices: { ...settings.voices, [lang]: e.target.value } })} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Chat y volumen */}
                <div className="mt-6 grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="flex items-center justify-between gap-3">
                            <span className={label}>{t('liveTranslation.config.announce')}</span>
                            <input type="checkbox" className="w-5 h-5 accent-[#9146FF]" checked={settings.announceInChat} disabled={!canEdit} onChange={e => update({ announceInChat: e.target.checked })} />
                        </label>
                        <p className={`${muted} mt-1 mb-2`}>{t('liveTranslation.config.announceHint')}</p>
                        <input className={input} value={settings.announceMessage ?? ''} disabled={!canEdit || !settings.announceInChat}
                               placeholder={t('liveTranslation.config.announcePlaceholder')} maxLength={400}
                               onChange={e => update({ announceMessage: e.target.value || null })} />
                    </div>
                    <div>
                        <div className="flex items-center justify-between">
                            <span className={label}>{t('liveTranslation.config.background')}</span>
                            <span className={muted}>{settings.backgroundVolume}%</span>
                        </div>
                        <p className={`${muted} mt-1 mb-2`}>{t('liveTranslation.config.backgroundHint')}</p>
                        <input type="range" min={0} max={60} value={settings.backgroundVolume} disabled={!canEdit} className="w-full accent-[#9146FF]"
                               onChange={e => update({ backgroundVolume: Number(e.target.value) })} />
                    </div>
                </div>
            </div>

            {/* Historial */}
            <div className={card}>
                <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">{t('liveTranslation.history.title')}</h2>
                {sessions.length === 0 ? (
                    <p className={muted}>{t('liveTranslation.history.empty')}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[#64748b] dark:text-[#94a3b8] border-b border-[#e2e8f0] dark:border-[#374151]">
                                    <th className="py-2 pr-4">{t('liveTranslation.history.date')}</th>
                                    <th className="py-2 pr-4">{t('liveTranslation.history.duration')}</th>
                                    <th className="py-2 pr-4">{t('liveTranslation.history.spoken')}</th>
                                    <th className="py-2 pr-4">{t('liveTranslation.history.phrases')}</th>
                                    <th className="py-2 pr-4">{t('liveTranslation.history.languages')}</th>
                                    <th className="py-2 pr-4">{t('liveTranslation.history.peak')}</th>
                                    <th className="py-2 pr-4">{t('liveTranslation.history.credits')}</th>
                                    <th className="py-2">{t('liveTranslation.history.end')}</th>
                                </tr>
                            </thead>
                            <tbody className="text-[#1e293b] dark:text-[#f8fafc]">
                                {sessions.map(s => {
                                    const end = s.endedAt ? new Date(s.endedAt) : null;
                                    const start = new Date(s.startedAt);
                                    return (
                                        <tr key={s.id} className="border-b border-[#f1f5f9] dark:border-[#26262c]">
                                            <td className="py-2 pr-4 whitespace-nowrap">{start.toLocaleString()}</td>
                                            <td className="py-2 pr-4">{end ? fmtDuration((end.getTime() - start.getTime()) / 1000) : t('liveTranslation.history.ongoing')}</td>
                                            <td className="py-2 pr-4">{fmtDuration(s.speechSeconds)}</td>
                                            <td className="py-2 pr-4">{s.segments}</td>
                                            <td className="py-2 pr-4">{Object.entries(s.charsByLanguage).map(([l, c]) => `${l.toUpperCase()} ${c.toLocaleString()}`).join(' · ') || '—'}</td>
                                            <td className="py-2 pr-4">{s.peakListeners}</td>
                                            <td className="py-2 pr-4">{s.creditsUsed.toLocaleString()}</td>
                                            <td className="py-2">{s.endReason ? t(`liveTranslation.reasons.${s.endReason}`, { defaultValue: s.endReason }) : '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
    return (
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#222324] border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8] text-xs">{icon} {label}</div>
            <div className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] mt-1">{value}</div>
        </div>
    );
}
