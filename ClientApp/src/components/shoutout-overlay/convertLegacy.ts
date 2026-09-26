import type { AnimationType, ShoutoutElement, ShoutoutLayout, ShowHideAnimation, TextLine } from './types';
import { KIND_OPTIONS, LAYOUT_VERSION, LEGACY, element, emptyLayout, textBlock } from './defaults';

// Configs guardadas antes del rediseño: se convierten al leer, en el dashboard y en el overlay, y se ven
// igual que en el overlay viejo (ShoutoutOverlay.tsx hasta 2026-09). Al guardar desde la vista nueva
// quedan en el formato nuevo (layout con version: 2).

const SPEED_MS: Record<string, number> = { slow: 1000, normal: 500, fast: 300 };

/** El viejo: "sin animación" y "fundido" hacían lo mismo (fundido con escala 0.9). */
function legacyAnimations(type: string, speed: string): ShoutoutLayout['animations'] {
    const durationMs = SPEED_MS[speed] ?? 500;
    const base = { durationMs, easing: 'ease-in-out' as const };
    const same = (t: AnimationType): ShoutoutLayout['animations'] => ({
        enter: { ...base, type: t, direction: 'left' },
        exit: { ...base, type: t, direction: 'right' },
    });
    switch (type) {
        case 'slide': return same('slide'); // entra por la izquierda y sale por la derecha
        case 'bounce': return same('pop');
        case 'zoom': return same('zoom');
        case 'rotate': return same('rotate');
        default: return same('fade-scale');
    }
}

/** Ancho aproximado de un bloque de texto (solo para el recuadro del editor: el viejo no cortaba). */
function estimateWidth(lines: TextLine[]): number {
    const w = Math.max(40, ...lines.filter(l => l.enabled).map(l => [...l.text].length * l.fontSize * 0.58));
    // Par: el centro (x + ancho / 2) cae justo en el ancla del viejo
    return Math.round(w / 2) * 2;
}

function estimateHeight(lines: TextLine[], gap: number, lineHeight: number): number {
    const on = lines.filter(l => l.enabled);
    if (!on.length) return 40;
    return Math.round(on.reduce((s, l) => s + l.fontSize * lineHeight, 0) + gap * (on.length - 1));
}

/** Config vieja (la respuesta de /api/shoutout/config) → formato nuevo. Mismo mezclado con los de fábrica que hacía el overlay. */
export function convertLegacyShoutout(config: any): ShoutoutLayout {
    const styles = { ...LEGACY.styles, ...(config?.styles ?? {}) };
    const lay = { ...LEGACY.layout, ...(config?.layout ?? {}) };
    const lines: TextLine[] = (Array.isArray(config?.textLines) ? config.textLines : LEGACY.textLines).map((l: any) => ({
        text: String(l?.text ?? ''), fontSize: Number(l?.fontSize) || 24, fontWeight: String(l?.fontWeight ?? 'normal'), enabled: l?.enabled !== false,
    }));

    const borderEnabled = !!config?.containerBorderEnabled;
    const borderWidth = config?.containerBorderWidth || 3;
    // Los hijos se ubicaban dentro del borde de la caja
    const b = borderEnabled ? borderWidth : 0;
    const { width: W, height: H } = LEGACY;

    const layout = emptyLayout();
    layout.theme = {
        background: {
            type: ['gradient', 'solid', 'transparent'].includes(styles.backgroundType) ? styles.backgroundType : 'gradient',
            color1: styles.gradientColor1, color2: styles.gradientColor2, angle: Number(styles.gradientAngle) || 0,
            solid: styles.solidColor, opacity: Number(styles.backgroundOpacity ?? 100),
        },
        borderEnabled,
        borderColor: config?.containerBorderColor || '#ffffff',
        borderWidth,
        radius: 20,
        shadow: borderEnabled ? '0 8px 24px rgba(0, 0, 0, 0.4)' : '0 4px 16px rgba(0, 0, 0, 0.2)',
        blur: 0,
        accent: '#9146ff',
    };
    layout.animations = legacyAnimations(config?.animationType || 'none', config?.animationSpeed || 'normal');

    const text = textBlock({
        lines,
        fontFamily: styles.fontFamily || 'Inter',
        color: styles.textColor || '#ffffff',
        shadow: ['none', 'normal', 'strong', 'glow'].includes(styles.textShadow) ? styles.textShadow : 'normal',
        align: ['left', 'center', 'right'].includes(lay.text?.align) ? lay.text.align : 'center',
        gap: 12,
        lineHeight: 1.2,
        outline: { enabled: !!config?.textOutlineEnabled, width: config?.textOutlineWidth || 2, color: config?.textOutlineColor || '#000000' },
        anchor: true,
    });
    const tw = estimateWidth(lines);
    const tx = (Number(lay.text?.x) || 0) + b;
    const clip = lay.clip ?? LEGACY.layout.clip;
    const profile = lay.profile ?? LEGACY.layout.profile;
    const size = Number(profile.size) || 90;
    const ax = (Number(profile.x) || 0) + b, ay = (Number(profile.y) || 0) + b;
    const cx = (Number(clip.x) || 0) + b, cy = (Number(clip.y) || 0) + b;

    layout.elements = [
        element('panel', 'panel', { x: 0, y: 0, width: W, height: H }),
        element('clip', 'clip', { x: cx, y: cy, width: Number(clip.width) || 400, height: Number(clip.height) || 260 }),
        element('avatar', 'avatar', { x: ax, y: ay, width: size, height: size }),
        // El contador iba arriba a la derecha, a 10 px del borde, encima de todo
        element('timer', 'timer', { x: W - b - 10 - 160, y: 10 + b, width: 160, height: 46 }, { enabled: !!config?.showDebugTimer }),
        element('text', 'text', {
            x: text.align === 'center' ? tx - tw / 2 : tx,
            y: (Number(lay.text?.y) || 0) + b,
            width: tw,
            height: estimateHeight(lines, text.gap, text.lineHeight),
        }, { text }),
        // Nuevos: apagados, así la config vieja se ve igual
        element('badge', 'badge', { x: ax + size - 30, y: ay + size - 30, width: 30, height: 30 }, { enabled: false }),
        element('live', 'live', { x: cx + 12, y: cy + 12, width: 100, height: 30 }, { enabled: false }),
        element('progress', 'progress', { x: 20, y: H - 12, width: W - 40, height: 6 }, { enabled: false }),
    ];
    // El contador queda encima de todo, como antes (zIndex 9999)
    layout.elements.push(layout.elements.splice(layout.elements.findIndex(e => e.id === 'timer'), 1)[0]);
    return layout;
}

