import { Trophy } from 'lucide-react';
import { ModuleDoc } from './ModuleDoc';
import type { DocScope } from './registry';

// Torneos: el texto vive en public/locales/{es,en}/docs-tournament.json (una clave por página).
export type TournamentPage = 'overview' | 'setup' | 'registration' | 'aram' | 'fortnite' | 'punishments' | 'prizes' | 'look' | 'discord';

export function TournamentDoc({ page, scope }: { page: TournamentPage; scope: DocScope }) {
    return <ModuleDoc ns="docs-tournament" page={page} scope={scope} icon={Trophy} />;
}
