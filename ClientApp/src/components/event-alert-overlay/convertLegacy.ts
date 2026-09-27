import type {
    AlertDesign, AlertEventType, CardElement, ElementAnimation, EventAlertsDesign, HypeTrainDesign, HypeTrainLevelKey,
    LegacyAlertStyle, LegacyElementBox, LegacyOverlayElements, MediaElement, TextElement, TextLine,
} from './types';
import {
    BACKEND_STYLE_DEFAULTS, DEFAULT_CANVAS, DEFAULT_OVERLAY_ELEMENTS, DESIGN_VERSION, EVENT_TYPES, OVERLAY_STYLE_DEFAULTS,
    PARTIAL_ELEMENT_FALLBACKS, eventAnimation, noAnimation, step,
} from './defaults';

// Configs guardadas antes del rediseño: se convierten al leer y se ven igual que en el overlay viejo
// (EventAlertsOverlay.tsx hasta 2026-09). El viejo dibujaba con global.overlayElements (una posición para todos
// los eventos) y el estilo que armaba el backend (global.defaultStyle + el `style` del evento, nivel o variante).
// global.perEventOverlay no se usa para dibujar: el viejo nunca lo mostró.

const HYPE_LEVELS: HypeTrainLevelKey[] = ['1', '2', '3', '4', '5', 'completed'];

const isObj = (v: any): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: any): v is number => typeof v === 'number' && Number.isFinite(v);

/** Mismo mezclado que ExtractStyleConfig del backend: cada campo presente y del tipo correcto pisa al anterior. */
export function mergeLegacyStyle(base: LegacyAlertStyle, patch: any): LegacyAlertStyle {
    if (!isObj(patch)) return base;
    const s: any = { ...base, backgroundGradient: { ...base.backgroundGradient } };
    for (const k of ['backgroundType', 'backgroundColor', 'backgroundImage', 'borderColor', 'mediaLayout', 'mediaObjectFit', 'fontFamily', 'fontWeight', 'textColor', 'textShadow', 'textAlign']) {
        if (typeof patch[k] === 'string') s[k] = patch[k];
    }
    for (const k of ['opacity', 'borderWidth', 'borderRadius', 'padding', 'width', 'height', 'fontSize']) {
        if (num(patch[k])) s[k] = patch[k];
    }
    if (typeof patch.borderEnabled === 'boolean') s.borderEnabled = patch.borderEnabled;
    const g = patch.backgroundGradient;
    if (isObj(g)) {
        if (typeof g.color1 === 'string') s.backgroundGradient.color1 = g.color1;
        if (typeof g.color2 === 'string') s.backgroundGradient.color2 = g.color2;
        if (num(g.angle)) s.backgroundGradient.angle = g.angle;
    }
    return s;
}

/** Mismo criterio que ExtractOverlayElements del backend (con sus valores de respaldo por campo). */
export function readLegacyElements(raw: any): LegacyOverlayElements {
    if (!isObj(raw)) return structuredClone(DEFAULT_OVERLAY_ELEMENTS);
    const read = (key: keyof LegacyOverlayElements): LegacyElementBox => {
        const e = raw[key];
        if (!isObj(e)) return { ...DEFAULT_OVERLAY_ELEMENTS[key] };
        const f = PARTIAL_ELEMENT_FALLBACKS[key];
        return {
            x: num(e.x) ? e.x : f.x,
            y: num(e.y) ? e.y : f.y,
            width: num(e.width) ? e.width : f.width,
            height: num(e.height) ? e.height : f.height,
            enabled: typeof e.enabled === 'boolean' ? e.enabled : true,
        };
    };
    return { card: read('card'), media: read('media'), text: read('text') };
}

const rect = (b: LegacyElementBox) => ({ x: b.x, y: b.y, width: b.width, height: b.height });

/** La sombra de la tarjeta del viejo: solo si el fondo no es transparente. */
const cardShadow = (type: string) => (type !== 'transparent' ? '0 8px 32px rgba(0,0,0,0.5)' : '');

