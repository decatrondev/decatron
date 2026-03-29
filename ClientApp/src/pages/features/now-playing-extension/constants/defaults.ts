/**
 * Now Playing Extension - Default Values & Constants
 */

import type { TierLimits, ConfigJson, NowPlayingState } from '../types';

export const ALL_UNLOCKED: TierLimits = {
    canUseSpotify: true, allowVertical: true, allowToggleElements: true,
    allowGradient: true, allowTransparent: true, allowCustomColors: true,
    allowCustomOpacity: true, allowCustomFonts: true, allowFontSize: true,
    allowTextShadow: true, allowProgressBarColors: true, allowProgressBarAnimation: true,
    allowAnimationType: true, allowAnimationDetails: true, allowFreeMode: true,
    allowMoveCard: true, allowedCanvasPresets: ['1920x1080', '1280x720', '2560x1440', '3840x2160'],
    pollingInterval: 3,
};

export const DEFAULT_CONFIG: ConfigJson = {
    canvas: { width: 1920, height: 1080 },
    layout: {
        orientation: 'horizontal',
        showAlbumArt: true,
        showArtist: true,
        showAlbum: false,
        showProgressBar: true,
        showTimeStamps: true,
        showProviderIcon: true,
        marqueeOnOverflow: true,
    },
    style: {
        backgroundType: 'color',
        backgroundColor: '#1B1C1D',
        backgroundGradient: { color1: '#1B1C1D', color2: '#262626', angle: 135 },
        opacity: 100,
        borderEnabled: true,
        borderColor: '#374151',
        borderWidth: 2,
        borderRadius: 12,
    },
    albumArt: { size: 80, borderRadius: 8, shadow: true },
    typography: {
        songTitle: { fontFamily: 'Inter', fontSize: 24, fontWeight: 700, color: '#f8fafc', textShadow: 'none' },
        artist: { fontFamily: 'Inter', fontSize: 18, fontWeight: 400, color: '#94a3b8', textShadow: 'none' },
        album: { fontFamily: 'Inter', fontSize: 14, fontWeight: 400, color: '#64748b', textShadow: 'none' },
        time: { fontFamily: 'Inter', fontSize: 12, fontWeight: 400, color: '#94a3b8' },
    },
    progressBar: {
        height: 4,
        borderRadius: 2,
        backgroundColor: '#374151',
        foregroundColor: '#1DB954',
        animated: true,
    },
    animations: {
        showAnimation: 'slideIn',
        showDirection: 'left',
        showDuration: 500,
        showEasing: 'ease-out',
        hideAnimation: 'slideOut',
        hideDirection: 'left',
        hideDuration: 500,
        hideEasing: 'ease-in',
        songChangeAnimation: 'crossfade',
        songChangeDuration: 300,
    },
    overlay: {
        mode: 'card',
        cardConfig: {
            card: { x: 30, y: 810, width: 760, height: 220 },
        },
        freeConfig: {
            card: { x: 30, y: 810, width: 760, height: 220 },
            albumArt: { x: 54, y: 834, size: 172 },
            songTitle: { x: 250, y: 830, maxWidth: 500 },
            artist: { x: 250, y: 886, maxWidth: 500 },
            album: { x: 250, y: 930, maxWidth: 500 },
            progressBar: { x: 250, y: 978, width: 500, height: 8 },
            timestamps: { x: 250, y: 994 },
            providerIcon: { x: 718, y: 826, size: 32 },
        },
    },
};

export const DEFAULT_STATE: NowPlayingState = {
    isEnabled: false,
    provider: 'lastfm',
    lastfmUsername: null,
    spotifyConnected: false,
    spotifySlotRequested: false,
    spotifySlotAssigned: false,
    pollingInterval: 5,
    configJson: DEFAULT_CONFIG,
};

export const FONT_OPTIONS = ['Inter', 'Arial', 'Roboto', 'Montserrat', 'Oswald', 'Georgia', 'Press Start 2P', 'monospace'];
export const FONT_WEIGHT_OPTIONS = [300, 400, 500, 600, 700, 800, 900];
export const TEXT_SHADOW_OPTIONS = [
    { value: 'none', label: 'Ninguna' },
    { value: '1px 1px 2px rgba(0,0,0,0.5)', label: 'Normal' },
    { value: '2px 2px 4px rgba(0,0,0,0.8)', label: 'Fuerte' },
    { value: '0 0 10px currentColor', label: 'Glow' },
];
export const CANVAS_PRESETS = [
    { label: '1920x1080 (Full HD)', width: 1920, height: 1080 },
    { label: '2560x1440 (2K)', width: 2560, height: 1440 },
    { label: '3840x2160 (4K)', width: 3840, height: 2160 },
    { label: '1280x720 (HD)', width: 1280, height: 720 },
];

export const TIER_LABELS: Record<string, { label: string; color: string }> = {
    supporter: { label: 'Supporter', color: 'text-blue-400 bg-blue-500/15 border-blue-500/30' },
    premium: { label: 'Premium', color: 'text-purple-400 bg-purple-500/15 border-purple-500/30' },
};
