import { Gamepad2 } from 'lucide-react';
import { ModuleDoc } from '../../ModuleDoc';
import type { DocScope } from '../../registry';

// Cuentas de juego (Riot, Epic y otros): el texto vive en public/locales/{es,en}/docs-accounts.json (una clave por página).
export type AccountsPage = 'overview' | 'riot' | 'epic';

export function AccountsDoc({ page, scope }: { page: AccountsPage; scope: DocScope }) {
    return <ModuleDoc ns="docs-accounts" page={page} scope={scope} icon={Gamepad2} />;
}
