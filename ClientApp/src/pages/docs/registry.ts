import type { ComponentType } from 'react';
import {
    Book, HelpCircle, Rocket, Grid, MessageSquare, Plug, Zap, Code, Variable, Monitor, Dice6,
    Clock, Bell, Gift, Volume2, DollarSign, Shield, Sparkles, Music, Gamepad2, Radio, Cat,
    BarChart3, Users, Code2, Settings, Lock, ListMusic, SlidersHorizontal, Terminal, Palette, History, PlayCircle, Disc, Coins, Trophy, MessageSquareText, Crosshair, Languages, Download,
} from 'lucide-react';

// REGISTRO ÚNICO de las páginas de documentación. De aquí salen el menú lateral, las tarjetas de
// los inicios y el buscador del centro de ayuda. Para agregar una página:
//   1. Crear el componente y su <Route> en App.tsx.
//   2. Agregar una entrada aquí.
//   3. Agregar su título y descripción en public/locales/{es,en}/docs.json → pages.<id>.
// `node .dev/tools/docs_registry_check.mjs` avisa si algo de esto quedó a medias.

export type DocScope = 'public' | 'private';
export type DocGroup = 'start' | 'commands' | 'reference' | 'modules' | 'features' | 'song-request' | 'wheel' | 'tournament' | 'moderation' | 'translation' | 'overlays' | 'settings';
export type DocColor = 'blue' | 'green' | 'yellow' | 'purple' | 'red' | 'pink' | 'orange' | 'cyan';

export interface DocPage {
    /** Clave de i18n: docs.json → pages.<id>.title / .description */
    id: string;
    /** Dónde aparece: la web pública (/docs/…), el panel (/dashboard/docs/…) o ambos. */
    scopes: DocScope[];
    group: DocGroup;
    /** Ruta relativa a la base del scope ('' = el inicio). */
    path: string;
    icon: ComponentType<{ className?: string }>;
    color: DocColor;
}

export const DOC_BASE: Record<DocScope, string> = {
    public: '/docs',
    private: '/dashboard/docs',
};

export function docUrl(scope: DocScope, path: string): string {
    return path ? `${DOC_BASE[scope]}/${path}` : DOC_BASE[scope];
}

export const DOC_GROUP_ORDER: Record<DocScope, DocGroup[]> = {
    public: ['start', 'commands', 'modules', 'reference'],
    private: ['start', 'commands', 'reference', 'features', 'song-request', 'wheel', 'tournament', 'moderation', 'translation', 'overlays', 'settings'],
};

const both: DocScope[] = ['public', 'private'];
const pub: DocScope[] = ['public'];
const priv: DocScope[] = ['private'];

