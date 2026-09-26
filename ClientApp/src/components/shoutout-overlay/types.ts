// Motor del overlay de Shoutout: diseño por elementos que dibuja ShoutoutRenderer en OBS, en la vista
// previa y en el editor. Ver .dev/plans/SHOUTOUT_REDESIGN_PLAN.md (fase 0).

/** Lo que llega con cada shoutout (SignalR ShowShoutout). Lo nuevo de la fase 2 es opcional. */
export interface ShoutoutData {
    targetUser: string;
    displayName?: string;
    gameName?: string;
    profileImageUrl?: string;
    clipUrl?: string | null;
    /** Fase 2. */
    title?: string;
    tags?: string[];
    broadcasterType?: 'partner' | 'affiliate' | '';
    isLive?: boolean;
    followers?: number | null;
    clipTitle?: string;
    clipViews?: number | null;
    clipCreator?: string;
}

export type ElementKind = 'panel' | 'clip' | 'avatar' | 'text' | 'badge' | 'live' | 'progress' | 'timer' | 'shape';

export type TextShadow = 'none' | 'normal' | 'strong' | 'glow';

export interface TextLine {
    /** Con variables: @username, @displayname, @game, @title, @followers, @clipTitle, @clipViews, @clipCreator. */
    text: string;
    fontSize: number;
    fontWeight: string;
    enabled: boolean;
}

/** Bloque de líneas de texto, apiladas como en el overlay viejo. */
export interface TextBlock {
    lines: TextLine[];
    fontFamily: string;
    color: string;
    shadow: TextShadow;
    align: 'left' | 'center' | 'right';
    /** Espacio entre líneas en px. */
    gap: number;
    lineHeight: number;
    outline: { enabled: boolean; width: number; color: string };
    uppercase?: boolean;
    letterSpacing?: number;
    /** Configs viejas: el bloque se ancla en `x` (izquierda o centro) y no se corta a lo ancho. */
    anchor?: boolean;
}

export interface ShoutoutElement {
    id: string;
    kind: ElementKind;
    label?: string;
    enabled: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    text?: TextBlock;
    /** Propio de cada tipo (radio, borde, sombra, colores, texto de la etiqueta…). */
    options: Record<string, any>;
}

export interface Background {
    type: 'gradient' | 'solid' | 'transparent';
    color1: string;
    color2: string;
    angle: number;
    solid: string;
    /** 0-100. */
    opacity: number;
}

export interface ShoutoutTheme {
    background: Background;
    borderEnabled: boolean;
    borderColor: string;
    borderWidth: number;
    radius: number;
    /** Sombra CSS del panel ('' = sin sombra). */
    shadow: string;
    blur: number;
    accent: string;
}

export type Direction = 'left' | 'right' | 'top' | 'bottom';
export type Easing = 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';

export type AnimationType =
    | 'none'
    | 'fade'
    /** Fundido con escala 0.9 (el "sin animación" y el "fundido" del viejo). */
    | 'fade-scale'
    | 'slide'
    | 'bounce'
    /** Rebote por escala (el "rebote" del viejo). */
    | 'pop'
    | 'zoom'
    | 'rotate'
    | 'flip'
    | 'glitch';

export interface ShowHideAnimation {
    type: AnimationType;
    direction: Direction;
    durationMs: number;
    easing: Easing;
}

export interface ShoutoutLayout {
    version: 2;
    canvas: { width: number; height: number };
    theme: ShoutoutTheme;
    /** En orden de dibujo: los últimos quedan encima. */
    elements: ShoutoutElement[];
    animations: { enter: ShowHideAnimation; exit: ShowHideAnimation };
}