function mergeAnim(a: Partial<ShowHideAnimation> | undefined, d: ShowHideAnimation): ShowHideAnimation {
    return { ...d, ...(a ?? {}) };
}

/** Lo guardado (viejo o nuevo) → el formato del renderer, completando lo que falte. */
export function normalizeShoutoutLayout(config: any): ShoutoutLayout {
    const raw = config?.layout;
    const layout = raw?.version === LAYOUT_VERSION && Array.isArray(raw.elements)
        ? (() => {
            const d = emptyLayout();
            return {
                version: LAYOUT_VERSION,
                canvas: { ...d.canvas, ...(raw.canvas ?? {}) },
                theme: { ...d.theme, ...(raw.theme ?? {}), background: { ...d.theme.background, ...(raw.theme?.background ?? {}) } },
                elements: (raw.elements as ShoutoutElement[]).map(e => ({
                    ...e,
                    options: { ...(KIND_OPTIONS[e.kind] ?? {}), ...(e.options ?? {}) },
                    text: e.text ? textBlock({ ...e.text, outline: { ...textBlock().outline, ...(e.text.outline ?? {}) } }) : undefined,
                })),
                animations: { enter: mergeAnim(raw.animations?.enter, d.animations.enter), exit: mergeAnim(raw.animations?.exit, d.animations.exit) },
            } as ShoutoutLayout;
        })()
        : convertLegacyShoutout(config ?? {});
    // Diseños guardados antes de que existieran la insignia y "en vivo": se agregan apagados
    for (const kind of ['badge', 'live', 'progress'] as const) {
        if (layout.elements.some(e => e.kind === kind)) continue;
        const avatar = layout.elements.find(e => e.kind === 'avatar');
        const clip = layout.elements.find(e => e.kind === 'clip');
        const rect = kind === 'badge'
            ? { x: (avatar?.x ?? 0) + (avatar?.width ?? 90) - 30, y: (avatar?.y ?? 0) + (avatar?.height ?? 90) - 30, width: 30, height: 30 }
            : kind === 'live'
                ? { x: (clip?.x ?? 0) + 12, y: (clip?.y ?? 0) + 12, width: 100, height: 30 }
                : { x: 20, y: layout.canvas.height - 12, width: layout.canvas.width - 40, height: 6 };
        const ti = layout.elements.findIndex(e => e.kind === 'timer');
        layout.elements.splice(ti < 0 ? layout.elements.length : ti, 0, element(kind, kind, rect, { enabled: false }));
    }
    // "Mostrar contador" se guarda en su columna (show_debug_timer): manda sobre el elemento
    const timer = layout.elements.find(e => e.kind === 'timer');
    if (timer) timer.enabled = !!config?.showDebugTimer;
    return layout;
}
