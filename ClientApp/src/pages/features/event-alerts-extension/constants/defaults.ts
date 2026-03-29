import type {
  GlobalAlertsConfig,
  FollowAlertConfig,
  BitsAlertConfig,
  SubsAlertConfig,
  GiftSubsAlertConfig,
  RaidsAlertConfig,
  ResubsAlertConfig,
  HypeTrainAlertConfig,
  EventAlertsConfig,
  BaseAlertConfig,
  AnimationConfig,
  EffectsConfig,
  AlertMediaConfig,
  TtsConfig,
  AlertStyleConfig,
  AntiSpamConfig,
  // Nuevos tipos para per-event overlay
  EventOverlayConfig,
  OverlayMediaElement,
  OverlayTextElement,
  OverlayAudioConfig,
  PerEventOverlayConfig,
} from '../types/index';

// ============================================
// TEMPLATES PREDEFINIDOS POR EVENTO
// ============================================

/** Templates de mensaje visual (texto en pantalla) */
export const MESSAGE_TEMPLATES = {
  // Follow
  follow: '¡Gracias {username} por el follow! ❤️',

  // Bits
  bits: {
    base: '¡Gracias {username} por los {amount} bits! 💎',
    tier1: '¡{username} donó {amount} bits! 💎',
    tier2: '¡WOW! {username} donó {amount} bits! 💎✨',
    tier3: '💥 ¡{username} ÉPICO con {amount} bits! 💥',
  },

  // Subs
  subs: {
    prime: '¡Gracias {username} por la sub Prime! 👑',
    tier1: '¡Gracias {username} por la sub! ⭐',
    tier2: '¡Gracias {username} por la sub Tier 2! ⭐⭐',
    tier3: '¡GRACIAS {username} por la sub Tier 3! ⭐⭐⭐',
  },

  // Gift Subs
  giftSubs: {
    base: '¡{username} regaló {amount} subs! 🎁',
    tier1: '¡{username} regaló {amount} sub(s)! 🎁',
    tier2: '¡WOW! {username} regaló {amount} subs! 🎁✨',
    tier3: '💥 ¡{username} ÉPICO! {amount} subs regaladas! 💥',
  },

  // Raids
  raids: {
    base: '¡{username} raideó con {viewers} viewers! 🚀',
    tier1: '¡{username} raideó con {viewers} viewers! 🚀',
    tier2: '¡WOW! {username} raideó con {viewers} viewers! 🚀✨',
    tier3: '💥 ¡RAID MASIVO de {username} con {viewers} viewers! 💥',
  },

  // Resubs
  resubs: {
    base: '¡{username} resub - {months} meses! 🎉',
    tier1: '¡{username} resub - {months} meses! 🎉',
    tier2: '¡{username} veterano - {months} meses! 🎉⭐',
    tier3: '👑 ¡{username} LEGENDARIO - {months} meses! 👑',
  },

  // Hype Train
  hypeTrain: {
    level1: '🔥 ¡Hype Train nivel 1 iniciado! 🔥',
    level2: '🔥 ¡Hype Train nivel 2! 🔥',
    level3: '🔥 ¡Hype Train nivel 3! 🔥',
    level4: '🔥 ¡Hype Train nivel 4! 🔥',
    level5: '🔥 ¡HYPE TRAIN NIVEL 5 MÁXIMO! 🔥',
    completed: '💥 ¡HYPE TRAIN COMPLETADO! 💥',
  },
} as const;