/** El diseño que dibuja lo mismo que el overlay viejo con ese estilo y esas posiciones. */
export function designFromLegacy(style: LegacyAlertStyle, elements: LegacyOverlayElements, canvas = DEFAULT_CANVAS): AlertDesign {
    return {
        canvas: { ...canvas },
        card: {
            ...rect(elements.card),
            enabled: elements.card.enabled,
            background: {
                type: style.backgroundType,
                color: style.backgroundColor,
                gradient: { ...style.backgroundGradient },
                image: style.backgroundImage,
            },
            opacity: style.opacity,
            border: { enabled: style.borderEnabled, color: style.borderColor, width: style.borderWidth },
            radius: style.borderRadius,
            shadow: cardShadow(style.backgroundType),
            animation: eventAnimation(),
        },
        media: {
            ...rect(elements.media),
            enabled: elements.media.enabled,
            fit: style.mediaObjectFit,
            opacity: 100,
            radius: 8,
            animation: eventAnimation(),
        },
        texts: [{
            id: 'main',
            ...rect(elements.text),
            enabled: elements.text.enabled,
            lines: [
                { template: '{emoji} {title}', fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: 1.3, opacity: 100, marginTop: 0 },
                // El mensaje iba entre comillas, más chico y sin grosor propio
                { template: '"{message}"', fontSize: Math.max(style.fontSize - 4, 12), lineHeight: 1.4, opacity: 85, marginTop: 8, requires: 'message' },
            ],
            fontFamily: style.fontFamily,
            color: style.textColor,
            align: style.textAlign,
            verticalAlign: 'center',
            shadow: style.textShadow,
            background: 'transparent',
            padding: style.padding,
            radius: 0,
            animation: eventAnimation(),
        }],
        animation: noAnimation(),
        followAlertStyle: true,
    };
}

/** El estilo viejo que representa un diseño convertido (lo que no se dibuja sale de los de fábrica). */
function legacyStyleOf(d: AlertDesign): LegacyAlertStyle {
    const main = d.texts.find(t => t.id === 'main') ?? d.texts[0];
    const title = main?.lines[0];
    return {
        ...OVERLAY_STYLE_DEFAULTS,
        backgroundType: d.card.background.type,
        backgroundColor: d.card.background.color,
        backgroundGradient: { ...d.card.background.gradient },
        backgroundImage: d.card.background.image,
        opacity: d.card.opacity,
        borderEnabled: d.card.border.enabled,
        borderColor: d.card.border.color,
        borderWidth: d.card.border.width,
        borderRadius: d.card.radius,
        padding: main?.padding ?? OVERLAY_STYLE_DEFAULTS.padding,
        mediaObjectFit: d.media.fit === 'fill' ? 'contain' : d.media.fit,
        fontFamily: main?.fontFamily ?? OVERLAY_STYLE_DEFAULTS.fontFamily,
        fontSize: title?.fontSize ?? OVERLAY_STYLE_DEFAULTS.fontSize,
        fontWeight: title?.fontWeight ?? OVERLAY_STYLE_DEFAULTS.fontWeight,
        textColor: main?.color ?? OVERLAY_STYLE_DEFAULTS.textColor,
        textShadow: main?.shadow ?? OVERLAY_STYLE_DEFAULTS.textShadow,
        textAlign: main?.align ?? OVERLAY_STYLE_DEFAULTS.textAlign,
    };
}

function legacyElementsOf(d: AlertDesign): LegacyOverlayElements {
    const main = d.texts.find(t => t.id === 'main') ?? d.texts[0];
    const box = (e: { x: number; y: number; width: number; height: number; enabled: boolean }) => ({ x: e.x, y: e.y, width: e.width, height: e.height, enabled: e.enabled });
    return { card: box(d.card), media: box(d.media), text: main ? box(main) : { ...DEFAULT_OVERLAY_ELEMENTS.text, enabled: false } };
}

/** Config vieja (EventAlertsConfig) → formato nuevo. Todos los eventos usan el general, como en el viejo. */
export function convertLegacyEventAlerts(config: any): EventAlertsDesign {
    const g = isObj(config?.global) ? config.global : {};
    const style = mergeLegacyStyle(BACKEND_STYLE_DEFAULTS, g.defaultStyle);
    const canvas = {
        width: num(g.canvas?.width) ? g.canvas.width : DEFAULT_CANVAS.width,
        height: num(g.canvas?.height) ? g.canvas.height : DEFAULT_CANVAS.height,
    };
    return { version: DESIGN_VERSION, general: designFromLegacy(style, readLegacyElements(g.overlayElements), canvas), events: {} };
}

