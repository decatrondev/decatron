// Tipos compartidos entre el overlay (/overlay/games), el panel y el editor.
// Espejo del modelo normalizado del backend (Decatron.Core/Models/GameOverlays/GameDataModels.cs).

export type GameId =
    | 'lol' | 'tft' | 'valorant' | 'marvel_rivals' | 'cs2' | 'fortnite' | 'rocket_league' | 'warzone';

export const GAME_IDS: GameId[] = ['lol', 'tft', 'valorant', 'marvel_rivals', 'cs2', 'fortnite', 'rocket_league', 'warzone'];

export const GAME_NAMES: Record<GameId, string> = {
    lol: 'League of Legends',
    tft: 'Teamfight Tactics',
    valorant: 'VALORANT',
    marvel_rivals: 'Marvel Rivals',
    cs2: 'Counter-Strike 2',
    fortnite: 'Fortnite',
    rocket_league: 'Rocket League',
    warzone: 'Warzone',
};

// Un solo color de acento por juego (plan §4). Nada de gradientes.
export const GAME_ACCENTS: Record<GameId, string> = {
    lol: '#c8aa6e',
    tft: '#e8b04b',
    valorant: '#ff4655',
    marvel_rivals: '#f5c518',
    cs2: '#f0a028',
    fortnite: '#5ab3ff',
    rocket_league: '#1a7bff',
    warzone: '#8bc34a',
};

export interface RankInfo {
    tier: string;
    division?: string | null;
    points?: number | null;
    pointsLabel: string;
    wins: number;
    losses: number;
    queue?: string | null;
    emblem?: string | null;
    isExact: boolean;
    source: string;
    isUnranked: boolean;
    winRate?: number | null;
}

export interface MatchSummary {
    id: string;
    result: 'win' | 'loss' | 'draw' | 'remake' | string;
    kills?: number | null;
    deaths?: number | null;
    assists?: number | null;
    character?: string | null;
    placement?: number | null;
    queue?: string | null;
    endedAt: string;
    durationSeconds: number;
    pointsDelta?: number | null;
    characterIcon?: string | null;
    role?: string | null;
    cs?: number | null;
    csPerMin?: number | null;
    damage?: number | null;
    visionScore?: number | null;
    kda?: number | null;
}

export interface PointsSample { at: string; absolute: number; label: string; }

export interface CharacterStat {
    name: string;
    icon?: string | null;
    games: number;
    wins: number;
    losses: number;
    avgKda?: number | null;
    winRate?: number | null;
}

export interface MasteryInfo { name: string; icon?: string | null; level: number; points: number; }

/** Promedios de las últimas N partidas (no solo la sesión), top campeones, racha, maestría. */
export interface AccountStats {
    sampleSize: number;
    winRate?: number | null;
    avgKda?: number | null;
    avgKills?: number | null;
    avgDeaths?: number | null;
    avgAssists?: number | null;
    avgCsPerMin?: number | null;
    avgDamage?: number | null;
    avgVisionScore?: number | null;
    streak: number;
    mainRole?: string | null;
    topCharacters: CharacterStat[];
    mastery: MasteryInfo[];
    updatedAt: string;
}

export interface LiveGameInfo {
    inGame: boolean;
    character?: string | null;
    characterIcon?: string | null;
    queue?: string | null;
    startedAt?: string | null;
}

export interface SessionState {
    startRank?: RankInfo | null;
    currentRank?: RankInfo | null;
    wins: number;
    losses: number;
    matches: MatchSummary[];
    streamStartedAt: string;
    pointsDelta?: number | null;
    pointsHistory?: PointsSample[];
    winRate?: number | null;
    streak?: number;
}