/** Templates de TTS (texto que se lee en voz alta) */
export const TTS_TEMPLATES = {
  // Follow
  follow: '¡Gracias {username} por el follow!',

  // Bits
  bits: {
    base: '¡Gracias {username} por los {amount} bits!',
    tier1: '¡Gracias {username} por los {amount} bits!',
    tier2: '¡Wow! ¡{username} donó {amount} bits!',
    tier3: '¡Increíble! ¡{username} donó {amount} bits!',
  },

  // Subs
  subs: {
    prime: '¡Gracias {username} por la sub Prime!',
    tier1: '¡Gracias {username} por suscribirte!',
    tier2: '¡Gracias {username} por la sub Tier 2!',
    tier3: '¡Increíble! ¡Gracias {username} por la sub Tier 3!',
  },

  // Gift Subs
  giftSubs: {
    base: '¡Gracias {username} por regalar {amount} subs!',
    tier1: '¡Gracias {username} por regalar {amount} subs!',
    tier2: '¡Wow! ¡{username} regaló {amount} subs!',
    tier3: '¡Increíble! ¡{username} regaló {amount} subs!',
  },

  // Raids
  raids: {
    base: '¡{username} raideó con {viewers} viewers!',
    tier1: '¡Bienvenidos! ¡{username} raideó con {viewers} viewers!',
    tier2: '¡Wow! ¡{username} raideó con {viewers} personas!',
    tier3: '¡Raid masivo! ¡{username} llegó con {viewers} personas!',
  },

  // Resubs
  resubs: {
    base: '¡Gracias {username} por {months} meses de apoyo!',
    tier1: '¡Gracias {username} por {months} meses!',
    tier2: '¡{username} lleva {months} meses apoyando!',
    tier3: '¡Increíble! ¡{username} lleva {months} meses! ¡Leyenda!',
  },

  // Hype Train
  hypeTrain: {
    level1: '¡Hype Train nivel uno!',
    level2: '¡Hype Train nivel dos!',
    level3: '¡Hype Train nivel tres! ¡Vamos!',
    level4: '¡Hype Train nivel cuatro! ¡No paren!',
    level5: '¡Nivel cinco! ¡Hype Train al máximo!',
    completed: '¡Hype Train completado! ¡Increíble chat!',
  },
} as const;

/** Variables disponibles por tipo de evento */
export const EVENT_VARIABLES = {
  follow: '{username}',
  bits: '{username}, {amount}',
  subs: '{username}, {tier}',
  giftSubs: '{username}, {amount}',
  raids: '{username}, {viewers}',
  resubs: '{username}, {months}, {tier}',
  hypeTrain: '{level}',
} as const;

/** Templates de mensaje del bot en chat */
export const CHAT_TEMPLATES = {
  follow: '¡Bienvenido {username}! Gracias por el follow 💜',
  bits: {
    base: '¡Gracias {username} por los {amount} bits! 💎',
    tier1: '¡{username} donó {amount} bits! 💎',
    tier2: '¡WOW! ¡{username} con {amount} bits! 💎✨',
    tier3: '🎉 ¡INCREÍBLE! ¡{username} donó {amount} bits! 🎉',
  },
  subs: {
    prime: '¡Gracias {username} por la sub Prime! 👑',
    tier1: '¡Bienvenido {username} a la familia! ⭐',
    tier2: '¡{username} se unió con Tier 2! ⭐⭐',
    tier3: '¡ÉPICO! ¡{username} con Tier 3! ⭐⭐⭐',
  },
  giftSubs: {
    base: '¡{username} regaló {amount} subs! ¡Gracias! 🎁',
    tier1: '¡Gracias {username} por regalar {amount} sub(s)! 🎁',
    tier2: '¡WOW! ¡{username} regaló {amount} subs! 🎁✨',
    tier3: '🎉 ¡{username} regaló {amount} subs! ¡INCREÍBLE! 🎉',
  },
  raids: {
    base: '¡Bienvenidos raiders de {username}! ({viewers} viewers) 🚀',
    tier1: '¡{username} llegó con {viewers} amigos! 🚀',
    tier2: '¡WOW! ¡{username} nos trae {viewers} viewers! 🚀✨',
    tier3: '🎉 ¡RAID MASIVO! ¡{username} con {viewers} personas! 🎉',
  },
  resubs: {
    base: '¡{username} renueva su sub! ({months} meses) 🎉',
    tier1: '¡Gracias {username} por {months} meses de apoyo! 🎉',
    tier2: '¡{username} lleva {months} meses! ¡Veterano! 🎉⭐',
    tier3: '👑 ¡{username} - {months} MESES! ¡LEYENDA! 👑',
  },
  hypeTrain: {
    level1: '🔥 ¡HYPE TRAIN NIVEL 1! ¡Vamos! 🔥',
    level2: '🔥 ¡NIVEL 2! ¡Sigan así! 🔥',
    level3: '🔥 ¡NIVEL 3! ¡NO PAREN! 🔥',
    level4: '🔥 ¡NIVEL 4! ¡CASI LLEGAMOS! 🔥',
    level5: '🔥🔥🔥 ¡NIVEL 5 MÁXIMO! 🔥🔥🔥',
    completed: '🏆 ¡HYPE TRAIN COMPLETADO! ¡INCREÍBLE CHAT! 🏆',
  },
} as const;

