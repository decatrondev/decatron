import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Download, FolderOpen, Loader2, Search, X, Monitor, RefreshCw, Trash2 } from 'lucide-react';
import api from '../../../../../services/api';
import { useDesktopDownload } from '../../../../../hooks/useDesktopDownload';
import { Card, Field, Select, Toggle, inputClass } from '../ui';
import { formatDuration, sourceName } from '../../utils';

// Descargas (.dev/plans/SONG_REQUEST_PLAN.md, fase 5): se piden acá y corren en Decatron Desktop,
// en la PC del streamer. El estado se consulta cada 1,5 s mientras la pestaña está abierta.

interface ToolStatus { ready: boolean; preparing: boolean; stage: string | null; percent: number | null; error: string | null; ytDlpVersion: string | null; ffmpegReady: boolean; folder: string; os: string }
interface Job { jobId: string; title: string; kind: string; format: string; state: string; percent: number | null; speed: string | null; eta: string | null; fileName: string | null; error: string | null; createdAt: string }
interface State { connected: boolean; supported: boolean; appVersion: string | null; status: ToolStatus | null; jobs: Job[] }
interface ProbeInfo { title: string; uploader: string | null; duration: number | null; thumbnail: string | null; webpageUrl: string; heights: number[]; hasVideo: boolean; subtitles: string[]; extractor: string }
interface Probe { url: string; info: ProbeInfo; origin: { source: string; title: string; artist: string; thumbnailUrl: string | null } | null }

const ACTIVE = ['queued', 'preparing', 'downloading', 'processing'];

