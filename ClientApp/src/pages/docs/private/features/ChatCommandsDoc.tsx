import { Clock, Globe } from 'lucide-react';
import { ModuleDoc } from '../../ModuleDoc';
import type { DocScope } from '../../registry';

// Watchtime y la vista pública de comandos: el texto vive en public/locales/{es,en}/docs-chatcmds.json (una clave por página).
export type ChatCommandsPage = 'watchtime' | 'public';

export function ChatCommandsDoc({ page, scope }: { page: ChatCommandsPage; scope: DocScope }) {
    return <ModuleDoc ns="docs-chatcmds" page={page} scope={scope} icon={page === 'watchtime' ? Clock : Globe} />;
}