// ============================================
// DEFAULTS DE COMPONENTES REUTILIZABLES
// ============================================

export const DEFAULT_ALERT_STYLE: AlertStyleConfig = {
  width: 600,
  height: 500,
  backgroundType: 'color',
  backgroundColor: 'rgba(0,0,0,0.85)',
  backgroundGradient: { color1: '#1a1a2e', color2: '#16213e', angle: 135 },
  backgroundImage: '',
  opacity: 100,
  borderEnabled: true,
  borderColor: 'rgba(255,255,255,0.2)',
  borderWidth: 2,
  borderRadius: 24,
  padding: 30,
  mediaLayout: 'top',
  mediaObjectFit: 'contain',
  fontFamily: 'Inter, sans-serif',
  fontSize: 26,
  fontWeight: 'bold',
  textColor: '#ffffff',
  textShadow: 'normal',
  textAlign: 'center',
};

export const DEFAULT_ANIMATION: AnimationConfig = {
  type: 'fade',
  direction: 'center',
  duration: 500,
  easing: 'ease-in-out',
};

export const DEFAULT_EFFECTS: EffectsConfig = {
  enabled: false,
  effects: [],
};

export const DEFAULT_MEDIA: AlertMediaConfig = {
  enabled: false,
  mode: 'simple',
};

export const DEFAULT_TTS: TtsConfig = {
  enabled: false,
  voice: 'Lupe',
  engine: 'standard',
  languageCode: 'es-US',

  // Template TTS
  template: '',
  templateVolume: 80,

  // User Message TTS
  readUserMessage: false,
  userMessageVolume: 80,
  maxChars: 150,

  waitForSound: true,  // Por defecto: TTS espera que el sonido de alerta termine
};

const tts = (template: string): TtsConfig => ({ ...DEFAULT_TTS, template });

export const DEFAULT_BASE_ALERT: BaseAlertConfig = {
  enabled: true,
  message: '¡Gracias {username}!',
  duration: 5,
  media: DEFAULT_MEDIA,
  animation: DEFAULT_ANIMATION,
  sound: '',
  volume: 50,
  effects: DEFAULT_EFFECTS,
  tts: DEFAULT_TTS,
  position: {
    x: 50,
    y: 50,
  },
  // Video audio settings
  playVideoAudio: false,
  videoVolume: 80,
};

// ============================================
// GLOBAL CONFIG
// ============================================

export const DEFAULT_GLOBAL_CONFIG: GlobalAlertsConfig = {
  enabled: true,
  defaultDuration: 5,
  defaultAnimation: 'fade',
  defaultAnimationDirection: 'center',
  queueSettings: {
    enabled: true,
    maxQueueSize: 10,
    delayBetweenAlerts: 1000,
    showQueueCounter: true,
  },
  defaultPosition: {
    x: 960, // Centro horizontal (1920/2)
    y: 540, // Centro vertical (1080/2)
  },
  defaultSound: '',
  defaultVolume: 50,
  cooldownSettings: {
    globalCooldown: 0,
    perEventCooldown: 5,
  },
  canvas: {
    width: 1920,
    height: 1080,
  },
  tts: DEFAULT_TTS,
  defaultStyle: DEFAULT_ALERT_STYLE,
  overlayElements: {
    card: {
      x: 660, // (1920-600)/2 = centro
      y: 290, // (1080-500)/2 = centro
      width: 600,
      height: 500,
      enabled: true,
    },
    media: {
      x: 690, // 30px margen desde card.x
      y: 320, // 30px margen desde card.y
      width: 540, // card.width - 60px
      height: 220, // ~44% del card - espacio para media
      enabled: true,
    },
    text: {
      x: 690, // 30px margen desde card.x
      y: 560, // debajo del media (320 + 220 + 20px gap)
      width: 540, // card.width - 60px
      height: 200, // ~40% del card - espacio para texto
      enabled: true,
    },
  },
};