// ─── Fase en vivo (Decatron Desktop leyendo el cliente de LoL) ────────────────
export interface LiveChampionRef { id: number; name: string; icon?: string | null; }
export interface LiveLobbyMember { name: string; tag?: string | null; isMe: boolean; isLeader: boolean; position1?: string | null; position2?: string | null; }
export interface LivePick { cellId: number; champion?: LiveChampionRef | null; position?: string | null; isMe: boolean; locked: boolean; }
export interface LiveChampSelect {
    myTeam: LivePick[]; theirTeam: LivePick[]; myBans: LiveChampionRef[]; theirBans: LiveChampionRef[];
    timerPhase?: string | null; remainingMs?: number | null; myPick?: LiveChampionRef | null; myPosition?: string | null; myTurn: boolean;
}
export interface LiveGameDetails { champion?: LiveChampionRef | null; position?: string | null; startedAt?: string | null; gameMode?: string | null; }
export interface LivePostGamePlayer { name: string; champion?: LiveChampionRef | null; kills: number; deaths: number; assists: number; isMe: boolean; }
export interface LivePostGame {
    win: boolean; champion?: LiveChampionRef | null; kills: number; deaths: number; assists: number;
    cs?: number | null; damage?: number | null; visionScore?: number | null; durationSeconds: number; pointsDelta?: number | null;
    myTeam: LivePostGamePlayer[]; theirTeam: LivePostGamePlayer[];
}
export type LivePhaseId = 'none' | 'lobby' | 'matchmaking' | 'champselect' | 'ingame' | 'postgame';
export interface LivePhaseInfo {
    phase: LivePhaseId;
    queueId?: number | null;
    queueName?: string | null;
    lobby: LiveLobbyMember[];
    champSelect?: LiveChampSelect | null;
    game?: LiveGameDetails | null;
    postGame?: LivePostGame | null;
    updatedAt: string;
}

export interface AccountOverlayState {
    accountId: number;
    game: GameId;
    displayName: string;
    externalName: string;
    region?: string | null;
    rank?: RankInfo | null;
    session?: SessionState | null;
    live?: LiveGameInfo | null;
    stats?: AccountStats | null;
    /** Solo con Decatron Desktop conectado y el cliente de LoL abierto en esta cuenta. */
    livePhase?: LivePhaseInfo | null;
    updatedAt: string;
}

export interface OverlayState {
    activeGame?: GameId | null;
    reason: 'category' | 'manual' | 'idle' | 'unconfigured' | 'no_accounts' | 'preview' | string;
    activeAccountId?: number | null;
    accounts: AccountOverlayState[];
    updatedAt: string;
}

// ─── Config visual por juego (games_json[game]) ─────────────────────────────

export type LayoutPreset = 'card' | 'compact' | 'bar' | 'emblem-only';
export type ElementId = 'emblem' | 'rank' | 'lp' | 'session' | 'recent' | 'accountName' | 'gameLogo' | 'liveCharacter'
    // Fase "LoL enriquecido": estadísticas de las últimas partidas
    | 'winrate' | 'kdaCs' | 'streak' | 'topChamps' | 'mastery' | 'lpGraph'
    // Fase B: en vivo desde Decatron Desktop (selección de campeón, fin de partida)
    | 'champSelect' | 'postGame';

export interface FontStyle {
    family?: string;
    size?: number;
    weight?: number;
    color?: string;
    shadow?: boolean;
}

export interface ElementConfig {
    visible: boolean;
    position?: { x: number; y: number };
    size?: number;
    font?: FontStyle;
    // recent / topChamps / mastery
    count?: number;
    style?: 'dots' | 'cards' | 'icons';
    // session
    showDelta?: boolean;
    // winrate: 'ranked' = W-L de toda la temporada, 'recent' = últimas 20, 'session' = hoy
    scope?: 'ranked' | 'recent' | 'session';
    // kdaCs: qué métricas mostrar
    metrics?: ('kda' | 'cs' | 'damage' | 'vision')[];
    // lpGraph
    height?: number;
}

