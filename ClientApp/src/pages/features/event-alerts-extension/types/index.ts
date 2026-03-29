// ============================================
// TIPOS PARA SISTEMA DE EVENT ALERTS
// ============================================

// Tipos de eventos soportados
export type EventType =
  | 'follow'
  | 'bits'
  | 'sub'
  | 'giftSub'
  | 'raid'
  | 'resub'
  | 'hypeTrain';

// Tipos de animación
export type AnimationType =
  | 'fade'
  | 'slide'
  | 'zoom'
  | 'bounce'
  | 'rotate'
  | 'none';

// Dirección de animación
export type AnimationDirection =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'center';

// Efectos visuales
export type VisualEffect =
  | 'shake'
  | 'glow'
  | 'float'
  | 'pulse'
  | 'confetti'
  | 'fireworks';

// Tier de subscripción
export type SubTier = 'prime' | 'tier1' | 'tier2' | 'tier3';

// Tipo de condición para tiers
export type TierConditionType = 'range' | 'exact' | 'minimum';

// ============================================
// CONFIGURACIÓN GLOBAL
// ============================================

export interface GlobalAlertsConfig {
  enabled: boolean;
  defaultDuration: number; // Segundos
  defaultAnimation: AnimationType;
  defaultAnimationDirection: AnimationDirection;
  queueSettings: {
    enabled: boolean;
    maxQueueSize: number;
    delayBetweenAlerts: number; // Milisegundos
    showQueueCounter: boolean;
  };
  defaultPosition: {
    x: number; // Píxeles absolutos
    y: number; // Píxeles absolutos
  };
  defaultSound: string; // URL
  defaultVolume: number; // 0-100
  cooldownSettings: {
    globalCooldown: number; // Segundos entre cualquier alerta
    perEventCooldown: number; // Segundos entre alertas del mismo evento
  };
  canvas: {
    width: number;
    height: number;
  };
  tts: TtsConfig; // Configuración TTS global (default para todos los eventos)
  defaultStyle: AlertStyleConfig; // Estilo visual por defecto para todas las alertas
  overlayElements: {
    card: {
      x: number; // Píxeles
      y: number; // Píxeles
      width: number; // Píxeles
      height: number; // Píxeles
      enabled: boolean;
    };
    media: {
      x: number; // Píxeles
      y: number; // Píxeles
      width: number; // Píxeles
      height: number; // Píxeles
      enabled: boolean;
    };
    text: {
      x: number; // Píxeles
      y: number; // Píxeles
      width: number; // Píxeles
      height: number; // Píxeles
      enabled: boolean;
    };
  };
  // Nuevo sistema de overlay por evento (drag-and-drop)
  perEventOverlay?: PerEventOverlayConfig;
}

// ============================================
// PER-EVENT OVERLAY ELEMENTS (Nuevo sistema drag-and-drop)
// ============================================

export type OverlayAnimationType =
  | 'none'
  | 'fadeIn' | 'fadeOut'
  | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight'
  | 'zoomIn' | 'zoomOut'
  | 'bounce' | 'bounceIn' | 'bounceOut'
  | 'rotateIn' | 'rotateOut';

// Elemento base del overlay (posición, tamaño, animaciones)
export interface OverlayElementBase {
  id: string;
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  animationIn: OverlayAnimationType;
  animationOut: OverlayAnimationType;
  animationDuration: number; // ms
}

// Elemento de Media (video/imagen/gif)
export interface OverlayMediaElement extends OverlayElementBase {
  type: 'media';
  url: string;
  fit: 'cover' | 'contain' | 'fill';
  opacity: number; // 0-100
  playVideoAudio: boolean;
  videoVolume: number; // 0-100
}

// Elemento de Texto
export interface OverlayTextElement extends OverlayElementBase {
  type: 'text';
  template: string; // ej: "{usuario} te ha seguido!"
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  textShadow: boolean;
  textShadowColor: string;
  textShadowBlur: number;
  backgroundColor: string; // 'transparent' o color
  borderRadius: number;
  padding: number;
}