// ============================================
// FOLLOW CONFIG
// ============================================

export const DEFAULT_FOLLOW_CONFIG: FollowAlertConfig = {
  enabled: true,
  alert: {
    ...DEFAULT_BASE_ALERT,
    message: '¡Gracias {username} por el follow! ❤️',
    tts: tts('¡Gracias {username} por el follow!'),
  },
  cooldown: 5,
  antiSpam: {
    enabled: true,
    perUserCooldown: 86400, // 24 horas por defecto
  },
};

// ============================================
// BITS CONFIG
// ============================================

export const DEFAULT_BITS_CONFIG: BitsAlertConfig = {
  enabled: true,
  baseAlert: {
    ...DEFAULT_BASE_ALERT,
    message: '¡Gracias {username} por los {amount} bits! 💎',
    tts: tts('¡Gracias {username} por los {amount} bits!'),
  },
  tiers: [
    {
      id: 'bits-tier-1',
      name: 'Básico',
      enabled: true,
      condition: { type: 'range', min: 0, max: 100 },
      message: '¡{username} donó {amount} bits!',
      duration: 5,
      media: { enabled: false, mode: 'simple' as const },
      animation: { type: 'slide', direction: 'left', duration: 500, easing: 'ease-in-out' },
      sound: '',
      volume: 50,
      effects: DEFAULT_EFFECTS,
      tts: tts('¡Gracias {username} por los {amount} bits!'),
    },
    {
      id: 'bits-tier-2',
      name: 'Medio',
      enabled: true,
      condition: { type: 'range', min: 101, max: 500 },
      message: '¡WOW! {username} donó {amount} bits! 💎',
      duration: 7,
      media: { enabled: false, mode: 'simple' as const },
      animation: { type: 'zoom', direction: 'center', duration: 600, easing: 'ease-in-out' },
      sound: '',
      volume: 60,
      effects: { enabled: true, effects: ['glow', 'shake'] },
      tts: tts('¡Wow! ¡{username} donó {amount} bits!'),
    },
    {
      id: 'bits-tier-3',
      name: 'Épico',
      enabled: true,
      condition: { type: 'minimum', min: 501 },
      message: '💥 ¡{username} ÉPICO con {amount} bits! 💥',
      duration: 10,
      media: { enabled: false, mode: 'simple' as const },
      animation: { type: 'bounce', direction: 'center', duration: 800, easing: 'ease-in-out' },
      sound: '',
      volume: 80,
      effects: { enabled: true, effects: ['glow', 'shake', 'confetti'] },
      tts: tts('¡Increíble! ¡{username} donó {amount} bits!'),
    },
  ],
  cooldown: 5,
};

// ============================================
// SUBS CONFIG
// ============================================

export const DEFAULT_SUBS_CONFIG: SubsAlertConfig = {
  enabled: true,
  subTypes: {
    prime: {
      ...DEFAULT_BASE_ALERT,
      message: '¡Gracias {username} por la sub Prime! 👑',
      tts: tts('¡Gracias {username} por la sub Prime!'),
    },
    tier1: {
      ...DEFAULT_BASE_ALERT,
      message: '¡Gracias {username} por la sub T1! ⭐',
      tts: tts('¡Gracias {username} por suscribirte!'),
    },
    tier2: {
      ...DEFAULT_BASE_ALERT,
      message: '¡Gracias {username} por la sub T2! ⭐⭐',
      duration: 7,
      effects: { enabled: true, effects: ['glow'] },
      tts: tts('¡Gracias {username} por la sub Tier 2!'),
    },
    tier3: {
      ...DEFAULT_BASE_ALERT,
      message: '¡GRACIAS {username} por la sub T3! ⭐⭐⭐',
      duration: 10,
      effects: { enabled: true, effects: ['glow', 'confetti'] },
      tts: tts('¡Increíble! ¡Gracias {username} por la sub Tier 3!'),
    },
  },
  cooldown: 5,
};

// ============================================
// GIFT SUBS CONFIG
// ============================================