/** Diseño de una alerta que llega sin config (solo con lo que trae la alerta): lo que hacía el viejo. */
export function designFromAlert(style?: Partial<LegacyAlertStyle>, overlayElements?: LegacyOverlayElements): AlertDesign {
    return designFromLegacy({ ...OVERLAY_STYLE_DEFAULTS, ...(style ?? {}) } as LegacyAlertStyle, overlayElements ?? DEFAULT_OVERLAY_ELEMENTS);
}

// ---------------------------------------------------------------------------
// Diseños nuevos (version: 2): se completan con lo que falte
// ---------------------------------------------------------------------------

function completeAnimation(raw: any, d: ElementAnimation): ElementAnimation {
    return { enter: step({ ...d.enter, ...(isObj(raw?.enter) ? raw.enter : {}) }), exit: step({ ...d.exit, ...(isObj(raw?.exit) ? raw.exit : {}) }) };
}

const TEXT_DEFAULTS: Omit<TextElement, 'id'> = {
    x: 0, y: 0, width: 400, height: 80, enabled: true, lines: [],
    fontFamily: 'Inter, sans-serif', color: '#ffffff', align: 'center', verticalAlign: 'center', shadow: 'normal',
    background: 'transparent', padding: 0, radius: 0, animation: eventAnimation(),
};

function completeLine(raw: any): TextLine {
    return { template: '', fontSize: 24, lineHeight: 1.3, opacity: 100, marginTop: 0, ...(isObj(raw) ? raw : {}) };
}

function completeText(raw: any, i: number): TextElement {
    const t = isObj(raw) ? raw : {};
    return {
        ...TEXT_DEFAULTS,
        ...t,
        id: typeof t.id === 'string' && t.id ? t.id : `text-${i + 1}`,
        lines: Array.isArray(t.lines) ? t.lines.map(completeLine) : [],
        animation: completeAnimation(t.animation, TEXT_DEFAULTS.animation),
    };
}

/** Completa un diseño con los valores de `base` (el general, o el del hype train para sus niveles). */
function completeDesign(raw: any, base: AlertDesign): AlertDesign {
    if (!isObj(raw)) return structuredClone(base);
    const card: CardElement = {
        ...base.card,
        ...(isObj(raw.card) ? raw.card : {}),
        background: {
            ...base.card.background,
            ...(isObj(raw.card?.background) ? raw.card.background : {}),
            gradient: { ...base.card.background.gradient, ...(isObj(raw.card?.background?.gradient) ? raw.card.background.gradient : {}) },
        },
        border: { ...base.card.border, ...(isObj(raw.card?.border) ? raw.card.border : {}) },
        animation: completeAnimation(raw.card?.animation, base.card.animation),
    };
    const media: MediaElement = {
        ...base.media,
        ...(isObj(raw.media) ? raw.media : {}),
        animation: completeAnimation(raw.media?.animation, base.media.animation),
    };
    return {
        canvas: { ...base.canvas, ...(isObj(raw.canvas) ? raw.canvas : {}) },
        card,
        media,
        texts: Array.isArray(raw.texts) ? raw.texts.map(completeText) : structuredClone(base.texts),
        animation: completeAnimation(raw.animation, base.animation),
        followAlertStyle: typeof raw.followAlertStyle === 'boolean' ? raw.followAlertStyle : false,
    };
}

/** Diseño de fábrica para una config nueva: el mismo aspecto que los valores de fábrica del dashboard. */
export function defaultAlertDesign(): AlertDesign {
    return { ...designFromLegacy(OVERLAY_STYLE_DEFAULTS, DEFAULT_OVERLAY_ELEMENTS), followAlertStyle: false };
}

/** Lo guardado (viejo o nuevo) → el formato del renderer, completando lo que falte. */
export function normalizeEventAlertsDesign(config: any): EventAlertsDesign {
    const raw = config?.design;
    if (raw?.version !== DESIGN_VERSION || !isObj(raw.general)) return convertLegacyEventAlerts(config ?? {});

    const general = completeDesign(raw.general, defaultAlertDesign());
    const events: EventAlertsDesign['events'] = {};
    for (const type of EVENT_TYPES) {
        const ev = raw.events?.[type];
        if (!isObj(ev)) continue;
        if (type !== 'hypeTrain') {
            events[type] = completeDesign(ev, general);
            continue;
        }
        const train: HypeTrainDesign = completeDesign(ev, general);
        if (isObj(ev.levels)) {
            train.levels = {};
            for (const key of HYPE_LEVELS) {
                if (isObj(ev.levels[key])) train.levels[key] = completeDesign(ev.levels[key], train);
            }
        }
        events.hypeTrain = train;
    }
    return { version: DESIGN_VERSION, general, events };
}

