import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PlatformTile, TierPill } from './parts';
import type { SettingsCtx } from './types';

/** Cabecera: quién eres, qué plan tienes, qué canal configuras y tus plataformas unidas. */
export default function SettingsHeader({ s }: { s: SettingsCtx }) {
    const { t } = useTranslation(['settings', 'common']);
    const { userInfo, accountTier, setActiveTab, accountChannels, viewerIsOwner, twitchLinked, discordLinked, kickLinked, riotLinked, epicLinked, headerName, headerAvatar } = s;
    return (
        <section className="bg-ds-surface rounded-lg border border-ds-border p-5 md:p-6 4xl:p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            <div className="flex items-center gap-4 4xl:gap-6 min-w-0">
                {headerAvatar ? (
                    <img src={headerAvatar} alt="" className="w-16 h-16 4xl:w-24 4xl:h-24 rounded-lg object-cover flex-shrink-0" />
                ) : (
                    <div className="w-16 h-16 4xl:w-24 4xl:h-24 rounded-lg bg-ds-accent text-ds-on-accent flex items-center justify-center text-2xl 4xl:text-4xl font-black flex-shrink-0">
                        {(headerName || '?').slice(0, 1).toUpperCase()}
                    </div>
                )}
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl md:text-3xl 4xl:text-4xl font-extrabold text-ds-text truncate">{headerName}</h1>
                        {accountTier && <TierPill tier={accountTier} />}
                        {!viewerIsOwner && (
                            <span className="px-2.5 py-0.5 bg-ds-accent text-ds-on-accent font-bold rounded-md text-xs 4xl:text-sm">{t('settings:header.delegatedBadge')}</span>
                        )}
                    </div>
                    <p className="text-sm 4xl:text-base text-ds-soft mt-0.5">
                        {t('settings:header.configuring')}: <span className="font-semibold text-ds-text">@{userInfo.login}</span>
                        {userInfo.isOwner && accountChannels.length > 1 && (
                            <button onClick={() => setActiveTab('channel')} className="ml-2 font-semibold text-ds-accent-text hover:underline">
                                {t('settings:header.switchChannel')}
                            </button>
                        )}
                    </p>
                </div>
            </div>

            {/* Tus plataformas como fichas unidas por una linea: encendidas las vinculadas */}
            <div>
                <p className="text-xs 4xl:text-sm font-semibold text-ds-soft mb-2">{t('settings:header.platforms')}</p>
                <div className="relative flex items-center gap-3 4xl:gap-4">
                    <span className="absolute left-5 right-5 top-1/2 h-0.5 bg-ds-border" aria-hidden />
                    <PlatformTile name="Twitch" color="#9146FF" on={twitchLinked} onClick={() => setActiveTab('account')} statusText={twitchLinked ? t('settings:header.connected') : t('settings:header.notConnected')}>
                        <svg className="w-5 h-5 4xl:w-6 4xl:h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" /></svg>
                    </PlatformTile>
                    <PlatformTile name="Kick" color="#53FC18" on={kickLinked} onClick={() => setActiveTab('account')} statusText={kickLinked ? t('settings:header.connected') : t('settings:header.notConnected')}>
                        <span className="font-black text-lg 4xl:text-xl">K</span>
                    </PlatformTile>
                    <PlatformTile name="Discord" color="#5865F2" on={discordLinked} onClick={() => setActiveTab('account')} statusText={discordLinked ? t('settings:header.connected') : t('settings:header.notConnected')}>
                        <MessageSquare className="w-5 h-5 4xl:w-6 4xl:h-6" />
                    </PlatformTile>
                    <PlatformTile name="Riot" color="#D13639" on={riotLinked} onClick={() => setActiveTab('games')} statusText={riotLinked ? t('settings:header.connected') : t('settings:header.notConnected')}>
                        <span className="font-black text-lg 4xl:text-xl">R</span>
                    </PlatformTile>
                    <PlatformTile name="Epic" color="var(--ds-text)" on={epicLinked} onClick={() => setActiveTab('games')} statusText={epicLinked ? t('settings:header.connected') : t('settings:header.notConnected')}>
                        <span className="font-black text-lg 4xl:text-xl">E</span>
                    </PlatformTile>
                </div>
            </div>
        </section>
    );
}
