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
    /** En qué plataformas lee la regla (comando, rol y todos); sin valor = solo Twitch, como antes de existir la opción. */
    platform?: 'all' | 'twitch' | 'kick';
    /** Solo en comandos: voz propia (manda sobre la del canal en lo que define). */
    voice?: RuleVoice;
    /** Solo en comandos: enfriamientos propios; sin valor heredan los del canal. */
    cooldownSeconds?: number;
    perUserCooldownSeconds?: number;
    /** Sin saldo en voz de pago: `silence` (por defecto) no suena; `standard` cae a la voz estándar. */
    noBalance?: 'silence' | 'standard';
}

export interface RuleVoice {
    engine: 'piper' | 'polly' | 'fish';
    standardVoice?: string;
    pollyVoice?: string;
    fishVoice?: string;
}

/** Tope de comandos con voz propia según el rango, y cuántos hay ya. */
export interface VoiceCommandLimits {
    max: number;
    used: number;
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
