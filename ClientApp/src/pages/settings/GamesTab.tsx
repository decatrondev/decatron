import { useTranslation } from 'react-i18next';
import RiotAccountsSettings from './RiotAccountsSettings';
import EpicAccountsSettings from './EpicAccountsSettings';
import { SettingsGroup, SettingsRow, ReadOnlyNotice, Linked, PlatformIcon } from './parts';
import type { SettingsCtx } from './types';

/** Pestaña «Juegos»: cuentas de Riot y Epic. */
export default function GamesTab({ s }: { s: SettingsCtx }) {
    const { t } = useTranslation(['settings', 'common']);
    const { userInfo, identity, viewerIsOwner } = s;
    return (
        <SettingsGroup title={t('settings:sections.games.title')} description={t('settings:sections.games.description')}>
            {viewerIsOwner ? (
                <div className="p-4 4xl:p-6 space-y-3">
                    <RiotAccountsSettings />
                    <EpicAccountsSettings />
                </div>
            ) : (
                <>
                    <ReadOnlyNotice text={t('settings:header.readOnly', { login: identity?.owner.login ?? userInfo.login })} />
                    {identity && identity.riotAccounts.length + identity.epicAccounts.length === 0 && (
                        <SettingsRow title="—" description={t('settings:sections.games.none')} />
                    )}
                    {identity?.riotAccounts.map((a, i) => (
                        <SettingsRow
                            key={`r${i}`}
                            icon={<PlatformIcon color="#D13639"><span className="font-black">R</span></PlatformIcon>}
                            title={a.name}
                            description={a.verified ? <Linked>Riot · verificada</Linked> : 'Riot · sin verificar'}
                        />
                    ))}
                    {identity?.epicAccounts.map((a, i) => (
                        <SettingsRow
                            key={`e${i}`}
                            icon={<PlatformIcon color="var(--ds-text)"><span className="font-black">E</span></PlatformIcon>}
                            title={a.name}
                            description={a.verified ? <Linked>Epic Games · verificada</Linked> : 'Epic Games · sin verificar'}
                        />
                    ))}
                </>
            )}
        </SettingsGroup>
    );
}
