// ============================================================================
// INTERFACES PARA SISTEMA DE ALERTAS PERSONALIZABLES (PROFESIONAL)
// ============================================================================

export type AlertTemplate = 'minimal' | 'colorful' | 'gaming' | 'custom';
export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days';
export type BackgroundType = 'color' | 'gradient' | 'image' | 'gif';
export type TextShadow = 'none' | 'normal' | 'strong' | 'glow';
export type FontWeight = 'normal' | 'bold' | 'bolder' | 'lighter';
export type AnimationType = 'none' | 'fade' | 'slide' | 'bounce' | 'zoom' | 'rotate';
export type AnimationSpeed = 'slow' | 'normal' | 'fast';

export type TimerEventType =
    | 'bits'
    | 'follow'
    | 'sub'
    | 'gift'
    | 'raid'
    | 'hypetrain'
    | 'tips';

// ============================================================================
// CONFIGURACIÓN VISUAL Y DE ESTILO
// ============================================================================

export interface GradientConfig {
    color1: string;
    color2: string;
    angle: number;
}

export interface Position {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}

export interface AlertStyleConfig {
    // Layout Interno
    layout: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    align: 'start' | 'center' | 'end';
    gap: number;
    
    // Configuración de Icono
    showIcon: boolean; // Mostrar u ocultar globalmente
    iconSize: number; // Tamaño en px
    iconShape: 'square' | 'circle' | 'rounded'; // Forma del contenedor del icono

    // Estilos Visuales
    backgroundType: BackgroundType;
    backgroundColor: string;
    gradient: GradientConfig;
    backgroundImage: string | null;
    textColor: string;
    fontSize: number;
    fontFamily: string;
    fontWeight: FontWeight;
    textShadow: TextShadow;
    borderEnabled: boolean;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    opacity: number;
}

export interface AlertAnimationConfig {
    entrance: AnimationType;
    exit: AnimationType;
    speed: AnimationSpeed;
}

export interface AlertsGlobalConfig {
    enabled: boolean;
    position: Position;
    size: Size;
    duration: number;
    style: AlertStyleConfig;
    animation: AlertAnimationConfig;
}

// ============================================================================
// SISTEMA DE MEDIA AVANZADA (UNIFICADO)
// ============================================================================

export interface MediaAsset {
    url: string;
    volume?: number; // 0-100
    loop?: boolean;
}

export interface AdvancedMediaComposition {
    video?: MediaAsset; // Video de fondo o principal
    image?: MediaAsset; // Imagen estática superpuesta
    audio?: MediaAsset; // Audio independiente
}

export interface AlertMediaConfig {
    enabled: boolean;
    mode: 'simple' | 'advanced';

    // Modo Simple: Un solo archivo (audio o video)
    simple?: MediaAsset & { type: 'audio' | 'video' };

    // Modo Avanzado: Composición completa
    advanced?: AdvancedMediaComposition;

    // Control de audio del video
    muteVideo?: boolean;     // Silenciar el audio del video (default: true)
    soundUrl?: string;       // Sonido de alerta independiente del video/imagen
    soundVolume?: number;    // Volumen del sonido (0-100, default: 80)
    ttsDelay?: number;       // ms a esperar después del sonido antes de TTS (0 = al terminar)
}

// ============================================================================
// CONFIGURACIÓN DE TTS (TEXT-TO-SPEECH)
// ============================================================================

export interface TtsConfig {
    enabled: boolean;
    voice: string;           // Voice ID, ej: "Lupe"
    engine: 'standard' | 'neural';
    languageCode: string;    // ej: "es-US", "en-US"

    // Template TTS (mensaje configurado: "¡Gracias {username}!")
    template: string;        // Texto a leer, con variables: {username}, {amount}, etc.
    templateVolume: number;  // 0-100 - Volumen del template

    // User Message TTS (mensaje escrito por el usuario en bits/subs/tips)
    readUserMessage: boolean; // Leer el mensaje del usuario
    userMessageVolume: number; // 0-100 - Volumen del mensaje del usuario
    maxChars: number;        // Máx chars del mensaje del usuario a leer

    waitForSound: boolean;   // Esperar que el sonido de alerta termine antes de reproducir TTS
}

export const DEFAULT_TTS_CONFIG: TtsConfig = {
    enabled: false,
    voice: 'Lupe',
    engine: 'standard',
    languageCode: 'es-US',
    template: '',
    templateVolume: 80,
    readUserMessage: false,
    userMessageVolume: 80,
    maxChars: 150,
    waitForSound: true
};

// ============================================================================
// CONFIGURACIÓN DE EVENTOS Y VARIANTES
// ============================================================================

/**
 * Condición para activar una variante específica.
 * - 'min': Se activa si la cantidad es >= threshold (ej: 100 bits)
 * - 'exact': Se activa si la cantidad es == threshold (ej: 69 bits)
 * - 'range': Se activa si min <= cantidad <= max (Futuro uso)
 */
export type VariantCondition = 'min' | 'exact';

/**
 * Configuración base para una alerta (común para Default y Variantes)
 */
export interface AlertConfigBase {
    enabled: boolean;

    // Identidad
    name?: string; // Nombre descriptivo para la variante (ej: "Alerta Épica 1000 bits")

    // Comportamiento
    duration?: number | null; // null = usar global

    // Contenido
    message: string; // Template

    // Iconografía
    icon?: string; // Emoji
    customIcon?: string | null; // URL

