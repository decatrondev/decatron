import type { ElementConfig, ElementId, OverlayLayout, ShowHideAnimation, TextShadow } from '../../../components/music-overlay/types';
import { cardLayout, normalizeLayout, text } from '../../../components/music-overlay/defaults';

// Now Playing (.dev/plans/NOW_PLAYING_REDESIGN_PLAN.md, fase 1): convierte el config_json viejo
// (modo tarjeta con auto-layout o modo libre) al formato del motor compartido, con cada elemento
// donde lo dibujaba el overlay viejo. Las fórmulas del modo tarjeta reproducen su flexbox y se
// validaron midiendo el overlay viejo en el navegador con las configs reales.

/** Versión del formato nuevo guardado en config_json. */
export const LAYOUT_VERSION = 2;

/** Lo que ofrece Now Playing del motor compartido. */
export const NP_ELEMENT_IDS: ElementId[] = ['panel', 'cover', 'equalizer', 'title', 'artist', 'album', 'progress', 'time', 'source'];

/** Los valores por defecto del overlay viejo (se mezclaban con lo guardado). */
const LEGACY_DEFAULT: any = {
    layout: { orientation: 'horizontal', showAlbumArt: true, showArtist: true, showAlbum: false, showProgressBar: true, showTimeStamps: true, showProviderIcon: true, marqueeOnOverflow: true },
    style: { backgroundType: 'color', backgroundColor: '#1B1C1D', backgroundGradient: { color1: '#1B1C1D', color2: '#262626', angle: 135 }, opacity: 100, borderEnabled: true, borderColor: '#374151', borderWidth: 2, borderRadius: 12 },
    albumArt: { size: 80, borderRadius: 8, shadow: true },
    typography: {
        songTitle: { fontFamily: 'Inter', fontSize: 24, fontWeight: 700, color: '#f8fafc', textShadow: 'none' },
        artist: { fontFamily: 'Inter', fontSize: 18, fontWeight: 400, color: '#94a3b8', textShadow: 'none' },
        album: { fontFamily: 'Inter', fontSize: 14, fontWeight: 400, color: '#64748b', textShadow: 'none' },
        time: { fontFamily: 'Inter', fontSize: 12, fontWeight: 400, color: '#94a3b8' },
    },
    progressBar: { height: 4, borderRadius: 2, backgroundColor: '#374151', foregroundColor: '#1DB954', animated: true },
    animations: {
        showAnimation: 'slideIn', showDirection: 'left', showDuration: 500, showEasing: 'ease-out',
        hideAnimation: 'slideOut', hideDirection: 'left', hideDuration: 500, hideEasing: 'ease-in',
        songChangeAnimation: 'crossfade', songChangeDuration: 300,
    },
    overlay: { elements: { card: { x: 20, y: 900, width: 400, height: 100 } } },
    canvas: { width: 1920, height: 1080 },
};

function deepMerge(target: any, source: any): any {
    const out = { ...target };
    for (const k of Object.keys(source ?? {})) {
        const sv = source[k], tv = target?.[k];
        if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object' && !Array.isArray(tv)) out[k] = deepMerge(tv, sv);
        else if (sv !== undefined) out[k] = sv;
    }
    return out;
}

export function isLegacyConfig(raw: any): boolean {
    return !(raw && raw.version === LAYOUT_VERSION && raw.elements);
}

/** El config_json guardado, en cualquier formato, listo para el motor. */
export function normalizeNowPlayingLayout(raw: any): OverlayLayout {
    if (!isLegacyConfig(raw)) return onlyNowPlaying(normalizeLayout(raw));
    return convertLegacyNowPlaying(raw ?? {});
}

function onlyNowPlaying(l: OverlayLayout): OverlayLayout {
    const elements = { ...l.elements };
    for (const id of Object.keys(elements) as ElementId[]) if (!NP_ELEMENT_IDS.includes(id)) elements[id] = { ...elements[id], enabled: false };
    return { ...l, elements };
}

// ── Texto ──────────────────────────────────────────────────────────────────

