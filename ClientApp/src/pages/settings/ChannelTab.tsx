import { useTranslation } from 'react-i18next';
import { Switch } from '../../components/ds';
import { InfoRow, SettingsGroup, SettingsRow, PlatformIcon, linkButton } from './parts';
import type { SettingsCtx } from './types';

/** Pestaña «Canal y bot»: tus canales, interruptor del bot, datos del sistema y nivel de acceso. */
export default function ChannelTab({ s }: { s: SettingsCtx }) {
    const { t } = useTranslation(['settings', 'common']);
    const { userInfo, botEnabled, isDiscordOnly, accountChannels, switchingChannel, switchToChannel, handleBotToggle, viewerIsOwner } = s;
    return (
        <div className="space-y-6 4xl:space-y-8">
            {userInfo.isOwner && accountChannels.length > 1 && (
                <SettingsGroup title={t('settings:sections.yourChannels.title')} description={t('settings:sections.yourChannels.description')}>
                    {accountChannels.map((ch: any) => (
                        <SettingsRow
                            key={ch.id}
                            icon={
                                ch.hasKick ? (
                                    <PlatformIcon color="#53FC18"><span className="font-black">K</span></PlatformIcon>
                                ) : (
                                    <PlatformIcon color="#9146FF"><span className="font-black">T</span></PlatformIcon>
                                )
                            }
                            title={ch.hasKick ? ch.kickUsername : ch.twitchLogin}
                            description={ch.hasKick ? 'Kick' : 'Twitch'}
                        >
                            {ch.isCurrent ? (
                                <span className="text-sm 4xl:text-base font-bold text-ds-accent-text px-3 py-1.5">Configurando ahora</span>
                            ) : (
                                <button
                                    onClick={() => switchToChannel(ch.id)}
                                    disabled={switchingChannel}
                                    className="ds-btn ds-btn--primary"
                                >
                                    Configurar este
                                </button>
                            )}
                        </SettingsRow>
                    ))}
                </SettingsGroup>
            )}

            <SettingsGroup title={t('settings:sections.bot.title')}>
                <SettingsRow
                    title={t('settings:general.botStatus.title')}
                    description={isDiscordOnly ? 'Vincula tu cuenta de Twitch para activar el bot' : t('settings:general.botStatus.description')}
                >
                    <Switch checked={!isDiscordOnly && botEnabled} onChange={isDiscordOnly ? undefined : handleBotToggle} disabled={isDiscordOnly} label={t('settings:general.botStatus.title')} />
                </SettingsRow>
            </SettingsGroup>

            <SettingsGroup title={t('settings:systemInfo.title')}>
                <InfoRow label={t('settings:systemInfo.version')} value="Decatron v2.0" />
                <InfoRow label={t('settings:systemInfo.uniqueId')} value={userInfo.uniqueId} />
                <InfoRow label={t('settings:systemInfo.channel')} value={userInfo.login} />
                <InfoRow label={t('settings:systemInfo.memberSince')} value={userInfo.createdAt} />
                <InfoRow label={t('settings:systemInfo.lastUpdate')} value={userInfo.updatedAt} />
            </SettingsGroup>

            <SettingsGroup title={t('settings:sections.accessLevel.title')}>
                <SettingsRow
                    title={viewerIsOwner ? t('settings:accessLevels.owner') : t('settings:accessLevels.controlTotal')}
                    description={t('settings:systemInfo.accessLevelDescription')}
                >
                    <span className="px-3 py-1 bg-ds-accent text-white text-xs 4xl:text-sm font-bold rounded">
                        {viewerIsOwner ? t('settings:accessLevels.owner') : t('settings:accessLevels.controlTotal')}
                    </span>
                </SettingsRow>
            </SettingsGroup>
        </div>
    );
}
