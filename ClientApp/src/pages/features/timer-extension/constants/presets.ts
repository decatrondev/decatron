import type { ThemeConfig, StyleConfig, ProgressBarConfig } from '../types';

export interface TimerPreset {
    id: string;
    name: string;
    description: string;
    previewColors: string[]; // [Fondo, Texto, Acento]
    config: {
        theme: Partial<ThemeConfig>;
        style: Partial<StyleConfig>;
        progressBar: Partial<ProgressBarConfig>;
    };
}

export const TIMER_PRESETS: TimerPreset[] = [
    {
        id: 'cyberpunk',
        name: 'Cyberpunk',
        description: 'Neón, negro y futurista.',
        previewColors: ['#000000', '#f472b6', '#22d3ee'],
        config: {
            theme: {
                mode: 'dark',
                containerBackground: '#09090b',
                containerOpacity: 95
            },
            style: {
                fontFamily: 'Oswald',
                fontWeight: '700',
                textColor: '#22d3ee',
                textShadow: 'glow',
                titleFontSize: 24,
                timeFontSize: 64
            },
            progressBar: {
                fillType: 'gradient',
                fillGradient: { color1: '#ec4899', color2: '#8b5cf6', angle: 90 },
                backgroundColor: '#3f3f46',
                borderEnabled: true,
                borderColor: '#22d3ee',
                borderWidth: 2,
                borderRadius: 4
            }
        }
    },
    {
        id: 'minimal-dark',
        name: 'Minimal Dark',
        description: 'Limpio, sobrio y elegante.',
        previewColors: ['#1a1a1a', '#ffffff', '#52525b'],
        config: {
            theme: {
                mode: 'dark',
                containerBackground: '#18181b',
                containerOpacity: 90
            },
            style: {
                fontFamily: 'Inter',
                fontWeight: '400',
                textColor: '#ffffff',
                textShadow: 'normal',
                titleFontSize: 20,
                timeFontSize: 48
            },
            progressBar: {
                fillType: 'color',
                fillColor: '#ffffff',
                backgroundColor: '#3f3f46',
                borderEnabled: false,
                borderRadius: 8,
                size: { width: 900, height: 4 }
            }
        }
    },
    {
        id: 'forest',
        name: 'Forest',
        description: 'Tonos naturales y relajantes.',
        previewColors: ['#064e3b', '#d1fae5', '#34d399'],
        config: {
            theme: {
                mode: 'dark',
                containerBackground: '#022c22',
                containerOpacity: 85
            },
            style: {
                fontFamily: 'Montserrat',
                fontWeight: '600',
                textColor: '#ecfccb',
                textShadow: 'strong'
            },
            progressBar: {
                fillType: 'gradient',
                fillGradient: { color1: '#4ade80', color2: '#10b981', angle: 45 },
                backgroundColor: '#064e3b',
                borderEnabled: true,
                borderColor: '#84cc16',
                borderWidth: 2,
                borderRadius: 12
            }
        }
    },
    {
        id: 'sunset',
        name: 'Sunset',
        description: 'Cálido, degradados naranjas.',
        previewColors: ['#431407', '#fb923c', '#f59e0b'],
        config: {
            theme: {
                mode: 'dark',
                containerBackground: '#2a0a04',
                containerOpacity: 90
            },
            style: {
                fontFamily: 'Poppins',
                fontWeight: '700',
                textColor: '#fff7ed',
                textShadow: 'normal'
            },
            progressBar: {
                fillType: 'gradient',
                fillGradient: { color1: '#f59e0b', color2: '#ef4444', angle: 90 },
                backgroundColor: '#431407',
                borderEnabled: false,
                borderRadius: 20
            }
        }
    },
    {
        id: 'clean-white',
        name: 'Clean White',
        description: 'Fondo claro para overlays luminosos.',
        previewColors: ['#ffffff', '#18181b', '#3b82f6'],
        config: {
            theme: {
                mode: 'light',
                containerBackground: '#ffffff',
                containerOpacity: 95
            },
            style: {
                fontFamily: 'Roboto',
                fontWeight: '500',
                textColor: '#18181b',
                textShadow: 'none'
            },
            progressBar: {
                fillType: 'color',
                fillColor: '#3b82f6',
                backgroundColor: '#e4e4e7',
                borderEnabled: false,
                borderRadius: 4
            }
        }
    }
];
