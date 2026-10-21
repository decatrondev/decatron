import { useTranslation } from 'react-i18next';
import { LinkRow, Warning } from '../../../components/overlay-editor/OverlayLinks';
import type { OverlayStatus } from '../../../components/overlay-editor/OverlayLinks';
import SpeakChatHistory from '../SpeakChatHistory';
import { cardClass, sectionTitle, sectionDesc, Toggle } from './shared';
import type { ConfigProps } from './types';

interface GlobalTabProps extends ConfigProps {
    /** Arma el enlace de OBS; `source` vacío = el enlace de siempre, sin `&source=` */
    overlayLink: (source?: 'all' | 'twitch' | 'kick') => string;
    status: OverlayStatus;
    statusLoaded: boolean;
    historyKey: number;
}

export default function GlobalTab({ config, setConfig, overlayLink, status, statusLoaded, historyKey }: GlobalTabProps) {
    const { t } = useTranslation('speakchat');
    const bothLinked = !!status.hasTwitch && !!status.hasKick;
    const copyLabel = t('links.copy');
    const copiedLabel = t('links.copied');
    return (
        <div className="space-y-6">
            <div className={cardClass}>
                <div className="flex items-center justify-between">
                    <div>
                        <p className={sectionTitle}>🎤 Speak Chat activo</p>
                        <p className={sectionDesc}>Activa o desactiva la lectura de mensajes en este canal</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Toggle
                            checked={config.global.enabled}
                            onChange={v => setConfig(c => ({ ...c, global: { ...c.global, enabled: v } }))}
                        />
                        <span className="text-sm font-bold text-ds-text">
                            {config.global.enabled ? 'Activado' : 'Desactivado'}
                        </span>
                    </div>
                </div>
            </div>

            <div className={cardClass}>
                <p className={sectionTitle}>🔗 URL del Overlay (OBS)</p>
                <p className={sectionDesc}>
                    Agrega esta URL como Browser Source en OBS Studio. Con plan pago funciona directo en OBS.
                    Con el plan Free necesitas tener una pestaña del navegador abierta.
                </p>
                <LinkRow
                    url={bothLinked ? overlayLink('all') : overlayLink()}
                    copyLabel={copyLabel} copiedLabel={copiedLabel}
                    name={bothLinked ? t('links.all') : undefined}
                    hint={bothLinked ? t('links.allHint') : undefined}
                    recommended={bothLinked}
                    connected={bothLinked ? status.all > 0 : status.total > 0}
                    loaded={statusLoaded}
                />
                {bothLinked && (
                    <div className="pt-3 mt-4 border-t border-ds-border">
                        <p className="text-xs 3xl:text-sm font-bold uppercase tracking-wide text-ds-soft">{t('links.advancedTitle')}</p>
                        <p className="text-xs 3xl:text-sm text-ds-soft mt-1 mb-3">{t('links.perPlatform')}</p>
                        <div className="space-y-3">
                            <LinkRow url={overlayLink('twitch')} name={t('links.twitch')} connected={status.twitch > 0} loaded={statusLoaded} copyLabel={copyLabel} copiedLabel={copiedLabel} />
                            <LinkRow url={overlayLink('kick')} name={t('links.kick')} connected={status.kick > 0} loaded={statusLoaded} copyLabel={copyLabel} copiedLabel={copiedLabel} />
                        </div>
                    </div>
                )}
                {status.warnings.includes('mixed') && <Warning title={t('links.warnMixedTitle')} text={t('links.warnMixed')} />}
                {status.warnings.includes('repeated') && !status.warnings.includes('mixed') && <Warning title={t('links.warnRepeatedTitle')} text={t('links.warnRepeated')} />}
                {statusLoaded && !bothLinked && (status.hasTwitch || status.hasKick) && (
                    <p className="text-xs 3xl:text-sm text-ds-soft mt-3">{t('links.linkOtherHint')}</p>
                )}
            </div>

            <SpeakChatHistory refreshKey={historyKey} />
        </div>
    );
}