export type StylePreset = 'minimal' | 'stats' | 'full';
export const STYLE_PRESET_LABELS: Record<StylePreset, string> = { minimal: 'Minimal', stats: 'Stats (op.gg)', full: 'Completo' };
/** Qué elementos deja visibles cada preset; el resto de la config no se toca. */
export const STYLE_PRESET_ELEMENTS: Record<StylePreset, ElementId[]> = {
    minimal: ['emblem', 'rank', 'lp', 'session', 'liveCharacter', 'champSelect', 'postGame'],
    stats: ['emblem', 'rank', 'lp', 'accountName', 'session', 'winrate', 'kdaCs', 'streak', 'recent', 'topChamps', 'lpGraph', 'liveCharacter', 'champSelect', 'postGame'],
    full: ['emblem', 'gameLogo', 'rank', 'lp', 'accountName', 'session', 'winrate', 'kdaCs', 'streak', 'recent', 'topChamps', 'mastery', 'lpGraph', 'liveCharacter', 'champSelect', 'postGame'],
};

/** Vistas por las que rota la tarjeta ("tipo GIF"): la principal, stats, campeones, gráfico. */
export type SlideView = 'main' | 'stats' | 'champs' | 'graph';
export const SLIDE_VIEW_LABELS: Record<SlideView, string> = { main: 'Principal', stats: 'Estadísticas', champs: 'Campeones', graph: 'Gráfico de LP' };
export interface SlidesConfig {
    enabled: boolean;
    /** Segundos que dura cada vista. */
    seconds: number;
    views: SlideView[];
}
/**
 * Tarjeta de Decatron: cada cierto tiempo tapa la tarjeta de la cuenta con el logo
 * completo del bot y un mensaje ("Consigue Decatron gratis en decatron.net"). En el
 * tier gratis no se puede apagar (el backend lo fuerza); en los de pago sí.
 */
export interface PromoConfig {
    enabled: boolean;
    /** Cada cuántos segundos aparece. */
    everySeconds: number;
    /** Cuántos segundos se queda. */
    durationSeconds: number;
}

export interface GameVisualConfig {
    enabled: boolean;
    accounts: number[];
    rotation: { mode: 'none' | 'interval' | 'active_first'; seconds: number };
    sessionScope: 'visible_account' | 'all_accounts';
    /** Cola por defecto del juego (p. ej. 'solo' | 'flex' en LoL). undefined = default del proveedor. */
    queue?: string;
    /** Override por cuenta: id de cuenta -> cola. */
    accountQueues?: Record<string, string>;
    layout: LayoutPreset;
    elements: Partial<Record<ElementId, ElementConfig>>;
    background: { type: 'solid' | 'transparent'; color: string; opacity: number; radius: number };
    accent?: string;
    animation: { in: 'fade' | 'slide' | 'none'; out: 'fade' | 'slide' | 'none'; accountSwitch: 'fade' | 'slide' | 'none' };
    /** Posicion de la tarjeta en el canvas (px). */
    position: { x: number; y: number };
    slides: SlidesConfig;
    promo: PromoConfig;
}

export interface GameOverlayInstance {
    id: number;
    slug: string;
    name: string;
    isEnabled: boolean;
    detectionMode: 'auto' | 'manual';
    forcedGame?: GameId | null;
    idleBehavior: 'hide' | 'multi_card';
    canvas: { width: number; height: number };
    games: Partial<Record<GameId, Partial<GameVisualConfig>>>;
    createdAt: string;
    updatedAt: string;
}

