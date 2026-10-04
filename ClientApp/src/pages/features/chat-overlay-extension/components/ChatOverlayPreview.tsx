import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, ScaledCanvas, CHECKER_BG } from '../../../../components/overlay-editor/ui';
import ChatBox from '../../../../components/chat-overlay/ChatRenderer';
import BubblesStage, { useBubbles } from '../../../../components/chat-overlay/BubblesStage';
import { useChatFeed } from '../../../../components/chat-overlay/useChatFeed';
import { CANVAS, type ChatOverlayConfig } from '../../../../components/chat-overlay/types';
import { sampleMessage, type SampleEmote } from '../../../../components/chat-overlay/sample';

/** Vista previa en vivo: el mismo renderer que el overlay de OBS, con chat simulado (emotes reales del canal si ya cargaron) */
export default function ChatOverlayPreview({ config, emotes, dirty }: { config: ChatOverlayConfig; emotes: SampleEmote[]; dirty: boolean }) {
    const { t } = useTranslation('overlays');
    const feed = useChatFeed(config);
    const bubbles = useBubbles(config);
    const isBubbles = config.mode === 'bubbles';
    const sink = isBubbles ? bubbles : feed;
    const sinkRef = useRef(sink);
    sinkRef.current = sink;
    const [running, setRunning] = useState(true);
    const [shared, setShared] = useState(false);
    // Acercado al cuadro del chat se lee mejor que el lienzo entero de 1920×1080
    const [zoom, setZoom] = useState(true);
    const emotesRef = useRef(emotes);
    emotesRef.current = emotes;
    const sharedRef = useRef(shared);
    sharedRef.current = shared;

    useEffect(() => {
        if (!running) return;
        let timer: number;
        const tick = () => {
            sinkRef.current.push(sampleMessage(emotesRef.current, { shared: sharedRef.current && Math.random() < 0.4 }));
            timer = window.setTimeout(tick, 900 + Math.random() * 1400);
        };
        timer = window.setTimeout(tick, 300);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running]);

    const btn = 'px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors';

    return (
        <div className="xl:sticky xl:top-4 space-y-3">
            <Card title={t('chat.preview.title')} description={dirty ? t('chat.preview.dirty') : t('chat.preview.description')}>
                {isBubbles ? (
                    <ScaledCanvas key="bubbles" width={CANVAS.width} height={CANVAS.height} background={CHECKER_BG}>
                        <BubblesStage engine={bubbles} config={config} />
                    </ScaledCanvas>
                ) : zoom ? (
                    <ScaledCanvas key="box" width={config.layout.width} height={config.layout.height} background={CHECKER_BG}>
                        <ChatBox items={feed.items} config={config} inline />
                    </ScaledCanvas>
                ) : (
                    <ScaledCanvas key="screen" width={CANVAS.width} height={CANVAS.height} background={CHECKER_BG}>
                        <ChatBox items={feed.items} config={config} />
                    </ScaledCanvas>
                )}
                <div className="flex flex-wrap gap-2 mt-4">
                    <button type="button" className={btn} onClick={() => setRunning(r => !r)}>{running ? t('chat.preview.pause') : t('chat.preview.simulate')}</button>
                    <button type="button" className={btn} onClick={() => sink.push(sampleMessage(emotes, { shared }))}>{t('chat.preview.sendOne')}</button>
                    {!isBubbles && <button type="button" className={btn} onClick={() => setZoom(z => !z)}>{zoom ? t('chat.preview.fullScreen') : t('chat.preview.zoomChat')}</button>}
                    <button type="button" className={btn} onClick={() => setShared(s => !s)}>{shared ? t('chat.preview.sharedOn') : t('chat.preview.sharedOff')}</button>
                    <button type="button" className={btn} onClick={sink.clear}>{t('chat.preview.clear')}</button>
                </div>
            </Card>
        </div>
    );
}
