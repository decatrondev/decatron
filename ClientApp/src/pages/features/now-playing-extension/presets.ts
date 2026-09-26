import type { ElementConfig, ElementId, OverlayLayout } from '../../../components/music-overlay/types';
import { cardLayout, text } from '../../../components/music-overlay/defaults';
import type { LayoutPreset } from '../../../components/music-overlay/DesignTabs';

// Diseños prearmados de Now Playing. El lienzo es el de la fuente de OBS (normalmente 1920×1080)
// y el widget va abajo a la izquierda; después se mueve en el Editor.

type Box = [x: number, y: number, w: number, h: number];

function build(canvas: { width: number; height: number }, size: [number, number], parts: Partial<Record<ElementId, [Box, Partial<ElementConfig>?]>>): OverlayLayout {
    const l = cardLayout();
    l.canvas = { ...canvas };
    // Colores del Now Playing de siempre: tarjeta oscura, borde gris y verde de Spotify
    l.theme = { ...l.theme, panelBackground: '#1B1C1D', panelBorderColor: '#374151', panelBorderWidth: 2, panelRadius: 16, panelBlur: 0, panelShadow: true, accent: '#1DB954', coverRadius: 10 };
    const ox = 30, oy = Math.max(0, canvas.height - size[1] - 30);
    for (const id of Object.keys(l.elements) as ElementId[]) {
        const part = parts[id];
        if (!part) { l.elements[id] = { ...l.elements[id], enabled: false }; continue; }
        const [[x, y, w, h], extra = {}] = part;
        l.elements[id] = { ...l.elements[id], enabled: true, x: ox + x, y: oy + y, width: w, height: h, ...extra, options: { ...l.elements[id].options, ...(extra.options ?? {}) } };
    }
    return l;
}

const title = (fontSize: number) => ({ text: text({ fontSize, fontWeight: '800', color: '#f8fafc', marquee: true }) });
const second = (fontSize: number) => ({ text: text({ fontSize, color: '#94a3b8' }) });
const third = (fontSize: number) => ({ text: text({ fontSize, color: '#64748b' }) });
const bar = (radius: number) => ({ options: { fill: '#1DB954', track: '#374151', radius } });
const time = (fontSize: number) => ({ text: text({ fontSize, color: '#94a3b8', fontFamily: 'JetBrains Mono' }), options: { format: 'split' } });
const icon = { options: { display: 'icon', opacity: 0.8 } };

export function nowPlayingPresets(canvas: { width: number; height: number }): LayoutPreset[] {
    return [
        {
            id: 'card',
            build: () => build(canvas, [760, 220], {
                panel: [[0, 0, 760, 220]],
                cover: [[20, 20, 180, 180], { options: { shadow: true } }],
                title: [[220, 30, 490, 44], title(32)],
                artist: [[220, 78, 520, 32], second(24)],
                album: [[220, 112, 520, 26], third(18)],
                progress: [[220, 160, 520, 8], bar(4)],
                time: [[220, 174, 520, 24], time(15)],
                source: [[716, 18, 24, 24], icon],
            }),
        },
        {
            id: 'vertical',
            build: () => build(canvas, [320, 470], {
                panel: [[0, 0, 320, 470]],
                cover: [[20, 20, 280, 280], { options: { shadow: true } }],
                title: [[20, 314, 280, 36], title(24)],
                artist: [[20, 352, 280, 28], second(18)],
                album: [[20, 382, 280, 22], third(14)],
                progress: [[20, 420, 280, 6], bar(3)],
                time: [[20, 432, 280, 22], time(13)],
                source: [[268, 30, 22, 22], icon],
            }),
        },
        {
            id: 'minimal',
            build: () => build(canvas, [520, 96], {
                panel: [[0, 0, 520, 96]],
                cover: [[12, 12, 72, 72]],
                equalizer: [[100, 20, 28, 16]],
                title: [[136, 12, 330, 36], title(24)],
                artist: [[100, 50, 366, 28], second(17)],
                progress: [[100, 84, 404, 4], bar(2)],
                source: [[478, 18, 26, 26], icon],
            }),
        },
        {
            id: 'text',
            build: () => {
                const l = build(canvas, [700, 110], {
                    equalizer: [[0, 16, 36, 24]],
                    title: [[50, 0, 650, 56], { text: text({ fontSize: 40, fontWeight: '800', color: '#ffffff', shadow: 'strong', marquee: true }) }],
                    artist: [[50, 60, 650, 40], { text: text({ fontSize: 28, fontWeight: '600', color: '#e4e4e7', shadow: 'strong' }) }],
                });
                l.theme = { ...l.theme, panelBackground: 'rgba(0,0,0,0)', panelBorderWidth: 0, panelShadow: false };
                return l;
            },
        },
    ];
}
