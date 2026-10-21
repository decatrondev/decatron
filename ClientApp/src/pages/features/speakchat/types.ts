// Tipos de la configuración de Speak Chat y de los datos que el panel lee del servidor.

export interface RoleConfig {
    everyone: boolean;
    subscriber: boolean;
    vip: boolean;
    moderator: boolean;
    broadcaster: boolean;
}

/** Cartera de créditos TTS. Dos bolsas: la estándar y la premium. */
export interface CreditUsage {
    tier: string;
    isUnlimited: boolean;
    monthlyGranted: number;
    monthlyUsed: number;
    monthlyRemaining: number;
    purchasedBalance: number;
    totalAvailable: number;
    standardGranted: number;
    standardUsed: number;
    standardRemaining: number;
    standardPercentage: number;
    inTransitionWindow: boolean;
    transitionEndsAt: string | null;
    tierExpiresAt: string | null;
    percentage: number;
}

export interface ChannelPointsReward {
    id: string;
    title: string;
    cost: number;
}

export interface ActivationRule {
    type: 'command' | 'bits' | 'channelPoints' | 'roles' | 'all';
    enabled: boolean;
    commandName?: string;
    minBits?: number;
    rewardId?: string;
    roles?: RoleConfig;
}

export interface SpeakChatConfigData {
    global: { enabled: boolean };
    activation: { rules: ActivationRule[] };
    // `voice` es el campo antiguo (nombre de voz Polly). Se conserva por
    // compatibilidad, pero cada motor tiene ya su propio campo.
    // `engine` es el proveedor (estándar o premium); `pollyEngine`, la calidad dentro de
    // Polly, que es lo que decide el multiplicador de créditos.
    voice: { engine: 'piper' | 'polly' | 'fish'; voice: string; pollyVoice: string; standardVoice: string; fishVoice?: string; pollyEngine: 'standard' | 'neural'; languageCode: string; volume: number };
    filters: { globalCooldownSeconds: number; perUserCooldownSeconds: number; maxChars: number; blockedWords: string[]; blockedWordsMode: 'whole' | 'partial'; blockedUsers: string[] };
    overlay: { showBubble: boolean; position: string; fontSize: number; backgroundColor: string; textColor: string; duration: number };
}

export type TabId = 'global' | 'activation' | 'voice' | 'filters' | 'overlay' | 'testing';

/** Lo que reciben las pestañas para leer y cambiar la configuración. */
export interface ConfigProps {
    config: SpeakChatConfigData;
    setConfig: React.Dispatch<React.SetStateAction<SpeakChatConfigData>>;
}
