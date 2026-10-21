// Vista previa de la burbuja del mensaje, con la posición y los colores configurados.
import { useTranslation } from 'react-i18next';
import type { SpeakChatConfigData } from '../types';

export default function BubblePreview({ overlay }: { overlay: SpeakChatConfigData['overlay'] }) {
    const { t } = useTranslation('speakchat');
    const o = overlay;
    const pos: React.CSSProperties = {
        ...(o.position.includes('top') ? { top: '8%' } : { bottom: '8%' }),
        ...(o.position.includes('left') ? { left: '3%' } : o.position.includes('right') ? { right: '3%' } : { left: '50%', transform: 'translateX(-50%)' }),
    };
    return (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-ds-border bg-ds-input">
            {o.showBubble && (
                <div className="absolute" style={{ ...pos, maxWidth: '65%' }}>
                    <div className="rounded-lg px-3 py-2 shadow-lg" style={{ backgroundColor: o.backgroundColor }}>
                        <p style={{ color: o.textColor, fontSize: Math.max(9, o.fontSize * 0.55), fontWeight: 700, margin: 0, opacity: 0.8, fontFamily: 'Inter, system-ui, sans-serif' }}>
                            {t('v2.overlay.sampleUser')}
                        </p>
                        <p style={{ color: o.textColor, fontSize: Math.max(9, o.fontSize * 0.65), margin: '2px 0 0', lineHeight: 1.4, fontFamily: 'Inter, system-ui, sans-serif' }}>
                            {t('v2.overlay.sampleMessage')}
                        </p>
                    </div>
                </div>
            )}
            {!o.showBubble && (
                <p className="absolute inset-0 flex items-center justify-center text-xs 3xl:text-sm text-ds-soft px-4 text-center">{t('v2.overlay.previewAudioOnly')}</p>
            )}
        </div>
    );
}
