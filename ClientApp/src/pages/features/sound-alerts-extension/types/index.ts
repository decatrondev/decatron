// Tipos
export interface ChannelPointsReward {
    id: string;
    title: string;
    cost: number;
    prompt: string;
    is_enabled: boolean;
    background_color: string;
    is_paused: boolean;
    is_in_stock: boolean;
}

export interface SoundFile {
    id: number;
    rewardId: string;
    rewardTitle: string;
    fileType: string;
    fileName: string;
    fileSize: number;
    durationSeconds: number;
    volume: number | null;
    enabled: boolean;
    playCount: number;
}

export interface TextLine {
    text: string;
    fontSize: number;
    fontWeight: string;
    enabled: boolean;
}

export interface Styles {
    fontFamily: string;
    fontSize: number;
    textColor: string;
    textShadow: string;
    backgroundType: string;
    gradientColor1: string;
    gradientColor2: string;
    gradientAngle: number;
    solidColor: string;
    backgroundOpacity: number;
}

export interface Layout {
    media: { x: number; y: number; width: number; height: number };
    text: { x: number; y: number; align: string };
}

export type TabType = 'basic' | 'typography' | 'background' | 'layout' | 'animations' | 'rewards';
export type DragElement = 'media' | 'text' | null;
