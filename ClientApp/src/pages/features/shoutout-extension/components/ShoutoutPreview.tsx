import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Send } from 'lucide-react';
import ShoutoutRenderer, { type Phase } from '../../../../components/shoutout-overlay/ShoutoutRenderer';
import { ScaledCanvas, CHECKER_BG } from '../../../../components/overlay-editor/ui';
import { SAMPLE_SHOUTOUT } from '../../../../components/shoutout-overlay/defaults';
import type { ShoutoutLayout } from '../../../../components/shoutout-overlay/types';
import api from '../../../../services/api';

interface Props {
    layout: ShoutoutLayout;
    duration: number;
    dirty: boolean;
}

/** Cuánto se queda en pantalla en la vista previa al reproducir (el overlay real usa la duración). */
const HOLD_MS = 2500;

/** Vista previa en vivo con el mismo renderer que OBS: quieta, o reproduciendo entrada y salida. */
export default function ShoutoutPreview({ layout, duration, dirty }: Props) {
    const { t } = useTranslation('overlays');
    const [withClip, setWithClip] = useState(true);
    const [phase, setPhase] = useState<Phase | 'hidden'>('static');
    const [run, setRun] = useState(0);
    const [testing, setTesting] = useState(false);
    const [testMsg, setTestMsg] = useState<string | null>(null);
    const timers = useRef<number[]>([]);

    const clear = () => { timers.current.forEach(id => window.clearTimeout(id)); timers.current = []; };
    useEffect(() => clear, []);

    const play = () => {
        clear();
        const { enter, exit } = layout.animations;
        const inMs = enter.type === 'none' ? 0 : enter.durationMs;
        const outMs = exit.type === 'none' ? 0 : exit.durationMs;
        setRun(r => r + 1);
        setPhase('enter');
        timers.current.push(window.setTimeout(() => setPhase('exit'), inMs + HOLD_MS));
        timers.current.push(window.setTimeout(() => setPhase('hidden'), inMs + HOLD_MS + outMs));
        timers.current.push(window.setTimeout(() => setPhase('static'), inMs + HOLD_MS + outMs + 700));
    };

    const test = async () => {
        setTesting(true);
        try {
            await api.post('/shoutout/test');
            setTestMsg(t('shoutout.preview.testSent'));
        } catch {
            setTestMsg(t('shoutout.preview.testFailed'));
        } finally {
            setTesting(false);
            window.setTimeout(() => setTestMsg(null), 4000);
        }
    };

    const data = { ...SAMPLE_SHOUTOUT, clipUrl: withClip ? SAMPLE_SHOUTOUT.clipUrl : null };
    const inMs = layout.animations.enter.type === 'none' ? 0 : layout.animations.enter.durationMs;
    const seg = (active: boolean) => `px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold transition-colors ${active ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'}`;

    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 3xl:p-5 shadow-lg xl:sticky xl:top-6 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-base 3xl:text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('shoutout.preview.title')}</h3>
                <div className="flex gap-1 p-1 rounded-xl bg-[#f8fafc] dark:bg-[#111]">
                    <button className={seg(withClip)} onClick={() => setWithClip(true)}>{t('shoutout.preview.withClip')}</button>
                    <button className={seg(!withClip)} onClick={() => setWithClip(false)}>{t('shoutout.preview.noClip')}</button>
                </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-[#e2e8f0] dark:border-[#374151]" style={{ background: CHECKER_BG }} data-testid="so-preview">
                <ScaledCanvas width={layout.canvas.width} height={layout.canvas.height} maxScale={1.5}>
                    {phase !== 'hidden' && (
                        <ShoutoutRenderer
                            key={run}
                            layout={layout}
                            data={data}
                            phase={phase}
                            preview
                            remaining={duration}
                            durationSec={(inMs + HOLD_MS) / 1000}
                            labels={{ clip: t('shoutout.preview.sampleClip') }}
                        />
                    )}
                </ScaledCanvas>
            </div>

            <button onClick={play} disabled={phase !== 'static'} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs 3xl:text-sm font-bold bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] disabled:opacity-50">
                <Play className="w-4 h-4" /> {phase === 'static' ? t('shoutout.preview.play') : t('shoutout.preview.playing')}
            </button>

            <div className="space-y-2">
                <button onClick={test} disabled={testing} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs 3xl:text-sm font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white disabled:opacity-50">
                    <Send className="w-4 h-4" /> {testing ? t('shoutout.preview.testing') : t('shoutout.preview.test')}
                </button>
                <p className="text-xs 3xl:text-sm text-[#94a3b8]">{testMsg ?? (dirty ? t('shoutout.preview.testUnsaved') : t('shoutout.preview.testHint'))}</p>
                <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t('shoutout.preview.size', { width: layout.canvas.width, height: layout.canvas.height })}</p>
            </div>
        </div>
    );
}
