import { Tv2 } from 'lucide-react';
import { ModuleDoc } from './ModuleDoc';
import type { DocScope } from './registry';

// Multi-view: el texto vive en public/locales/{es,en}/docs-multiview.json (una clave por página).
export function MultiviewDoc({ scope }: { scope: DocScope }) {
    return <ModuleDoc ns="docs-multiview" page="overview" scope={scope} icon={Tv2} />;
}
