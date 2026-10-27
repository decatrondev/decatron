import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';
import { onTokenChanged, onTokenRemoved } from '../utils/tokenEvents';

// Módulos del plan del tenant del Host (GET /platform/my-modules). Solo informativo: el servidor
// responde 403 module_not_included si se insiste. Mientras carga o si falla, se muestra todo (no se esconde
// una función por un error de red); el tenant #1 siempre lo tiene todo.
interface PlanModulesValue {
    loaded: boolean;
    /** Un módulo, o una lista (basta uno: el menú/hub se muestra si el plan trae alguno de sus módulos). */
    has: (module: string | string[]) => boolean;
}

const PlanModulesContext = createContext<PlanModulesValue>({ loaded: false, has: () => true });

export function PlanModulesProvider({ children }: { children: ReactNode }) {
    const [modules, setModules] = useState<Set<string> | null>(null);

    const load = useCallback(async () => {
        if (!localStorage.getItem('token')) { setModules(null); return; }
        try {
            const res = await api.get('/platform/my-modules');
            setModules(res.data?.success ? new Set<string>(res.data.modules) : null);
        } catch {
            setModules(null);
        }
    }, []);

    useEffect(() => {
        load();
        const offChanged = onTokenChanged(load);
        const offRemoved = onTokenRemoved(() => setModules(null));
        return () => { offChanged(); offRemoved(); };
    }, [load]);

    const has = useCallback((m: string | string[]) => modules === null || [m].flat().some(x => modules.has(`module.${x}`)), [modules]);

    return <PlanModulesContext.Provider value={{ loaded: modules !== null, has }}>{children}</PlanModulesContext.Provider>;
}

export const usePlanModules = () => useContext(PlanModulesContext);

// Módulos de cada grupo (el menú o el hub aparece si el plan trae alguno).
export const OVERLAY_MODULES = ['ov_chat', 'ov_shoutout', 'ov_sound_alerts', 'ov_event_alerts', 'ov_goals', 'ov_now_playing', 'ov_live', 'ov_promo', 'timers', 'giveaways', 'song_request', 'game_overlays', 'pets', 'roulette', 'gacha'];
export const MODERATION_MODULES = ['mod_banned_words', 'mod_links', 'mod_spam', 'mod_raids', 'mod_commands', 'mod_history'];

// Módulo que exige cada ruta del panel (la más específica gana). Lo que no está aquí no depende del plan.
const ROUTE_MODULES: [string, string | string[]][] = [
    ['/me/spirits', 'spirits'],
    ['/me/tcg', 'gacha'],
    ['/me/gacha', 'gacha'],
    ['/commands/ruleta', 'roulette'],
    ['/commands/clip', 'clips'],
    ['/commands/microcommands', 'cmd_micro'],
    ['/commands/custom', 'cmd_custom'],
    ['/commands/scripting', 'cmd_scripting'],
    ['/commands/watchtime', 'cmd_watchtime'],
    ['/commands/public', 'cmd_public'],
    ['/features/moderation/banned-words', 'mod_banned_words'],
    ['/features/moderation/links', 'mod_links'],
    ['/features/moderation/spam', 'mod_spam'],
    ['/features/moderation/raids', 'mod_raids'],
    ['/features/moderation/commands', 'mod_commands'],
    ['/features/moderation/history', 'mod_history'],
    ['/features/moderation', MODERATION_MODULES],
    ['/moderation', MODERATION_MODULES],
    ['/discord', 'discord'],
    ['/multi', 'multiview'],
    ['/overlays/song-request', 'song_request'],
    ['/overlays/timer', 'timers'],
    ['/overlays/rueda', 'roulette'],
    ['/overlays/pets', 'pets'],
    ['/overlays/games', 'game_overlays'],
    ['/overlays/chat', 'ov_chat'],
    ['/overlays/shoutout', 'ov_shoutout'],
    ['/overlays/sound-alerts', 'ov_sound_alerts'],
    ['/overlays/event-alerts', 'ov_event_alerts'],
    ['/overlays/goals', 'ov_goals'],
    ['/overlays/now-playing', 'ov_now_playing'],
    ['/overlays/live', 'ov_live'],
    ['/overlays/promo', 'ov_promo'],
    ['/overlays/gacha', 'gacha'],
    ['/overlays', OVERLAY_MODULES],
    ['/features/sound-alerts', 'ov_sound_alerts'],
    ['/features/event-alerts', 'ov_event_alerts'],
    ['/features/timers', 'timers'],
    ['/features/giveaways', 'giveaways'],
    ['/features/speak-chat', 'tts'],
    ['/features/live-translation', 'live_translation'],
    ['/features/lol-coach', 'lol_coach'],
    ['/features/torneos', 'tournaments'],
    ['/features/emotes', 'emotes'],
    ['/features/bots', 'bots'],
    ['/features/tips', 'tips'],
    ['/features/decatron-chat', 'decatron_chat'],
    ['/features/decatron-ai', 'decatron_ai'],
    ['/features/gacha', 'gacha'],
    ['/analytics', 'analytics'],
    ['/followers', 'followers'],
    ['/credits', 'credits'],
    ['/developer', 'developer'],
];

export function moduleForPath(pathname: string): string | string[] | null {
    for (const [prefix, mod] of ROUTE_MODULES) {
        if (pathname === prefix || pathname.startsWith(prefix + '/')) return mod;
    }
    return null;
}
