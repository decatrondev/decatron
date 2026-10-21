// Overlay: cómo se ve la burbuja del mensaje en pantalla, con vista previa en vivo.
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { Card, Field, NumberInput, Toggle, inputClass } from '../../../../components/overlay-editor/ui';
import ObsLinks from './ObsLinks';
import type { SpeakChatState } from './useSpeakChatConfig';

const POSITIONS = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const;

export default function OverlayTab({ sc }: { sc: SpeakChatState }) {
    const { t } = useTranslation('speakchat');
    const { config, setConfig, reloadOverlays, reloading } = sc;
    const o = config.overlay;
    const set = (patch: Partial<typeof o>) => setConfig(c => ({ ...c, overlay: { ...c.overlay, ...patch } }));

    return (
        <div className="space-y-6">
            <div className="space-y-6 min-w-0">
                <Card title={t('v2.overlay.bubbleTitle')} description={t('v2.overlay.bubbleDescription')}>
                    <Toggle checked={o.showBubble} onChange={v => set({ showBubble: v })} label={o.showBubble ? t('v2.overlay.visible') : t('v2.overlay.audioOnly')} />
                    {o.showBubble && (
                        <div className="space-y-5 mt-5">
                            <Field label={t('v2.overlay.position')}>
                                <div className="grid grid-cols-3 gap-2 max-w-sm" role="radiogroup" aria-label={t('v2.overlay.position')}>
                                    {POSITIONS.map(pos => (
                                        <button key={pos} type="button" role="radio" aria-checked={o.position === pos} onClick={() => set({ position: pos })}
                                            className={o.position === pos ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}>
                                            {t(`v2.overlay.pos.${pos}`)}
                                        </button>
                                    ))}
                                </div>
                            </Field>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <Field label={t('v2.overlay.background')} hint={t('v2.overlay.backgroundHint')}>
                                    <input value={o.backgroundColor} onChange={e => set({ backgroundColor: e.target.value })} className={inputClass} placeholder="rgba(0,0,0,0.75)" />
                                </Field>
                                <Field label={t('v2.overlay.textColor')}>
                                    <div className="flex gap-2">
                                        <input type="color" value={o.textColor} onChange={e => set({ textColor: e.target.value })} aria-label={t('v2.overlay.textColor')}
                                            className="h-[42px] w-12 rounded-lg border border-ds-border bg-transparent cursor-pointer p-0.5" />
                                        <input value={o.textColor} onChange={e => set({ textColor: e.target.value })} className={`${inputClass} font-mono`} />
                                    </div>
                                </Field>
                                <Field label={t('v2.overlay.fontSize')}>
                                    <NumberInput value={o.fontSize} min={10} max={48} onChange={n => set({ fontSize: n })} />
                                </Field>
                                <Field label={t('v2.overlay.duration')} hint={t('v2.overlay.durationHint')}>
                                    <NumberInput value={o.duration} min={1000} max={30000} step={500} onChange={n => set({ duration: n })} />
                                </Field>
                            </div>
                        </div>
                    )}
                </Card>

                <ObsLinks sc={sc} />

                <Card title={t('v2.overlay.reloadTitle')} description={t('v2.overlay.reloadDescription')}>
                    <button type="button" className="ds-btn ds-btn--secondary" disabled={reloading} onClick={reloadOverlays}>
                        <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} /> {reloading ? t('v2.overlay.reloading') : t('v2.overlay.reload')}
                    </button>
                </Card>
            </div>

        </div>
    );
}
