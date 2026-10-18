import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';
import { onTokenChanged, onTokenRemoved } from '../utils/tokenEvents';

// Módulos del plan del tenant del Host (GET /platform/my-modules). Solo informativo: el servidor
// responde 403 module_not_included si se insiste. Mientras carga o si falla, se muestra todo (no se esconde
// una función por un error de red); el tenant #1 siempre lo tiene todo.
interface PlanModulesValue {
    loaded: boolean;
    has: (module: string) => boolean;
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

    const has = useCallback((m: string) => modules === null || modules.has(`module.${m}`), [modules]);

    return <PlanModulesContext.Provider value={{ loaded: modules !== null, has }}>{children}</PlanModulesContext.Provider>;
}

export const usePlanModules = () => useContext(PlanModulesContext);

// Módulo que exige cada ruta del panel (la más específica gana). Lo que no está aquí no depende del plan.
const ROUTE_MODULES: [string, string][] = [
    ['/commands/ruleta', 'roulette'],
    ['/commands/clip', 'clips'],
    ['/commands', 'commands'],
    ['/moderation', 'moderation'],
    ['/features/moderation', 'moderation'],
    ['/discord', 'discord'],
    ['/overlays/song-request', 'song_request'],
    ['/overlays/timer', 'timers'],
    ['/overlays/rueda', 'roulette'],
    ['/overlays/pets', 'pets'],
    ['/overlays/games', 'game_overlays'],
    ['/overlays', 'overlays'],
    ['/features/timers', 'timers'],
    ['/features/giveaways', 'giveaways'],
    ['/features/speak-chat', 'tts'],
    ['/features/live-translation', 'live_translation'],
    ['/features/lol-coach', 'lol_coach'],
    ['/features/torneos', 'tournaments'],
];

export function moduleForPath(pathname: string): string | null {
    for (const [prefix, mod] of ROUTE_MODULES) {
        if (pathname === prefix || pathname.startsWith(prefix + '/')) return mod;
    }
    return null;
}
