import { DEFAULT_PALETTE } from '../../../components/wheel/visualConfig';

export type PrizeType =
    | 'nothing'
    | 'coins'
    | 'free_spin'
    | 'gacha_pull'
    | 'timer_time'
    | 'timeout'
    | 'sound_alert'
    | 'manual_message';

export interface Prize {
    type: PrizeType;
    params: Record<string, unknown>;
}

export interface Segment {
    id: number;
    label: string;
    weight: number;
    color: string | null;
    icon: string | null;
    prize: Prize;
    isEnabled: boolean;
    effectivePercentage?: number;

    // Stock (Fase 7). null = ilimitado.
    stockTotal: number | null;
    stockPerViewer: number | null;
    stockWindow: string;
    /** Solo lectura: lo que queda de la ventana en curso. */
    stockRemaining?: number | null;
}

export interface WheelSummary {
    id: number;
    name: string;
    mode: string;
    slug: string;
    isEnabled: boolean;

    // Economía y disparadores (Fase 2). Solo vienen en el detalle.
    creditLabel?: string;
    spinPrice?: number;
    isAccumulable?: boolean;
    overflowPolicy?: string;
    multiFitPolicy?: string;
    creditExpiry?: string;
    spinCommand?: string;
    balanceCommand?: string;
    buyCommand?: string;
    commandEnabled?: boolean;
    autoSpin?: boolean;
    spinCooldownSeconds?: number;
    maxSpinsPerStream?: number | null;
    maxCoinsPerHour?: number | null;

    // Reglas de giro (Fase 7).
    noRepeatScope?: string;
    pityEnabled?: boolean;
    pityThreshold?: number | null;
    allowMultiSpin?: boolean;
    maxMultiSpin?: number;
}

export interface Source {
    id: number;
    source: string;
    channelPointsRewardTitle?: string | null;
    isEnabled: boolean;
    rateNumerator: number;
    rateDenominator: number;
    capPerEvent: number | null;
    /** Solo tienen efecto en gift_sub: es la unica fuente por la que llega el tier. */
    tier2Multiplier: number;
    tier3Multiplier: number;
    channelPointsRewardId: string | null;
}

export type Tab = 'segments' | 'credits' | 'limits' | 'messages' | 'test' | 'deliveries'
    | 'raffle' | 'look' | 'canvas' | 'media' | 'history' | 'wallets';

/** Una fila del historial. `label` es null si el gajo se borro despues del giro. */
export interface Spin {
    id: number;
    createdAt: string;
    mode: string;
    viewer: string | null;
    trigger: string;
    creditsSpent: number;
    segmentId: number | null;
    label: string | null;
    prize: { type?: string; params?: Record<string, unknown> } | null;
    deliveryStatus: string;
    raffleWinner: unknown;
}

export interface SpinFilters {
    from: string;
    to: string;
    viewer: string;
    trigger: string;
    status: string;
}

export const SPIN_FILTERS_VACIOS: SpinFilters = { from: '', to: '', viewer: '', trigger: 'all', status: 'all' };

export interface Metrics {
    totals: {
        spins: number; spinsLast7: number; spinsLast30: number;
        pendingDeliveries: number; creditsSpent: number; coinsPaid: number;
    };
    byTrigger: { trigger: string; spins: number }[];
    distribution: {
        segmentId: number; label: string; color: string | null;
        spins: number; configuredPct: number; realPct: number;
    }[];
    luckiest: { viewer: string; spins: number; credits: number }[];
}

export interface ViewerWallet {
    viewer: string;
    credits: number;
    lifetimeCredits: number;
    spinsThisStream: number;
    lastActivityAt: string;
    lastSpinAt: string | null;
}

/// Config del modo Sorteo. Vive en su propia tabla porque son reglas del sorteo,
/// no aspecto, y una rueda de Premios no tiene ninguno de estos campos.
export interface RaffleConfig {
    entryCommand: string;
    windowMode: 'manual' | 'timed' | 'always_open';
    windowSeconds: number | null;
    entryCostCredits: number;
    maxEntriesPerViewer: number;
    weightSources: Record<string, any>;
    requirements: Record<string, any>;
    winnersCount: number;
    drawMode: 'single' | 'multi' | 'remove_and_continue';
    removeWinnerFromPool: boolean;
    clearOnStreamEnd: boolean;
    isOpen: boolean;
    windowClosesAt: string | null;
    acceptingEntries: boolean;
}

export interface RaffleEntry {
    id: number;
    viewer: string;
    entries: number;
    weight: number;
    breakdown: Record<string, any> | null;
    hasWon: boolean;
    wonAt: string | null;
    joinedAt: string;
}

/// Una alerta de sonido del canal, para elegirla como premio.
export interface SoundAlertOption {
    id: number;
    title: string;
    enabled: boolean;
}

/// Un premio que el bot no pudo entregar y espera al streamer.
export interface Delivery {
    id: number;
    wheelId: number;
    wheelName: string;
    spinId: number;
    viewer: string;
    prize: Prize | null;
    status: string;
    reason: string | null;
    notes: string | null;
    resolvedAt: string | null;
    createdAt: string;
}

export interface MessagePack {
    messages: Record<string, { es: string | null; en: string | null }>;
    defaults: Record<string, { es: string; en: string }>;
    placeholders: Record<string, string[]>;
}

export interface ChannelReward {
    id: string;
    title: string;
    cost: number;
}

export interface SimResult {
    viewer: string;
    balanceBefore: number;
    balanceAfter: number;
    credited: boolean;
    creditsAdded: number;
    spinsOwed: number;
    spun: boolean;
    spinLabel: string | null;
}

export const emptySegment = (index: number): Segment => ({
    id: 0,
    label: '',
    weight: 1,
    color: DEFAULT_PALETTE[index % DEFAULT_PALETTE.length],
    icon: null,
    prize: { type: 'nothing', params: {} },
    isEnabled: true,
    stockTotal: null,
    stockPerViewer: null,
    stockWindow: 'ever',
});

export function normalizeSegment(s: any): Segment {
    return {
        id: s.id ?? 0,
        label: s.label ?? '',
        weight: Number(s.weight ?? 1),
        color: s.color ?? null,
        icon: s.icon ?? null,
        prize: s.prize && typeof s.prize === 'object' ? s.prize : { type: 'nothing', params: {} },
        isEnabled: s.isEnabled ?? true,
        effectivePercentage: s.effectivePercentage,
        stockTotal: s.stockTotal ?? null,
        stockPerViewer: s.stockPerViewer ?? null,
        stockWindow: s.stockWindow ?? 'ever',
        stockRemaining: s.stockRemaining ?? null,
    };
}
