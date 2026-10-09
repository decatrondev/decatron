import { Disc } from 'lucide-react';
import { ModuleDoc } from './ModuleDoc';
import type { DocScope } from './registry';

// Rueda, Sorteo y Ruleta: el texto vive en public/locales/{es,en}/docs-wheel.json (una clave por página).
export type WheelPage = 'overview' | 'setup' | 'prizes' | 'credits' | 'raffle' | 'commands' | 'look' | 'ruleta';

export function WheelDoc({ page, scope }: { page: WheelPage; scope: DocScope }) {
    return <ModuleDoc ns="docs-wheel" page={page} scope={scope} icon={Disc} />;
}
