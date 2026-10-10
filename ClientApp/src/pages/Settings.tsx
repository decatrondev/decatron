import { Lock } from 'lucide-react';
import { Tabs } from '../components/ds';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../hooks/usePermissions';
import { useSettingsData } from './settings/useSettingsData';
import type { SettingsCtx, SettingsTab } from './settings/types';
import SettingsHeader from './settings/SettingsHeader';
import AccountTab from './settings/AccountTab';
import ChannelTab from './settings/ChannelTab';
import AccessTab from './settings/AccessTab';
import GamesTab from './settings/GamesTab';
import IntegrationsTab from './settings/IntegrationsTab';
import SettingsModals from './settings/SettingsModals';
import SettingsToasts from './settings/SettingsToasts';

// Configuración (rediseño 2026-09-29): una sección por pestaña, la pestaña va en ?tab= para poder enlazarla.
// Esta página solo arma la estructura; los datos viven en settings/useSettingsData y cada pestaña es su propio archivo.
export default function Settings() {
    const { t } = useTranslation(['settings', 'common']);
    const data = useSettingsData();
    const { botStatus, userInfo, pageLoading, isDiscordOnly, identity, authProvider, linkedKick, linkedTwitch, jwtClaims, activeTab, setActiveTab } = data;

    // --- VALIDACIÓN DE PERMISOS ---
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const navigate = useNavigate();

    // Verificar permisos de acceso a Settings
    if (permissionsLoading) {
        return <div className="text-center py-8 text-ds-soft">{t('settings:loading.verifyingPermissions')}</div>;
    }

    // Discord-only users can always see settings (their version)
    if (!isDiscordOnly && !hasMinimumLevel('control_total')) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-ds-danger/10 border border-ds-danger/30 rounded-lg p-8 max-w-md text-center">
                    <Lock className="w-16 h-16 text-ds-danger mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-ds-danger mb-2">{t('settings:accessDenied.title')}</h2>
                    <p className="text-ds-soft mb-6">
                        {t("settings:accessDenied.message")}
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="ds-btn ds-btn--primary ds-btn--lg"
                    >
                        {t('settings:accessDenied.backToDashboard')}
                    </button>
                </div>
            </div>
        );
    }

    if (pageLoading || !botStatus || !userInfo) {
        return <div className="text-center py-8 text-ds-soft">{t('settings:loading.loadingSettings')}</div>;
    }

    // Estado de cada plataforma para la cabecera y las filas de "Mi cuenta".
    // Quien mira es el dueño del canal: si no, lo personal se muestra solo lectura.
    const viewerIsOwner = identity ? identity.isOwner : userInfo.isOwner !== false;
    const twitchLinked = identity ? !!identity.platforms.twitch : authProvider === 'twitch' || authProvider === 'both' || (authProvider === 'kick' && !!linkedTwitch);
    const discordLinked = identity ? identity.platforms.discord : authProvider === 'discord' || authProvider === 'both';
    const kickLinked = identity ? !!identity.platforms.kick : authProvider === 'kick' || !!linkedKick;
    const riotLinked = !!identity && identity.riotAccounts.length > 0;
    const epicLinked = !!identity && identity.epicAccounts.length > 0;
    const headerName = identity?.owner.displayName || userInfo.displayName;
    const headerAvatar = identity ? identity.owner.profileImageUrl : jwtClaims.ProfileImage;

    const tabs: { id: SettingsTab; label: string }[] = [
        { id: 'account', label: t('settings:tabs.account') },
        { id: 'channel', label: t('settings:tabs.channel') },
        ...(!isDiscordOnly ? [{ id: 'access' as SettingsTab, label: t('settings:tabs.access') }] : []),
        { id: 'games', label: t('settings:tabs.games') },
        { id: 'integrations', label: t('settings:tabs.integrations') },
    ];
    const currentTab: SettingsTab = tabs.some((x) => x.id === activeTab) ? activeTab : 'account';

    const s: SettingsCtx = { ...data, userInfo, botStatus, viewerIsOwner, twitchLinked, discordLinked, kickLinked, riotLinked, epicLinked, headerName, headerAvatar, tabs, currentTab };

    return (
        <>
            <div className="font-onest max-w-[1400px] 4xl:max-w-[1900px] 5xl:max-w-[2500px] mx-auto space-y-6 4xl:space-y-8">
                <SettingsHeader s={s} />

                {/* Pestañas */}
                <nav className="sticky top-0 z-20 -mx-1 px-1 bg-ds-bg/90 backdrop-blur">
                    <Tabs items={tabs} value={currentTab} onChange={(id) => setActiveTab(id as SettingsTab)} />
                </nav>

                {currentTab === 'account' && <AccountTab s={s} />}
                {currentTab === 'channel' && <ChannelTab s={s} />}
                {currentTab === 'access' && !isDiscordOnly && <AccessTab s={s} />}
                {currentTab === 'games' && <GamesTab s={s} />}
                {currentTab === 'integrations' && <IntegrationsTab s={s} />}
            </div>

            <SettingsModals s={s} />
            <SettingsToasts s={s} />
        </>
    );
}
