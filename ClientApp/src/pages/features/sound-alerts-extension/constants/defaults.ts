import type { Layout, Rect, Styles, TextLine } from '../types';

export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;
export const FULL_CANVAS: Rect = { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT };

export const DEFAULT_GLOBAL_VOLUME = 70;
export const DEFAULT_DURATION = 10;
export const DEFAULT_COOLDOWN_MS = 500;

export const DEFAULT_TEXT_LINES: TextLine[] = [
    { text: '@redeemer canjeó @reward', fontSize: 24, fontWeight: 'bold', enabled: true },
    { text: '¡Gracias por el apoyo!', fontSize: 18, fontWeight: '600', enabled: true },
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
    backgroundOpacity: 100,
};

export const DEFAULT_LAYOUT: Layout = {
    media: { x: 260, y: 40, width: 1400, height: 700 },
    text: { x: 460, y: 780, width: 1000, height: 240, align: 'center' },
};

export const FONT_OPTIONS = ['Inter', 'Roboto', 'Montserrat', 'Poppins', 'Arial'];
export const FONT_WEIGHT_OPTIONS = ['400', '600', 'bold'] as const;
export const SHADOW_OPTIONS = ['none', 'normal', 'strong', 'glow'] as const;
export const BACKGROUND_TYPE_OPTIONS = ['transparent', 'solid', 'gradient'] as const;
export const ANIMATION_TYPE_OPTIONS = ['none', 'fade', 'slide', 'bounce', 'zoom'] as const;
export const ANIMATION_SPEED_OPTIONS = ['slow', 'normal', 'fast'] as const;