export const DEFAULT_GIFT_SUBS_CONFIG: GiftSubsAlertConfig = {
  enabled: true,
  baseAlert: {
    ...DEFAULT_BASE_ALERT,
    message: '¡{username} regaló {amount} subs! 🎁',
    tts: tts('¡Gracias {username} por regalar {amount} subs!'),
  },
  tiers: [
    {
      id: 'gift-tier-1',
      name: 'Básico',
      enabled: true,
      condition: { type: 'range', min: 1, max: 4 },
      message: '¡{username} regaló {amount} sub(s)! 🎁',
      duration: 5,
      media: { enabled: false, mode: 'simple' as const },
      animation: DEFAULT_ANIMATION,
      sound: '',
      volume: 50,
      effects: DEFAULT_EFFECTS,
      tts: tts('¡Gracias {username} por regalar {amount} subs!'),
    },
    {
      id: 'gift-tier-2',
      name: 'Especial',
      enabled: true,
      condition: { type: 'range', min: 5, max: 9 },
      message: '¡WOW! {username} regaló {amount} subs! 🎁✨',
      duration: 7,
      media: { enabled: false, mode: 'simple' as const },
      animation: { type: 'zoom', direction: 'center', duration: 600, easing: 'ease-in-out' },
      sound: '',
      volume: 60,
      effects: { enabled: true, effects: ['glow'] },
      tts: tts('¡Wow! ¡{username} regaló {amount} subs!'),
    },
    {
      id: 'gift-tier-3',
      name: 'Épico',
      enabled: true,
      condition: { type: 'minimum', min: 10 },
      message: '💥 ¡{username} ÉPICO! {amount} subs regaladas! 💥',
      duration: 10,
      media: { enabled: false, mode: 'simple' as const },
      animation: { type: 'bounce', direction: 'center', duration: 800, easing: 'ease-in-out' },
      sound: '',
      volume: 80,
      effects: { enabled: true, effects: ['glow', 'confetti', 'fireworks'] },
      tts: tts('¡Increíble! ¡{username} regaló {amount} subs!'),
    },
  ],
  cooldown: 5,
};

// ============================================
// RAIDS CONFIG
// ============================================

export const DEFAULT_RAIDS_CONFIG: RaidsAlertConfig = {
  enabled: true,
  baseAlert: {
    ...DEFAULT_BASE_ALERT,
    message: '¡{username} raideó con {viewers} viewers! 🚀',
    tts: tts('¡{username} raideó con {viewers} viewers!'),
  },
  tiers: [
    {
      id: 'raid-tier-1',
      name: 'Pequeño',
      enabled: true,
      condition: { type: 'range', min: 1, max: 10 },
      message: '¡{username} raideó con {viewers} viewers! 🚀',
      duration: 5,
      media: { enabled: false, mode: 'simple' as const },
      animation: DEFAULT_ANIMATION,
      sound: '',
      volume: 50,
      effects: DEFAULT_EFFECTS,
      tts: tts('¡Bienvenidos! ¡{username} raideó con {viewers} viewers!'),
    },
    {
      id: 'raid-tier-2',
      name: 'Medio',
      enabled: true,
      condition: { type: 'range', min: 11, max: 50 },
      message: '¡WOW! {username} raideó con {viewers} viewers! 🚀✨',
      duration: 7,
      media: { enabled: false, mode: 'simple' as const },
      animation: { type: 'slide', direction: 'right', duration: 600, easing: 'ease-in-out' },
      sound: '',
      volume: 60,
      effects: { enabled: true, effects: ['glow', 'shake'] },
      tts: tts('¡Wow! ¡{username} raideó con {viewers} personas!'),
    },
    {
      id: 'raid-tier-3',
      name: 'Masivo',
      enabled: true,
      condition: { type: 'minimum', min: 51 },
      message: '💥 ¡RAID MASIVO de {username} con {viewers} viewers! 💥',
      duration: 10,
      media: { enabled: false, mode: 'simple' as const },
      animation: { type: 'bounce', direction: 'center', duration: 800, easing: 'ease-in-out' },
      sound: '',
      volume: 80,
      effects: { enabled: true, effects: ['glow', 'shake', 'confetti', 'fireworks'] },
      tts: tts('¡Raid masivo! ¡{username} llegó con {viewers} personas!'),
    },
  ],
  cooldown: 5,
};

