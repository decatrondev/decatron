/**
 * Overlay de OBS del giveaway (F3c): tipos de la foto que manda el servidor y la apariencia editable.
 * El servidor decide fase, ganador y tiempos; el navegador solo dibuja. Los valores por defecto son los mismos que
 * GiveawayOverlayRules.cs (Decatron.Core/Models/GiveawaySettings.cs): si cambias uno, cambia el otro.
 */

import { DEFAULT_THEME, fadeShowHide, FONT_FAMILIES } from '../../../../components/music-overlay/defaults';
import type { OverlayTheme, ShowHideAnimation, TextShadow } from '../../../../components/music-overlay/types';

export { FONT_FAMILIES };
export type { OverlayTheme, ShowHideAnimation, TextShadow };

export const OVERLAY_CANVAS = { width: 1920, height: 1080 };

export interface OverlayBlock { enabled: boolean; x: number; y: number; width: number; height: number }

export interface OverlayAppearance {
    revealSeconds: number;
    resultSeconds: number;
    /** Panel de los bloques: el mismo tema que Song Request (por defecto el de Decatron). */
    theme: OverlayTheme;
    font: string;
    textColor: string;
    secondaryColor: string;
    textShadow: TextShadow;
    enter: ShowHideAnimation;
    exit: ShowHideAnimation;
    confetti: boolean;
    tickSound: boolean;
    fanfareSound: boolean;
    volume: number;
    card: OverlayBlock;
    entries: OverlayBlock;
    reveal: OverlayBlock;
    winners: OverlayBlock;
}

export type OverlayBlockId = 'card' | 'entries' | 'reveal' | 'winners';

export const DEFAULT_APPEARANCE: OverlayAppearance = {
    revealSeconds: 8,
    resultSeconds: 15,
    theme: { ...DEFAULT_THEME },
    font: 'Inter',
    textColor: '#ffffff',
    secondaryColor: '#a1a1aa',
    textShadow: 'soft',
    enter: fadeShowHide(600),
    exit: fadeShowHide(600),
    confetti: true,
    tickSound: true,
    fanfareSound: true,
    volume: 60,
    card: { enabled: true, x: 60, y: 60, width: 640, height: 360 },
    entries: { enabled: true, x: 60, y: 460, width: 640, height: 420 },
    reveal: { enabled: true, x: 460, y: 240, width: 1000, height: 500 },
    winners: { enabled: true, x: 460, y: 780, width: 1000, height: 220 },
};

/** Mezcla lo que llegó (puede venir incompleto) con los valores por defecto, bloque por bloque. */
export function mergeAppearance(loaded?: Partial<OverlayAppearance> | null): OverlayAppearance {
    const d = DEFAULT_APPEARANCE;
    const l = loaded ?? {};
    return {
        ...d, ...l,
        theme: { ...d.theme, ...(l.theme ?? {}) },
        enter: { ...d.enter, ...(l.enter ?? {}) },
        exit: { ...d.exit, ...(l.exit ?? {}) },
        card: { ...d.card, ...(l.card ?? {}) },
        entries: { ...d.entries, ...(l.entries ?? {}) },
        reveal: { ...d.reveal, ...(l.reveal ?? {}) },
        winners: { ...d.winners, ...(l.winners ?? {}) },
    };
}

export type OverlayPhase = 'idle' | 'open' | 'drawing' | 'winner' | 'result' | 'cancelled';

export interface OverlayEntry { displayName: string; platform: string; enteredAt: string }
export interface OverlayWinner { position: number; displayName: string; platform: string; state: 'pending' | 'responded' | 'timeout'; deadline: string | null; wasBackup: boolean }

/** La foto que emite el servidor (GiveawayOverlayService.Snapshot, en camelCase). */
export interface OverlaySnapshot {
    phase: OverlayPhase;
    sessionId: number | null;
    prize: string | null;
    command: string | null;
    allowAutoEntry: boolean;
    twitch: boolean;
    kick: boolean;
    participantCount: number;
    endsAt: string | null;
    drawnAt: string | null;
    revealSeconds: number;
    resultSeconds: number;
    responseTimeoutSeconds: number;
    recent: OverlayEntry[];
    candidates: string[];
    winners: OverlayWinner[];
    serverNow: string;
    appearance: OverlayAppearance;
    simulated?: boolean;
}

export const PLATFORM_STYLE: Record<string, { label: string; color: string; letter: string }> = {
    twitch: { label: 'Twitch', color: '#9146ff', letter: 'T' },
    kick: { label: 'Kick', color: '#53fc18', letter: 'K' },
};

/** Fotos de ejemplo para el editor (mismos datos en cada fase) */
export function demoSnapshot(phase: OverlayPhase, appearance: OverlayAppearance, withKick: boolean): OverlaySnapshot {
    const now = Date.now();
    const names = ['Camila', 'Mateo', 'Valentina', 'Santiago', 'Lucía', 'Diego', 'Sofía', 'Andrés', 'Mariana', 'Javier'];
    const recent = names.map((n, i) => ({ displayName: n, platform: withKick && i % 3 === 2 ? 'kick' : 'twitch', enteredAt: new Date(now - i * 4000).toISOString() }));
    const winner: OverlayWinner = { position: 1, displayName: 'Valentina', platform: 'twitch', state: 'pending', deadline: new Date(now + 42000).toISOString(), wasBackup: false };
    return {
        phase, sessionId: 0, prize: 'Premio de ejemplo', command: '!join', allowAutoEntry: false, twitch: true, kick: withKick,
        participantCount: 128, endsAt: new Date(now + 95000).toISOString(),
        drawnAt: new Date(now).toISOString(), revealSeconds: appearance.revealSeconds, resultSeconds: appearance.resultSeconds,
        responseTimeoutSeconds: 60, recent, candidates: names,
        winners: phase === 'idle' || phase === 'open' || phase === 'cancelled' ? [] : [phase === 'result' ? { ...winner, state: 'responded', deadline: null } : winner],
        serverNow: new Date(now).toISOString(), appearance, simulated: true,
    };
}