const SHADOWS: Record<string, TextShadow> = { normal: 'soft', strong: 'strong', glow: 'glow' };

// El título iba en un inline-block dentro de un div con el line-height de la página (24 px): si la
// letra es chica, esa línea "fantasma" hace el renglón más alto que el texto y lo baja un poco.
const STRUT_ABOVE = 18.17;
const STRUT_BELOW = 24 - STRUT_ABOVE;
/** Ascendente menos descendente de cada fuente (proporción del tamaño), para ubicar la línea base. */
const ASC_MINUS_DESC: Record<string, number> = { Inter: 0.7266, Arial: 0.693, Roboto: 0.683, Montserrat: 0.717, Poppins: 0.7 };

function titleLine(fontSize: number, fontFamily: string) {
    const line = fontSize * 1.3;
    const above = 0.65 * fontSize + ((ASC_MINUS_DESC[fontFamily] ?? 0.72) * fontSize) / 2;
    const below = line - above;
    return { line, rowHeight: Math.max(above, STRUT_ABOVE) + Math.max(below, STRUT_BELOW), offset: Math.max(above, STRUT_ABOVE) - above };
}

// ── Conversión ─────────────────────────────────────────────────────────────

export function convertLegacyNowPlaying(raw: any): OverlayLayout {
    const cfg = deepMerge(LEGACY_DEFAULT, raw);
    const { layout: show, style, albumArt, typography: ty, progressBar: pb, animations: an, canvas } = cfg;
    const mode = cfg.overlay?.mode || 'card';
    const els = mode === 'free' ? (cfg.overlay.freeConfig || cfg.overlay.elements) : (cfg.overlay.cardConfig || cfg.overlay.elements);

    const out = cardLayout();
    out.canvas = { width: canvas.width, height: canvas.height };
    for (const id of Object.keys(out.elements) as ElementId[]) out.elements[id] = { ...out.elements[id], enabled: false };

    // Con dos decimales: el viejo ubicaba el texto en medios y cuartos de píxel
    const r = (v: number) => Math.round(v * 100) / 100;
    const set = (id: ElementId, x: number, y: number, width: number, height: number, extra: Partial<ElementConfig> = {}) => {
        out.elements[id] = { ...out.elements[id], enabled: true, x: r(x), y: r(y), width: Math.max(1, r(width)), height: Math.max(1, r(height)), ...extra, options: { ...out.elements[id].options, ...(extra.options ?? {}) } };
    };
    const textOf = (t: any, size: number, marquee = false, lineHeight = 1.3) => text({
        fontFamily: t.fontFamily || 'Inter', fontSize: size, fontWeight: String(t.fontWeight ?? 400), color: t.color,
        align: 'left', shadow: SHADOWS[t.textShadow] ?? 'none', marquee, lineHeight,
    });

    const background = style.backgroundType === 'transparent' ? 'rgba(0,0,0,0)'
        : style.backgroundType === 'gradient' ? `linear-gradient(${style.backgroundGradient.angle}deg, ${style.backgroundGradient.color1}, ${style.backgroundGradient.color2})`
            : style.backgroundColor;
    const shadowCss = style.backgroundType !== 'transparent' ? '0 4px 16px rgba(0,0,0,0.4)' : undefined;

    const card = els.card;
    const horizontal = show.orientation !== 'vertical';

    if (mode === 'free') {
        // Modo libre: cada elemento donde estaba, sin escalar
        out.theme = { ...out.theme, panelBackground: background, panelBorderColor: style.borderColor, panelBorderWidth: style.borderEnabled ? style.borderWidth : 0, panelRadius: style.borderRadius, panelBlur: 0, panelShadow: !!shadowCss, panelShadowCss: shadowCss, coverRadius: albumArt.borderRadius };
        set('panel', card.x, card.y, card.width, card.height);
        if (show.showAlbumArt && els.albumArt) set('cover', els.albumArt.x, els.albumArt.y, els.albumArt.size, els.albumArt.size, { options: { shadow: !!albumArt.shadow } });
        if (els.songTitle) {
            const tl = titleLine(ty.songTitle.fontSize, ty.songTitle.fontFamily);
            set('title', els.songTitle.x, els.songTitle.y + tl.offset, els.songTitle.maxWidth, tl.line, { text: textOf(ty.songTitle, ty.songTitle.fontSize, !!show.marqueeOnOverflow) });
        }
        if (show.showArtist && els.artist) set('artist', els.artist.x, els.artist.y, els.artist.maxWidth, ty.artist.fontSize * 1.3, { text: textOf(ty.artist, ty.artist.fontSize) });
        if (show.showAlbum && els.album) set('album', els.album.x, els.album.y, els.album.maxWidth, ty.album.fontSize * 1.3, { text: textOf(ty.album, ty.album.fontSize) });
        if (show.showProgressBar && els.progressBar) set('progress', els.progressBar.x, els.progressBar.y, els.progressBar.width, els.progressBar.height, { options: { fill: pb.foregroundColor, track: pb.backgroundColor, radius: pb.borderRadius } });
        if (show.showTimeStamps && els.timestamps) set('time', els.timestamps.x, els.timestamps.y, Math.max(160, ty.time.fontSize * 12), ty.time.fontSize * 1.5, { text: textOf(ty.time, ty.time.fontSize, false, 1.5), options: { format: 'spaced' } });
        if (show.showProviderIcon && els.providerIcon) set('source', els.providerIcon.x, els.providerIcon.y, els.providerIcon.size, els.providerIcon.size, { options: { display: 'icon', opacity: 0.6 } });
    } else {
        // Modo tarjeta: todo escala con la tarjeta respecto de 760×220
        const k = Math.min(card.width / 760, card.height / 220);
        const s = (v: number) => Math.round(v * k);
        const borderRaw = style.borderEnabled ? style.borderWidth : 0;
        const border = style.borderEnabled ? Math.max(1, s(style.borderWidth)) : 0;
        const pad = s(horizontal ? 12 : 16);
        const gap = s(horizontal ? 12 : 8);
        const cx = card.x + border + pad, cy = card.y + border + pad;
        const cw = card.width - 2 * border - 2 * pad, ch = card.height - 2 * border - 2 * pad;

        out.theme = { ...out.theme, panelBackground: background, panelBorderColor: style.borderColor, panelBorderWidth: border, panelRadius: s(style.borderRadius), panelBlur: 0, panelShadow: !!shadowCss, panelShadowCss: shadowCss, coverRadius: s(albumArt.borderRadius), clipToPanel: true };
        set('panel', card.x, card.y, card.width, card.height);

        const art = !show.showAlbumArt ? 0 : Math.max(20, horizontal
            ? card.height - 2 * pad - 2 * borderRaw
            : Math.min(card.width - 2 * pad - 2 * borderRaw, s(albumArt.size)));

        // Columna de datos: título, artista, álbum y barra con tiempos, separados por s(2)
        const tl = titleLine(s(ty.songTitle.fontSize), ty.songTitle.fontFamily);
        const rows: { id: ElementId | 'bar'; h: number }[] = [{ id: 'title', h: tl.rowHeight }];
        if (show.showArtist) rows.push({ id: 'artist', h: s(ty.artist.fontSize) * 1.3 });
        if (show.showAlbum) rows.push({ id: 'album', h: s(ty.album.fontSize) * 1.3 });
        const timeH = s(ty.time.fontSize) * 1.5;
        if (show.showProgressBar) rows.push({ id: 'bar', h: s(4) + s(pb.height) + (show.showTimeStamps ? s(2) + timeH : 0) });
        const total = rows.reduce((a, row) => a + row.h, 0) + s(2) * (rows.length - 1);

        let infoX: number, infoW: number, top: number;
        if (horizontal) {
            if (art) set('cover', cx, cy + (ch - art) / 2, art, art, { options: { shadow: !!albumArt.shadow } });
            infoX = art ? cx + art + gap : cx;
            infoW = art ? cw - art - gap : cw;
            top = cy + (ch - total) / 2;
        } else {
            if (art) set('cover', cx + (cw - art) / 2, cy, art, art, { options: { shadow: !!albumArt.shadow } });
            infoX = cx;
            infoW = cw;
            const areaTop = art ? cy + art + gap : cy;
            top = areaTop + ((art ? ch - art - gap : ch) - total) / 2;
        }

        let y = top;
        for (const row of rows) {
            if (row.id === 'title') set('title', infoX, y + tl.offset, infoW, tl.line, { text: { ...textOf(ty.songTitle, s(ty.songTitle.fontSize), !!show.marqueeOnOverflow), marqueeGap: s(40) } });
            if (row.id === 'artist') set('artist', infoX, y, infoW, row.h, { text: textOf(ty.artist, s(ty.artist.fontSize)) });
            if (row.id === 'album') set('album', infoX, y, infoW, row.h, { text: textOf(ty.album, s(ty.album.fontSize)) });
            if (row.id === 'bar') {
                const barY = y + s(4);
                set('progress', infoX, barY, infoW, s(pb.height), { options: { fill: pb.foregroundColor, track: pb.backgroundColor, radius: s(pb.borderRadius) } });
                if (show.showTimeStamps) set('time', infoX, barY + s(pb.height) + s(2), infoW, timeH, { text: textOf(ty.time, s(ty.time.fontSize), false, 1.5), options: { format: 'split' } });
            }
            y += row.h + s(2);
        }

        if (show.showProviderIcon) {
            const size = s(16);
            set('source', card.x + card.width - border - s(6) - size, card.y + border + s(6), size, size, { options: { display: 'icon', opacity: 0.6 } });
        }
    }

    // Opacidad de la tarjeta: antes atenuaba todo; ahora va en el fondo (ninguna config real la usa)
    if (style.opacity < 100 && style.backgroundType === 'color') out.theme.panelBackground = withAlpha(style.backgroundColor, style.opacity / 100);

    out.animations = {
        ...out.animations,
        // El viejo hacía siempre el mismo "crossfade" (fundido con un leve zoom), fuera cual fuera la opción
        songChange: 'crossfade',
        songChangePanel: mode !== 'free',
        durationMs: an.songChangeDuration || 300,
        hideWhenIdle: true,
        marqueeSpeed: 75,
        marqueeMode: 'loop',
        freezeWhenPaused: true,
        enter: showAnim(an.showAnimation, an.showDirection, an.showDuration, an.showEasing),
        exit: hideAnim(an.hideAnimation, an.hideDirection, an.hideDuration, an.hideEasing),
    };
    return out;
}