// ============================================
// RESUBS CONFIG
// ============================================

export const DEFAULT_RESUBS_CONFIG: ResubsAlertConfig = {
  enabled: true,
  baseAlert: {
    ...DEFAULT_BASE_ALERT,
    message: '¡{username} resub - {months} meses! 🎉',
    tts: tts('¡Gracias {username} por {months} meses de apoyo!'),
  },
  tiers: [
    {
      id: 'resub-tier-1',
      name: 'Nuevo',
      enabled: true,
      condition: { type: 'range', min: 1, max: 3 },
      message: '¡{username} resub - {months} meses! 🎉',
      duration: 5,
      media: { enabled: false, mode: 'simple' as const },
      animation: DEFAULT_ANIMATION,
      sound: '',
      volume: 50,
      effects: DEFAULT_EFFECTS,
      tts: tts('¡Gracias {username} por {months} meses!'),
    },
    {
      id: 'resub-tier-2',
      name: 'Veterano',
      enabled: true,
      condition: { type: 'range', min: 4, max: 12 },
      message: '¡{username} veterano - {months} meses! 🎉⭐',
      duration: 7,
      media: { enabled: false, mode: 'simple' as const },
      animation: { type: 'zoom', direction: 'center', duration: 600, easing: 'ease-in-out' },
      sound: '',
      volume: 60,
      effects: { enabled: true, effects: ['glow'] },
      tts: tts('¡{username} lleva {months} meses apoyando!'),
    },
    {
      id: 'resub-tier-3',
      name: 'Legendario',
      enabled: true,
      condition: { type: 'minimum', min: 13 },
      message: '👑 ¡{username} LEGENDARIO - {months} meses! 👑',
      duration: 10,
      media: { enabled: false, mode: 'simple' as const },
      animation: { type: 'bounce', direction: 'center', duration: 800, easing: 'ease-in-out' },
      sound: '',
      volume: 80,
      effects: { enabled: true, effects: ['glow', 'confetti', 'fireworks'] },
      tts: tts('¡Increíble! ¡{username} lleva {months} meses! ¡Leyenda!'),
    },
  ],
  cooldown: 5,
};

// ============================================
// HYPE TRAIN CONFIG
// ============================================

export const DEFAULT_HYPE_TRAIN_CONFIG: HypeTrainAlertConfig = {
  enabled: true,
  levels: {
    1: {
      ...DEFAULT_BASE_ALERT,
      message: '🔥 ¡Hype Train nivel 1 iniciado! 🔥',
      duration: 5,
      tts: tts('¡Hype Train nivel uno!'),
    },
    2: {
      ...DEFAULT_BASE_ALERT,
      message: '🔥 ¡Hype Train nivel 2! 🔥',
      duration: 5,
      tts: tts('¡Hype Train nivel dos!'),
    },
    3: {
      ...DEFAULT_BASE_ALERT,
      message: '🔥 ¡Hype Train nivel 3! 🔥',
      duration: 6,
      effects: { enabled: true, effects: ['glow'] },
      tts: tts('¡Hype Train nivel tres! ¡Vamos!'),
    },
    4: {
      ...DEFAULT_BASE_ALERT,
      message: '🔥 ¡Hype Train nivel 4! 🔥',
      duration: 7,
      effects: { enabled: true, effects: ['glow', 'shake'] },
      tts: tts('¡Hype Train nivel cuatro! ¡No paren!'),
    },
    5: {
      ...DEFAULT_BASE_ALERT,
      message: '🔥 ¡HYPE TRAIN NIVEL 5 MÁXIMO! 🔥',
      duration: 8,
      effects: { enabled: true, effects: ['glow', 'shake', 'confetti'] },
      tts: tts('¡Nivel cinco! ¡Hype Train al máximo!'),
    },
  },
  completionAlert: {
    ...DEFAULT_BASE_ALERT,
    message: '💥 ¡HYPE TRAIN COMPLETADO! 💥',
    duration: 10,
    animation: { type: 'bounce', direction: 'center', duration: 800, easing: 'ease-in-out' },
    effects: { enabled: true, effects: ['glow', 'shake', 'confetti', 'fireworks'] },
    tts: tts('¡Hype Train completado! ¡Increíble chat!'),
  },
  cooldown: 10,
};

