/**
 * Types for Tips Overlay Editor
 * Updated to match Event Alerts system with tiers and variants
 */

import type { AlertMediaConfig } from '../../../../types/timer-alerts';
import type {
  TtsConfig,
  TierCondition,
  AnimationConfig,
  EffectsConfig,
  VariantsConfig,
  ChatMessageConfig,
} from '../../event-alerts-extension/types/index';

// Re-export for convenience
export type { TtsConfig, TierCondition, AnimationConfig, EffectsConfig, VariantsConfig, ChatMessageConfig };

export type OverlayAnimationType =
  | 'none'
  | 'fadeIn' | 'fadeOut'
  | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight'
  | 'zoomIn' | 'zoomOut'
  | 'bounceIn' | 'bounceOut'
  | 'rotateIn' | 'rotateOut';

export interface OverlayPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  enabled: boolean;
}

export interface OverlayMediaElement extends OverlayPosition {
  id: string;
  url: string;
  fit: 'cover' | 'contain' | 'fill';
  animationIn: OverlayAnimationType;
  animationOut: OverlayAnimationType;
  animationDuration: number;
  zIndex: number;
  videoVolume: number;
  playVideoAudio: boolean;
}

export interface OverlayTextElement extends OverlayPosition {
  id: string;
  template: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  textShadow: boolean;
  animationIn: OverlayAnimationType;
  animationOut: OverlayAnimationType;
  animationDuration: number;
  zIndex: number;
}

export interface OverlayCardElement extends OverlayPosition {
  backgroundColor: string;
  borderRadius: number;
  borderColor: string;
  borderWidth: number;
  boxShadow: boolean;
  opacity: number;
}

export interface TipsOverlayConfig {
  canvas: {
    width: number;
    height: number;
  };
  card: OverlayCardElement;
  media: OverlayMediaElement;
  texts: OverlayTextElement[];
  audio: {
    url: string;
    volume: number;
    enabled: boolean;
  };
  duration: number;
  animationIn: OverlayAnimationType;
  animationOut: OverlayAnimationType;
}

// ============================================
// TIER CONFIGURATION FOR TIPS (by amount)
// ============================================

export interface TipsTier {
  id: string;
  name: string;
  enabled: boolean;
  condition: TierCondition;
  message: string;
  duration: number;
  media: AlertMediaConfig;
  animation: AnimationConfig;
  sound: string;
  volume: number;
  effects: EffectsConfig;
  tts: TtsConfig;
  chatMessage?: ChatMessageConfig;
  playVideoAudio?: boolean;
  videoVolume?: number;
  variants?: VariantsConfig;
}

// ============================================
// BASE ALERT CONFIG FOR TIPS
// ============================================

export interface TipsBaseAlertConfig {
  enabled: boolean;
  message: string;
  duration: number;
  media: AlertMediaConfig;
  animation: AnimationConfig;
  sound: string;
  volume: number;
  effects: EffectsConfig;
  tts: TtsConfig;
  chatMessage?: ChatMessageConfig;
  playVideoAudio?: boolean;
  videoVolume?: number;
  variants?: VariantsConfig;
}

// ============================================
// FULL TIPS ALERT CONFIG (matches Event Alerts)
// ============================================

export interface TipsAlertConfig {
  enabled: boolean;
  baseAlert: TipsBaseAlertConfig;
  tiers: TipsTier[];
  cooldown: number;
}

// Variables available for tips
export const TIPS_VARIABLES = ['{donorName}', '{amount}', '{message}', '{time}', '{currency}'];

// Preview data for tips
export const TIPS_PREVIEW_DATA = {
  donorName: 'TestUser',
  amount: '$10.00',
  message: '¡Gracias por el stream!',
  time: '+5:00',
  currency: 'USD'
};

// Message templates for tips tiers
export const TIPS_MESSAGE_TEMPLATES = {
  base: '¡{donorName} donó {amount}!',
  tier1: '🥉 ¡{donorName} donó {amount}!',
  tier2: '🥈 ¡{donorName} donó {amount}! ¡Eres genial!',
  tier3: '🥇 ¡MEGA DONACIÓN! {donorName} donó {amount}! ¡Increíble!'
};

// TTS templates for tips tiers
export const TIPS_TTS_TEMPLATES = {
  base: '¡Gracias {donorName} por donar {amount}!',
  tier1: '¡{donorName} donó {amount}!',
  tier2: '¡{donorName} donó {amount}! ¡Muchas gracias!',
  tier3: '¡Mega donación! {donorName} donó {amount}! ¡Eres increíble!'
};

// Chat message templates for tips
export const TIPS_CHAT_TEMPLATES = {
  base: '¡Gracias @{donorName} por la donación de {amount}! 💜',
  tier1: '¡@{donorName} donó {amount}! 🎉',
  tier2: '¡@{donorName} donó {amount}! ¡Muchísimas gracias! 🌟',
  tier3: '¡MEGA DONACIÓN! @{donorName} donó {amount}! ¡ERES INCREÍBLE! 🎆'
};