const DIRS = ['left', 'right', 'top', 'bottom'];
const EASINGS = ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear'];
const dir = (d: string) => (DIRS.includes(d) ? d : 'left') as ShowHideAnimation['direction'];
const ease = (e: string) => (EASINGS.includes(e) ? e : 'ease') as ShowHideAnimation['easing'];

/** Mismo criterio que el overlay viejo: lo que no reconocía entraba deslizando desde la izquierda. */
function showAnim(type: string, direction: string, ms: number, easing: string): ShowHideAnimation {
    if (type === 'fadeIn') return { type: 'fade', direction: 'left', durationMs: ms || 500, easing: ease(easing) };
    if (type === 'slideIn') return { type: 'slide', direction: dir(direction), durationMs: ms || 500, easing: ease(easing) };
    if (type === 'bounceIn') return { type: 'bounce', direction: dir(direction), durationMs: ms || 500, easing: ease(easing) };
    return { type: 'slide', direction: 'left', durationMs: ms || 500, easing: ease(easing) };
}

function hideAnim(type: string, direction: string, ms: number, easing: string): ShowHideAnimation {
    if (type === 'fadeOut') return { type: 'fade', direction: 'left', durationMs: ms || 500, easing: ease(easing) };
    if (type === 'slideOut') return { type: 'slide', direction: dir(direction), durationMs: ms || 500, easing: ease(easing) };
    return { type: 'slide', direction: 'left', durationMs: ms || 500, easing: ease(easing) };
}

function withAlpha(color: string, alpha: number): string {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    return m ? `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})` : color;
}