/** "1:23" o "83" → 83 segundos. Vacío → null. */
function parseTime(text: string): number | null | 'invalid' {
    const t = text.trim();
    if (!t) return null;
    const parts = t.split(':').map(p => p.trim());
    if (parts.some(p => !/^\d+(\.\d+)?$/.test(p)) || parts.length > 3) return 'invalid';
    return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

export default function DownloadsTab({ initialInput, onInputConsumed }: { initialInput?: string | null; onInputConsumed?: () => void }) {
    const { t } = useTranslation('overlays');
    const desktop = useDesktopDownload();
    const [state, setState] = useState<State | null>(null);
    const [input, setInput] = useState(initialInput ?? '');
    const [probing, setProbing] = useState(false);
    const [probe, setProbe] = useState<Probe | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [starting, setStarting] = useState(false);

    // Opciones
    const [kind, setKind] = useState<'video' | 'audio'>('video');
    const [videoFormat, setVideoFormat] = useState('mp4');
    const [audioFormat, setAudioFormat] = useState('mp3');
    const [height, setHeight] = useState<string>('best');
    const [audioQuality, setAudioQuality] = useState('best');
    const [trim, setTrim] = useState(false);
    const [trimStart, setTrimStart] = useState('');
    const [trimEnd, setTrimEnd] = useState('');
    const [thumbnail, setThumbnail] = useState(true);
    const [subs, setSubs] = useState<string[]>([]);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/song-request/downloads');
            setState(res.data);
        } catch { /* se reintenta en el próximo ciclo */ }
    }, []);

    useEffect(() => {
        load();
        const id = window.setInterval(load, 1500);
        return () => window.clearInterval(id);
    }, [load]);

    const errorText = (code: string | null | undefined) =>
        t(`songRequest.downloads.errors.${code}`, { defaultValue: t(`songRequest.errors.${code}`, { defaultValue: t('songRequest.downloads.errors.download_failed') }) });

    const analyze = async (value = input) => {
        if (!value.trim()) return;
        setProbing(true); setError(null); setProbe(null);
        try {
            const res = await api.post('/song-request/downloads/probe', { input: value.trim() });
            if (!res.data.success) { setError(errorText(res.data.error)); return; }
            const p: Probe = res.data;
            setProbe(p);
            setKind(p.info.hasVideo ? 'video' : 'audio');
            setHeight('best');
            setSubs([]);
            setTrim(false); setTrimStart(''); setTrimEnd('');
        } catch { setError(errorText('probe_failed')); }
        finally { setProbing(false); }
    };

    // Llegó un link desde la Cola o el Historial: se analiza solo
    const consumed = useRef(false);
    useEffect(() => {
        if (initialInput && !consumed.current && state?.connected && state.supported) {
            consumed.current = true;
            setInput(initialInput);
            analyze(initialInput);
            onInputConsumed?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialInput, state?.connected, state?.supported]);

    const start = async () => {
        if (!probe) return;
        const from = trim ? parseTime(trimStart) : null;
        const to = trim ? parseTime(trimEnd) : null;
        if (from === 'invalid' || to === 'invalid' || (from != null && to != null && to <= from)) { setError(t('songRequest.downloads.errors.invalid_trim')); return; }
        setStarting(true); setError(null);
        try {
            const title = probe.origin ? `${probe.origin.artist} - ${probe.origin.title}` : probe.info.title;
            const res = await api.post('/song-request/downloads', {
                url: probe.url, title, kind,
                format: kind === 'audio' ? audioFormat : videoFormat,
                maxHeight: kind === 'video' && height !== 'best' ? Number(height) : null,
                audioQuality, trimStart: from, trimEnd: to, thumbnail,
                subtitles: kind === 'video' ? subs : [],
            });
            if (!res.data.success) setError(errorText(res.data.error));
            else { setProbe(null); setInput(''); load(); }
        } catch (e: any) { setError(errorText(e?.response?.data?.error ?? 'download_failed')); }
        finally { setStarting(false); }
    };

    const btn = 'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm 3xl:text-base font-bold bg-ds-raised text-ds-soft hover:bg-ds-raised transition-colors disabled:opacity-50';
    const primary = 'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm 3xl:text-base font-bold bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent disabled:opacity-50 shrink-0';

    if (!state) return <Card><Loader2 className="w-5 h-5 animate-spin text-ds-soft" /></Card>;

    // ── Sin app / app vieja ──
    if (!state.connected || !state.supported) {
        return (
            <Card title={t('songRequest.downloads.title')} description={t('songRequest.downloads.description')}>
                <div className="flex flex-col sm:flex-row items-start gap-4 p-4 rounded-lg border border-ds-warn/40 bg-ds-warn/10">
                    <Monitor className="w-8 h-8 text-ds-accent-text shrink-0" />
                    <div className="flex-1 space-y-3 text-sm 3xl:text-base text-ds-warn">
                        <p className="font-bold">{state.connected ? t('songRequest.downloads.outdatedTitle') : t('songRequest.downloads.offlineTitle')}</p>
                        <p>{state.connected ? t('songRequest.downloads.outdatedBody', { version: state.appVersion ?? '?' }) : t('songRequest.downloads.offlineBody')}</p>
                        <div className="flex flex-wrap gap-2">
                            <a href={desktop.url} target="_blank" rel="noreferrer" className={primary}><Download className="w-4 h-4" /> {desktop.label}</a>
                            {!state.connected && <Link to="/settings" className={btn}>{t('songRequest.downloads.linkApp')}</Link>}
                        </div>
                    </div>
                </div>
            </Card>
        );
    }

    const s = state.status!;
    const heights = probe?.info.heights ?? [];

    return (
        <div className="space-y-6">
            {/* Estado de la app */}
            <Card>
                <div className="flex flex-wrap items-center gap-3 justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.ready ? 'bg-ds-accent' : s.preparing ? 'bg-ds-warn animate-pulse' : 'bg-ds-faint'}`} />
                        <div className="min-w-0">
                            <p className="text-sm 3xl:text-base font-bold text-ds-text">
                                {t('songRequest.downloads.appConnected', { version: state.appVersion ?? '' })}
                            </p>
                            <p className="text-xs 3xl:text-sm text-ds-soft truncate">
                                {s.preparing ? t(`songRequest.downloads.stages.${s.stage ?? 'other'}`, { percent: s.percent ?? 0, defaultValue: t('songRequest.downloads.stages.other') })
                                    : s.ready ? t('songRequest.downloads.toolsReady', { version: s.ytDlpVersion }) : t('songRequest.downloads.toolsLater')}
                                {' · '}{s.folder}
                            </p>
                        </div>
                    </div>
                    <button className={btn} onClick={() => api.post('/song-request/downloads/open-folder', {})}><FolderOpen className="w-4 h-4" /> {t('songRequest.downloads.openFolder')}</button>
                </div>
                {s.error && <p className="text-sm 3xl:text-base text-ds-danger mt-3">{s.error}</p>}
                {s.preparing && s.percent != null && (
                    <div className="h-1.5 rounded-full bg-ds-raised overflow-hidden mt-3">
                        <div className="h-full bg-ds-accent transition-[width]" style={{ width: `${s.percent}%` }} />
                    </div>
                )}
            </Card>

            {/* Analizar */}
            <Card title={t('songRequest.downloads.title')} description={t('songRequest.downloads.description')}>
                <form className="flex gap-2" onSubmit={e => { e.preventDefault(); analyze(); }}>
                    <input value={input} onChange={e => setInput(e.target.value)} placeholder={t('songRequest.downloads.placeholder')} className={inputClass} maxLength={500} />
                    <button type="submit" disabled={probing || !input.trim()} className={primary}>
                        {probing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} {probing ? t('songRequest.downloads.analyzing') : t('songRequest.downloads.analyze')}
                    </button>
                </form>
                {probing && !s.ready && <p className="text-xs 3xl:text-sm text-ds-soft mt-2">{t('songRequest.downloads.firstTimeHint')}</p>}
                {error && <p className="text-sm 3xl:text-base text-ds-danger mt-2">{error}</p>}

                {probe && (
                    <div className="mt-5 space-y-5">
                        <div className="flex flex-col sm:flex-row gap-4">
                            {(probe.origin?.thumbnailUrl ?? probe.info.thumbnail) && (
                                <img src={probe.origin?.thumbnailUrl ?? probe.info.thumbnail ?? ''} alt="" className="w-full sm:w-48 3xl:w-56 aspect-video object-cover rounded-lg bg-ds-input" />
                            )}
                            <div className="min-w-0 space-y-1">
                                <p className="font-bold text-ds-text text-base 3xl:text-lg break-words">{probe.origin ? probe.origin.title : probe.info.title}</p>
                                <p className="text-sm 3xl:text-base text-ds-soft">
                                    {probe.origin ? probe.origin.artist : probe.info.uploader}
                                    {probe.info.duration ? ` · ${formatDuration(probe.info.duration)}` : ''}
                                    {` · ${probe.origin ? `${sourceName(probe.origin.source)} → YouTube` : probe.info.extractor}`}
                                </p>
                                <button className="text-xs 3xl:text-sm text-ds-soft hover:text-ds-danger flex items-center gap-1" onClick={() => setProbe(null)}><X className="w-3 h-3" /> {t('songRequest.downloads.discard')}</button>
                            </div>
                        </div>

                        <div className="flex gap-1 p-1 rounded-lg bg-ds-bg w-fit">
                            {(['video', 'audio'] as const).filter(k => k === 'audio' || probe.info.hasVideo).map(k => (
                                <button key={k} onClick={() => setKind(k)} className={`px-4 py-1.5 rounded-lg text-sm 3xl:text-base font-bold ${kind === k ? 'bg-ds-accent text-ds-on-accent' : 'text-ds-soft '}`}>
                                    {t(`songRequest.downloads.kinds.${k}`)}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {kind === 'video' ? (
                                <>
                                    <Field label={t('songRequest.downloads.quality')}>
                                        <Select value={height} onChange={setHeight} options={[{ value: 'best', label: t('songRequest.downloads.best') }, ...heights.map(h => ({ value: String(h), label: h >= 2160 ? `${h}p (4K)` : h >= 1440 ? `${h}p (2K)` : `${h}p` }))]} />
                                    </Field>
                                    <Field label={t('songRequest.downloads.format')}>
                                        <Select value={videoFormat} onChange={setVideoFormat} options={[{ value: 'mp4', label: t('songRequest.downloads.formats.mp4') }, { value: 'webm', label: t('songRequest.downloads.formats.webm') }]} />
                                    </Field>
                                </>
                            ) : (
                                <>
                                    <Field label={t('songRequest.downloads.format')}>
                                        <Select value={audioFormat} onChange={setAudioFormat} options={['mp3', 'm4a', 'opus', 'wav'].map(f => ({ value: f, label: t(`songRequest.downloads.formats.${f}`) }))} />
                                    </Field>
                                    <Field label={t('songRequest.downloads.quality')}>
                                        <Select value={audioQuality} onChange={setAudioQuality} options={['best', '320', '256', '192', '128'].map(q => ({ value: q, label: q === 'best' ? t('songRequest.downloads.best') : `${q} kbps` }))} />
                                    </Field>
                                </>
                            )}
                        </div>

                        <div className="space-y-3">
                            <Toggle checked={trim} onChange={setTrim} label={t('songRequest.downloads.trim')} hint={t('songRequest.downloads.trimHint')} />
                            {trim && (
                                <div className="grid grid-cols-2 gap-3 max-w-md pl-14">
                                    <Field label={t('songRequest.downloads.from')}><input className={inputClass} value={trimStart} onChange={e => setTrimStart(e.target.value)} placeholder="0:30" /></Field>
                                    <Field label={t('songRequest.downloads.to')}><input className={inputClass} value={trimEnd} onChange={e => setTrimEnd(e.target.value)} placeholder={probe.info.duration ? formatDuration(probe.info.duration) : '1:15'} /></Field>
                                </div>
                            )}
                            <Toggle checked={thumbnail} onChange={setThumbnail} label={t('songRequest.downloads.thumbnail')} hint={t('songRequest.downloads.thumbnailHint')} />
                            {kind === 'video' && probe.info.subtitles.length > 0 && (
                                <div>
                                    <p className="text-sm 3xl:text-base font-semibold text-ds-text mb-2">{t('songRequest.downloads.subtitles')}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {probe.info.subtitles.map(l => (
                                            <button key={l} onClick={() => setSubs(v => v.includes(l) ? v.filter(x => x !== l) : v.length >= 5 ? v : [...v, l])}
                                                className={`px-2.5 py-1 rounded-lg text-xs 3xl:text-sm font-mono font-bold ${subs.includes(l) ? 'bg-ds-accent text-ds-on-accent' : 'bg-ds-raised text-ds-soft '}`}>
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={start} disabled={starting} className={primary}>
                            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {t('songRequest.downloads.download')}
                        </button>
                    </div>
                )}
            </Card>

            {/* Descargas */}
            <Card
                title={t('songRequest.downloads.jobsTitle')}
                actions={state.jobs.some(j => !ACTIVE.includes(j.state)) ? (
                    <button className={btn} onClick={async () => { await api.post('/song-request/downloads/clear'); load(); }}><Trash2 className="w-4 h-4" /> {t('songRequest.downloads.clear')}</button>
                ) : undefined}
            >
                {state.jobs.length === 0 ? (
                    <p className="text-sm 3xl:text-base text-ds-soft">{t('songRequest.downloads.noJobs')}</p>
                ) : (
                    <div className="divide-y divide-ds-border">
                        {state.jobs.map(job => {
                            const active = ACTIVE.includes(job.state);
                            return (
                                <div key={job.jobId} className="py-3 space-y-2">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm 3xl:text-base font-semibold text-ds-text truncate">{job.title || job.fileName || job.jobId}</p>
                                            <p className="text-xs 3xl:text-sm text-ds-soft truncate">
                                                {[job.kind && t(`songRequest.downloads.kinds.${job.kind}`), job.format, job.fileName].filter(Boolean).join(' · ')}
                                            </p>
                                        </div>
                                        <span className={`text-xs 3xl:text-sm font-bold shrink-0 ${job.state === 'done' ? 'text-ds-ok ' : job.state === 'error' ? 'text-ds-danger ' : 'text-ds-soft '}`}>
                                            {job.state === 'error' ? errorText(job.error)
                                                : job.state === 'downloading' ? `${(job.percent ?? 0).toFixed(1)}%${job.speed ? ` · ${job.speed}` : ''}${job.eta ? ` · ${job.eta}` : ''}`
                                                    : t(`songRequest.downloads.states.${job.state}`, { defaultValue: job.state })}
                                        </span>
                                        {active && <button className={btn} onClick={() => api.post(`/song-request/downloads/${job.jobId}/cancel`)}><X className="w-4 h-4" /></button>}
                                        {job.state === 'done' && <button className={btn} title={t('songRequest.downloads.showFile')} onClick={() => api.post('/song-request/downloads/open-folder', { jobId: job.jobId })}><FolderOpen className="w-4 h-4" /></button>}
                                    </div>
                                    {active && (
                                        <div className="h-1.5 rounded-full bg-ds-raised overflow-hidden">
                                            <div className={`h-full bg-ds-accent ${job.state === 'downloading' ? 'transition-[width] duration-700' : 'animate-pulse w-full opacity-60'}`}
                                                style={job.state === 'downloading' ? { width: `${job.percent ?? 0}%` } : undefined} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                <p className="text-xs 3xl:text-sm text-ds-soft mt-3 flex items-center gap-1.5"><RefreshCw className="w-3 h-3" /> {t('songRequest.downloads.liveNote')}</p>
            </Card>
        </div>
    );
}
