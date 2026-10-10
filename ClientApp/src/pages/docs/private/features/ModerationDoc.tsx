import { Shield } from 'lucide-react';
import { ModuleDoc } from '../../ModuleDoc';
import type { DocScope } from '../../registry';

// Moderación: el texto vive en public/locales/{es,en}/docs-moderation.json (una clave por página).
export type ModerationPage = 'overview' | 'setup' | 'words' | 'links' | 'spam' | 'raids' | 'commands' | 'bots';

export function ModerationDoc({ page, scope }: { page: ModerationPage; scope: DocScope }) {
    return <ModuleDoc ns="docs-moderation" page={page} scope={scope} icon={Shield} />;
}
