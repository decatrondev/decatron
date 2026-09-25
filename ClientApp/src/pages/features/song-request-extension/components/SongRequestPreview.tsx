import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, SkipForward, CircleOff } from 'lucide-react';
import SongOverlayRenderer, { type OverlayLabels } from './SongOverlayRenderer';
import { ScaledCanvas, CHECKER_BG } from './ui';
import { SAMPLE_SONGS } from '../constants/defaults';
import type { OverlayKind, OverlayLayout, PlaybackProgress, QueueSnapshot } from '../types';

interface Props {
    kind: OverlayKind;
    onKindChange: (kind: OverlayKind) => void;
    layout: OverlayLayout;
    labels: OverlayLabels;
    live: { snapshot: QueueSnapshot | null; progress: PlaybackProgress | null };
}

/** Vista previa en vivo del overlay que se está editando, con canción de ejemplo o con la cola real. */
export default function SongRequestPreview({ kind, onKindChange, layout, labels, live }: Props) {
    const { t } = useTranslation('overlays');
    const [source, setSource] = useState<'sample' | 'live'>('sample');
    const [index, setIndex] = useState(0);
    const [idle, setIdle] = useState(false);
    const [playing, setPlaying] = useState(true);
    const [position, setPosition] = useState(35);

    const sample = SAMPLE_SONGS[index % SAMPLE_SONGS.length];
    const sampleQueue = useMemo(
        () => [1, 2, 3].map(i => SAMPLE_SONGS[(index + i) % SAMPLE_SONGS.length]).map((s, i) => ({ ...s, id: s.id - 100 * (i + 1) })),
        [index],
    );

    // Avance simulado: un aviso por segundo, como el reproductor real
    useEffect(() => {
        if (source !== 'sample' || !playing || idle) return;
        const id = window.setInterval(() => {
            setPosition(p => {
                const next = p + 1;
                if (next >= (sample.durationSeconds ?? 200)) { setIndex(i => i + 1); return 0; }
                return next;
            });
        }, 1000);
        return () => window.clearInterval(id);
    }, [source, playing, idle, sample.durationSeconds]);

    const isLive = source === 'live';
    const current = isLive ? live.snapshot?.current ?? null : idle ? null : sample;
    const queue = isLive ? live.snapshot?.queue ?? [] : sampleQueue;
    const paused = isLive ? live.snapshot?.paused ?? false : !playing;
    const progress: PlaybackProgress | null = isLive
        ? live.progress
        : current ? { itemId: current.id, position, duration: current.durationSeconds ?? 0, playing } : null;

    const btn = 'p-2 rounded-lg bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors disabled:opacity-40';
    const seg = (active: boolean) => `px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold transition-colors ${active ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'}`;

    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 3xl:p-5 shadow-lg xl:sticky xl:top-6 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-base 3xl:text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('songRequest.preview.title')}</h3>
                <div className="flex gap-1 p-1 rounded-xl bg-[#f8fafc] dark:bg-[#111]">
                    <button className={seg(kind === 'player')} onClick={() => onKindChange('player')}>{t('songRequest.kinds.player')}</button>
                    <button className={seg(kind === 'nowPlaying')} onClick={() => onKindChange('nowPlaying')}>{t('songRequest.kinds.nowPlaying')}</button>
                </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-[#e2e8f0] dark:border-[#374151] p-3" style={{ background: CHECKER_BG }}>
                <ScaledCanvas width={layout.canvas.width} height={layout.canvas.height}>
                    <SongOverlayRenderer layout={layout} current={current} queue={queue} progress={progress} paused={paused} labels={labels} />
                </ScaledCanvas>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex gap-1 p-1 rounded-xl bg-[#f8fafc] dark:bg-[#111]">
                    <button className={seg(!isLive)} onClick={() => setSource('sample')}>{t('songRequest.preview.sample')}</button>
                    <button className={seg(isLive)} onClick={() => setSource('live')}>{t('songRequest.preview.live')}</button>
                </div>
                {!isLive && (
                    <div className="flex gap-1">
                        <button className={btn} onClick={() => setPlaying(p => !p)} disabled={idle} title={playing ? t('songRequest.preview.pause') : t('songRequest.preview.play')}>
                            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button className={btn} onClick={() => { setIdle(false); setIndex(i => i + 1); setPosition(0); }} title={t('songRequest.preview.next')}>
                            <SkipForward className="w-4 h-4" />
                        </button>
                        <button className={`${btn} ${idle ? '!bg-[#2563eb] !text-white' : ''}`} onClick={() => setIdle(v => !v)} title={t('songRequest.preview.idle')}>
                            <CircleOff className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            <p className="text-xs 3xl:text-sm text-[#94a3b8]">
                {t('songRequest.preview.size', { width: layout.canvas.width, height: layout.canvas.height })}
                {isLive && !live.snapshot?.current && ` · ${t('songRequest.preview.liveEmpty')}`}
            </p>
        </div>
    );
}
