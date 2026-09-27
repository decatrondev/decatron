import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Send } from 'lucide-react';
import EventAlertRenderer, { type Phase } from '../../../../components/event-alert-overlay/EventAlertRenderer';
import { ScaledCanvas, CHECKER_BG } from '../../../../components/overlay-editor/ui';
import { EVENT_TYPES } from '../../../../components/event-alert-overlay/defaults';
import { applyPartialStyle, exitDurationMs, resolveAlertDesign } from '../../../../components/event-alert-overlay/convertLegacy';
import { audioFor, listCases, payloadFor } from '../../../../components/event-alert-overlay/fromConfig';
import type { AlertEventType, EventAlertsDesign } from '../../../../components/event-alert-overlay/types';
import api from '../../../../services/api';

interface Props {
    /** La config completa tal como se va a guardar (con el diseño). */
    config: any;
    design: EventAlertsDesign;
    canvas: { width: number; height: number };
    dirty: boolean;
    /** Evento que se está editando (la vista previa lo sigue). */
    eventType: AlertEventType;
    onEventTypeChange: (e: AlertEventType) => void;
    /** Nivel del hype train que se está editando en el Diseño ('completed' = el fin), si hay. */
    hypeLevel?: number | 'completed';
}

/** Tiempo en pantalla al reproducir en la vista previa (la alerta real usa su duración). */
const HOLD_MS = 2500;

