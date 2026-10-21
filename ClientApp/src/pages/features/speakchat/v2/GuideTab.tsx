// Guía: cinco pasos para dejar Speak Chat funcionando, cada uno con su estado y un salto a la pestaña que toca.
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Card } from '../../../../components/overlay-editor/ui';
import { LinkRow } from '../../../../components/overlay-editor/OverlayLinks';
import type { SpeakChatState } from './useSpeakChatConfig';
import type { TabId2 } from './tabs';

export default function GuideTab({ sc, goTo }: { sc: SpeakChatState; goTo: (tab: TabId2) => void }) {
    const { t } = useTranslation('speakchat');
    const { config, status, statusLoaded, overlayLink } = sc;
    const bothLinked = !!status.hasTwitch && !!status.hasKick;
    const connected = statusLoaded && status.total > 0;

    const step = (n: number, done: boolean, title: string, body: React.ReactNode, tab: TabId2, action: string) => (
        <div className="flex gap-4">
            <span className={`w-8 h-8 3xl:w-10 3xl:h-10 shrink-0 rounded-full font-black flex items-center justify-center text-sm 3xl:text-base ${done ? 'bg-ds-ok/15 text-ds-ok' : 'bg-ds-accent text-ds-on-accent'}`} aria-label={done ? t('v2.guide.done') : undefined}>
                {done ? <Check className="w-4 h-4" aria-hidden /> : n}
            </span>
            <div className="flex-1 min-w-0 space-y-2">
                <h4 className="font-bold text-ds-text text-sm 3xl:text-base">{title}</h4>
                <div className="text-sm 3xl:text-base text-ds-soft space-y-2">{body}</div>
                <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => goTo(tab)}>{action}</button>
            </div>
        </div>
    );

    return (
        <Card title={t('v2.guide.title')} description={t('v2.guide.description')}>
            <div className="space-y-7">
                {step(1, config.global.enabled, t('v2.guide.step1Title'), <p>{t('v2.guide.step1Body')}</p>, 'general', t('v2.guide.goGeneral'))}
                {step(2, true, t('v2.guide.step2Title'),
                    <p>{t('v2.guide.step2Body', { engine: t(`v2.engine.${config.voice.engine}`) })}</p>, 'channelVoice', t('v2.guide.goVoice'))}
                {step(3, connected, t('v2.guide.step3Title'), (
                    <>
                        <p>{t('v2.guide.step3Body')}</p>
                        <LinkRow
                            url={bothLinked ? overlayLink('all') : overlayLink()}
                            name={bothLinked ? t('links.all') : undefined}
                            recommended={bothLinked}
                            copyLabel={t('links.copy')} copiedLabel={t('links.copied')}
                            connected={bothLinked ? status.all > 0 : status.total > 0} loaded={statusLoaded}
                        />
                    </>
                ), 'overlay', t('v2.guide.goOverlay'))}
                {step(4, false, t('v2.guide.step4Title'), <p>{t('v2.guide.step4Body')}</p>, 'tests', t('v2.guide.goTests'))}
            </div>
        </Card>
    );
}
