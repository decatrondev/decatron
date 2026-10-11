import { Radio } from 'lucide-react';
import { ModuleDoc } from '../../ModuleDoc';
import type { DocScope } from '../../registry';

// Kick como plataforma: el texto vive en public/locales/{es,en}/docs-kick.json (una clave por página).
export type KickPage = 'overview' | 'connect' | 'features';

export function KickDoc({ page, scope }: { page: KickPage; scope: DocScope }) {
    return <ModuleDoc ns="docs-kick" page={page} scope={scope} icon={Radio} />;
}
