import type { SettingsData } from './useSettingsData';

export function parseJwt(token: string | null): Record<string, string> {
    if (!token) return {};
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(window.atob(base64));
    } catch { return {}; }
}

export interface BotStatus {
    botConnected: boolean;
    botEnabledForUser: boolean;
    canModifySettings: boolean;
    userAccessLevel: string;
}

export interface ChannelUser {
    id: number;
    userId: number;
    username: string;
    displayName: string;
    accessLevel: string;
    permissionLabel: string;
    grantedBy: string;
    createdAt: string;
    // Vanish/alias — el backend ya filtra y enmascara segun quien mira (ver
    // SettingsController.GetChannelUsers). Estos flags solo sirven para pintar.
    isHidden: boolean;      // true solo si el que mira es el dueño o el propio usuario
    alias: string | null;   // idem: el alias real, para editarlo / marcar la fila
    isAliased: boolean;     // el que mira NO es dueño y lo que llego en username es un alias
    isSelf: boolean;
}

export interface EditAccessForm {
    id: number;
    displayName: string;
    permissionLevel: string;
    isHidden: boolean;
    alias: string;
}

export interface UserInfo {
    uniqueId: string;
    login: string;
    displayName: string;
    createdAt: string;
    updatedAt: string;
    // false cuando el canal activo no es el propio (permisos delegados via el
    // selector "Gestion de Accesos" del header) — "Vincular Cuentas" y "Tus
    // Canales" actuan siempre sobre la cuenta de quien esta logueado, nunca
    // sobre el canal delegado, asi que se ocultan en ese modo para no mezclar
    // dos identidades en la misma pantalla.
    isOwner: boolean;
}

export interface AccountTier {
    /** El backend devuelve lo que haya en la base; no está acotado a esta lista. */
    tier: string;
    tierStartedAt: string | null;
    tierExpiresAt: string | null;
    source: string | null;
}

// Pestañas de Settings (rediseño 2026-09-29): una sección por pestaña en vez de
// todo en una sola pagina. La pestaña va en ?tab= para poder enlazarla.
export type SettingsTab = 'account' | 'channel' | 'access' | 'games' | 'integrations';
export const SETTINGS_TABS: SettingsTab[] = ['account', 'channel', 'access', 'games', 'integrations'];

/**
 * Pestaña inicial: la de ?tab=, o la que corresponde a la vuelta de un login
 * externo (Discord → Integraciones, Epic → Juegos, vincular plataforma → Mi cuenta),
 * para que el aviso de esa seccion se vea al volver.
 */
export function initialSettingsTab(): SettingsTab {
    const q = new URLSearchParams(window.location.search);
    const tab = q.get('tab') as SettingsTab | null;
    if (tab && SETTINGS_TABS.includes(tab)) return tab;
    if (q.get('discord')) return 'integrations';
    if (q.get('epic')) return 'games';
    return 'account';
}

export interface ChannelIdentity {
    isOwner: boolean;
    owner: { login: string; displayName: string; profileImageUrl: string | null };
    platforms: { twitch: { login: string } | null; kick: { username: string | null } | null; discord: boolean };
    riotAccounts: { game: string; name: string; region: string | null; verified: boolean }[];
    epicAccounts: { name: string; verified: boolean }[];
}

// Interfaz para la notificación Toast
export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error';
}

// Interfaz para el Modal de Confirmación
export interface ConfirmModal {
    title: string;
    message: string;
    onConfirm: () => void;
}
/** Todo lo que necesitan las pestañas: los datos del hook más lo derivado, con usuario y bot ya cargados. */
export type SettingsCtx = Omit<SettingsData, 'userInfo' | 'botStatus'> & {
    userInfo: UserInfo;
    botStatus: BotStatus;
    viewerIsOwner: boolean;
    twitchLinked: boolean;
    discordLinked: boolean;
    kickLinked: boolean;
    riotLinked: boolean;
    epicLinked: boolean;
    headerName: string;
    headerAvatar: string | null | undefined;
    tabs: { id: SettingsTab; label: string }[];
    currentTab: SettingsTab;
};