    // Sistema de Media Profesional
    media: AlertMediaConfig;

    // Text-to-Speech
    tts?: TtsConfig;

    // Estilos (Override opcional del global)
    useGlobalStyle: boolean;
    customStyle?: Partial<AlertStyleConfig>;
    customAnimation?: Partial<AlertAnimationConfig>;

    // Legacy support (para migración suave, se eliminarán a futuro)
    soundEnabled?: boolean;
    soundUrl?: string | null;
    soundVolume?: number;
}

/**
 * Variante específica (Tier)
 */
export interface AlertVariant extends AlertConfigBase {
    id: string; // ID único para gestión
    condition: VariantCondition;
    threshold: number; // Cantidad disparadora (bits, viewers, months, etc.)
}

/**
 * Configuración contenedora por Tipo de Evento
 */
export interface EventCategoryConfig {
    enabled: boolean;
    
    // Configuración Default (Fallback)
    default: AlertConfigBase;

    // Lista de Variantes (Tiers)
    variants: AlertVariant[];
}

// ============================================================================
// CONFIGURACIÓN MAESTRA
// ============================================================================

export interface AlertsConfig {
    enabled: boolean;
    template: AlertTemplate;
    globalVolume: number;
    testMode: boolean;
    
    global: AlertsGlobalConfig;

    events: {
        bits: EventCategoryConfig;
        follow: EventCategoryConfig;
        sub: EventCategoryConfig;
        gift: EventCategoryConfig;
        raid: EventCategoryConfig;
        hypetrain: EventCategoryConfig;
        tips: EventCategoryConfig;
    };
}

// ============================================================================
// DATOS EN TIEMPO DE EJECUCIÓN (DTOs)
// ============================================================================

export interface TimerEventAlertData {
    eventType: TimerEventType;
    userName: string;
    amount?: number;
    secondsAdded: number;
    message: string;

    // Datos resueltos listos para consumir por el Overlay
    media?: AlertMediaConfig;
    style?: AlertStyleConfig;
    animation?: AlertAnimationConfig;
    duration?: number;
    icon?: string;
    customIcon?: string | null;

    // TTS URLs generadas por el backend
    ttsTemplateUrl?: string;
    ttsTemplateVolume?: number;
    ttsUserMessageUrl?: string;
    ttsUserMessageVolume?: number;

    // Sonido de alerta (para secuencia de audio)
    soundUrl?: string;
    soundVolume?: number;
}

// ============================================================================
// VALORES POR DEFECTO (FACTORY)
// ============================================================================

const DEFAULT_MEDIA_CONFIG: AlertMediaConfig = {
    enabled: false,
    mode: 'simple',
    simple: { url: '', type: 'audio', volume: 100 }
};

const createDefaultEventConfig = (msg: string, icon: string, ttsTemplate?: string): EventCategoryConfig => ({
    enabled: true,
    default: {
        enabled: true,
        message: msg,
        icon: icon,
        customIcon: null,
        duration: null,
        useGlobalStyle: true,
        media: { ...DEFAULT_MEDIA_CONFIG },
        tts: {
            ...DEFAULT_TTS_CONFIG,
            template: ttsTemplate || ''
        }
    },
    variants: []
});

export const DEFAULT_ALERTS_CONFIG: AlertsConfig = {
    enabled: true,
    template: 'minimal',
    globalVolume: 100,
    testMode: false,
    global: {
        enabled: true,
        position: { x: 200, y: 90 },
        size: { width: 600, height: 120 },
        duration: 5000,
        style: {
            // Layout Defaults
            layout: 'column',
            align: 'center',
            gap: 10,
            
            // Icon Defaults
            showIcon: true,
            iconSize: 50,
            iconShape: 'rounded',

            backgroundType: 'color',
            backgroundColor: '#1a1a1a',
            gradient: { color1: '#3b82f6', color2: '#8b5cf6', angle: 45 },
            backgroundImage: null,
            textColor: '#ffffff',
            fontSize: 32,
            fontFamily: 'Arial',
            fontWeight: 'bold',
            textShadow: 'none',
            borderEnabled: false,
            borderColor: '#ffffff',
            borderWidth: 2,
            borderRadius: 20,
            opacity: 85
        },
        animation: {
            entrance: 'fade',
            exit: 'fade',
            speed: 'normal'
        }
    },
    events: {
        bits: createDefaultEventConfig('+{time} por {amount} bits de {userName}!', '💎', '¡Gracias {userName} por {amount} bits!'),
        follow: createDefaultEventConfig('+{time} por follow de {userName}!', '❤️', '¡Bienvenido {userName}!'),
        sub: createDefaultEventConfig('+{time} por suscripción de {userName}!', '⭐', '¡Gracias {userName} por suscribirte!'),
        gift: createDefaultEventConfig('+{time} por {amount} subs regaladas de {userName}!', '🎁', '¡Gracias {userName} por regalar {amount} subs!'),
        raid: createDefaultEventConfig('+{time} por raid de {amount} viewers de {userName}!', '🚀', '¡Bienvenidos raiders de {userName}!'),
        hypetrain: createDefaultEventConfig('+{time} por Hype Train nivel {amount}!', '🔥', '¡Hype Train nivel {amount}!'),
        tips: createDefaultEventConfig('+{time} por ${amount} de {userName}! {message}', '💰', '¡Gracias {userName} por donar {amount}!')
    }
};

export interface AlertTemplateDefinition {
    name: string;
    description: string;
    global: AlertsGlobalConfig;
}