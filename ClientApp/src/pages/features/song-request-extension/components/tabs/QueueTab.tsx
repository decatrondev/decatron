import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, SkipForward, Trash2, Ban, GripVertical, Headphones, Volume2, Lock, Unlock, Plus, Radio, Download } from 'lucide-react';
import api from '../../../../../services/api';
import { Card, Toggle, inputClass } from '../ui';
import TrackPlayer from '../TrackPlayer';
import { useSongRequestPlayer } from '../../hooks/useSongRequestHub';
import { formatDuration } from '../../utils';
import type { PlaybackProgress, QueueItem, QueueSnapshot } from '../../types';
import type { SongRequestConfigState } from '../../hooks/useSongRequestConfig';
import { PlatformIcon } from '../PlatformIcon';

interface Props {
    cfg: SongRequestConfigState;
    snapshot: QueueSnapshot | null;
    progress: PlaybackProgress | null;
    connected: boolean;
    /** Abre Descargas con este link. */
    onDownload?: (url: string) => void;
}

const control = (action: string, value?: number) => api.post('/song-request/control', { action, value });

/** Control remoto en vivo de la cola. */
export default function QueueTab({ cfg, snapshot, progress, connected, onDownload }: Props) {
    const { t } = useTranslation('overlays');
    const [input, setInput] = useState('');
    const [adding, setAdding] = useState(false);
    const [addResult, setAddResult] = useState<{ ok: boolean; text: string } | null>(null);
    const [listenHere, setListenHere] = useState(false);
    const [dragId, setDragId] = useState<number | null>(null);
    const [order, setOrder] = useState<number[] | null>(null);
    const [volume, setVolume] = useState<number | null>(null);

    const queue = useMemo(() => {
        const items = snapshot?.queue ?? [];
        if (!order) return items;
        const byId = new Map(items.map(i => [i.id, i]));
        return order.map(id => byId.get(id)).filter((i): i is QueueItem => !!i);
    }, [snapshot?.queue, order]);

    if (!cfg.server) return null;
    const current = snapshot?.current ?? null;
    const shownVolume = volume ?? snapshot?.volume ?? 50;
    const currentProgress = progress && current && progress.itemId === current.id ? progress : null;

    const add = async () => {
        if (!input.trim()) return;
        setAdding(true);
        setAddResult(null);
        try {
            const res = await api.post('/song-request/queue', { input: input.trim() });
            if (res.data.success) {
                setAddResult({ ok: true, text: t('songRequest.queue.added', { position: res.data.position }) });
                setInput('');
            } else {
                setAddResult({ ok: false, text: t(`songRequest.errors.${res.data.error}`, { defaultValue: t('songRequest.errors.failed') }) });
            }
        } catch {
            setAddResult({ ok: false, text: t('songRequest.errors.failed') });
        } finally {
            setAdding(false);
        }
    };

    const drop = async (targetId: number) => {
        if (dragId === null || dragId === targetId) return;
        const ids = queue.map(q => q.id);
        const from = ids.indexOf(dragId);
        const to = ids.indexOf(targetId);
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        setOrder(ids);
        setDragId(null);
        try { await api.put('/song-request/queue/order', { ids }); } finally { setOrder(null); }
    };

    const ban = async (item: QueueItem, type: 'track' | 'author' | 'user') => {
        const labels = { track: item.title, author: item.artist, user: item.requestedBy };
        if (!window.confirm(t(`songRequest.queue.banConfirm.${type}`, { name: labels[type] }))) return;
        await api.post(`/song-request/queue/${item.id}/ban`, { type });
    };

    const iconBtn = 'p-2 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626] hover:text-[#1e293b] dark:hover:text-white transition-colors';

    return (
        <div className="space-y-6">
            {!cfg.enabled && (
                <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm 3xl:text-base">
                    {t('songRequest.queue.disabled')}
                </div>
            )}

            {/* Estado */}
            <div className="flex flex-wrap gap-2 text-xs 3xl:text-sm font-bold">
                <Status ok={connected} label={connected ? t('songRequest.queue.live') : t('songRequest.queue.reconnecting')} />
                <Status ok={!!snapshot?.playerConnected} label={snapshot?.playerConnected ? t('songRequest.queue.playerOn') : t('songRequest.queue.playerOff')} />
                <Status ok={!!snapshot?.requestsOpen} label={snapshot?.requestsOpen ? t('songRequest.queue.open') : t('songRequest.queue.closed')} />
                {snapshot?.paused && <Status ok={false} warn label={t('songRequest.queue.paused')} />}
            </div>

            {/* Sonando ahora + controles */}
            <Card title={t('songRequest.queue.nowPlaying')}>
                {current ? (
                    <div className="flex flex-col sm:flex-row gap-4">
                        {current.thumbnailUrl && <img src={current.thumbnailUrl} alt="" className="w-full sm:w-48 3xl:w-56 aspect-video object-cover rounded-xl" />}
                        <div className="flex-1 min-w-0 space-y-1">
                            <a href={current.originUrl ?? current.url ?? undefined} target="_blank" rel="noopener noreferrer" className="block font-bold text-[#1e293b] dark:text-[#f8fafc] text-base 3xl:text-lg hover:underline break-words">{current.title}</a>
                            <p className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8]">{current.artist} · {current.isFallback ? t('songRequest.overlayLabels.fallback') : <><PlatformIcon platform={current.platform} /> {t('songRequest.queue.requestedBy', { user: current.requestedBy })}</>}</p>
                            <ProgressBar progress={currentProgress} duration={current.durationSeconds} />
                        </div>
                    </div>
                ) : (
                    <p className="text-sm 3xl:text-base text-[#94a3b8]">
                        {queue.length > 0 && !snapshot?.playerConnected ? t('songRequest.queue.waitingPlayer') : t('songRequest.queue.nothing')}
                    </p>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                    {snapshot?.paused ? (
                        <CtlButton onClick={() => control('resume')} icon={<Play className="w-4 h-4" />} label={t('songRequest.queue.resume')} primary />
                    ) : (
                        <CtlButton onClick={() => control('pause')} icon={<Pause className="w-4 h-4" />} label={t('songRequest.queue.pause')} />
                    )}
                    <CtlButton onClick={() => control('skip')} icon={<SkipForward className="w-4 h-4" />} label={t('songRequest.queue.skip')} disabled={!current} />
                    {snapshot?.requestsOpen ? (
                        <CtlButton onClick={() => control('close')} icon={<Lock className="w-4 h-4" />} label={t('songRequest.queue.closeRequests')} />
                    ) : (
                        <CtlButton onClick={() => control('open')} icon={<Unlock className="w-4 h-4" />} label={t('songRequest.queue.openRequests')} primary />
                    )}
                    <div className="flex items-center gap-2 ml-auto min-w-[200px] flex-1 sm:flex-none">
                        <Volume2 className="w-4 h-4 text-[#64748b]" />
                        <input
                            type="range" min={0} max={100} value={shownVolume}
                            onChange={e => setVolume(Number(e.target.value))}
                            onPointerUp={() => { if (volume !== null) control('volume', volume).finally(() => setVolume(null)); }}
                            onKeyUp={() => { if (volume !== null) control('volume', volume).finally(() => setVolume(null)); }}
                            className="flex-1 accent-[#2563eb]"
                        />
                        <span className="w-9 text-right font-mono text-xs 3xl:text-sm text-[#64748b]">{shownVolume}</span>
                    </div>
                </div>
            </Card>

            {/* Escuchar aquí */}
            <Card>
                <Toggle
                    checked={listenHere}
                    onChange={setListenHere}
                    label={t('songRequest.queue.listenHere')}
                    hint={t('songRequest.queue.listenHereHint')}
                />
                {listenHere && <LocalPlayer channel={cfg.server.channel} playerKey={cfg.server.playerKey} />}
            </Card>

            {/* Agregar */}
            <Card title={t('songRequest.queue.addTitle')}>
                <form className="flex gap-2" onSubmit={e => { e.preventDefault(); add(); }}>
                    <input value={input} onChange={e => setInput(e.target.value)} placeholder={t('songRequest.queue.addPlaceholder')} className={inputClass} maxLength={500} />
                    <button type="submit" disabled={adding || !input.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm 3xl:text-base font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white disabled:opacity-50 shrink-0">
                        <Plus className="w-4 h-4" /> {adding ? t('songRequest.queue.adding') : t('songRequest.queue.add')}
                    </button>
                </form>
                {addResult && <p className={`text-sm 3xl:text-base mt-2 ${addResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{addResult.text}</p>}
            </Card>

            {/* Cola */}
            <Card title={t('songRequest.queue.upNext', { count: queue.length })} description={snapshot?.totalDurationSeconds ? t('songRequest.queue.total', { duration: formatDuration(snapshot.totalDurationSeconds) }) : undefined}>
                {queue.length === 0 ? (
                    <p className="text-sm 3xl:text-base text-[#94a3b8]">{t('songRequest.queue.empty')}</p>
                ) : (
                    <ol className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                        {queue.map((item, i) => (
                            <li
                                key={item.id}
                                draggable
                                onDragStart={() => setDragId(item.id)}
                                onDragOver={e => e.preventDefault()}
                                onDrop={() => drop(item.id)}
                                className={`flex items-center gap-3 py-2 ${dragId === item.id ? 'opacity-40' : ''}`}
                            >
                                <GripVertical className="w-4 h-4 text-[#cbd5e1] dark:text-[#4b5563] cursor-grab shrink-0" />
                                <span className="w-6 text-right font-mono text-xs 3xl:text-sm text-[#94a3b8] shrink-0">{i + 1}</span>
                                {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" className="w-16 h-9 3xl:w-20 3xl:h-[45px] object-cover rounded shrink-0" />}
                                <div className="flex-1 min-w-0">
                                    <a href={item.originUrl ?? item.url ?? undefined} target="_blank" rel="noopener noreferrer" className="block text-sm 3xl:text-base font-semibold text-[#1e293b] dark:text-[#f8fafc] truncate hover:underline">{item.title}</a>
                                    <p className="text-xs 3xl:text-sm text-[#64748b] dark:text-[#94a3b8] truncate">{item.artist} · <PlatformIcon platform={item.platform} /> {t('songRequest.queue.requestedBy', { user: item.requestedBy })}</p>
                                </div>
                                <span className="font-mono text-xs 3xl:text-sm text-[#94a3b8] shrink-0 hidden sm:inline">{formatDuration(item.durationSeconds)}</span>
                                {onDownload && (item.originUrl ?? item.url) && (
                                    <button className={iconBtn} title={t('songRequest.downloads.sendTo')} onClick={() => onDownload((item.originUrl ?? item.url)!)}>
                                        <Download className="w-4 h-4" />
                                    </button>
                                )}
                                <BanMenu item={item} onBan={ban} />
                                <button className={iconBtn} title={t('songRequest.queue.remove')} onClick={() => api.delete(`/song-request/queue/${item.id}`)}>
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </li>
                        ))}
                    </ol>
                )}
                {current && (
                    <div className="mt-3 pt-3 border-t border-[#e2e8f0] dark:border-[#374151] flex items-center gap-2 text-xs 3xl:text-sm text-[#64748b]">
                        <span>{t('songRequest.queue.banCurrent')}</span>
                        <BanMenu item={current} onBan={ban} />
                    </div>
                )}
            </Card>
        </div>
    );
}

function Status({ ok, label, warn }: { ok: boolean; label: string; warn?: boolean }) {
    const tone = warn ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
        : ok ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
            : 'bg-[#f1f5f9] text-[#64748b] dark:bg-[#262626] dark:text-[#94a3b8]';
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${tone}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${warn ? 'bg-amber-500' : ok ? 'bg-green-500' : 'bg-[#94a3b8]'}`} />
            {label}
        </span>
    );
}

function CtlButton({ onClick, icon, label, primary, disabled }: { onClick: () => void; icon: React.ReactNode; label: string; primary?: boolean; disabled?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm 3xl:text-base font-bold transition-colors disabled:opacity-40 ${primary ? 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white' : 'bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'}`}
        >
            {icon} {label}
        </button>
    );
}

function ProgressBar({ progress, duration }: { progress: PlaybackProgress | null; duration: number | null }) {
    const total = progress?.duration || duration || 0;
    const pos = progress?.position ?? 0;
    return (
        <div className="pt-2">
            <div className="h-1.5 rounded-full bg-[#e2e8f0] dark:bg-[#374151] overflow-hidden">
                <div className="h-full bg-[#2563eb] transition-[width] duration-1000 ease-linear" style={{ width: total ? `${Math.min(100, (pos / total) * 100)}%` : '0%' }} />
            </div>
            <div className="flex justify-between font-mono text-xs 3xl:text-sm text-[#94a3b8] mt-1">
                <span>{formatDuration(pos) || '0:00'}</span>
                <span>{formatDuration(total)}</span>
            </div>
        </div>
    );
}

function BanMenu({ item, onBan }: { item: QueueItem; onBan: (item: QueueItem, type: 'track' | 'author' | 'user') => void }) {
    const { t } = useTranslation('overlays');
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button className="p-2 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626] hover:text-red-600" title={t('songRequest.queue.ban')} onClick={() => setOpen(o => !o)}>
                <Ban className="w-4 h-4" />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] shadow-xl p-1" onMouseLeave={() => setOpen(false)}>
                    {(['track', 'author', 'user'] as const)
                        .filter(type => type !== 'user' || (item.platform !== 'dashboard' && !item.isFallback))
                        .map(type => (
                            <button key={type} onClick={() => { setOpen(false); onBan(item, type); }} className="w-full text-left px-3 py-2 rounded-lg text-sm 3xl:text-base text-[#1e293b] dark:text-[#f8fafc] hover:bg-[#fef2f2] dark:hover:bg-red-900/20">
                                {t(`songRequest.queue.banOptions.${type}`)}
                            </button>
                        ))}
                </div>
            )}
        </div>
    );
}

