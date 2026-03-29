export interface TextLine {
    text: string;
    fontSize: number;
    fontWeight: string;
    enabled: boolean;
}

export interface StyleConfig {
    fontFamily: string;
    fontSize: number;
    textColor: string;
    textShadow: 'none' | 'normal' | 'strong' | 'glow';
    backgroundType: 'gradient' | 'solid' | 'transparent';
    gradientColor1: string;
    gradientColor2: string;
    gradientAngle: number;
    solidColor: string;
    backgroundOpacity: number;
}

export interface LayoutConfig {
    clip: { x: number; y: number; width: number; height: number };
    text: { x: number; y: number; align: string };
    profile: { x: number; y: number; size: number };
}

export type TabType = 'basic' | 'typography' | 'background' | 'layout' | 'animations' | 'management' | 'debug';

export type DragElement = 'clip' | 'text' | 'profile' | null;