export const DOC_PAGES: DocPage[] = [
    // — Inicio —
    { id: 'home', scopes: pub, group: 'start', path: '', icon: Book, color: 'blue' },
    { id: 'help-center', scopes: priv, group: 'start', path: '', icon: HelpCircle, color: 'blue' },
    { id: 'about', scopes: pub, group: 'start', path: 'about', icon: HelpCircle, color: 'blue' },
    { id: 'getting-started', scopes: pub, group: 'start', path: 'getting-started', icon: Rocket, color: 'green' },
    { id: 'features', scopes: pub, group: 'start', path: 'features', icon: Grid, color: 'cyan' },
    { id: 'faq', scopes: pub, group: 'start', path: 'faq', icon: MessageSquare, color: 'purple' },

    // — Comandos —
    { id: 'commands-default', scopes: both, group: 'commands', path: 'commands/default', icon: Zap, color: 'blue' },
    { id: 'commands-custom', scopes: both, group: 'commands', path: 'commands/custom', icon: MessageSquare, color: 'green' },
    { id: 'commands-micro', scopes: both, group: 'commands', path: 'commands/microcommands', icon: Zap, color: 'yellow' },
    { id: 'commands-scripting', scopes: both, group: 'commands', path: 'commands/scripting', icon: Code, color: 'purple' },
    { id: 'ruleta', scopes: priv, group: 'commands', path: 'commands/ruleta', icon: Crosshair, color: 'red' },

    // — Referencia —
    { id: 'variables', scopes: both, group: 'reference', path: 'variables', icon: Variable, color: 'blue' },
    { id: 'overlay-shoutout', scopes: both, group: 'reference', path: 'overlays/shoutout', icon: Monitor, color: 'purple' },
    { id: 'overlay-gacha', scopes: both, group: 'reference', path: 'overlays/gacha', icon: Dice6, color: 'orange' },
    { id: 'api', scopes: pub, group: 'reference', path: 'api', icon: Plug, color: 'green' },

    // — Solo con cuenta: guías de módulos —
    { id: 'timer', scopes: priv, group: 'features', path: 'features/timer', icon: Clock, color: 'blue' },
    { id: 'event-alerts', scopes: priv, group: 'features', path: 'features/event-alerts', icon: Bell, color: 'red' },
    { id: 'giveaway', scopes: priv, group: 'features', path: 'features/giveaway', icon: Gift, color: 'pink' },
    { id: 'sound-alerts', scopes: priv, group: 'features', path: 'features/sound-alerts', icon: Volume2, color: 'orange' },
    { id: 'tips', scopes: priv, group: 'features', path: 'features/tips', icon: DollarSign, color: 'green' },
    { id: 'shoutout', scopes: priv, group: 'features', path: 'features/shoutout', icon: MessageSquare, color: 'purple' },
    { id: 'ai', scopes: priv, group: 'features', path: 'features/ai', icon: Sparkles, color: 'purple' },
    { id: 'now-playing', scopes: priv, group: 'features', path: 'features/now-playing', icon: Music, color: 'green' },
    { id: 'game-overlays', scopes: priv, group: 'features', path: 'features/game-overlays', icon: Gamepad2, color: 'blue' },
    { id: 'live-overlay', scopes: priv, group: 'features', path: 'features/live-overlay', icon: Radio, color: 'green' },
    { id: 'pets', scopes: priv, group: 'features', path: 'features/pets', icon: Cat, color: 'orange' },
    { id: 'decatron-chat', scopes: priv, group: 'features', path: 'features/decatron-chat', icon: MessageSquare, color: 'blue' },
    { id: 'analytics', scopes: priv, group: 'features', path: 'features/analytics', icon: BarChart3, color: 'blue' },
    { id: 'followers', scopes: priv, group: 'features', path: 'features/followers', icon: Users, color: 'purple' },
    { id: 'developer', scopes: priv, group: 'features', path: 'features/developer', icon: Code2, color: 'blue' },
    { id: 'gacha', scopes: priv, group: 'features', path: 'features/gacha', icon: Dice6, color: 'orange' },

    // — Módulos (visión general pública) —
    { id: 'sr-overview', scopes: pub, group: 'modules', path: 'song-request', icon: Music, color: 'blue' },

    { id: 'wheel-overview', scopes: pub, group: 'modules', path: 'wheel', icon: Disc, color: 'blue' },

    { id: 'tournament-overview', scopes: pub, group: 'modules', path: 'tournaments', icon: Trophy, color: 'blue' },

    { id: 'moderation-overview', scopes: pub, group: 'modules', path: 'moderation', icon: Shield, color: 'red' },

    { id: 'translation-overview', scopes: pub, group: 'modules', path: 'translation', icon: Languages, color: 'blue' },

    // — Rueda y Sorteo: manual con cuenta —
    { id: 'wheel-setup', scopes: priv, group: 'wheel', path: 'wheel/setup', icon: PlayCircle, color: 'blue' },
    { id: 'wheel-prizes', scopes: priv, group: 'wheel', path: 'wheel/prizes', icon: Gift, color: 'blue' },
    { id: 'wheel-credits', scopes: priv, group: 'wheel', path: 'wheel/credits', icon: Coins, color: 'blue' },
    { id: 'wheel-raffle', scopes: priv, group: 'wheel', path: 'wheel/raffle', icon: Trophy, color: 'blue' },
    { id: 'wheel-commands', scopes: priv, group: 'wheel', path: 'wheel/commands', icon: MessageSquareText, color: 'blue' },
    { id: 'wheel-look', scopes: priv, group: 'wheel', path: 'wheel/look', icon: Palette, color: 'blue' },

    // — Torneos: manual con cuenta —
    { id: 'tournament-setup', scopes: priv, group: 'tournament', path: 'tournaments/setup', icon: PlayCircle, color: 'blue' },
    { id: 'tournament-registration', scopes: priv, group: 'tournament', path: 'tournaments/registration', icon: Users, color: 'blue' },
    { id: 'tournament-aram', scopes: priv, group: 'tournament', path: 'tournaments/aram', icon: Gamepad2, color: 'blue' },
    { id: 'tournament-fortnite', scopes: priv, group: 'tournament', path: 'tournaments/fortnite', icon: Crosshair, color: 'blue' },
    { id: 'tournament-punishments', scopes: priv, group: 'tournament', path: 'tournaments/punishments', icon: Shield, color: 'blue' },
    { id: 'tournament-prizes', scopes: priv, group: 'tournament', path: 'tournaments/prizes', icon: Gift, color: 'blue' },
    { id: 'tournament-look', scopes: priv, group: 'tournament', path: 'tournaments/look', icon: Palette, color: 'blue' },
    { id: 'tournament-discord', scopes: priv, group: 'tournament', path: 'tournaments/discord', icon: MessageSquareText, color: 'blue' },

    // — Moderación: manual con cuenta —
    { id: 'moderation-setup', scopes: priv, group: 'moderation', path: 'moderation/setup', icon: PlayCircle, color: 'red' },
    { id: 'moderation-words', scopes: priv, group: 'moderation', path: 'moderation/words', icon: MessageSquare, color: 'red' },
    { id: 'moderation-links', scopes: priv, group: 'moderation', path: 'moderation/links', icon: Plug, color: 'red' },
    { id: 'moderation-spam', scopes: priv, group: 'moderation', path: 'moderation/spam', icon: Zap, color: 'red' },
    { id: 'moderation-raids', scopes: priv, group: 'moderation', path: 'moderation/raids', icon: Radio, color: 'red' },
    { id: 'moderation-commands', scopes: priv, group: 'moderation', path: 'moderation/commands', icon: Terminal, color: 'red' },
    { id: 'moderation-bots', scopes: priv, group: 'moderation', path: 'moderation/bots', icon: Users, color: 'red' },

    // — Traducción en vivo, Desktop y extensión: manual con cuenta —
    { id: 'translation-setup', scopes: priv, group: 'translation', path: 'translation/setup', icon: PlayCircle, color: 'blue' },
    { id: 'translation-config', scopes: priv, group: 'translation', path: 'translation/config', icon: SlidersHorizontal, color: 'blue' },
    { id: 'translation-credits', scopes: priv, group: 'translation', path: 'translation/credits', icon: Coins, color: 'blue' },
    { id: 'translation-desktop', scopes: priv, group: 'translation', path: 'translation/desktop', icon: Download, color: 'blue' },
    { id: 'translation-extension', scopes: priv, group: 'translation', path: 'translation/extension', icon: Monitor, color: 'blue' },

    // — Song Request: manual con cuenta —
    { id: 'sr-setup', scopes: priv, group: 'song-request', path: 'song-request/setup', icon: PlayCircle, color: 'blue' },
    { id: 'sr-requests', scopes: priv, group: 'song-request', path: 'song-request/requests', icon: SlidersHorizontal, color: 'blue' },
    { id: 'sr-playlists', scopes: priv, group: 'song-request', path: 'song-request/playlists', icon: ListMusic, color: 'blue' },
    { id: 'sr-commands', scopes: priv, group: 'song-request', path: 'song-request/commands', icon: Terminal, color: 'blue' },
    { id: 'sr-overlay', scopes: priv, group: 'song-request', path: 'song-request/overlay', icon: Palette, color: 'blue' },
    { id: 'sr-library', scopes: priv, group: 'song-request', path: 'song-request/library', icon: History, color: 'blue' },

    // — Overlays y configuración (solo con cuenta) —
    { id: 'overlays-guide', scopes: priv, group: 'overlays', path: 'overlays', icon: Monitor, color: 'purple' },
    { id: 'settings', scopes: priv, group: 'settings', path: 'settings', icon: Settings, color: 'blue' },
    { id: 'permissions', scopes: priv, group: 'settings', path: 'permissions', icon: Lock, color: 'red' },
];

export function pagesFor(scope: DocScope, group?: DocGroup): DocPage[] {
    return DOC_PAGES.filter(p => p.scopes.includes(scope) && (!group || p.group === group));
}