/** "Escuchar aquí": el dashboard pasa a ser el reproductor (el overlay de OBS se calla). */
function LocalPlayer({ channel, playerKey }: { channel: string; playerKey: string }) {
    const { t } = useTranslation('overlays');
    const { snapshot, status, reportEnded, reportError, reportProgress } = useSongRequestPlayer(channel, playerKey);
    const current = snapshot?.current ?? null;
    const item = useMemo(
        () => (current?.sourceId ? { id: current.id, source: current.source, sourceId: current.sourceId } : null),
        [current?.id, current?.source, current?.sourceId],
    );

    return (
        <div className="mt-4 space-y-2">
            <p className="flex items-center gap-2 text-sm 3xl:text-base font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                {status === 'active' ? <Headphones className="w-4 h-4 text-green-500" /> : <Radio className="w-4 h-4 text-[#94a3b8]" />}
                {t(`songRequest.queue.localStatus.${status}`)}
            </p>
            {status !== 'replaced' && (
                <div className="w-full max-w-md aspect-video rounded-xl overflow-hidden bg-black">
                    <TrackPlayer item={item} paused={snapshot?.paused ?? false} volume={snapshot?.volume ?? 50} onEnded={reportEnded} onError={reportError} onProgress={reportProgress} />
                </div>
            )}
        </div>
    );
}
