import { Sparkles } from 'lucide-react';
import { ModuleDoc } from '../../ModuleDoc';
import type { DocScope } from '../../registry';

// Fortnite Spirits: el texto vive en public/locales/{es,en}/docs-spirits.json (una clave por página).
export type SpiritsPage = 'overview' | 'collection' | 'commands' | 'notices';

export function SpiritsDoc({ page, scope }: { page: SpiritsPage; scope: DocScope }) {
    return <ModuleDoc ns="docs-spirits" page={page} scope={scope} icon={Sparkles} />;
}
