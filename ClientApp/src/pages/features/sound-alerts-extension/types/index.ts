// Tipos
export interface ChannelPointsReward {
    id: string;
    title: string;
    cost: number;
    prompt: string;
    is_enabled: boolean;
    background_color: string;
    is_paused: boolean;
    is_in_stock: boolean;
}

export interface SoundFile {
    id: number;
    rewardId: string;
    rewardTitle: string;
    fileType: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    durationSeconds: number;
    volume: number | null;
    enabled: boolean;
    playCount: number;
    showImage: boolean;
    imageUrl?: string;
    imageSource: 'upload' | 'url';
    imagePath?: string;
    imagePublicUrl?: string | null;
}

export interface Rect { x: number; y: number; width: number; height: number }

export type TextAlign = 'left' | 'center' | 'right';

/**
 * Una línea de texto de la alerta. Desde el rediseño cada línea tiene su propia caja
 * (x, y, width, height sobre 1920×1080). Las guardadas antes no la traen: se apilaban
 * dentro de `layout.text` y `normalizeDesign` las convierte a la misma posición.
 */
export interface TextLine {
    text: string;
    fontSize: number;
    fontWeight: string;
    enabled: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    align?: TextAlign;
}

export type PlacedLine = TextLine & Rect & { align: TextAlign };

export interface Styles {
    fontFamily: string;
    fontSize: number;
    textColor: string;
    textShadow: string;
    backgroundType: string;
    gradientColor1: string;
    gradientColor2: string;
    gradientAngle: number;
    solidColor: string;
    backgroundOpacity: number;
}

export interface Layout {
    media: Rect;
    /** Caja del texto apilado de antes; se conserva para los overlays que aún no se actualizaron. */
    text: Rect & { align: string };
    /** Dónde va el fondo. Sin esto (configs viejas) cubre todo el lienzo. */
    panel?: Rect;
}

export interface TextOutline { enabled: boolean; color: string; width: number }

/** Todo lo visual de la alerta, ya normalizado: lo usan el overlay, la vista previa y el editor. */
export interface AlertDesign {
    textLines: PlacedLine[];
    styles: Styles;
    layout: Layout & { panel: Rect };
    textOutline: TextOutline;
    animation: { type: string; speed: string };
}

/** Lo que llega con cada canje. */
export interface AlertContent {
    redeemer: string;
    reward: string;
    fileType: string;
    fileUrl?: string;
    imageUrl?: string | null;
    showImage?: boolean;
}

/** La config completa que se edita y se guarda. */
export interface SoundAlertSettings {
    globalVolume: number;
    globalEnabled: boolean;
    duration: number;
    cooldownMs: number;
    design: AlertDesign;
}

export type TabId = 'guide' | 'rewards' | 'library' | 'basic' | 'texts' | 'background' | 'animation' | 'editor';
