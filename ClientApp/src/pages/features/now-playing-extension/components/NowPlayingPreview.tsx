import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, SkipForward, CircleOff, Send } from 'lucide-react';
import MusicOverlayRenderer, { type OverlayLabels } from '../../../../components/music-overlay/MusicOverlayRenderer';
import { ScaledCanvas, CHECKER_BG } from '../../../../components/overlay-editor/ui';
import { SAMPLE_TRACKS } from '../../../../components/music-overlay/defaults';
import { contentBounds } from '../../../../components/music-overlay/utils';
import type { MusicTrack, OverlayLayout, PlaybackProgress } from '../../../../components/music-overlay/types';
import api from '../../../../services/api';
import { trackFromApi } from '../liveTrack';

interface Props {
    layout: OverlayLayout;
    labels: OverlayLabels;
    channel: string;
    dirty: boolean;
}

/** Vista previa en vivo del overlay: canción de ejemplo o la que está sonando, con el mismo renderer que OBS. */
export default function NowPlayingPreview({ layout, labels, channel, dirty }: Props) {
    const { t } = useTranslation('overlays');
    const [source, setSource] = useState<'sample' | 'live'>('sample');
    const [index, setIndex] = useState(0);
    const [idle, setIdle] = useState(false);
    const [playing, setPlaying] = useState(true);
    const [position, setPosition] = useState(35);
    const [live, setLive] = useState<{ track: MusicTrack; progress: PlaybackProgress } | null>(null);
    const [testing, setTesting] = useState(false);
    const [testMsg, setTestMsg] = useState<string | null>(null);
    // El lienzo es la pantalla de OBS entera: por defecto se encuadra el widget para que se lea
    const [full, setFull] = useState(false);
    const bb = full ? { x: 0, y: 0, width: layout.canvas.width, height: layout.canvas.height } : contentBounds(layout, 24);

    const sample = SAMPLE_TRACKS[index % SAMPLE_TRACKS.length];

    // Avance simulado de la canción de ejemplo
    useEffect(() => {
        if (source !== 'sample' || !playing || idle) return;
        const id = window.setInterval(() => {
            setPosition(p => {
                if (p + 1 >= (sample.durationSeconds ?? 200)) { setIndex(i => i + 1); return 0; }
                return p + 1;
            });
        }, 1000);
        return () => window.clearInterval(id);
    }, [source, playing, idle, sample.durationSeconds]);

    // Lo que suena de verdad (cada 10 s mientras está elegido)
    useEffect(() => {
        if (source !== 'live' || !channel) return;
        let stop = false;
        const load = async () => {
            try {
                const res = await api.get(`/nowplaying/now/${channel}`);
                const d = res.data?.data;
                if (!stop) setLive(d?.isPlaying && d?.song ? trackFromApi(d) : null);
            } catch { if (!stop) setLive(null); }
        };
        load();
        const id = window.setInterval(load, 10000);
        return () => { stop = true; window.clearInterval(id); };
    }, [source, channel]);

    const isLive = source === 'live';
    const current = isLive ? live?.track ?? null : idle ? null : sample;
    const progress: PlaybackProgress | null = isLive
        ? live?.progress ?? null
        : current ? { itemId: current.id, position, duration: current.durationSeconds ?? 0, playing } : null;

    const test = async () => {
        setTesting(true);
        try {
            await api.post('/nowplaying/test');
            setTestMsg(t('nowPlaying.preview.testSent'));
        } catch {
            setTestMsg(t('nowPlaying.preview.testFailed'));
        } finally {
            setTesting(false);
            window.setTimeout(() => setTestMsg(null), 4000);
        }
    };

    const btn = 'p-2 rounded-lg bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors disabled:opacity-40';
    const seg = (active: boolean) => `px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold transition-colors ${active ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'}`;

    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 3xl:p-5 shadow-lg xl:sticky xl:top-6 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-base 3xl:text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('nowPlaying.preview.title')}</h3>
                <div className="flex gap-1 p-1 rounded-xl bg-[#f8fafc] dark:bg-[#111]">
                    <button className={seg(!isLive)} onClick={() => setSource('sample')}>{t('nowPlaying.preview.sample')}</button>
                    <button className={seg(isLive)} onClick={() => setSource('live')}>{t('nowPlaying.preview.live')}</button>
                </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-[#e2e8f0] dark:border-[#374151]" style={{ background: CHECKER_BG }}>
                <ScaledCanvas width={bb.width} height={bb.height} maxScale={1.5}>
                    <div style={{ position: 'absolute', left: -bb.x, top: -bb.y }}>
                        <MusicOverlayRenderer layout={layout} current={current} queue={[]} progress={progress} paused={!isLive && !playing} labels={labels} />
                    </div>
                </ScaledCanvas>
            </div>
            <div className="flex gap-1 p-1 rounded-xl bg-[#f8fafc] dark:bg-[#111] w-fit">
                <button className={seg(!full)} onClick={() => setFull(false)}>{t('nowPlaying.preview.fit')}</button>
                <button className={seg(full)} onClick={() => setFull(true)}>{t('nowPlaying.preview.full')}</button>
            </div>

            {!isLive && (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t('nowPlaying.preview.controls')}</p>
                    <div className="flex gap-1">
                        <button className={btn} onClick={() => setPlaying(p => !p)} disabled={idle} title={playing ? t('nowPlaying.preview.pause') : t('nowPlaying.preview.play')}>
                            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button className={btn} onClick={() => { setIdle(false); setIndex(i => i + 1); setPosition(0); }} title={t('nowPlaying.preview.next')}>
                            <SkipForward className="w-4 h-4" />
                        </button>
                        <button className={`${btn} ${idle ? '!bg-[#2563eb] !text-white' : ''}`} onClick={() => setIdle(v => !v)} title={t('nowPlaying.preview.idle')}>
                            <CircleOff className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
            {isLive && !live && <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t('nowPlaying.preview.liveEmpty')}</p>}

            <div className="space-y-2">
                <button onClick={test} disabled={testing} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs 3xl:text-sm font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white disabled:opacity-50">
                    <Send className="w-4 h-4" /> {testing ? t('nowPlaying.preview.testing') : t('nowPlaying.preview.test')}
                </button>
                <p className="text-xs 3xl:text-sm text-[#94a3b8]">{testMsg ?? (dirty ? t('nowPlaying.preview.testUnsaved') : t('nowPlaying.preview.testHint'))}</p>
                <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t('nowPlaying.preview.size', { width: layout.canvas.width, height: layout.canvas.height })}</p>
            </div>
        </div>
    );
}
