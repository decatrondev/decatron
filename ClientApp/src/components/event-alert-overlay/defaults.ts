import type { AlertEventType, AnimationStep, ElementAnimation, EventAlertData, LegacyAlertStyle, LegacyOverlayElements } from './types';

export const DESIGN_VERSION = 2 as const;

export const EVENT_TYPES: AlertEventType[] = ['follow', 'bits', 'subs', 'giftSubs', 'raids', 'resubs', 'hypeTrain'];

/** Variables de las plantillas de texto (se aceptan también los alias del backend: {userName}, {user}, {bits}…). */
export const TEXT_VARIABLES = ['username', 'amount', 'tier', 'months', 'viewers', 'level', 'message', 'emoji', 'title'] as const;

/** Emoji de cada evento (el que iba delante del título en el overlay viejo). */
export const EVENT_EMOJIS: Record<AlertEventType, string> = {
    follow: '❤️',
    bits: '💎',
    subs: '⭐',
    giftSubs: '🎁',
    raids: '🚀',
    resubs: '🎉',
    hypeTrain: '🔥',
};

/** Lo que pone el backend (ExtractStyleConfig) en lo que global.defaultStyle y el evento no traen. */
export const BACKEND_STYLE_DEFAULTS: LegacyAlertStyle = {
    width: 400,
    height: 300,
    backgroundType: 'color',
    backgroundColor: 'rgba(0,0,0,0.85)',
    backgroundGradient: { color1: '#1a1a2e', color2: '#16213e', angle: 135 },
    backgroundImage: '',
    opacity: 100,
    borderEnabled: true,
    borderColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderRadius: 16,
    padding: 24,
    mediaLayout: 'top',
    mediaObjectFit: 'contain',
    fontFamily: 'Inter, sans-serif',
    fontSize: 18,
    fontWeight: 'bold',
    textColor: '#ffffff',
    textShadow: 'normal',
    textAlign: 'center',
};

/** Lo que completaba el overlay viejo si la alerta llegaba sin estilo (y los valores de fábrica del dashboard). */
export const OVERLAY_STYLE_DEFAULTS: LegacyAlertStyle = {
    ...BACKEND_STYLE_DEFAULTS,
    width: 600,
    height: 500,
    borderRadius: 24,
    padding: 30,
    fontSize: 26,
};

/** Posiciones de fábrica (backend y overlay): tarjeta 600×500 centrada en 1920×1080. */
export const DEFAULT_OVERLAY_ELEMENTS: LegacyOverlayElements = {
    card: { x: 660, y: 290, width: 600, height: 500, enabled: true },
    media: { x: 690, y: 320, width: 540, height: 220, enabled: true },
    text: { x: 690, y: 560, width: 540, height: 200, enabled: true },
};

/** Lo que pone el backend (ExtractOverlayElements) si el elemento existe pero le falta un campo. */
export const PARTIAL_ELEMENT_FALLBACKS: LegacyOverlayElements = {
    card: { x: 760, y: 390, width: 400, height: 300, enabled: true },
    media: { x: 780, y: 410, width: 360, height: 120, enabled: true },
    text: { x: 780, y: 550, width: 360, height: 120, enabled: true },
};

export const DEFAULT_CANVAS = { width: 1920, height: 1080 };

export function step(patch: Partial<AnimationStep> = {}): AnimationStep {
    return { type: 'none', direction: 'left', durationMs: 600, easing: 'ease-out', delayMs: 0, ...patch };
}

/** La de cada elemento en el viejo: la del evento, 0,6 s ease-out; slide entra por la izquierda y sale por la derecha. */
export function eventAnimation(): ElementAnimation {
    return { enter: step({ type: 'event', direction: 'left' }), exit: step({ type: 'event', direction: 'right' }) };
}

export function noAnimation(): ElementAnimation {
    return { enter: step(), exit: step({ direction: 'right' }) };
}

/** Datos de ejemplo por evento para la vista previa y el editor. */
export const SAMPLE_ALERTS: Record<AlertEventType, EventAlertData> = {
    follow: { eventType: 'follow', username: 'SeguidorNuevo', amount: 0, message: '¡Gracias SeguidorNuevo por el follow! ❤️' },
    bits: { eventType: 'bits', username: 'FanDeBits', amount: 500, message: '¡Gracias FanDeBits por los 500 bits! 💎' },
    subs: { eventType: 'subs', username: 'NuevoSub', amount: 1, tier: 'Tier 1', months: 1, message: '¡Gracias NuevoSub por la sub! ⭐' },
    giftSubs: { eventType: 'giftSubs', username: 'Generoso', amount: 5, tier: 'Tier 1', message: '¡Generoso regaló 5 subs! 🎁' },
    raids: { eventType: 'raids', username: 'CanalAmigo', amount: 42, viewers: 42, message: '¡CanalAmigo raideó con 42 viewers! 🚀' },
    resubs: { eventType: 'resubs', username: 'Veterano', amount: 12, months: 12, tier: 'Tier 1', message: '¡Veterano resub - 12 meses! 🎉' },
    hypeTrain: { eventType: 'hypeTrain', username: '', amount: 2, level: 2, message: '🔥 ¡Hype Train nivel 2! 🔥' },
};
