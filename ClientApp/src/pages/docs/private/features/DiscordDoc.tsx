import { MessageSquareText } from 'lucide-react';
import { ModuleDoc } from '../../ModuleDoc';
import type { DocScope } from '../../registry';

// Discord: el texto vive en public/locales/{es,en}/docs-discord.json (una clave por página).
export type DiscordPage = 'overview' | 'setup' | 'alerts' | 'welcome' | 'levels' | 'rewards' | 'commands';

export function DiscordDoc({ page, scope }: { page: DiscordPage; scope: DocScope }) {
    return <ModuleDoc ns="docs-discord" page={page} scope={scope} icon={MessageSquareText} />;
}
