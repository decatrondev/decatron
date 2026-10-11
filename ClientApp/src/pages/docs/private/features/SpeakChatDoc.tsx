import { Mic } from 'lucide-react';
import { ModuleDoc } from '../../ModuleDoc';
import type { DocScope } from '../../registry';

// Speak Chat: el texto vive en public/locales/{es,en}/docs-speak.json (una clave por página).
export type SpeakChatPage = 'overview' | 'setup' | 'activation' | 'voice' | 'filters';

export function SpeakChatDoc({ page, scope }: { page: SpeakChatPage; scope: DocScope }) {
    return <ModuleDoc ns="docs-speak" page={page} scope={scope} icon={Mic} />;
}
