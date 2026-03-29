import type { TextLine, Styles, Layout } from '../types';

export const DEFAULT_GLOBAL_VOLUME = 70;
export const DEFAULT_DURATION = 10;
export const DEFAULT_ANIMATION_TYPE = 'fade';
export const DEFAULT_ANIMATION_SPEED = 'normal';
export const DEFAULT_COOLDOWN_MS = 500;
export const DEFAULT_TEXT_OUTLINE_ENABLED = false;
export const DEFAULT_TEXT_OUTLINE_COLOR = '#000000';
export const DEFAULT_TEXT_OUTLINE_WIDTH = 2;

export const DEFAULT_TEXT_LINES: TextLine[] = [
    { text: '@redeemer canjeó @reward', fontSize: 24, fontWeight: 'bold', enabled: true },
    { text: '¡Gracias por el apoyo!', fontSize: 18, fontWeight: '600', enabled: true }
];

export const DEFAULT_STYLES: Styles = {
    fontFamily: 'Inter',
    fontSize: 24,
    textColor: '#ffffff',
    textShadow: 'normal',
    backgroundType: 'transparent',
    gradientColor1: '#667eea',
    gradientColor2: '#764ba2',
    gradientAngle: 135,
    solidColor: '#8b5cf6',
    backgroundOpacity: 100
};

export const DEFAULT_LAYOUT: Layout = {
    media: { x: 100, y: 20, width: 200, height: 200 },
    text: { x: 200, y: 300, align: 'center' }
};

export const FONT_OPTIONS = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Montserrat', label: 'Montserrat' },
    { value: 'Poppins', label: 'Poppins' },
    { value: 'Arial', label: 'Arial' },
];

export const ANIMATION_TYPE_OPTIONS = [
    { value: 'none', label: 'Sin animación' },
    { value: 'fade', label: 'Fade' },
    { value: 'slide', label: 'Slide' },
    { value: 'bounce', label: 'Bounce' },
    { value: 'zoom', label: 'Zoom' },
];

export const ANIMATION_SPEED_OPTIONS = [
    { value: 'slow', label: 'Lenta' },
    { value: 'normal', label: 'Normal' },
    { value: 'fast', label: 'Rápida' },
];

export const SHADOW_OPTIONS = ['none', 'normal', 'strong', 'glow'] as const;

export const SHADOW_LABELS: Record<string, string> = {
    none: 'Sin',
    normal: 'Normal',
    strong: 'Fuerte',
    glow: 'Brillo',
};

export const BACKGROUND_TYPE_OPTIONS = ['transparent', 'solid', 'gradient'] as const;

export const BACKGROUND_TYPE_LABELS: Record<string, string> = {
    transparent: 'Transparente',
    solid: 'Sólido',
    gradient: 'Degradado',
};

export const FONT_WEIGHT_OPTIONS = [
    { value: '400', label: 'Normal' },
    { value: '600', label: 'Semi-bold' },
    { value: 'bold', label: 'Bold' },
];
