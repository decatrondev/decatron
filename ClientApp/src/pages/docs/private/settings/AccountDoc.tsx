import { UserCircle } from 'lucide-react';
import { ModuleDoc } from '../../ModuleDoc';
import type { DocScope } from '../../registry';

// Cuenta, plataformas, canales e idioma: el texto vive en public/locales/{es,en}/docs-account.json (una clave por página).
export type AccountPage = 'overview' | 'settings' | 'platforms' | 'language';

export function AccountDoc({ page, scope }: { page: AccountPage; scope: DocScope }) {
    return <ModuleDoc ns="docs-account" page={page} scope={scope} icon={UserCircle} />;
}