export function defaultGameConfig(game: GameId): GameVisualConfig {
    return {
        enabled: false,
        accounts: [],
        rotation: { mode: 'none', seconds: 30 },
        sessionScope: 'visible_account',
        queue: undefined,
        accountQueues: {},
        layout: 'card',
        elements: {
            emblem: { visible: true, size: 96 },
            rank: { visible: true, font: { size: 26, weight: 700, color: '#ffffff', shadow: true } },
            lp: { visible: true, font: { size: 16, weight: 500, color: '#c9d1d9' } },
            session: { visible: true, showDelta: true, font: { size: 15, weight: 600, color: '#e6edf3' } },
            recent: { visible: true, count: 5, style: 'dots' },
            accountName: { visible: true, font: { size: 13, weight: 500, color: '#8b949e' } },
            gameLogo: { visible: false, size: 28 },
            liveCharacter: { visible: true, font: { size: 13, weight: 600, color: '#e6edf3' } },
            // Nuevos: apagados por defecto para no cambiar los overlays que ya están en OBS.
            winrate: { visible: false, scope: 'ranked', font: { size: 14, weight: 600, color: '#e6edf3' } },
            kdaCs: { visible: false, metrics: ['kda', 'cs'], font: { size: 13, weight: 500, color: '#c9d1d9' } },
            streak: { visible: false, font: { size: 13, weight: 700, color: '#e6edf3' } },
            topChamps: { visible: false, count: 3, font: { size: 12, weight: 500, color: '#c9d1d9' } },
            mastery: { visible: false, count: 3, font: { size: 12, weight: 500, color: '#c9d1d9' } },
            lpGraph: { visible: false, height: 48 },
            // Solo aparecen con Decatron Desktop conectado: encendidos por defecto.
            champSelect: { visible: true, font: { size: 12, weight: 600, color: '#e6edf3' } },
            postGame: { visible: true, font: { size: 14, weight: 600, color: '#e6edf3' } },
        },
        background: { type: 'solid', color: '#0f1115', opacity: 85, radius: 12 },
        accent: GAME_ACCENTS[game],
        animation: { in: 'fade', out: 'fade', accountSwitch: 'slide' },
        position: { x: 24, y: 24 },
        slides: { enabled: false, seconds: 12, views: ['main', 'stats', 'champs', 'graph'] },
        promo: { enabled: true, everySeconds: 180, durationSeconds: 8 },
    };
}

/** Mezcla la config guardada (parcial) con los defaults del juego. */
export function resolveGameConfig(game: GameId, saved?: Partial<GameVisualConfig> | null): GameVisualConfig {
    const d = defaultGameConfig(game);
    if (!saved) return d;
    const elements: GameVisualConfig['elements'] = { ...d.elements };
    for (const key of Object.keys(saved.elements ?? {}) as ElementId[]) {
        elements[key] = { ...d.elements[key], ...saved.elements![key], font: { ...d.elements[key]?.font, ...saved.elements![key]?.font } } as ElementConfig;
    }
    return {
        ...d,
        ...saved,
        rotation: { ...d.rotation, ...saved.rotation },
        background: { ...d.background, ...saved.background },
        animation: { ...d.animation, ...saved.animation },
        position: { ...d.position, ...saved.position },
        accountQueues: { ...(saved.accountQueues ?? {}) },
        slides: { ...d.slides, ...saved.slides, views: saved.slides?.views?.length ? saved.slides.views : d.slides.views },
        promo: { ...d.promo, ...saved.promo },
        elements,
    };
}

