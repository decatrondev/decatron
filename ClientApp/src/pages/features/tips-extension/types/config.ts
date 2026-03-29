/**
 * Types for TipsConfig orchestration
 * Extracted from TipsConfig.tsx
 */

import type { TtsConfig } from '../../event-alerts-extension/types/index';
import type { TipsOverlayConfig, TipsAlertConfig } from './index';

export interface TipsSettings {
    isEnabled: boolean;
    paypalConnected: boolean;
    paypalEmail: string;
    isProduction: boolean;

    // Amounts
    minAmount: number;
    maxAmount: number;
    currency: string;
    suggestedAmounts: string;

    // Donation page
    pageTitle: string;
    pageDescription: string;
    pageAccentColor: string;
    pageBackgroundImage: string;

    // Alert config (JSON string)
    alertConfig: string;

    // Alert mode: 'timer' = usar sistema del Timer, 'basic' = alertas independientes
    alertMode: 'timer' | 'basic';

    // Basic alert settings (when alertMode === 'basic')
    basicAlertSound: string;
    basicAlertVolume: number;
    basicAlertDuration: number;
    basicAlertAnimation: 'fade' | 'slide' | 'bounce' | 'zoom';
    basicAlertMessage: string;

    // TTS for basic alerts
    basicAlertTts: TtsConfig;

    // Overlay config for basic alerts
    basicAlertOverlay: TipsOverlayConfig;

    // New tips alert config (full system with tiers and variants)
    tipsAlertConfig: TipsAlertConfig;

    // Timer integration
    timerIntegrationEnabled: boolean;
    secondsPerCurrency: number;
    timeUnit: 'seconds' | 'minutes' | 'hours' | 'days';

    // Security
    maxMessageLength: number;
    cooldownSeconds: number;
    badWordsFilter: boolean;
    requireMessage: boolean;
}

export interface TipStatistics {
    totalAmount: number;
    totalCount: number;
    averageAmount: number;
    largestTip: number;
    topDonor: string | null;
    topDonorTotal: number;
    totalTimeAdded: number;
    formattedTimeAdded: string;
}

export interface RecentTip {
    id: number;
    donorName: string;
    amount: number;
    currency: string;
    message: string | null;
    timeAdded: number;
    donatedAt: string;
}

export const CURRENCIES = [
    { code: 'USD', symbol: '$', name: 'Dólar estadounidense' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'Libra esterlina' },
    { code: 'MXN', symbol: '$', name: 'Peso mexicano' },
    { code: 'ARS', symbol: '$', name: 'Peso argentino' },
    { code: 'COP', symbol: '$', name: 'Peso colombiano' },
    { code: 'CLP', symbol: '$', name: 'Peso chileno' },
    { code: 'BRL', symbol: 'R$', name: 'Real brasileño' },
    { code: 'PEN', symbol: 'S/', name: 'Sol peruano' },
];
