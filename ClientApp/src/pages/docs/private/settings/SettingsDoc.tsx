import { AccountDoc } from './AccountDoc';

// Configuración de la cuenta (Ajustes): el texto vive en public/locales/{es,en}/docs-account.json → settings.
export default function SettingsDoc() {
    return <AccountDoc page="settings" scope="private" />;
}
