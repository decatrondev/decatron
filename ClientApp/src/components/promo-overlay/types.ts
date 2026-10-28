// Motor de diseño del overlay de Promociones: una plantilla es un lienzo con una lista libre de elementos (forma, imagen,
// icono, texto, QR) que dibuja PromoDesignRenderer en OBS, en la vista previa y en el editor. Hermano del motor de Event
// Alerts (components/event-alert-overlay): misma estructura de animaciones y mismo editor de lienzo, sin tocarlo.
// Plan: .dev/plans/overlay-promo/PLAN.md §3.3c. El servidor valida este mismo JSON (PromoDesignValidator.cs).
import type { ElementAnimation } from '../event-alert-overlay/types';
import type { Slot } from './slots';

export type { AnimationStep, AnimationType, Direction, Easing, ElementAnimation } from '../event-alert-overlay/types';

export const PROMO_DESIGN_VERSION = 1 as const;

/** Animaciones continuas (después de la entrada). */
export type LoopType = 'none' | 'pulse' | 'float' | 'breathe' | 'glow' | 'sway' | 'spin' | 'blink';
export interface Loop { type: LoopType; /** Duración de una vuelta, en ms. */ durationMs: number; delayMs: number }

export interface Fill {
    type: 'color' | 'gradient' | 'transparent';
    color: string;
    gradient: { color1: string; color2: string; angle: number };
}
export interface Border { enabled: boolean; color: string; width: number }
export interface Glow { enabled: boolean; color: string; blur: number }

/** Recorte de la forma: píldora y esquinas se hacen con el radio; el resto, con esto. */
export type ShapeCut = 'none' | 'slant-right' | 'slant-left' | 'slant-both' | 'corners';

interface Base {
    id: string;
    /** Nombre en la lista de capas del editor. */
    name: string;
    enabled: boolean;
    x: number; y: number; width: number; height: number;
    /** Grados. */
    rotation: number;
    /** 0-100. */
    opacity: number;
    animation: ElementAnimation;
    loop: Loop;
}

export interface ShapeElement extends Base {
    kind: 'shape';
    fill: Fill;
    border: Border;
    /** Hasta mitad del lado menor = píldora o círculo. */
    radius: number;
    cut: ShapeCut;
    /** Px de recorte para `cut`. */
    cutSize: number;
    /** Sombra CSS ('' = sin sombra). */
    shadow: string;
    glow: Glow;
    /** Desenfoque del fondo que hay detrás (px); 0 = ninguno. */
    backdropBlur: number;
}

export interface ImageElement extends Base {
    kind: 'image';
    /** 'library' = una imagen de la biblioteca de /admin/brand; 'piece' = la imagen de la pieza. */
    source: 'library' | 'piece';
    /** "builtin:<clave>" o "asset:<id>" (solo con source 'library'). */
    ref: string;
    fit: 'cover' | 'contain' | 'fill';
    radius: number;
    border: Border;
    shadow: string;
    glow: Glow;
}

export interface IconElement extends Base {
    kind: 'icon';
    /** 'piece' = el icono de la pieza; 'fixed' = el de `icon`. */
    source: 'piece' | 'fixed';
    icon: string;
    color: string;
    strokeWidth: number;
    glow: Glow;
}

export type TextShadow = 'none' | 'soft' | 'normal' | 'strong' | 'glow';

export interface TextElement extends Base {
    kind: 'text';
    /** Con variables: {{title}}, {{body}}, {{channel}}, {{commands}}, {{link}}. Si queda vacío no se dibuja. */
    template: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    color: string;
    align: 'left' | 'center' | 'right';
    verticalAlign: 'top' | 'center' | 'bottom';
    lineHeight: number;
    /** px */
    letterSpacing: number;
    italic: boolean;
    uppercase: boolean;
    /** 0 = sin límite. */
    maxLines: number;
    shadow: TextShadow;
    /** Color del brillo (solo con shadow 'glow'). */
    glowColor: string;
    /** Caja detrás del texto (un chip de comando, por ejemplo). */
    fill: Fill;
    border: Border;
    radius: number;
    padding: number;
}

export interface QrElement extends Base {
    kind: 'qr';
    color: string;
    background: string;
    radius: number;
    padding: number;
    border: Border;
}

export type PromoElement = ShapeElement | ImageElement | IconElement | TextElement | QrElement;
export type PromoElementKind = PromoElement['kind'];

export interface PromoDesign {
    version: typeof PROMO_DESIGN_VERSION;
    canvas: { width: number; height: number };
    /** En orden de dibujo: los últimos quedan encima. */
    elements: PromoElement[];
    /** Animación de la pieza entera (encima de la de cada elemento). */
    animation: ElementAnimation;
    /** Ajustes que el streamer puede cambiar (colores, textos fijos, tipografía). Ver slots.ts. */
    slots?: Slot[];
}

/** Lo que dibuja el diseño: el contenido de la pieza, ya con sus variables resueltas. */
export interface PromoContent {
    title: string;
    body: string;
    link: string | null;
    /** Imagen de la pieza (URL ya resuelta). */
    imageUrl: string | null;
    icon: string | null;
    showQr: boolean;
    /** Enlace corto de Decatron que lleva el QR (cuenta el clic y redirige). Si falta, el QR usa `link`. */
    qrLink?: string | null;
}

/** Valores de las variables del texto. */
export interface PromoVars { channel: string; commands: string; link: string }

export const PROMO_TEXT_VARIABLES = ['title', 'body', 'channel', 'commands', 'link'] as const;
