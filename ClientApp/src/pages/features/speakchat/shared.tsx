// Valores y piezas que comparten las pestañas de Speak Chat.
import {
    DEFAULT_PREMIUM_VOICE,
    DEFAULT_LANGUAGE_CODE,
    DEFAULT_POLLY_ENGINE,
} from '../../../components/tts/voiceDefaults';
import type { CreditUsage, RoleConfig, SpeakChatConfigData } from './types';

// ===================== DEFAULTS =====================

export const defaultRoles: RoleConfig = { everyone: true, subscriber: false, vip: false, moderator: false, broadcaster: true };

export const defaultConfig: SpeakChatConfigData = {
    global: { enabled: false },
    activation: {
        rules: [
            { type: 'command', enabled: false, commandName: '!tts', roles: { ...defaultRoles } },
            { type: 'bits', enabled: false, minBits: 100, roles: { ...defaultRoles } },
            { type: 'channelPoints', enabled: false, rewardId: '', roles: { ...defaultRoles } },
            { type: 'roles', enabled: false, roles: { everyone: false, subscriber: true, vip: true, moderator: true, broadcaster: true } },
            { type: 'all', enabled: false },
        ]
    },
    voice: {
        engine: 'piper',
        voice: DEFAULT_PREMIUM_VOICE,
        pollyVoice: DEFAULT_PREMIUM_VOICE,
        standardVoice: '',
        pollyEngine: DEFAULT_POLLY_ENGINE,
        languageCode: DEFAULT_LANGUAGE_CODE,
        volume: 80,
    },
    filters: { globalCooldownSeconds: 0, perUserCooldownSeconds: 10, maxChars: 200, blockedWords: [], blockedWordsMode: 'whole', blockedUsers: [] },
    overlay: { showBubble: true, position: 'bottom-left', fontSize: 16, backgroundColor: 'rgba(0,0,0,0.75)', textColor: '#ffffff', duration: 5000 }
};

// Las voces y los idiomas ya no se escriben aquí: vienen de `useVoiceCatalog`, que los
// pide al servidor. La lista de este archivo tenía 16 voces y la de las alertas 21, y
// ninguna de las dos coincidía con lo que AWS ofrece de verdad.

// ===================== SHARED CLASSES =====================

export const inputClass = 'w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none text-sm';
export const labelClass = 'text-xs font-bold text-ds-soft block mb-2';

// ===================== HELPERS =====================

export function deepMerge(target: any, source: any): any {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] ?? {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

/** Fechas de la cartera de créditos tal como las enseñan la pestaña Voz y la de Testing. */
export function usageDateLabels(usage: CreditUsage | null) {
    const transitionEndsLabel = usage?.transitionEndsAt
        ? new Date(usage.transitionEndsAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
        : null;

    const tierExpiryLabel = usage?.tierExpiresAt
        ? new Date(usage.tierExpiresAt).toLocaleString('es-ES', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        })
        : null;

    return { transitionEndsLabel, tierExpiryLabel };
}