// Audio con soporte para múltiples tiers
export interface OverlayAudioConfig {
  enabled: boolean;
  url: string;
  volume: number; // 0-100
  delay: number; // ms antes de reproducir
}

// Audio por tier (para subscriptions)
export interface OverlayTierAudio {
  prime: OverlayAudioConfig;
  tier1: OverlayAudioConfig;
  tier2: OverlayAudioConfig;
  tier3: OverlayAudioConfig;
}

// Configuración de overlay por evento
export interface EventOverlayConfig {
  enabled: boolean;
  duration: number; // ms
  media: OverlayMediaElement;
  texts: OverlayTextElement[];
  audio: OverlayAudioConfig;
  // Para subs: audio por tier (opcional)
  tierAudio?: OverlayTierAudio;
}

// Configuración completa de overlays por evento
export interface PerEventOverlayConfig {
  follow: EventOverlayConfig;
  subscription: EventOverlayConfig;
  giftSub: EventOverlayConfig;
  raid: EventOverlayConfig;
  bits: EventOverlayConfig;
  channelPoints: EventOverlayConfig;
  tts: EventOverlayConfig;
}

// Variables disponibles por tipo de evento
export const EVENT_VARIABLES: Record<string, string[]> = {
  follow: ['usuario', 'fecha'],
  subscription: ['usuario', 'meses', 'tier', 'mensaje', 'racha'],
  giftSub: ['usuario', 'cantidad', 'tier', 'receptor'],
  raid: ['usuario', 'viewers'],
  bits: ['usuario', 'bits', 'mensaje'],
  channelPoints: ['usuario', 'recompensa', 'costo', 'mensaje'],
  tts: ['usuario', 'mensaje'],
};

// Datos de preview por evento
export const EVENT_PREVIEW_DATA: Record<string, Record<string, string | number>> = {
  follow: { usuario: 'StreamerFan123', fecha: 'Ahora' },
  subscription: { usuario: 'ProGamer99', meses: 3, tier: 'Tier 1', mensaje: '¡Increíble stream!', racha: 3 },
  giftSub: { usuario: 'GenerousUser', cantidad: 5, tier: 'Tier 1', receptor: 'LuckyViewer' },
  raid: { usuario: 'BigStreamer', viewers: 150 },
  bits: { usuario: 'CheerMaster', bits: 500, mensaje: '¡Eres el mejor!' },
  channelPoints: { usuario: 'LoyalViewer', recompensa: 'Elige la canción', costo: 5000, mensaje: 'Música!' },
  tts: { usuario: 'Viewer123', mensaje: 'Hola a todos en el chat!' },
};

// ============================================
// STYLE CONFIGURATION
// ============================================

export type MediaLayout = 'top' | 'bottom' | 'left' | 'right' | 'background' | 'hidden';
export type BackgroundType = 'color' | 'gradient' | 'image' | 'transparent';
export type TextShadowType = 'none' | 'normal' | 'strong' | 'glow';

export interface AlertStyleConfig {
  // Card size
  width: number;
  height: number;

  // Background
  backgroundType: BackgroundType;
  backgroundColor: string;
  backgroundGradient: { color1: string; color2: string; angle: number };
  backgroundImage: string;
  opacity: number; // 0-100

  // Border
  borderEnabled: boolean;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  padding: number;

  // Media layout (position of media relative to text)
  mediaLayout: MediaLayout;
  mediaObjectFit: 'cover' | 'contain';

  // Typography
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  textColor: string;
  textShadow: TextShadowType;
  textAlign: 'left' | 'center' | 'right';
}

// ============================================
// MEDIA CONFIGURATION (reutiliza el sistema del timer extensible)
// ============================================

import type { AlertMediaConfig } from '../../../../types/timer-alerts';
export type { AlertMediaConfig };
// Alias para compatibilidad con el resto del código
export type AlertMedia = AlertMediaConfig;

