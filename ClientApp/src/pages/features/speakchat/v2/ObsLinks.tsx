// Enlaces de OBS de Speak Chat: «Todo» (recomendado) y, con los dos canales vinculados, uno por plataforma.
import { useTranslation } from 'react-i18next';
import { Card } from '../../../../components/overlay-editor/ui';
import { LinkRow, Warning } from '../../../../components/overlay-editor/OverlayLinks';
import type { SpeakChatState } from './useSpeakChatConfig';

/** Los enlaces de OBS en fila: con los dos canales vinculados salen los tres a la vista (Todo, Solo Twitch, Solo Kick). */
export function ObsLinkRows({ sc }: { sc: SpeakChatState }) {
    const { t } = useTranslation('speakchat');
    const { status, statusLoaded, overlayLink } = sc;
    const bothLinked = !!status.hasTwitch && !!status.hasKick;
    const common = { copyLabel: t('links.copy'), copiedLabel: t('links.copied'), loaded: statusLoaded };

    return (
        <div className="space-y-4">
            <LinkRow
                url={bothLinked ? overlayLink('all') : overlayLink()}
                name={bothLinked ? t('links.all') : undefined}
                hint={bothLinked ? t('links.allHint') : undefined}
                recommended={bothLinked}
                connected={bothLinked ? status.all > 0 : status.total > 0}
                {...common}
            />
            {bothLinked && (
                <>
                    <LinkRow url={overlayLink('twitch')} name={t('links.twitch')} hint={t('links.twitchHint')} connected={status.twitch > 0} {...common} />
                    <LinkRow url={overlayLink('kick')} name={t('links.kick')} hint={t('links.kickHint')} connected={status.kick > 0} {...common} />
                    <p className="text-xs 3xl:text-sm text-ds-soft">{t('links.perPlatform')}</p>
                </>
            )}
            {status.warnings.includes('mixed') && <Warning title={t('links.warnMixedTitle')} text={t('links.warnMixed')} />}
            {status.warnings.includes('repeated') && !status.warnings.includes('mixed') && <Warning title={t('links.warnRepeatedTitle')} text={t('links.warnRepeated')} />}
            {statusLoaded && !bothLinked && (status.hasTwitch || status.hasKick) && (
                <p className="text-xs 3xl:text-sm text-ds-soft">{t('links.linkOtherHint')}</p>
            )}
        </div>
    );
}

export default function ObsLinks({ sc }: { sc: SpeakChatState }) {
    const { t } = useTranslation('speakchat');
    return (
        <Card title={t('v2.obs.title')} description={t('v2.obs.description')}>
            <ObsLinkRows sc={sc} />
            <ol className="list-decimal pl-5 mt-4 space-y-1 text-sm 3xl:text-base text-ds-soft">
                <li>{t('v2.obs.step1')}</li>
                <li>{t('v2.obs.step2')}</li>
                <li>{t('v2.obs.step3')}</li>
            </ol>
        </Card>
    );
}
