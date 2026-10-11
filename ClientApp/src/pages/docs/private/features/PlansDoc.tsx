import { Zap } from 'lucide-react';
import { ModuleDoc } from '../../ModuleDoc';
import type { DocScope } from '../../registry';

// Planes y apoyo (Supporters): el texto vive en public/locales/{es,en}/docs-plans.json (una clave por página).
export type PlansPage = 'overview' | 'buy' | 'plans';

export function PlansDoc({ page, scope }: { page: PlansPage; scope: DocScope }) {
    return <ModuleDoc ns="docs-plans" page={page} scope={scope} icon={Zap} />;
}