// ============================================
// TTS CONFIGURATION
// ============================================

export interface TtsConfig {
  enabled: boolean;
  voice: string;           // Voice ID, ej: "Lupe"
  engine: 'standard' | 'neural';
  languageCode: string;    // ej: "es-US", "en-US"

  // Template TTS (mensaje configurado: "¡Gracias {username}!")
  template: string;        // Texto a leer, con variables: {username}, {amount}, etc.
  templateVolume: number;  // 0-100 - Volumen del template

  // User Message TTS (mensaje escrito por el usuario en bits/subs/resubs)
  readUserMessage: boolean; // Leer el mensaje del usuario
  userMessageVolume: number; // 0-100 - Volumen del mensaje del usuario
  maxChars: number;        // Máx chars del mensaje del usuario a leer

  waitForSound: boolean;   // Esperar que el sonido de alerta termine antes de reproducir TTS

  // Compatibilidad hacia atrás (deprecated, usar templateVolume)
  volume?: number;
}

// ============================================
// ANIMACIÓN Y EFECTOS
// ============================================

export interface AnimationConfig {
  type: AnimationType;
  direction: AnimationDirection;
  duration: number; // Milisegundos
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface EffectsConfig {
  enabled: boolean;
  effects: VisualEffect[];
}

// ============================================
// TIER CONFIGURATION
// ============================================

export interface TierCondition {
  type: TierConditionType;
  min?: number;
  max?: number;
  exact?: number;
}

export interface AlertTier {
  id: string;
  name: string;
  enabled: boolean;
  condition: TierCondition;
  message: string;
  duration: number; // Sobrescribe global si está definido
  media: AlertMedia;
  animation: AnimationConfig;
  sound: string;
  volume: number;
  effects: EffectsConfig;
  tts: TtsConfig;
  chatMessage?: ChatMessageConfig; // Mensaje del bot en chat
  position?: {
    x: number;
    y: number;
  };
  style?: Partial<AlertStyleConfig>; // Sobrescribe el estilo global
  // Video audio settings
  playVideoAudio?: boolean; // Si reproducir audio del video
  videoVolume?: number;     // 0-100 - Volumen del video
  // Sistema de variantes (opcional)
  variants?: VariantsConfig;
}

// ============================================
// CHAT MESSAGE CONFIG
// ============================================

export interface ChatMessageConfig {
  enabled: boolean;
  template: string; // Template con variables: {username}, {amount}, {tier}, {months}, {viewers}, {level}
}

// ============================================
// BASE ALERT CONFIG (usado en varios eventos)
// ============================================

export interface BaseAlertConfig {
  enabled: boolean;
  message: string;
  duration: number;
  media: AlertMedia;
  animation: AnimationConfig;
  sound: string;
  volume: number;
  effects: EffectsConfig;
  tts: TtsConfig;
  chatMessage?: ChatMessageConfig; // Mensaje del bot en chat
  position?: {
    x: number;
    y: number;
  };
  style?: Partial<AlertStyleConfig>; // Sobrescribe el estilo global
  // Video audio settings
  playVideoAudio?: boolean; // Si reproducir audio del video
  videoVolume?: number;     // 0-100 - Volumen del video
  // Sistema de variantes (opcional)
  variants?: VariantsConfig;
}

// ============================================
// SISTEMA DE VARIANTES
// ============================================

// Modo de selección de variantes
export type VariantSelectionMode = 'random' | 'weighted' | 'sequential' | 'noRepeat';

// Modo de reset para "sin repetir"
export type VariantResetMode = 'all' | 'time';

// Una variante individual de alerta
export interface AlertVariant {
  id: string;
  name: string;
  weight: number;        // Para modo ponderado (1-100)
  media: AlertMedia;
  sound: string;
  volume: number;
  message: string;
  duration: number;
  animation: AnimationConfig;
  effects: EffectsConfig;
  tts: TtsConfig;
  chatMessage?: ChatMessageConfig;
  playVideoAudio?: boolean;
  videoVolume?: number;
}

// Configuración del sistema de variantes (opcional en cada tier/alerta)
export interface VariantsConfig {
  enabled: boolean;
  mode: VariantSelectionMode;
  resetAfter: VariantResetMode;
  resetTimeMinutes: number;
  variants: AlertVariant[];
}

// Límites de variantes por tier de cuenta
export const VARIANT_LIMITS = {
  free: 5,
  supporter: 15,
  premium: 999, // Prácticamente ilimitado
} as const;

// ============================================
// CONFIGURACIÓN POR EVENTO
// ============================================

// ANTI-SPAM CONFIG (para evitar alertas repetidas del mismo usuario)
export interface AntiSpamConfig {
  enabled: boolean;
  perUserCooldown: number; // Segundos antes de que el mismo usuario pueda disparar otra alerta (ej: 86400 = 24 horas)
}

// FOLLOW
export interface FollowAlertConfig {
  enabled: boolean;
  alert: BaseAlertConfig;
  cooldown: number;
  antiSpam: AntiSpamConfig;
}

// BITS (con alerta base + tiers)
export interface BitsAlertConfig {
  enabled: boolean;
  baseAlert: BaseAlertConfig; // Suena SIEMPRE
  tiers: AlertTier[]; // Sobrescriben base si cumplen condición
  cooldown: number;
}

// SUBS (por tier de Twitch)
export interface SubsAlertConfig {
  enabled: boolean;
  subTypes: {
    [key in SubTier]: BaseAlertConfig;
  };
  cooldown: number;
}

// GIFT SUBS (con tiers por cantidad)
export interface GiftSubsAlertConfig {
  enabled: boolean;
  baseAlert: BaseAlertConfig;
  tiers: AlertTier[]; // Por cantidad de subs regalados
  cooldown: number;
}

// RAIDS (con tiers por cantidad de viewers)
export interface RaidsAlertConfig {
  enabled: boolean;
  baseAlert: BaseAlertConfig;
  tiers: AlertTier[]; // Por cantidad de viewers
  cooldown: number;
}

// RESUBS (con tiers por meses)
export interface ResubsAlertConfig {
  enabled: boolean;
  baseAlert: BaseAlertConfig;
  tiers: AlertTier[]; // Por meses de antigüedad
  cooldown: number;
}

// HYPE TRAIN (alertas por nivel)
export interface HypeTrainAlertConfig {
  enabled: boolean;
  levels: {
    [level: number]: BaseAlertConfig; // 1-5
  };
  completionAlert: BaseAlertConfig; // Alerta especial al completar
  cooldown: number;
}

// ============================================
// CONFIGURACIÓN COMPLETA
// ============================================

export interface EventAlertsConfig {
  global: GlobalAlertsConfig;
  follow: FollowAlertConfig;
  bits: BitsAlertConfig;
  subs: SubsAlertConfig;
  giftSubs: GiftSubsAlertConfig;
  raids: RaidsAlertConfig;
  resubs: ResubsAlertConfig;
  hypeTrain: HypeTrainAlertConfig;
}

// ============================================
// TIPOS AUXILIARES
// ============================================

export interface AlertTestPayload {
  eventType: EventType;
  username?: string;
  amount?: number;
  subTier?: SubTier;
  months?: number;
  viewers?: number;
  level?: number;
}

export interface AlertQueueItem {
  id: string;
  eventType: EventType;
  config: BaseAlertConfig;
  data: {
    username?: string;
    amount?: number;
    [key: string]: any;
  };
  timestamp: number;
}

export type TabType =
  | 'global'
  | 'style'
  | 'follow'
  | 'bits'
  | 'subs'
  | 'giftSubs'
  | 'raids'
  | 'resubs'
  | 'hypeTrain'
  | 'media'
  | 'testing'
  | 'overlay';