// ============================================
// CONFIGURACIÓN COMPLETA POR DEFECTO
// ============================================

export const DEFAULT_EVENT_ALERTS_CONFIG: EventAlertsConfig = {
  global: DEFAULT_GLOBAL_CONFIG,
  follow: DEFAULT_FOLLOW_CONFIG,
  bits: DEFAULT_BITS_CONFIG,
  subs: DEFAULT_SUBS_CONFIG,
  giftSubs: DEFAULT_GIFT_SUBS_CONFIG,
  raids: DEFAULT_RAIDS_CONFIG,
  resubs: DEFAULT_RESUBS_CONFIG,
  hypeTrain: DEFAULT_HYPE_TRAIN_CONFIG,
};

// ============================================
// PER-EVENT OVERLAY DEFAULTS (Nuevo sistema drag-and-drop)
// ============================================

export const DEFAULT_OVERLAY_AUDIO: OverlayAudioConfig = {
  enabled: false,
  url: '',
  volume: 80,
  delay: 0,
};

export const DEFAULT_OVERLAY_MEDIA: OverlayMediaElement = {
  id: 'media-1',
  type: 'media',
  enabled: false, // Deshabilitado por defecto hasta que se suba media
  x: 710,
  y: 290,
  width: 500,
  height: 350,
  zIndex: 1,
  animationIn: 'fadeIn',
  animationOut: 'fadeOut',
  animationDuration: 500,
  url: '', // Sin URL = no hay media
  fit: 'contain',
  opacity: 100,
  playVideoAudio: true,
  videoVolume: 80,
};

export const DEFAULT_OVERLAY_TEXT: OverlayTextElement = {
  id: 'text-1',
  type: 'text',
  enabled: true,
  x: 660, // Centrado en canvas 1920 (1920-600)/2
  y: 490, // Centrado vertical en canvas 1080 (1080-100)/2
  width: 600,
  height: 100,
  zIndex: 2,
  animationIn: 'fadeIn',
  animationOut: 'fadeOut',
  animationDuration: 500,
  template: '{usuario} te ha seguido!',
  fontFamily: 'Inter, sans-serif',
  fontSize: 48,
  fontWeight: 'bold',
  color: '#ffffff',
  textAlign: 'center',
  textShadow: true,
  textShadowColor: 'rgba(0,0,0,0.8)',
  textShadowBlur: 4,
  backgroundColor: 'transparent',
  borderRadius: 8,
  padding: 12,
};

// Factory para crear configuración de evento con template personalizado
const createEventOverlayConfig = (
  textTemplate: string,
  hasTierAudio: boolean = false
): EventOverlayConfig => ({
  enabled: true,
  duration: 5000,
  media: { ...DEFAULT_OVERLAY_MEDIA },
  texts: [
    { ...DEFAULT_OVERLAY_TEXT, id: 'text-1', template: textTemplate },
  ],
  audio: { ...DEFAULT_OVERLAY_AUDIO },
  ...(hasTierAudio && {
    tierAudio: {
      prime: { ...DEFAULT_OVERLAY_AUDIO },
      tier1: { ...DEFAULT_OVERLAY_AUDIO },
      tier2: { ...DEFAULT_OVERLAY_AUDIO },
      tier3: { ...DEFAULT_OVERLAY_AUDIO },
    },
  }),
});

export const DEFAULT_PER_EVENT_OVERLAY: PerEventOverlayConfig = {
  follow: createEventOverlayConfig('¡{usuario} te ha seguido! ❤️'),
  subscription: createEventOverlayConfig('¡Gracias {usuario} por suscribirte! ⭐ ({tier})', true),
  giftSub: createEventOverlayConfig('¡{usuario} regaló {cantidad} subs! 🎁'),
  raid: createEventOverlayConfig('¡{usuario} trae {viewers} viewers! 🚀'),
  bits: createEventOverlayConfig('¡{usuario} donó {bits} bits! 💎'),
  channelPoints: createEventOverlayConfig('¡{usuario} canjeó {recompensa}! 🎯'),
  tts: createEventOverlayConfig('💬 {usuario}: {mensaje}'),
};
