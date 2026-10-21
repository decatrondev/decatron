// Resumen: de un vistazo, si Speak Chat está activo, qué lee, con qué voz, cuánto saldo queda y si OBS lo escucha.
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Card, Toggle } from '../../../../components/overlay-editor/ui';
import SpeakChatHistory from '../../SpeakChatHistory';
import CreditsPanel from './CreditsPanel';
import PlatformsCard from './PlatformsCard';
import ObsLinks from './ObsLinks';
import type { SpeakChatState } from './useSpeakChatConfig';
import type { TabId2 } from './tabs';

export default function SummaryTab({ sc, goTo }: { sc: SpeakChatState; goTo: (tab: TabId2) => void }) {
    const { t } = useTranslation('speakchat');
    const { config, setConfig, status, statusLoaded, historyKey, limits } = sc;
    const active = config.activation.rules.filter(r => r.enabled);
    const ownVoices = config.activation.rules.filter(r => r.type === 'command' && r.voice).length;
    const noOverlay = statusLoaded && config.global.enabled && status.total === 0;

    return (
        <div className="space-y-6">
            <Card>
                <Toggle
                    checked={config.global.enabled}
                    onChange={v => setConfig(c => ({ ...c, global: { ...c.global, enabled: v } }))}
                    label={t('v2.summary.enabled')}
                    hint={config.global.enabled ? t('v2.summary.enabledOn') : t('v2.summary.enabledOff')}
                />
                {noOverlay && (
                    <div role="alert" className="mt-4 flex items-start gap-3 rounded-lg border border-ds-warn/40 bg-ds-warn/10 px-4 py-3 text-sm 3xl:text-base text-ds-warn">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        <span>{t('v2.summary.noOverlay')}</span>
                    </div>
                )}
            </Card>

            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
                <CreditsPanel usage={sc.usage} />
                <PlatformsCard sc={sc} />
            </div>

            <Card
                title={t('v2.summary.readsTitle')}
                description={t('v2.summary.readsDescription')}
                actions={<button type="button" className="ds-btn ds-btn--secondary ds-btn--sm whitespace-nowrap" onClick={() => goTo('commands')}>{t('v2.summary.editCommands')}</button>}
            >
                {active.length === 0 ? (
                    <p className="text-sm 3xl:text-base text-ds-soft">{t('v2.summary.noRules')}</p>
                ) : (
                    <ul className="divide-y divide-ds-border">
                        {active.map((r, i) => (
                            <li key={i} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm 3xl:text-base">
                                <span className="font-semibold text-ds-text">
                                    {r.type === 'command' ? (r.commandName || '!tts') : t(`v2.rules.${r.type}.label`)}
                                </span>
                                <span className="text-ds-soft">
                                    {r.type === 'command' && r.voice ? t(`v2.engine.${r.voice.engine}`) : t('v2.summary.channelVoice')}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm 3xl:text-base text-ds-soft">
                    <span>{t('v2.summary.channelVoiceIs', { engine: t(`v2.engine.${config.voice.engine}`) })}</span>
                    <span>{t('commandVoice.counter', { used: ownVoices, max: limits.max })}</span>
                    <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => goTo('voices')}>{t('v2.summary.editVoice')}</button>
                </div>
            </Card>

            <ObsLinks sc={sc} />
            <SpeakChatHistory refreshKey={historyKey} />
        </div>
    );
}
