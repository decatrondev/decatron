import { MessageSquare } from 'lucide-react';
import { ModuleDoc } from '../../ModuleDoc';
import type { DocScope } from '../../registry';

// Chat en pantalla y emotes: el texto vive en public/locales/{es,en}/docs-chat.json (una clave por página).
export type ChatEmotesPage = 'overview' | 'setup' | 'look' | 'bubbles' | 'filters' | 'emotes' | 'own-emotes';

export function ChatEmotesDoc({ page, scope }: { page: ChatEmotesPage; scope: DocScope }) {
    return <ModuleDoc ns="docs-chat" page={page} scope={scope} icon={MessageSquare} />;
}