/** Vista previa fija: la alerta de un evento y nivel, con el mismo renderer y los mismos datos que OBS. */
export default function EventAlertsPreview({ config, design, canvas, dirty, eventType, onEventTypeChange, hypeLevel }: Props) {
    const { t } = useTranslation('overlays');
    const cases = useMemo(() => listCases(config, eventType), [config, eventType]);
    const [caseKey, setCaseKey] = useState<string>('');
    const [phase, setPhase] = useState<Phase | 'hidden'>('static');
    const [run, setRun] = useState(0);
    const [testing, setTesting] = useState(false);
    const [testMsg, setTestMsg] = useState<string | null>(null);
    const timers = useRef<number[]>([]);
    const [full, setFull] = useState(false);

    // Al cambiar de evento (o de nivel del hype train en el Diseño), el primer caso o el nivel elegido
    useEffect(() => {
        setCaseKey(eventType === 'hypeTrain' && hypeLevel ? (hypeLevel === 'completed' ? 'completed' : `level-${hypeLevel}`) : '');
    }, [eventType, hypeLevel]);

    // Si el elegido no existe (otro evento, o se borró el nivel), el primero
    const current = cases.find(c => c.key === caseKey) ?? cases[0];
    const built = useMemo(() => (current ? payloadFor(config, current) : null), [config, current]);
    const alertDesign = useMemo(() => {
        if (!built) return null;
        const resolved = resolveAlertDesign(design, built.data, built.style, built.overlayElements);
        return { ...applyPartialStyle(resolved, built.partialStyle), canvas };
    }, [built, design, canvas]);

    const audio = useMemo(() => (current ? audioFor(config, current) : null), [config, current]);
    const soundRef = useRef<HTMLAudioElement | null>(null);
    const stopSound = () => { soundRef.current?.pause(); soundRef.current = null; };
    const clear = () => { timers.current.forEach(id => window.clearTimeout(id)); timers.current = []; stopSound(); };
    useEffect(() => clear, []);

    const play = () => {
        if (!alertDesign) return;
        clear();
        setRun(r => r + 1);
        setPhase('enter');
        // El sonido de la alerta, como en OBS (la voz no: generarla gasta créditos; se escucha con "Probar en OBS")
        if (audio?.soundUrl) {
            const snd = new Audio(audio.soundUrl);
            snd.volume = Math.min(1, audio.soundVolume / 100);
            snd.play().catch(() => { /* el navegador puede bloquearlo hasta que haya un clic */ });
            soundRef.current = snd;
        }
        const outMs = exitDurationMs(alertDesign);
        timers.current.push(window.setTimeout(() => setPhase('exit'), HOLD_MS));
        timers.current.push(window.setTimeout(() => setPhase('hidden'), HOLD_MS + outMs));
        timers.current.push(window.setTimeout(() => setPhase('static'), HOLD_MS + outMs + 600));
    };

    const test = async () => {
        if (!current) return;
        setTesting(true);
        try {
            await api.post('/eventalerts/test', { eventType, amount: current.amount, username: 'StreamFan99' });
            setTestMsg(t('eventAlertsView.preview.testSent'));
        } catch {
            setTestMsg(t('eventAlertsView.preview.testFailed'));
        } finally {
            setTesting(false);
            window.setTimeout(() => setTestMsg(null), 4000);
        }
    };

    // Encuadre: la alerta (la tarjeta y lo que tenga alrededor) o la pantalla entera
    const box = useMemo(() => {
        if (full || !alertDesign) return { x: 0, y: 0, width: canvas.width, height: canvas.height };
        const rects = [alertDesign.card, alertDesign.media, ...alertDesign.texts].filter(r => r.enabled);
        if (!rects.length) return { x: 0, y: 0, width: canvas.width, height: canvas.height };
        const m = 40;
        const x = Math.max(0, Math.min(...rects.map(r => r.x)) - m), y = Math.max(0, Math.min(...rects.map(r => r.y)) - m);
        const r = Math.min(canvas.width, Math.max(...rects.map(r => r.x + r.width)) + m), b = Math.min(canvas.height, Math.max(...rects.map(r => r.y + r.height)) + m);
        return { x, y, width: Math.max(1, r - x), height: Math.max(1, b - y) };
    }, [full, alertDesign, canvas]);

    const seg = (active: boolean) => `px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold transition-colors ${active ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'}`;
    const selectClass = 'w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm 3xl:text-base';

    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 3xl:p-5 shadow-lg xl:sticky xl:top-6 space-y-4">
            <h3 className="text-base 3xl:text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('eventAlertsView.preview.title')}</h3>
            <div className="grid grid-cols-2 gap-2">
                <select className={selectClass} value={eventType} onChange={e => onEventTypeChange(e.target.value as AlertEventType)} aria-label={t('eventAlertsView.preview.event')}>
                    {EVENT_TYPES.map(ev => <option key={ev} value={ev}>{t(`eventAlertsView.events.${ev}`)}</option>)}
                </select>
                <select className={selectClass} value={current?.key ?? ''} onChange={e => setCaseKey(e.target.value)} disabled={cases.length < 2} aria-label={t('eventAlertsView.preview.level')}>
                    {cases.map(c => (
                        <option key={c.key} value={c.key}>
                            {c.key === 'base' || c.key === 'follow' ? t('eventAlertsView.preview.base') : c.key === 'completed' ? t('eventAlertsView.design.completed') : c.eventType === 'hypeTrain' ? t('eventAlertsView.design.level', { n: c.level }) : c.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="rounded-xl overflow-hidden border border-[#e2e8f0] dark:border-[#374151]" style={{ background: CHECKER_BG }} data-testid="ea-preview">
                {alertDesign && built ? (
                    <ScaledCanvas width={box.width} height={box.height} maxScale={1}>
                        <div style={{ position: 'absolute', left: -box.x, top: -box.y }}>
                            {phase !== 'hidden' && <EventAlertRenderer key={`${run}-${current?.key}`} design={alertDesign} data={built.data} phase={phase} preview videoVolume={phase === 'static' ? undefined : audio?.videoVolume} />}
                        </div>
                    </ScaledCanvas>
                ) : (
                    <p className="p-6 text-sm text-center text-[#94a3b8]">{t('eventAlertsView.preview.empty')}</p>
                )}
            </div>
            <div className="flex gap-1 p-1 rounded-xl bg-[#f8fafc] dark:bg-[#111] w-fit">
                <button className={seg(!full)} onClick={() => setFull(false)}>{t('eventAlertsView.preview.fit')}</button>
                <button className={seg(full)} onClick={() => setFull(true)}>{t('eventAlertsView.preview.full')}</button>
            </div>

            <button onClick={play} disabled={phase !== 'static' || !alertDesign} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs 3xl:text-sm font-bold bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] disabled:opacity-50">
                <Play className="w-4 h-4" /> {phase === 'static' ? t('eventAlertsView.preview.play') : t('eventAlertsView.preview.playing')}
            </button>
            <div className="space-y-2">
                <button onClick={test} disabled={testing || !current} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs 3xl:text-sm font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white disabled:opacity-50">
                    <Send className="w-4 h-4" /> {testing ? t('eventAlertsView.preview.testing') : t('eventAlertsView.preview.test')}
                </button>
                <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t('eventAlertsView.preview.soundHint')}</p>
                <p className="text-xs 3xl:text-sm text-[#94a3b8]">{testMsg ?? (dirty ? t('eventAlertsView.preview.testUnsaved') : t('eventAlertsView.preview.testHint'))}</p>
                <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t('eventAlertsView.preview.size', { width: canvas.width, height: canvas.height })}</p>
            </div>
        </div>
    );
}
