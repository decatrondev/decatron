/**
 * Now Playing Extension - Type Definitions
 */

export type TabId = 'general' | 'layout' | 'style' | 'typography' | 'progressBar' | 'animations' | 'overlay' | 'preview';

export interface TypographySettings {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    color: string;
    textShadow?: string;
}

export interface ConfigJson {
    canvas: { width: number; height: number };
    layout: {
        orientation: 'horizontal' | 'vertical';
        showAlbumArt: boolean;
        showArtist: boolean;
        showAlbum: boolean;
        showProgressBar: boolean;
        showTimeStamps: boolean;
        showProviderIcon: boolean;
        marqueeOnOverflow: boolean;
    };
    style: {
        backgroundType: 'color' | 'gradient' | 'transparent';
        backgroundColor: string;
        backgroundGradient: { color1: string; color2: string; angle: number };
        opacity: number;
        borderEnabled: boolean;
        borderColor: string;
        borderWidth: number;
        borderRadius: number;
    };
    albumArt: {
        size: number;
        borderRadius: number;
        shadow: boolean;
    };
    typography: {
        songTitle: TypographySettings;
        artist: TypographySettings;
        album: TypographySettings;
        time: TypographySettings;
    };
    progressBar: {
        height: number;
        borderRadius: number;
        backgroundColor: string;
        foregroundColor: string;
        animated: boolean;
    };
    animations: {
        showAnimation: string;
        showDirection: string;
        showDuration: number;
        showEasing: string;
        hideAnimation: string;
        hideDirection: string;
        hideDuration: number;
        hideEasing: string;
        songChangeAnimation: string;
        songChangeDuration: number;
    };
    overlay: {
        mode: 'card' | 'free';
        cardConfig: {
            card: { x: number; y: number; width: number; height: number };
        };
        freeConfig: {
            card: { x: number; y: number; width: number; height: number };
            albumArt: { x: number; y: number; size: number };
            songTitle: { x: number; y: number; maxWidth: number };
            artist: { x: number; y: number; maxWidth: number };
            album: { x: number; y: number; maxWidth: number };
            progressBar: { x: number; y: number; width: number; height: number };
            timestamps: { x: number; y: number };
            providerIcon: { x: number; y: number; size: number };
        };
    };
}

export interface NowPlayingState {
    isEnabled: boolean;
    provider: string;
    lastfmUsername: string | null;
    spotifyConnected: boolean;
    spotifySlotRequested: boolean;
    spotifySlotAssigned: boolean;
    pollingInterval: number;
    configJson: ConfigJson;
}

export interface CupoInfo {
    total: number;
    used: number;
    available: number;
}

export interface TierLimits {
    canUseSpotify: boolean;
    allowVertical: boolean;
    allowToggleElements: boolean;
    allowGradient: boolean;
    allowTransparent: boolean;
    allowCustomColors: boolean;
    allowCustomOpacity: boolean;
    allowCustomFonts: boolean;
    allowFontSize: boolean;
    allowTextShadow: boolean;
    allowProgressBarColors: boolean;
    allowProgressBarAnimation: boolean;
    allowAnimationType: boolean;
    allowAnimationDetails: boolean;
    allowFreeMode: boolean;
    allowMoveCard: boolean;
    allowedCanvasPresets: string[];
    pollingInterval: number;
}
