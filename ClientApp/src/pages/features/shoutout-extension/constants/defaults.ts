import type { TextLine, StyleConfig, LayoutConfig } from '../types';

export const DEFAULT_DURATION = 10;
export const DEFAULT_COOLDOWN = 30;

export const DEFAULT_TEXT_LINES: TextLine[] = [
    { text: '🔥 ¡Sigan a @username! 🔥', fontSize: 32, fontWeight: 'bold', enabled: true },
    { text: 'Jugando: @game', fontSize: 24, fontWeight: '600', enabled: true }
];

export const DEFAULT_STYLES: StyleConfig = {
    fontFamily: 'Inter',
    fontSize: 32,
    textColor: '#ffffff',
    textShadow: 'normal',
    backgroundType: 'gradient',
    gradientColor1: '#667eea',
    gradientColor2: '#764ba2',
    gradientAngle: 135,
    solidColor: '#8b5cf6',
    backgroundOpacity: 100
};

export const DEFAULT_LAYOUT: LayoutConfig = {
    clip: { x: 20, y: 20, width: 400, height: 260 },
    text: { x: 699, y: 82, align: 'center' },
    profile: { x: 660, y: 173, size: 90 }
};

export const DEFAULT_ANIMATION_TYPE = 'none';
export const DEFAULT_ANIMATION_SPEED = 'normal';
export const DEFAULT_TEXT_OUTLINE_ENABLED = false;
export const DEFAULT_TEXT_OUTLINE_COLOR = '#000000';
export const DEFAULT_TEXT_OUTLINE_WIDTH = 2;
export const DEFAULT_CONTAINER_BORDER_ENABLED = false;
export const DEFAULT_CONTAINER_BORDER_COLOR = '#ffffff';
export const DEFAULT_CONTAINER_BORDER_WIDTH = 3;