export function formatTier(tier: string): string {
    if (!tier || tier === 'UNRANKED') return 'Unranked';
    return tier.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Catalogo de rangos por juego (modo manual y selectores) ────────────────
// tier en MAYUSCULAS como lo guarda el backend; divisions vacio = sin division.

export interface RankCatalogEntry { tier: string; label: string; divisions: string[]; }

const IV_I = ['IV', 'III', 'II', 'I'];
const III_I = ['III', 'II', 'I'];

export const RANK_CATALOG: Record<GameId, RankCatalogEntry[]> = {
    lol: [
        ...['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND'].map(t => ({ tier: t, label: formatTier(t), divisions: IV_I })),
        { tier: 'MASTER', label: 'Master', divisions: [] }, { tier: 'GRANDMASTER', label: 'Grandmaster', divisions: [] }, { tier: 'CHALLENGER', label: 'Challenger', divisions: [] },
    ],
    tft: [
        ...['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND'].map(t => ({ tier: t, label: formatTier(t), divisions: IV_I })),
        { tier: 'MASTER', label: 'Master', divisions: [] }, { tier: 'GRANDMASTER', label: 'Grandmaster', divisions: [] }, { tier: 'CHALLENGER', label: 'Challenger', divisions: [] },
    ],
    valorant: [
        ...['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'ASCENDANT', 'IMMORTAL'].map(t => ({ tier: t, label: formatTier(t), divisions: ['1', '2', '3'] })),
        { tier: 'RADIANT', label: 'Radiant', divisions: [] },
    ],
    marvel_rivals: [
        ...['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'GRANDMASTER', 'CELESTIAL'].map(t => ({ tier: t, label: formatTier(t), divisions: III_I })),
        { tier: 'ETERNITY', label: 'Eternity', divisions: [] }, { tier: 'ONE_ABOVE_ALL', label: 'One Above All', divisions: [] },
    ],
    cs2: [
        ...Array.from({ length: 10 }, (_, i) => ({ tier: `LEVEL_${i + 1}`, label: `FACEIT nivel ${i + 1}`, divisions: [] })),
        { tier: 'PREMIER', label: 'Premier (puntos)', divisions: [] },
    ],
    fortnite: [
        ...['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'].map(t => ({ tier: t, label: formatTier(t), divisions: ['I', 'II', 'III'] })),
        { tier: 'ELITE', label: 'Elite', divisions: [] }, { tier: 'CHAMPION', label: 'Champion', divisions: [] }, { tier: 'UNREAL', label: 'Unreal', divisions: [] },
    ],
    rocket_league: [
        ...['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'CHAMPION', 'GRAND_CHAMPION'].map(t => ({ tier: t, label: formatTier(t), divisions: ['I', 'II', 'III'] })),
        { tier: 'SUPERSONIC_LEGEND', label: 'Supersonic Legend', divisions: [] },
    ],
    warzone: [
        ...['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'CRIMSON', 'IRIDESCENT'].map(t => ({ tier: t, label: formatTier(t), divisions: ['I', 'II', 'III'] })),
        { tier: 'TOP_250', label: 'Top 250', divisions: [] },
    ],
};

export const LAYOUT_LABELS: Record<LayoutPreset, string> = {
    card: 'Tarjeta', compact: 'Compacto', bar: 'Barra', 'emblem-only': 'Solo emblema',
};

export const ELEMENT_LABELS: Record<ElementId, string> = {
    emblem: 'Emblema de rango', rank: 'Rango', lp: 'Puntos (LP/RR/ELO)', session: 'Sesión (W-L y delta)',
    recent: 'Últimas partidas', accountName: 'Nombre de cuenta', gameLogo: 'Nombre del juego', liveCharacter: 'En partida',
    winrate: 'Winrate', kdaCs: 'KDA / CS por minuto', streak: 'Racha', topChamps: 'Top campeones', mastery: 'Maestría', lpGraph: 'Gráfico de LP',
    champSelect: 'Selección de campeón (Desktop)', postGame: 'Fin de partida (Desktop)',
};

/** Elementos que solo se alimentan del cliente de LoL vía Decatron Desktop. */
export const LIVE_ELEMENTS: ElementId[] = ['champSelect', 'postGame'];

/** Elementos que solo tienen sentido si el proveedor da esos datos (hoy: LoL). */
export const STATS_ELEMENTS: ElementId[] = ['winrate', 'kdaCs', 'streak', 'topChamps', 'mastery', 'lpGraph'];
export const GAMES_WITH_STATS: GameId[] = ['lol'];

export const ROLE_LABELS: Record<string, string> = { TOP: 'Top', JUNGLE: 'Jungla', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Support' };

export const QUEUE_LABELS: Record<string, string> = { solo: 'SoloQ', flex: 'Flex' };
