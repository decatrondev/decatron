/**
 * Default values for Tips Overlay Editor
 */

import type {
  TipsOverlayConfig,
  OverlayMediaElement,
  OverlayTextElement,
  OverlayCardElement,
  TipsAlertConfig,
  TipsBaseAlertConfig,
} from '../types';

export const DEFAULT_OVERLAY_CARD: OverlayCardElement = {
  x: 660,
  y: 290,
  width: 600,
  height: 500,
  enabled: true,
  backgroundColor: 'rgba(0, 0, 0, 0.9)',
  borderRadius: 24,
  borderColor: '#9146FF',
  borderWidth: 0,
  boxShadow: true,
  opacity: 100
};

export const DEFAULT_OVERLAY_MEDIA: OverlayMediaElement = {
  id: 'media-1',
  x: 690,
  y: 320,
  width: 540,
  height: 180,
  enabled: true,
  url: '',
  fit: 'contain',
  animationIn: 'zoomIn',
  animationOut: 'fadeOut',
  animationDuration: 500,
  zIndex: 10,
  videoVolume: 80,
  playVideoAudio: false
};

export const DEFAULT_OVERLAY_TEXT: OverlayTextElement = {
  id: 'text-1',
  x: 690,
  y: 520,
  width: 540,
  height: 100,
  enabled: true,
  template: '¡{donorName} donó {amount}!',
  fontFamily: 'Inter, sans-serif',
  fontSize: 36,
  fontWeight: 'bold',
  color: '#ffffff',
  textAlign: 'center',
  textShadow: true,
  animationIn: 'slideUp',
  animationOut: 'fadeOut',
  animationDuration: 500,
  zIndex: 20
};

export const DEFAULT_OVERLAY_TEXT_MESSAGE: OverlayTextElement = {
  id: 'text-2',
  x: 690,
  y: 640,
  width: 540,
  height: 120,
  enabled: true,
  template: '"{message}"',
  fontFamily: 'Inter, sans-serif',
  fontSize: 24,
  fontWeight: 'normal',
  color: '#e0e0e0',
  textAlign: 'center',
  textShadow: false,
  animationIn: 'fadeIn',
  animationOut: 'fadeOut',
  animationDuration: 500,
  zIndex: 21
};

export const DEFAULT_TIPS_OVERLAY_CONFIG: TipsOverlayConfig = {
  canvas: {
    width: 1920,
    height: 1080
  },
  card: DEFAULT_OVERLAY_CARD,
  media: DEFAULT_OVERLAY_MEDIA,
  texts: [DEFAULT_OVERLAY_TEXT, DEFAULT_OVERLAY_TEXT_MESSAGE],
  audio: {
    url: '',
    volume: 80,
    enabled: true
  },
  duration: 5000,
  animationIn: 'bounceIn',
  animationOut: 'fadeOut'
};

export const FONT_FAMILIES = [
  'Inter, sans-serif',
  'Roboto, sans-serif',
  'Montserrat, sans-serif',
  'Poppins, sans-serif',
  'Open Sans, sans-serif',
  'Lato, sans-serif',
  'Oswald, sans-serif',
  'Bebas Neue, sans-serif',
];

export const ANIMATIONS_IN = [
  { value: 'none', label: 'Ninguna' },
  { value: 'fadeIn', label: 'Fade In' },
  { value: 'slideUp', label: 'Slide Up' },
  { value: 'slideDown', label: 'Slide Down' },
  { value: 'slideLeft', label: 'Slide Left' },
  { value: 'slideRight', label: 'Slide Right' },
  { value: 'zoomIn', label: 'Zoom In' },
  { value: 'bounceIn', label: 'Bounce In' },
  { value: 'rotateIn', label: 'Rotate In' },
];

export const ANIMATIONS_OUT = [
  { value: 'none', label: 'Ninguna' },
  { value: 'fadeOut', label: 'Fade Out' },
  { value: 'slideUp', label: 'Slide Up' },
  { value: 'slideDown', label: 'Slide Down' },
  { value: 'slideLeft', label: 'Slide Left' },
  { value: 'slideRight', label: 'Slide Right' },
  { value: 'zoomOut', label: 'Zoom Out' },
  { value: 'bounceOut', label: 'Bounce Out' },
  { value: 'rotateOut', label: 'Rotate Out' },
];

// Default base alert config for new tips alert system
export const DEFAULT_TIPS_BASE_ALERT: TipsBaseAlertConfig = {
  enabled: true,
  message: '¡{donorName} donó {amount}!',
  duration: 5,
  media: {
    enabled: false,
    mode: 'simple',
  },
  animation: {
    type: 'bounce',
    direction: 'center',
    duration: 500,
    easing: 'ease-in-out',
  },
  sound: '',
  volume: 80,
  effects: {
    enabled: false,
    effects: [],
  },
  tts: {
    enabled: false,
    voice: 'Lupe',
    engine: 'standard',
    languageCode: 'es-US',
    template: '¡Gracias {donorName} por donar {amount}!',
    templateVolume: 80,
    readUserMessage: true,
    userMessageVolume: 80,
    maxChars: 150,
    waitForSound: true,
  },
  chatMessage: {
    enabled: false,
    template: '¡Gracias @{donorName} por la donación de {amount}! 💜',
  },
};

// Default full tips alert config
export const DEFAULT_TIPS_ALERT_CONFIG: TipsAlertConfig = {
  enabled: true,
  baseAlert: DEFAULT_TIPS_BASE_ALERT,
  tiers: [],
  cooldown: 0,
};
