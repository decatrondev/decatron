/**
 * Overlay "Partida en vivo" (/overlay/live): lo que Decatron Desktop lee del cliente del
 * juego, en una caja fija con una pantalla por fase. Independiente de Game Overlays
 * (una sola cuenta: la del Desktop; no rota). Plan: LIVE_MATCH_OVERLAY_PLAN.md §3.
 */
import { CardSize, ElementConfig, FontStyle, LivePhaseId, LivePhaseInfo } from '../game-overlays/types';

export type LiveLayout = 'panel' | 'compact' | 'bar';
export const LIVE_LAYOUTS: LiveLayout[] = ['panel', 'compact', 'bar'];

/** Pantallas = fases del Desktop (sin 'none', que es transparente). */
export type LiveScreenId = Exclude<LivePhaseId, 'none'>;
export const LIVE_SCREENS: LiveScreenId[] = ['lobby', 'matchmaking', 'champselect', 'ingame', 'postgame'];

export type LiveElementId =
    | 'title'          // cabecera: punto de estado + fase + cola
    | 'lobbyMembers' | 'scoutRank' | 'scoutWinRate' | 'scoutStreak' | 'scoutTopChamps'
    | 'searchTime'
    | 'myTeamPicks' | 'theirTeamPicks' | 'bans' | 'timer' | 'yourTurn'
    | 'coachSay' | 'coachTips'
    | 'champion' | 'gameTime'
    | 'prediction'
    | 'result' | 'kda' | 'stats' | 'lpDelta';

/** Qué elementos pertenecen a cada pantalla (orden = orden en el editor). */
export const SCREEN_ELEMENTS: Record<LiveScreenId, LiveElementId[]> = {
    lobby: ['title', 'lobbyMembers', 'scoutRank', 'scoutWinRate', 'scoutStreak', 'scoutTopChamps'],
    matchmaking: ['title', 'searchTime'],
    champselect: ['title', 'timer', 'yourTurn', 'myTeamPicks', 'theirTeamPicks', 'bans', 'coachSay'],
    ingame: ['title', 'champion', 'gameTime', 'prediction'],
    postgame: ['title', 'result', 'kda', 'stats', 'lpDelta', 'coachSay', 'coachTips', 'prediction'],
};

export type LiveElementConfig = Pick<ElementConfig, 'visible' | 'font'>;

export interface LiveOverlayConfig {
    layout: LiveLayout;
    size: CardSize;
    sizeMode: 'auto' | 'manual';
    scale: number;
    position: { x: number; y: number };
    background: { type: 'solid' | 'transparent'; color: string; opacity: number; radius: number };
    accent: string;
    chrome: { accentLine: boolean; accentWidth: number; shadow: boolean };
    animation: { in: 'fade' | 'slide' | 'none'; out: 'fade' | 'slide' | 'none'; phaseSwitch: 'fade' | 'slide' | 'none' };
    screens: Record<LiveScreenId, { enabled: boolean }>;
    elements: Partial<Record<LiveElementId, LiveElementConfig>>;
}

export interface LiveOverlayInstance {
    id: number;
    slug: string;
    name: string;
    isEnabled: boolean;
    canvas: { width: number; height: number };
    config: Partial<LiveOverlayConfig>;
    createdAt: string;
    updatedAt: string;
}

/** Lo que manda el backend ("LiveMatchState"): null/none = sin Desktop → transparente. */
export interface LiveMatchState {
    connected: boolean;
    summonerName?: string | null;
    phase?: LivePhaseInfo | null;
    updatedAt: string;
}

export const LIVE_LAYOUT_DEFAULT_SIZE: Record<LiveLayout, CardSize> = {
    panel: { width: 380, height: 300 },
    compact: { width: 420, height: 160 },
    bar: { width: 1872, height: 64 },
};

const F = (size: number, weight = 600, color = '#e6edf3'): FontStyle => ({ size, weight, color });

export function defaultLiveConfig(): LiveOverlayConfig {
    return {
        layout: 'panel',
        size: { ...LIVE_LAYOUT_DEFAULT_SIZE.panel },
        sizeMode: 'auto',
        scale: 1,
        position: { x: 24, y: 24 },
        background: { type: 'solid', color: '#0f1115', opacity: 85, radius: 12 },
        accent: '#c8aa6e',
        chrome: { accentLine: true, accentWidth: 3, shadow: true },
        animation: { in: 'fade', out: 'fade', phaseSwitch: 'fade' },
        screens: { lobby: { enabled: true }, matchmaking: { enabled: true }, champselect: { enabled: true }, ingame: { enabled: true }, postgame: { enabled: true } },
        elements: {
            title: { visible: true, font: F(13, 700, '#ffffff') },
            lobbyMembers: { visible: true, font: F(13, 500) },
            // Scouting de los amigos apagado por defecto: expone su rango/winrate en pantalla (decisión §3.2).
            scoutRank: { visible: false, font: F(12, 500, '#c9d1d9') },
            scoutWinRate: { visible: false, font: F(12, 500, '#c9d1d9') },
            scoutStreak: { visible: false, font: F(12, 500, '#c9d1d9') },
            scoutTopChamps: { visible: false, font: F(11, 500, '#8b949e') },
            searchTime: { visible: true, font: F(13, 600) },
            timer: { visible: true, font: F(12, 600, '#c9d1d9') },
            yourTurn: { visible: true, font: F(12, 800) },
            myTeamPicks: { visible: true, font: F(12, 600) },
            theirTeamPicks: { visible: true, font: F(12, 600) },
            bans: { visible: true, font: F(12, 600) },
            coachSay: { visible: true, font: F(13, 500) },
            coachTips: { visible: true, font: F(12, 500, '#c9d1d9') },
            champion: { visible: true, font: F(14, 700, '#ffffff') },
            gameTime: { visible: true, font: F(13, 600, '#c9d1d9') },
            prediction: { visible: true, font: F(13, 600) },
            result: { visible: true, font: F(16, 800, '#ffffff') },
            kda: { visible: true, font: F(14, 700) },
            stats: { visible: true, font: F(12, 500, '#c9d1d9') },
            lpDelta: { visible: true, font: F(14, 700) },
        },
    };
}

export function resolveLiveConfig(saved?: Partial<LiveOverlayConfig> | null): LiveOverlayConfig {
    const d = defaultLiveConfig();
    if (!saved) return d;
    const elements: LiveOverlayConfig['elements'] = { ...d.elements };
    for (const key of Object.keys(saved.elements ?? {}) as LiveElementId[]) {
        elements[key] = { ...d.elements[key], ...saved.elements![key], font: { ...d.elements[key]?.font, ...saved.elements![key]?.font } } as LiveElementConfig;
    }
    const layout = LIVE_LAYOUTS.includes(saved.layout as LiveLayout) ? saved.layout as LiveLayout : d.layout;
    return {
        ...d,
        ...saved,
        layout,
        size: saved.size?.width && saved.size?.height ? { ...saved.size } : { ...LIVE_LAYOUT_DEFAULT_SIZE[layout] },
        sizeMode: saved.sizeMode === 'manual' ? 'manual' : 'auto',
        scale: typeof saved.scale === 'number' && saved.scale > 0 ? saved.scale : 1,
        position: { ...d.position, ...saved.position },
        background: { ...d.background, ...saved.background },
        chrome: { ...d.chrome, ...saved.chrome },
        animation: { ...d.animation, ...saved.animation },
        screens: { ...d.screens, ...saved.screens },
        elements,
    };
}
