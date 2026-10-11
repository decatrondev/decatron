import { Bot } from 'lucide-react';
import { ModuleDoc } from '../../ModuleDoc';
import type { DocScope } from '../../registry';

// Coach de LoL: el texto vive en public/locales/{es,en}/docs-coach.json (una clave por página).
export type CoachPage = 'overview' | 'setup' | 'behavior' | 'commands';

export function CoachDoc({ page, scope }: { page: CoachPage; scope: DocScope }) {
    return <ModuleDoc ns="docs-coach" page={page} scope={scope} icon={Bot} />;
}
