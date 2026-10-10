import { Languages } from 'lucide-react';
import { ModuleDoc } from '../../ModuleDoc';
import type { DocScope } from '../../registry';

// Traducción en vivo, Decatron Desktop y extensión: el texto vive en public/locales/{es,en}/docs-translation.json (una clave por página).
export type TranslationPage = 'overview' | 'setup' | 'config' | 'credits' | 'desktop' | 'extension';

export function TranslationDoc({ page, scope }: { page: TranslationPage; scope: DocScope }) {
    return <ModuleDoc ns="docs-translation" page={page} scope={scope} icon={Languages} />;
}
