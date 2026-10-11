import { Coins } from 'lucide-react';
import { ModuleDoc } from '../../ModuleDoc';
import type { DocScope } from '../../registry';

// Créditos, compras y comprobantes: el texto vive en public/locales/{es,en}/docs-credits.json (una clave por página).
export type CreditsPage = 'overview' | 'balance' | 'buy' | 'billing';

export function CreditsDoc({ page, scope }: { page: CreditsPage; scope: DocScope }) {
    return <ModuleDoc ns="docs-credits" page={page} scope={scope} icon={Coins} />;
}
