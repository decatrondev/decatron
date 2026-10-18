import { useTranslation } from 'react-i18next';
import { useTenantName } from '../../hooks/useTenantName';
import DesktopAppSettings from './DesktopAppSettings';
import DiscordIntegration from './DiscordIntegration';
import { SettingsGroup } from './parts';
import type { SettingsCtx } from './types';

/** Pestaña «Integraciones»: Discord y la app de escritorio. */
export default function IntegrationsTab({ s }: { s: SettingsCtx }) {
    const { t } = useTranslation(['settings', 'common']);
    const tenantName = useTenantName();
    return (
        <SettingsGroup title={t('settings:sections.integrations.title')} description={t('settings:sections.integrations.description', { brand: tenantName ?? 'Decatron' })}>
            <div className="p-4 4xl:p-6 space-y-3">
                <DiscordIntegration />
                <DesktopAppSettings />
            </div>
        </SettingsGroup>
    );
}
