import { AtSign } from 'lucide-react';
import { ModuleDoc } from './ModuleDoc';
import type { DocScope } from './registry';

// Página personal (decatron.net/@nombre): el texto vive en public/locales/{es,en}/docs-personal-page.json.
// «overview» es la página pública y «guide» la guía con sesión.
export function PersonalPageDoc({ scope }: { scope: DocScope }) {
    return <ModuleDoc ns="docs-personal-page" page={scope === 'public' ? 'overview' : 'guide'} scope={scope} icon={AtSign} />;
}