/**
 * El diseño de una alerta concreta: el del evento (o el del nivel del hype train) o, si no tiene, el general.
 * En las configs viejas (followAlertStyle) encima va el `style` y las posiciones que llegan con la alerta.
 */
export function resolveAlertDesign(
    design: EventAlertsDesign,
    alert: { eventType: AlertEventType; level?: number; hypeTrainCompleted?: boolean },
    style?: Partial<LegacyAlertStyle>,
    overlayElements?: LegacyOverlayElements,
): AlertDesign {
    let d: AlertDesign = design.events[alert.eventType] ?? design.general;
    if (alert.eventType === 'hypeTrain' && design.events.hypeTrain?.levels) {
        const key = (alert.hypeTrainCompleted ? 'completed' : String(alert.level ?? 1)) as HypeTrainLevelKey;
        d = design.events.hypeTrain.levels[key] ?? d;
    }
    if (!d.followAlertStyle || (!style && !overlayElements)) return d;
    const merged = mergeLegacyStyle(legacyStyleOf(d), style);
    const out = designFromLegacy(merged, overlayElements ?? legacyElementsOf(d), d.canvas);
    // Lo que el estilo viejo no toca se conserva (textos agregados, animación de la alerta)
    return { ...out, texts: [...out.texts, ...d.texts.filter(t => t.id !== 'main')], animation: d.animation };
}

/**
 * El `style` propio del evento, nivel o variante (el parcial, sin el global) sobre un diseño nuevo: fondo, opacidad,
 * borde y esquinas de la tarjeta, ajuste de la media, y fuente, color y sombra de los textos. Los diseños que
 * siguen el estilo de la alerta (configs viejas) ya lo traen aplicado.
 */
export function applyPartialStyle(d: AlertDesign, partial?: Partial<LegacyAlertStyle> | null): AlertDesign {
    if (d.followAlertStyle || !isObj(partial)) return d;
    const p = partial as Partial<LegacyAlertStyle>;
    const bg = { ...d.card.background, gradient: { ...d.card.background.gradient } };
    if (p.backgroundType) bg.type = p.backgroundType;
    if (typeof p.backgroundColor === 'string') bg.color = p.backgroundColor;
    if (isObj(p.backgroundGradient)) bg.gradient = { ...bg.gradient, ...p.backgroundGradient };
    if (typeof p.backgroundImage === 'string') bg.image = p.backgroundImage;
    return {
        ...d,
        card: {
            ...d.card,
            background: bg,
            opacity: num(p.opacity) ? p.opacity! : d.card.opacity,
            radius: num(p.borderRadius) ? p.borderRadius! : d.card.radius,
            border: {
                enabled: typeof p.borderEnabled === 'boolean' ? p.borderEnabled : d.card.border.enabled,
                color: typeof p.borderColor === 'string' ? p.borderColor : d.card.border.color,
                width: num(p.borderWidth) ? p.borderWidth! : d.card.border.width,
            },
        },
        media: p.mediaObjectFit ? { ...d.media, fit: p.mediaObjectFit } : d.media,
        texts: d.texts.map(t => ({
            ...t,
            fontFamily: typeof p.fontFamily === 'string' && p.fontFamily ? p.fontFamily : t.fontFamily,
            color: typeof p.textColor === 'string' && p.textColor ? p.textColor : t.color,
            shadow: p.textShadow ?? t.shadow,
        })),
    };
}

/** Cuánto dura la salida más larga del diseño (la alerta entera y cada elemento), para esperar antes de sacarla. */
export function exitDurationMs(d: AlertDesign): number {
    const steps = [d.animation.exit, d.card.animation.exit, d.media.animation.exit, ...d.texts.map(t => t.animation.exit)];
    return Math.max(0, ...steps.filter(s => s.type !== 'none').map(s => s.durationMs + (s.delayMs || 0)));
}
