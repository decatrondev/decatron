import type { OverlayLayout, OverlayTheme, TextStyle, ElementId } from '../types';
import { TEXT_ELEMENTS } from './defaults';

/**
 * Temas: cambian colores, fuentes y el panel, nunca la posición de los elementos
 * (eso es de los diseños del Editor).
 */
export interface ThemePreset {
    id: string;
    swatch: [string, string, string]; // fondo, texto, acento
    theme: Partial<OverlayTheme>;
    font: string;
    titleWeight: string;
    primary: string;
    secondary: string;
    shadow: TextStyle['shadow'];
    progressTrack: string;
}

export const THEME_PRESETS: ThemePreset[] = [
    {
        id: 'decatron', swatch: ['#0a0a0f', '#ffffff', '#39ff14'],
        theme: { panelBackground: 'rgba(10, 10, 15, 0.85)', panelBorderColor: 'rgba(57, 255, 20, 0.35)', panelBorderWidth: 1, panelRadius: 18, panelBlur: 8, panelShadow: true, accent: '#39ff14' },
        font: 'Inter', titleWeight: '800', primary: '#ffffff', secondary: '#a1a1aa', shadow: 'soft', progressTrack: 'rgba(255,255,255,0.15)',
    },
    {
        id: 'neon', swatch: ['#12001f', '#f5d0fe', '#e879f9'],
        theme: { panelBackground: 'rgba(18, 0, 31, 0.85)', panelBorderColor: 'rgba(232, 121, 249, 0.6)', panelBorderWidth: 2, panelRadius: 14, panelBlur: 6, panelShadow: true, accent: '#e879f9' },
        font: 'Rajdhani', titleWeight: '700', primary: '#f5d0fe', secondary: '#c084fc', shadow: 'glow', progressTrack: 'rgba(232,121,249,0.2)',
    },
    {
        id: 'minimal', swatch: ['#ffffff', '#0f172a', '#2563eb'],
        theme: { panelBackground: 'rgba(255, 255, 255, 0.92)', panelBorderColor: 'rgba(15, 23, 42, 0.08)', panelBorderWidth: 1, panelRadius: 20, panelBlur: 0, panelShadow: true, accent: '#2563eb' },
        font: 'Poppins', titleWeight: '700', primary: '#0f172a', secondary: '#64748b', shadow: 'none', progressTrack: 'rgba(15,23,42,0.1)',
    },
    {
        id: 'vinyl', swatch: ['#1c1410', '#fde68a', '#f59e0b'],
        theme: { panelBackground: 'rgba(28, 20, 16, 0.9)', panelBorderColor: 'rgba(245, 158, 11, 0.3)', panelBorderWidth: 1, panelRadius: 10, panelBlur: 0, panelShadow: true, accent: '#f59e0b' },
        font: 'Playfair Display', titleWeight: '700', primary: '#fde68a', secondary: '#d6b98c', shadow: 'soft', progressTrack: 'rgba(253,230,138,0.15)',
    },
    {
        id: 'glass', swatch: ['#94a3b8', '#ffffff', '#38bdf8'],
        theme: { panelBackground: 'rgba(255, 255, 255, 0.12)', panelBorderColor: 'rgba(255, 255, 255, 0.35)', panelBorderWidth: 1, panelRadius: 24, panelBlur: 18, panelShadow: false, accent: '#38bdf8' },
        font: 'Montserrat', titleWeight: '700', primary: '#ffffff', secondary: '#e2e8f0', shadow: 'strong', progressTrack: 'rgba(255,255,255,0.25)',
    },
    {
        id: 'arcade', swatch: ['#000000', '#fef08a', '#ef4444'],
        theme: { panelBackground: 'rgba(0, 0, 0, 0.9)', panelBorderColor: '#ef4444', panelBorderWidth: 3, panelRadius: 0, panelBlur: 0, panelShadow: false, accent: '#ef4444' },
        font: 'Press Start 2P', titleWeight: '400', primary: '#fef08a', secondary: '#fca5a5', shadow: 'strong', progressTrack: 'rgba(239,68,68,0.25)',
    },
    {
        id: 'transparent', swatch: ['#00000000', '#ffffff', '#ffffff'],
        theme: { panelBackground: 'rgba(0, 0, 0, 0)', panelBorderColor: 'rgba(0, 0, 0, 0)', panelBorderWidth: 0, panelRadius: 0, panelBlur: 0, panelShadow: false, accent: '#ffffff' },
        font: 'Montserrat', titleWeight: '800', primary: '#ffffff', secondary: '#e4e4e7', shadow: 'strong', progressTrack: 'rgba(255,255,255,0.25)',
    },
];

/** Los elementos de texto "secundarios" toman el color secundario; el título y la hora, el principal. */
const SECONDARY: ElementId[] = ['artist', 'time', 'next', 'queue', 'source'];

export function applyThemePreset(layout: OverlayLayout, preset: ThemePreset): OverlayLayout {
    const elements = { ...layout.elements };
    for (const id of TEXT_ELEMENTS) {
        const e = elements[id];
        if (!e.text) continue;
        const color = id === 'requester' ? preset.theme.accent ?? preset.primary
            : SECONDARY.includes(id) ? preset.secondary : preset.primary;
        elements[id] = {
            ...e,
            text: {
                ...e.text,
                fontFamily: id === 'time' && preset.font !== 'Press Start 2P' ? e.text.fontFamily : preset.font,
                fontWeight: id === 'title' ? preset.titleWeight : e.text.fontWeight,
                color,
                shadow: preset.shadow,
            },
        };
    }
    elements.progress = {
        ...elements.progress,
        options: { ...elements.progress.options, fill: preset.theme.accent, track: preset.progressTrack },
    };
    return { ...layout, theme: { ...layout.theme, ...preset.theme }, elements };
}
