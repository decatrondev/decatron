import { useState, useEffect, useMemo } from 'react';
import { Trash2, Plus, Crown, X, AlertTriangle, CheckCircle, Lock, MessageSquare, ExternalLink, Loader2, Unlink, EyeOff, Pencil } from 'lucide-react';
import api from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '../components/LanguageSelector';
import RiotAccountsSettings from './settings/RiotAccountsSettings';
import EpicAccountsSettings from './settings/EpicAccountsSettings';
import DesktopAppSettings from './settings/DesktopAppSettings';

function parseJwt(token: string | null): Record<string, string> {
    if (!token) return {};
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(window.atob(base64));
    } catch { return {}; }
}

interface BotStatus {
    botConnected: boolean;
    botEnabledForUser: boolean;
    canModifySettings: boolean;
    userAccessLevel: string;
}

interface ChannelUser {
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

interface EditAccessForm {
    id: number;
    displayName: string;
    permissionLevel: string;
    isHidden: boolean;
    alias: string;
}

interface UserInfo {
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

interface AccountTier {
    /** El backend devuelve lo que haya en la base; no está acotado a esta lista. */
    tier: string;
    tierStartedAt: string | null;
    tierExpiresAt: string | null;
    source: string | null;
}

// Pestañas de Settings (rediseño 2026-09-29): una sección por pestaña en vez de
// todo en una sola pagina. La pestaña va en ?tab= para poder enlazarla.
type SettingsTab = 'account' | 'channel' | 'access' | 'games' | 'integrations';
const SETTINGS_TABS: SettingsTab[] = ['account', 'channel', 'access', 'games', 'integrations'];

/**
 * Pestaña inicial: la de ?tab=, o la que corresponde a la vuelta de un login
 * externo (Discord → Integraciones, Epic → Juegos, vincular plataforma → Mi cuenta),
 * para que el aviso de esa seccion se vea al volver.
 */
function initialSettingsTab(): SettingsTab {
    const q = new URLSearchParams(window.location.search);
    const tab = q.get('tab') as SettingsTab | null;
    if (tab && SETTINGS_TABS.includes(tab)) return tab;
    if (q.get('discord')) return 'integrations';
    if (q.get('epic')) return 'games';
    return 'account';
}

// Interfaz para la notificación Toast
interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error';
}

// Interfaz para el Modal de Confirmación
interface ConfirmModal {
    title: string;
    message: string;
    onConfirm: () => void;
}

export default function Settings() {
    const { t } = useTranslation(['settings', 'common']);
    const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
    const [channelUsers, setChannelUsers] = useState<ChannelUser[]>([]);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [botEnabled, setBotEnabled] = useState(true);
    const [accountTier, setAccountTier] = useState<AccountTier | null>(null);
    const [newUserId, setNewUserId] = useState('');
    const [newPermission, setNewPermission] = useState('commands');
    const [newIsHidden, setNewIsHidden] = useState(false);
    const [newAlias, setNewAlias] = useState('');
    // Solo el dueño ve/edita oculto y alias. Lo dice el backend en channel-users,
    // no el contexto del header, para que sea la misma regla que aplica el server.
    const [isAccessOwner, setIsAccessOwner] = useState(false);
    const [editAccess, setEditAccess] = useState<EditAccessForm | null>(null);
    const [loading, setLoading] = useState(false); // Para operaciones de C/R/U/D
    const [pageLoading, setPageLoading] = useState(true); // Para la carga inicial

    const [activeTab, setActiveTabState] = useState<SettingsTab>(initialSettingsTab);
    const setActiveTab = (tab: SettingsTab) => {
        setActiveTabState(tab);
        window.history.replaceState({}, '', `/settings?tab=${tab}`);
    };

    // Cuentas de juego vinculadas, solo para encender las fichas de Riot y Epic de la cabecera.
    const [gameLinks, setGameLinks] = useState<{ riot: boolean; epic: boolean }>({ riot: false, epic: false });
    useEffect(() => {
        api.get('/me/game-accounts')
            .then((res) => {
                const accounts: { game: string; provider: string }[] = res.data?.accounts || [];
                setGameLinks({
                    riot: accounts.some((a) => a.provider === 'riot'),
                    epic: accounts.some((a) => a.game === 'fortnite'),
                });
            })
            .catch(() => {});
    }, [activeTab]);

    // --- NUEVOS ESTADOS PARA NOTIFICACIONES ---
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null);

    // --- VALIDACIÓN DE PERMISOS ---
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const navigate = useNavigate();

    // Auth provider from JWT
    const jwtClaims = useMemo(() => parseJwt(localStorage.getItem('token')), []);
    const authProvider = jwtClaims.AuthProvider || 'twitch';
    const isDiscordOnly = authProvider === 'discord';
    const discordUsername = jwtClaims.DiscordId ? (jwtClaims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || '') : '';
    const discordAvatar = jwtClaims.ProfileImage || '';

    // Handle link callback (Twitch, Discord o Kick vinculados)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const linked = params.get('linked');
        const code = params.get('code');
        const linkError = params.get('error');

        if (linked === 'kick' || linked === 'twitch-account') {
            // Ninguno de los dos fusiona filas — la sesion actual no cambia, no
            // hace falta canjear un token nuevo.
            addToast(`${linked === 'kick' ? 'Kick' : 'Twitch'} vinculado exitosamente`, 'success');
            window.history.replaceState({}, '', '/settings');
            loadAccountChannels();
            return;
        }

        if (linkError === 'kick_already_linked' || linkError === 'twitch_already_linked') {
            addToast(`Ese canal de ${linkError.startsWith('kick') ? 'Kick' : 'Twitch'} ya está vinculado a otra cuenta`, 'error');
            window.history.replaceState({}, '', '/settings');
            return;
        }

        if (linked && code) {
            api.post(linked === 'discord' ? '/auth/discord/exchange' : '/auth/exchange', { code })
                .then((res) => {
                    localStorage.setItem('token', res.data.token);
                    addToast(`${linked === 'discord' ? 'Discord' : 'Twitch'} vinculado exitosamente`, 'success');
                    window.history.replaceState({}, '', '/settings');
                    window.location.reload();
                })
                .catch(() => {
                    addToast('Cuenta vinculada. Cierra sesion y vuelve a entrar.', 'success');
                    window.history.replaceState({}, '', '/settings');
                });
        }
    }, []);

    // Canales vinculados a la misma cuenta (Twitch/Kick) — separado del JWT,
    // que solo describe la sesion actual.
    const [linkedKick, setLinkedKick] = useState<{ id: number; kickUsername: string | null } | null>(null);
    const [linkedTwitch, setLinkedTwitch] = useState<{ id: number; twitchLogin: string | null } | null>(null);
    const [accountChannels, setAccountChannels] = useState<any[]>([]);
    const [switchingChannel, setSwitchingChannel] = useState(false);
    const loadAccountChannels = async () => {
        try {
            const res = await api.get('/auth/account-channels');
            const channels = res.data.channels || [];
            setAccountChannels(channels);
            const kickChannel = channels.find((c: any) => c.hasKick && !c.isCurrent) || channels.find((c: any) => c.hasKick && c.isCurrent);
            setLinkedKick(kickChannel ? { id: kickChannel.id, kickUsername: kickChannel.kickUsername } : null);
            // Solo relevante para saber "¿ya hay un Twitch vinculado?" desde una
            // sesion que no es Twitch (ej. Kick) — el caso Discord ya lo resuelve
            // authProvider === 'both' sin necesitar esto.
            const twitchChannel = channels.find((c: any) => c.hasTwitch && !c.isCurrent);
            setLinkedTwitch(twitchChannel ? { id: twitchChannel.id, twitchLogin: twitchChannel.twitchLogin } : null);
        } catch { /* silencioso, no bloquea el resto de settings */ }
    };
    useEffect(() => { loadAccountChannels(); }, []);

    // "Tus Canales" — separado del selector de permisos delegados del header a
    // proposito (seccion 8.9/8.13/8.14 del plan): esto es SOLO tus propios
    // canales vinculados por cuenta, no gente a la que le diste acceso.
    //
    // No usa /channel/switch (esa es la "nota invisible" en la sesion que
    // dejaba el header/sidebar/dashboard mostrando el canal viejo). Esto pide
    // un token nuevo directamente — mismo efecto que loguearte de cero con el
    // otro canal — y lo reemplaza en localStorage, asi todo lo que lee el
    // token (header incluido) cambia junto.
    const switchToChannel = async (channelId: number) => {
        setSwitchingChannel(true);
        try {
            const res = await api.post('/auth/switch-channel', { channelId });
            localStorage.setItem('token', res.data.token);
            window.location.href = '/dashboard';
        } catch {
            addToast('No se pudo cambiar de canal', 'error');
            setSwitchingChannel(false);
        }
    };

    // Efecto para cargar todos los datos iniciales
    useEffect(() => {
        const loadAllData = async () => {
            setPageLoading(true);
            if (isDiscordOnly) {
                // Discord-only: solo cargar tier e info básica
                await loadAccountTier();
                // Set minimal user info from JWT
                setUserInfo({
                    uniqueId: 'Cargando...',
                    login: discordUsername || 'Discord User',
                    displayName: jwtClaims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] || discordUsername || 'Discord User',
                    createdAt: 'N/A',
                    updatedAt: new Date().toLocaleString('es-ES'),
                    // Solo-Discord siempre es su propia cuenta: sin esto quedaba undefined y
                    // se escondia la seccion de vincular (con el boton "Vincular Twitch").
                    isOwner: true
                });
                setBotStatus({ botConnected: false, botEnabledForUser: false, canModifySettings: false, userAccessLevel: 'none' });
                // Load Discord user info from DB
                try {
                    const res = await api.get('/auth/discord/me');
                    if (res.data) {
                        setUserInfo({
                            uniqueId: res.data.uniqueId || 'N/A',
                            login: res.data.discordUsername || discordUsername,
                            displayName: res.data.displayName || discordUsername,
                            createdAt: res.data.createdAt ? new Date(res.data.createdAt).toLocaleDateString('es-ES') : 'N/A',
                            updatedAt: res.data.updatedAt ? new Date(res.data.updatedAt).toLocaleString('es-ES') : 'N/A',
                            isOwner: true
                        });
                    }
                } catch { /* fallback to JWT data */ }
            } else {
                await Promise.all([
                    loadBotStatus(),
                    loadChannelUsers(),
                    loadUserInfo(),
                    loadAccountTier()
                ]);
            }
            setPageLoading(false);
        };
        loadAllData();
    }, []);

    // --- MANEJO DE NOTIFICACIONES TOAST ---
    const addToast = (message: string, type: 'success' | 'error') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        // Auto-eliminar después de 3 segundos
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    // 3. Se agregaron comprobaciones de tipo (type guards) para manejar 'unknown'
    const loadBotStatus = async () => {
        try {
            const res = await api.get('/settings/bot/status');
            // Comprobación de tipo
            if (res.data && typeof res.data === 'object' && 'success' in res.data && res.data.success) {
                const data = res.data as BotStatus; // Asignación segura
                setBotStatus(data);
                setBotEnabled(data.botEnabledForUser);
            }
        } catch (err) {
            console.error('Error loading bot status:', err);
            addToast(t('settings:messages.errorLoadingBotStatus'), 'error');
        }
    };

    const loadChannelUsers = async () => {
        try {
            const res = await api.get('/settings/channel-users');
            // Comprobación de tipo
            if (res.data && typeof res.data === 'object' && 'success' in res.data && res.data.success && 'users' in res.data && Array.isArray(res.data.users)) {
                setChannelUsers(res.data.users as ChannelUser[]);
                setIsAccessOwner('isOwner' in res.data && res.data.isOwner === true);
            }
        } catch (err) {
            console.error('Error loading channel users:', err);
            addToast(t("settings:messages.errorLoadingUsers"), 'error');
        }
    };

    const loadUserInfo = async () => {
        try {
            const res = await api.get('/channel/context');
            // Comprobación de tipo
            if (res.data && typeof res.data === 'object' && 'success' in res.data && res.data.success &&
                'context' in res.data && typeof res.data.context === 'object' && res.data.context &&
                'activeChannel' in res.data.context && typeof res.data.context.activeChannel === 'object'
            ) {
                const channel = (res.data.context as {
                    activeChannel: {
                        login: string,
                        displayName: string,
                        uniqueId?: string,
                        createdAt?: string,
                        updatedAt?: string,
                        isOwner?: boolean
                    }
                }).activeChannel;

                setUserInfo({
                    uniqueId: channel.uniqueId || 'N/A',
                    login: channel.login,
                    displayName: channel.displayName,
                    createdAt: channel.createdAt ? new Date(channel.createdAt).toLocaleDateString('es-ES') : 'N/A',
                    updatedAt: channel.updatedAt ? new Date(channel.updatedAt).toLocaleString('es-ES') : new Date().toLocaleString('es-ES'),
                    isOwner: channel.isOwner !== false
                });
            }
        } catch (err) {
            console.error('Error loading user info:', err);
            addToast(t("settings:messages.errorLoadingChannel"), 'error');
        }
    };

    const loadAccountTier = async () => {
        try {
            const res = await api.get('/auth/account-tier');
            if (res.data) setAccountTier(res.data as AccountTier);
        } catch (err) {
            console.error('Error loading account tier:', err);
        }
    };

    // --- FUNCIÓN MODIFICADA (REQUEST 2) ---
    // Se llama directamente al cambiar el toggle
    const handleBotToggle = async () => {
        const newStatus = !botEnabled;
        // Actualización optimista de la UI
        setBotEnabled(newStatus);

        try {
            const res = await api.post('/settings/update', { botEnabled: newStatus });
            // Comprobación de tipo
            if (res.data && typeof res.data === 'object' && 'success' in res.data && res.data.success) {
                addToast(t("settings:messages.botStatusUpdated"), 'success');
                // Sincronizar con el estado real del servidor
                await loadBotStatus();
            } else {
                // Revertir en caso de fallo
                setBotEnabled(!newStatus);
                const message = (res.data && typeof res.data === 'object' && 'message' in res.data) ? String(res.data.message) : t("settings:messages.errorUpdating");
                addToast(message, 'error');
            }
        } catch (err) {
            console.error('Error saving settings:', err);
            // Revertir en caso de fallo
            setBotEnabled(!newStatus);
            addToast(t("settings:messages.errorSavingSettings"), 'error');
        }
    };

    // --- FUNCIÓN MODIFICADA (REQUEST 3) ---
    // Usa toasts en lugar de alerts
    const addUser = async () => {
        if (!newUserId.trim()) {
            addToast(t("settings:messages.enterUserId"), 'error');
            return;
        }
        setLoading(true);
        try {
            const res = await api.post('/settings/add-access', {
                authorizedUserId: newUserId.trim(),
                permissionLevel: newPermission,
                isHidden: isAccessOwner && newIsHidden,
                alias: isAccessOwner && newAlias.trim() ? newAlias.trim() : null
            });
            // Comprobación de tipo
            if (res.data && typeof res.data === 'object' && 'success' in res.data && res.data.success) {
                setNewUserId('');
                setNewPermission('commands');
                setNewIsHidden(false);
                setNewAlias('');
                setShowAddUserModal(false);
                await loadChannelUsers();
                const message = 'message' in res.data ? String(res.data.message) : t("settings:messages.userAdded");
                addToast(message, 'success');
            } else {
                const message = (res.data && typeof res.data === 'object' && 'message' in res.data) ? String(res.data.message) : t("settings:messages.errorAddingUser");
                addToast(message, 'error');
            }
        } catch (err) {
            console.error('Error adding user:', err);
            addToast(t("settings:messages.errorAddingUser"), 'error');
        } finally {
            setLoading(false);
        }
    };

    const openEditAccess = (user: ChannelUser) => {
        setEditAccess({
            id: user.id,
            displayName: user.displayName,
            permissionLevel: user.accessLevel,
            isHidden: user.isHidden,
            alias: user.alias ?? ''
        });
    };

    const saveEditAccess = async () => {
        if (!editAccess) return;
        setLoading(true);
        try {
            const res = await api.put(`/settings/update-access/${editAccess.id}`, {
                permissionLevel: editAccess.permissionLevel,
                isHidden: editAccess.isHidden,
                alias: editAccess.alias.trim() || null
            });
            if (res.data && typeof res.data === 'object' && 'success' in res.data && res.data.success) {
                setEditAccess(null);
                await loadChannelUsers();
                addToast(t("settings:messages.accessUpdated"), 'success');
            } else {
                const message = (res.data && typeof res.data === 'object' && 'message' in res.data) ? String(res.data.message) : t("settings:messages.errorUpdatingAccess");
                addToast(message, 'error');
            }
        } catch (err) {
            console.error('Error updating access:', err);
            addToast(t("settings:messages.errorUpdatingAccess"), 'error');
        } finally {
            setLoading(false);
        }
    };

    // --- FUNCIONES MODIFICADAS (REQUEST 3) ---
    // `removeUser` ahora abre el modal de confirmación
    const removeUser = (id: number) => {
        const user = channelUsers.find(u => u.id === id);
        setConfirmModal({
            title: t('settings:accessManagement.removeUserModal.title'),
            message: t("settings:accessManagement.removeUserModal.message", { username: user?.username || "este usuario" }),
            onConfirm: () => executeRemoveUser(id)
        });
    };

    // `executeRemoveUser` contiene la lógica de borrado
    const executeRemoveUser = async (id: number) => {
        setLoading(true);
        try {
            const res = await api.delete(`/settings/remove-access/${id}`);
            // Comprobación de tipo
            if (res.data && typeof res.data === 'object' && 'success' in res.data && res.data.success) {
                await loadChannelUsers();
                const message = 'message' in res.data ? String(res.data.message) : t("settings:messages.userRemoved");
                addToast(message, 'success');
            } else {
                const message = (res.data && typeof res.data === 'object' && 'message' in res.data) ? String(res.data.message) : t("settings:messages.errorRemovingUser");
                addToast(message, 'error');
            }
        } catch (err) {
            console.error('Error removing user:', err);
            addToast(t("settings:messages.errorRemovingUser"), 'error');
        } finally {
            setLoading(false);
            setConfirmModal(null); // Cierra el modal de confirmación
        }
    };

    // Verificar permisos de acceso a Settings
    if (permissionsLoading) {
        return <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">{t('settings:loading.verifyingPermissions')}</div>;
    }

    // Discord-only users can always see settings (their version)
    if (!isDiscordOnly && !hasMinimumLevel('control_total')) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 max-w-md text-center">
                    <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-red-600 dark:text-red-400 mb-2">{t('settings:accessDenied.title')}</h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mb-6">
                        {t("settings:accessDenied.message")}
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                    >
                        {t('settings:accessDenied.backToDashboard')}
                    </button>
                </div>
            </div>
        );
    }

    if (pageLoading || !botStatus || !userInfo) {
        return <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">{t('settings:loading.loadingSettings')}</div>;
    }

    // Estado de cada plataforma para la cabecera y las filas de "Mi cuenta".
    const twitchLinked = authProvider === 'twitch' || authProvider === 'both' || (authProvider === 'kick' && !!linkedTwitch);
    const discordLinked = authProvider === 'discord' || authProvider === 'both';
    const kickLinked = authProvider === 'kick' || !!linkedKick;

    const tabs: { id: SettingsTab; label: string }[] = [
        { id: 'account', label: t('settings:tabs.account') },
        { id: 'channel', label: t('settings:tabs.channel') },
        ...(!isDiscordOnly ? [{ id: 'access' as SettingsTab, label: t('settings:tabs.access') }] : []),
        { id: 'games', label: t('settings:tabs.games') },
        { id: 'integrations', label: t('settings:tabs.integrations') },
    ];
    const currentTab: SettingsTab = tabs.some((x) => x.id === activeTab) ? activeTab : 'account';

    const linkButton = 'px-4 py-2 text-sm 4xl:text-base font-bold rounded-lg transition-all whitespace-nowrap';
    const unlinkButton = `${linkButton} bg-red-500/10 text-red-500 border border-red-200 dark:border-red-800 hover:bg-red-500/20`;

    return (
        <>
            <div className="font-onest max-w-[1400px] 4xl:max-w-[1900px] 5xl:max-w-[2500px] mx-auto space-y-6 4xl:space-y-8">
                {/* Cabecera: quien sos, que plan tenes, que canal configuras y tus plataformas unidas */}
                <section className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-5 md:p-6 4xl:p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                    <div className="flex items-center gap-4 4xl:gap-6 min-w-0">
                        {jwtClaims.ProfileImage ? (
                            <img src={jwtClaims.ProfileImage} alt="" className="w-16 h-16 4xl:w-24 4xl:h-24 rounded-2xl object-cover flex-shrink-0" />
                        ) : (
                            <div className="w-16 h-16 4xl:w-24 4xl:h-24 rounded-2xl bg-[#2563eb] text-white flex items-center justify-center text-2xl 4xl:text-4xl font-black flex-shrink-0">
                                {(userInfo.displayName || '?').slice(0, 1).toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-2xl md:text-3xl 4xl:text-4xl font-extrabold text-[#1e293b] dark:text-[#f8fafc] truncate">{userInfo.displayName}</h1>
                                {accountTier && <TierPill tier={accountTier} />}
                            </div>
                            <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                                {t('settings:header.configuring')}: <span className="font-semibold text-[#1e293b] dark:text-[#f8fafc]">@{userInfo.login}</span>
                                {userInfo.isOwner && accountChannels.length > 1 && (
                                    <button onClick={() => setActiveTab('channel')} className="ml-2 font-semibold text-[#2563eb] hover:underline">
                                        {t('settings:header.switchChannel')}
                                    </button>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Tus plataformas como fichas unidas por una linea: encendidas las vinculadas */}
                    <div>
                        <p className="text-xs 4xl:text-sm font-semibold text-[#64748b] dark:text-[#94a3b8] mb-2">{t('settings:header.platforms')}</p>
                        <div className="relative flex items-center gap-3 4xl:gap-4">
                            <span className="absolute left-5 right-5 top-1/2 h-0.5 bg-[#e2e8f0] dark:bg-[#374151]" aria-hidden />
                            <PlatformTile name="Twitch" color="#9146FF" on={twitchLinked} onClick={() => setActiveTab('account')} statusText={twitchLinked ? t('settings:header.connected') : t('settings:header.notConnected')}>
                                <svg className="w-5 h-5 4xl:w-6 4xl:h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" /></svg>
                            </PlatformTile>
                            <PlatformTile name="Kick" color="#53FC18" dark on={kickLinked} onClick={() => setActiveTab('account')} statusText={kickLinked ? t('settings:header.connected') : t('settings:header.notConnected')}>
                                <span className="font-black text-lg 4xl:text-xl">K</span>
                            </PlatformTile>
                            <PlatformTile name="Discord" color="#5865F2" on={discordLinked} onClick={() => setActiveTab('account')} statusText={discordLinked ? t('settings:header.connected') : t('settings:header.notConnected')}>
                                <MessageSquare className="w-5 h-5 4xl:w-6 4xl:h-6" />
                            </PlatformTile>
                            <PlatformTile name="Riot" color="#D13639" on={gameLinks.riot} onClick={() => setActiveTab('games')} statusText={gameLinks.riot ? t('settings:header.connected') : t('settings:header.notConnected')}>
                                <span className="font-black text-lg 4xl:text-xl">R</span>
                            </PlatformTile>
                            <PlatformTile name="Epic" color="#2A2A2A" on={gameLinks.epic} onClick={() => setActiveTab('games')} statusText={gameLinks.epic ? t('settings:header.connected') : t('settings:header.notConnected')}>
                                <span className="font-black text-lg 4xl:text-xl">E</span>
                            </PlatformTile>
                        </div>
                    </div>
                </section>

                {/* Pestañas */}
                <nav className="sticky top-0 z-20 -mx-1 px-1 bg-[#f8fafc]/90 dark:bg-[#111213]/90 backdrop-blur" role="tablist">
                    <div className="flex gap-1 overflow-x-auto border-b border-[#e2e8f0] dark:border-[#374151]">
                        {tabs.map((tab) => {
                            const on = currentTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    role="tab"
                                    aria-selected={on}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`relative px-4 4xl:px-6 py-3 4xl:py-4 text-sm md:text-base 4xl:text-lg font-bold whitespace-nowrap transition-colors ${
                                        on ? 'text-[#1e293b] dark:text-[#f8fafc]' : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#1e293b] dark:hover:text-[#f8fafc]'
                                    }`}
                                >
                                    {tab.label}
                                    {on && <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-[#2563eb] rounded-full" />}
                                </button>
                            );
                        })}
                    </div>
                </nav>

                {/* ─── Mi cuenta ─── */}
                {currentTab === 'account' && (
                    <div className="space-y-6 4xl:space-y-8">
                        <SettingsGroup title={t('settings:sections.platforms.title')} description={t('settings:sections.platforms.description')}>
                            {!userInfo.isOwner ? (
                                <SettingsRow title="—" description={t('settings:header.delegated')} />
                            ) : (
                                <>
                                    <SettingsRow
                                        icon={<PlatformIcon color="#9146FF"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" /></svg></PlatformIcon>}
                                        title="Twitch"
                                        description={twitchLinked ? <Linked>Vinculado{linkedTwitch?.twitchLogin ? ` (${linkedTwitch.twitchLogin})` : ''}</Linked> : 'No vinculado'}
                                    >
                                        {authProvider === 'discord' && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const res = await api.post('/auth/link-twitch-start');
                                                        if (res.data.url) window.location.href = res.data.url;
                                                    } catch { addToast('Error al iniciar vinculación', 'error'); }
                                                }}
                                                className={`${linkButton} bg-[#9146ff] hover:bg-[#772ce8] text-white`}
                                            >
                                                Vincular
                                            </button>
                                        )}
                                        {authProvider === 'kick' && !linkedTwitch && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        // link-account-start, no link-twitch-start: no fusiona
                                                        // filas, Kick conserva su propia config.
                                                        const res = await api.post('/auth/link-account-start');
                                                        if (res.data.url) window.location.href = res.data.url;
                                                    } catch { addToast('Error al iniciar vinculación', 'error'); }
                                                }}
                                                className={`${linkButton} bg-[#9146ff] hover:bg-[#772ce8] text-white`}
                                            >
                                                Vincular
                                            </button>
                                        )}
                                        {authProvider === 'kick' && linkedTwitch && (
                                            <button
                                                onClick={async () => {
                                                    if (!confirm('¿Desvincular Twitch? El canal sigue existiendo, solo deja de estar agrupado con esta cuenta.')) return;
                                                    try {
                                                        await api.post('/auth/unlink-account');
                                                        addToast('Twitch desvinculado', 'success');
                                                        loadAccountChannels();
                                                    } catch { addToast('Error al desvincular', 'error'); }
                                                }}
                                                className={unlinkButton}
                                            >
                                                Desvincular
                                            </button>
                                        )}
                                        {authProvider === 'both' && jwtClaims.AuthProvider === 'discord' && (
                                            <button
                                                onClick={async () => {
                                                    if (!confirm('¿Desvincular Twitch? Perderás acceso al bot y al dashboard del streamer.')) return;
                                                    try {
                                                        const res = await api.post('/auth/unlink-twitch');
                                                        if (res.data.token) {
                                                            localStorage.setItem('token', res.data.token);
                                                            window.location.reload();
                                                        }
                                                    } catch { addToast('Error al desvincular', 'error'); }
                                                }}
                                                className={unlinkButton}
                                            >
                                                Desvincular
                                            </button>
                                        )}
                                    </SettingsRow>

                                    <SettingsRow
                                        icon={<PlatformIcon color="#5865F2"><MessageSquare className="w-5 h-5" /></PlatformIcon>}
                                        title="Discord"
                                        description={discordLinked ? <Linked>Vinculado</Linked> : 'No vinculado'}
                                    >
                                        {authProvider === 'twitch' && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const res = await api.post('/auth/discord/link-start');
                                                        if (res.data.url) window.location.href = res.data.url;
                                                    } catch { addToast('Error al iniciar vinculación', 'error'); }
                                                }}
                                                className={`${linkButton} bg-[#5865F2] hover:bg-[#4752C4] text-white`}
                                            >
                                                Vincular Discord
                                            </button>
                                        )}
                                        {authProvider === 'both' && jwtClaims.AuthProvider !== 'discord' && (
                                            <button
                                                onClick={async () => {
                                                    if (!confirm('¿Desvincular Discord?')) return;
                                                    try {
                                                        const res = await api.post('/auth/discord/unlink');
                                                        if (res.data.token) {
                                                            localStorage.setItem('token', res.data.token);
                                                            window.location.reload();
                                                        }
                                                    } catch { addToast('Error al desvincular', 'error'); }
                                                }}
                                                className={unlinkButton}
                                            >
                                                Desvincular
                                            </button>
                                        )}
                                    </SettingsRow>

                                    {/* Kick — no fusiona filas, cada canal mantiene su propia config */}
                                    {authProvider !== 'kick' && (
                                        <SettingsRow
                                            icon={<PlatformIcon color="#53FC18" dark><span className="font-black">K</span></PlatformIcon>}
                                            title="Kick"
                                            description={linkedKick ? <Linked>Vinculado{linkedKick.kickUsername ? ` (${linkedKick.kickUsername})` : ''}</Linked> : 'No vinculado'}
                                        >
                                            {!linkedKick ? (
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const res = await api.post('/auth/kick/link-start');
                                                            if (res.data.url) window.location.href = res.data.url;
                                                        } catch { addToast('Error al iniciar vinculación', 'error'); }
                                                    }}
                                                    className={`${linkButton} bg-[#53fc18] hover:bg-[#3ecc0a] text-black`}
                                                >
                                                    Vincular Kick
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm('¿Desvincular Kick? El canal sigue existiendo, solo deja de estar agrupado con esta cuenta.')) return;
                                                        try {
                                                            await api.post('/auth/kick/unlink');
                                                            addToast('Kick desvinculado', 'success');
                                                            loadAccountChannels();
                                                        } catch { addToast('Error al desvincular', 'error'); }
                                                    }}
                                                    className={unlinkButton}
                                                >
                                                    Desvincular
                                                </button>
                                            )}
                                        </SettingsRow>
                                    )}
                                    {authProvider === 'both' && (
                                        <div className="px-5 4xl:px-7 py-3 bg-green-50 dark:bg-green-900/20 text-sm 4xl:text-base text-green-700 dark:text-green-400 font-medium flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4" /> Cuentas vinculadas: acceso completo
                                        </div>
                                    )}
                                </>
                            )}
                        </SettingsGroup>

                        <SettingsGroup title={t('settings:sections.plan.title')} description={t('settings:sections.plan.description')}>
                            <div className="px-5 4xl:px-7 py-4 4xl:py-5">
                                {accountTier ? (
                                    <TierBadge tier={accountTier} />
                                ) : (
                                    <div className="inline-block px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-500 font-bold rounded-lg text-sm animate-pulse">Cargando...</div>
                                )}
                            </div>
                        </SettingsGroup>

                        <SettingsGroup title={t('settings:language.title')} description={t('settings:language.description')}>
                            <div className="px-5 4xl:px-7 py-4 4xl:py-5 space-y-4">
                                <LanguageSelector variant="radio" showLabel={false} />
                                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">{t('settings:language.note')}</p>
                            </div>
                        </SettingsGroup>
                    </div>
                )}

                {/* ─── Canal y bot ─── */}
                {currentTab === 'channel' && (
                    <div className="space-y-6 4xl:space-y-8">
                        {userInfo.isOwner && accountChannels.length > 1 && (
                            <SettingsGroup title={t('settings:sections.yourChannels.title')} description={t('settings:sections.yourChannels.description')}>
                                {accountChannels.map((ch: any) => (
                                    <SettingsRow
                                        key={ch.id}
                                        icon={
                                            ch.hasKick ? (
                                                <PlatformIcon color="#53FC18" dark><span className="font-black">K</span></PlatformIcon>
                                            ) : (
                                                <PlatformIcon color="#9146FF"><span className="font-black">T</span></PlatformIcon>
                                            )
                                        }
                                        title={ch.hasKick ? ch.kickUsername : ch.twitchLogin}
                                        description={ch.hasKick ? 'Kick' : 'Twitch'}
                                    >
                                        {ch.isCurrent ? (
                                            <span className="text-sm 4xl:text-base font-bold text-[#2563eb] px-3 py-1.5">Configurando ahora</span>
                                        ) : (
                                            <button
                                                onClick={() => switchToChannel(ch.id)}
                                                disabled={switchingChannel}
                                                className={`${linkButton} bg-[#2563eb] hover:bg-[#1d4ed8] text-white disabled:opacity-50`}
                                            >
                                                Configurar este
                                            </button>
                                        )}
                                    </SettingsRow>
                                ))}
                            </SettingsGroup>
                        )}

                        <SettingsGroup title={t('settings:sections.bot.title')}>
                            <SettingsRow
                                title={t('settings:general.botStatus.title')}
                                description={isDiscordOnly ? 'Vincula tu cuenta de Twitch para activar el bot' : t('settings:general.botStatus.description')}
                            >
                                <button
                                    onClick={isDiscordOnly ? undefined : handleBotToggle}
                                    disabled={isDiscordOnly}
                                    role="switch"
                                    aria-checked={!isDiscordOnly && botEnabled}
                                    aria-label={t('settings:general.botStatus.title')}
                                    className={`relative w-14 h-8 rounded-full transition-colors flex-shrink-0 ${isDiscordOnly ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed' : botEnabled ? 'bg-[#2563eb]' : 'bg-gray-300 dark:bg-gray-600'}`}
                                >
                                    <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${!isDiscordOnly && botEnabled ? 'translate-x-6' : ''}`} />
                                </button>
                            </SettingsRow>
                        </SettingsGroup>

                        <SettingsGroup title={t('settings:systemInfo.title')}>
                            <InfoRow label={t('settings:systemInfo.version')} value="Decatron v2.0" />
                            <InfoRow label={t('settings:systemInfo.uniqueId')} value={userInfo.uniqueId} />
                            <InfoRow label={t('settings:systemInfo.channel')} value={userInfo.login} />
                            <InfoRow label={t('settings:systemInfo.memberSince')} value={userInfo.createdAt} />
                            <InfoRow label={t('settings:systemInfo.lastUpdate')} value={userInfo.updatedAt} />
                        </SettingsGroup>

                        <SettingsGroup title={t('settings:sections.accessLevel.title')}>
                            <SettingsRow title={t('settings:accessLevels.owner')} description={t('settings:systemInfo.accessLevelDescription')}>
                                <span className="px-3 py-1 bg-purple-600 text-white text-xs 4xl:text-sm font-bold rounded">{t('settings:accessLevels.owner')}</span>
                            </SettingsRow>
                        </SettingsGroup>
                    </div>
                )}

                {/* ─── Accesos ─── */}
                {currentTab === 'access' && !isDiscordOnly && (
                    <div className="space-y-6 4xl:space-y-8">
                        <SettingsGroup
                            title={t('settings:accessManagement.title')}
                            action={
                                <button
                                    onClick={() => setShowAddUserModal(true)}
                                    className={`${linkButton} flex items-center gap-2 bg-[#2563eb] hover:bg-blue-700 text-white`}
                                >
                                    <Plus className="w-4 h-4" />
                                    {t('settings:accessManagement.addAccess')}
                                </button>
                            }
                        >
                            <SettingsRow
                                icon={<Crown className="w-5 h-5 text-purple-600" />}
                                title={userInfo.displayName}
                                description={`@${userInfo.login}`}
                            >
                                <span className="px-3 py-1 bg-purple-600 text-white text-xs 4xl:text-sm font-bold rounded">{t('settings:accessLevels.owner')}</span>
                            </SettingsRow>
                        </SettingsGroup>

                        <SettingsGroup
                            title={t('settings:accessManagement.usersWithAccess')}
                            description={isAccessOwner ? t('settings:accessManagement.hiddenHint') : undefined}
                        >
                            {channelUsers.length === 0 ? (
                                <div className="text-center text-[#64748b] dark:text-[#94a3b8] py-8 text-sm 4xl:text-base">{t('settings:accessManagement.noUsers')}</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm 4xl:text-base">
                                        <thead>
                                            <tr className="text-left text-[#64748b] dark:text-[#94a3b8]">
                                                <th className="px-5 4xl:px-7 py-3 font-semibold">{t('settings:accessManagement.tableHeaders.name')}</th>
                                                <th className="px-4 py-3 font-semibold">{t('settings:accessManagement.tableHeaders.username')}</th>
                                                <th className="px-4 py-3 font-semibold">{t('settings:accessManagement.tableHeaders.permissions')}</th>
                                                <th className="px-4 py-3 font-semibold">{t('settings:accessManagement.tableHeaders.addedBy')}</th>
                                                <th className="px-5 4xl:px-7 py-3 font-semibold text-right">{t('settings:accessManagement.tableHeaders.actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#374151] border-t border-[#e2e8f0] dark:border-[#374151]">
                                            {channelUsers.map((user) => (
                                                <tr key={user.id} className={`hover:bg-slate-50 dark:hover:bg-[#222324] transition-colors ${user.isHidden ? 'opacity-60' : ''}`}>
                                                    <td className="px-5 4xl:px-7 py-3 text-[#1e293b] dark:text-[#f8fafc] font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <span>{user.displayName}</span>
                                                            {user.isHidden && (
                                                                <span title={t('settings:accessManagement.hiddenBadge')} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                                    <EyeOff className="w-3 h-3" />
                                                                    {t('settings:accessManagement.hiddenBadge')}
                                                                </span>
                                                            )}
                                                            {user.isSelf && <span className="text-xs font-bold text-[#2563eb]">{t('settings:accessManagement.youBadge')}</span>}
                                                        </div>
                                                        {user.alias && (
                                                            <div className="text-xs text-[#64748b] dark:text-[#94a3b8] font-normal">
                                                                {t('settings:accessManagement.aliasLabel')}: {user.alias}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-[#64748b] dark:text-[#94a3b8]">{user.isAliased ? '—' : `@${user.username}`}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold text-white ${user.accessLevel === 'control_total' ? 'bg-purple-600' : user.accessLevel === 'moderation' ? 'bg-[#2563eb]' : 'bg-gray-500'}`}>
                                                            {user.permissionLabel}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-[#64748b] dark:text-[#94a3b8]">{user.grantedBy === '__owner__' ? t('settings:accessManagement.owner') : user.grantedBy}</td>
                                                    <td className="px-5 4xl:px-7 py-3 text-right">
                                                        <div className="inline-flex items-center gap-1">
                                                            {isAccessOwner && (
                                                                <button
                                                                    onClick={() => openEditAccess(user)}
                                                                    disabled={loading}
                                                                    title={t('settings:accessManagement.editAccess')}
                                                                    className="p-1.5 hover:bg-[#2563eb] rounded text-[#2563eb] hover:text-white transition-all disabled:opacity-50"
                                                                >
                                                                    <Pencil className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => removeUser(user.id)}
                                                                disabled={loading}
                                                                className="p-1.5 hover:bg-red-600 rounded text-red-500 hover:text-white transition-all disabled:opacity-50"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </SettingsGroup>
                    </div>
                )}

                {/* ─── Juegos ─── */}
                {currentTab === 'games' && (
                    <SettingsGroup title={t('settings:sections.games.title')} description={t('settings:sections.games.description')}>
                        <div className="p-4 4xl:p-6 space-y-3">
                            <RiotAccountsSettings />
                            <EpicAccountsSettings />
                        </div>
                    </SettingsGroup>
                )}

                {/* ─── Integraciones ─── */}
                {currentTab === 'integrations' && (
                    <SettingsGroup title={t('settings:sections.integrations.title')} description={t('settings:sections.integrations.description')}>
                        <div className="p-4 4xl:p-6 space-y-3">
                            <DiscordIntegration />
                            <DesktopAppSettings />
                        </div>
                    </SettingsGroup>
                )}
            </div>

            {/* --- MODALES Y NOTIFICACIONES (REQUEST 3) --- */}

            {/* Modal Agregar Usuario (sin cambios, solo el estado de visibilidad) */}
            {showAddUserModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 max-w-md w-full border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">{t('settings:accessManagement.addUserModal.title')}</h3>
                            <button onClick={() => setShowAddUserModal(false)} className="text-[#64748b] dark:text-[#94a3b8] hover:text-[#1e293b] dark:hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">{t('settings:accessManagement.addUserModal.uniqueIdLabel')}</label>
                                <input
                                    type="text"
                                    value={newUserId}
                                    onChange={(e) => setNewUserId(e.target.value)}
                                    placeholder={t("settings:accessManagement.addUserModal.uniqueIdPlaceholder")}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-[#222324] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-[#2563eb] dark:focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">{t('settings:accessManagement.addUserModal.permissionLabel')}</label>
                                <select
                                    value={newPermission}
                                    onChange={(e) => setNewPermission(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-[#222324] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-white focus:border-[#2563eb] dark:focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                                >
                                    <option value="commands">{t('settings:accessManagement.addUserModal.permissionCommands')}</option>
                                    <option value="moderation">{t('settings:accessManagement.addUserModal.permissionModeration')}</option>
                                    <option value="control_total">{t('settings:accessManagement.addUserModal.permissionControlTotal')}</option>
                                </select>
                            </div>
                            {isAccessOwner && (
                                <>
                                    <div>
                                        <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">{t('settings:accessManagement.aliasLabel')}</label>
                                        <input
                                            type="text"
                                            maxLength={30}
                                            value={newAlias}
                                            onChange={(e) => setNewAlias(e.target.value)}
                                            placeholder={t("settings:accessManagement.aliasPlaceholder")}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#222324] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-[#2563eb] dark:focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                                        />
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('settings:accessManagement.aliasHelp')}</p>
                                    </div>
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newIsHidden}
                                            onChange={(e) => setNewIsHidden(e.target.checked)}
                                            className="mt-1 w-4 h-4 accent-[#2563eb]"
                                        />
                                        <span>
                                            <span className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('settings:accessManagement.hiddenLabel')}</span>
                                            <span className="block text-xs text-[#64748b] dark:text-[#94a3b8]">{t('settings:accessManagement.hiddenHelp')}</span>
                                        </span>
                                    </label>
                                </>
                            )}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowAddUserModal(false)}
                                    className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-[#1e293b] dark:text-white font-bold rounded-lg transition-all"
                                >
                                    {t('settings:accessManagement.addUserModal.cancel')}
                                </button>
                                <button
                                    onClick={addUser}
                                    disabled={loading}
                                    className="flex-1 px-4 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? t("settings:accessManagement.addUserModal.adding") : t('settings:accessManagement.addUserModal.add')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Editar Acceso — solo el dueño (nivel, alias, oculto) */}
            {editAccess && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 max-w-md w-full border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">{t('settings:accessManagement.editUserModal.title')}</h3>
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{editAccess.displayName}</p>
                            </div>
                            <button onClick={() => setEditAccess(null)} className="text-[#64748b] dark:text-[#94a3b8] hover:text-[#1e293b] dark:hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">{t('settings:accessManagement.addUserModal.permissionLabel')}</label>
                                <select
                                    value={editAccess.permissionLevel}
                                    onChange={(e) => setEditAccess({ ...editAccess, permissionLevel: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-[#222324] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-white focus:border-[#2563eb] dark:focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                                >
                                    <option value="commands">{t('settings:accessManagement.addUserModal.permissionCommands')}</option>
                                    <option value="moderation">{t('settings:accessManagement.addUserModal.permissionModeration')}</option>
                                    <option value="control_total">{t('settings:accessManagement.addUserModal.permissionControlTotal')}</option>
                                </select>
                            </div>
                            {isAccessOwner && (
                                <>
                                    <div>
                                        <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">{t('settings:accessManagement.aliasLabel')}</label>
                                        <input
                                            type="text"
                                            maxLength={30}
                                            value={editAccess.alias}
                                            onChange={(e) => setEditAccess({ ...editAccess, alias: e.target.value })}
                                            placeholder={t("settings:accessManagement.aliasPlaceholder")}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#222324] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-[#2563eb] dark:focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                                        />
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('settings:accessManagement.aliasHelp')}</p>
                                    </div>
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editAccess.isHidden}
                                            onChange={(e) => setEditAccess({ ...editAccess, isHidden: e.target.checked })}
                                            className="mt-1 w-4 h-4 accent-[#2563eb]"
                                        />
                                        <span>
                                            <span className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('settings:accessManagement.hiddenLabel')}</span>
                                            <span className="block text-xs text-[#64748b] dark:text-[#94a3b8]">{t('settings:accessManagement.hiddenHelp')}</span>
                                        </span>
                                    </label>
                                </>
                            )}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setEditAccess(null)}
                                    className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-[#1e293b] dark:text-white font-bold rounded-lg transition-all"
                                >
                                    {t('settings:accessManagement.addUserModal.cancel')}
                                </button>
                                <button
                                    onClick={saveEditAccess}
                                    disabled={loading}
                                    className="flex-1 px-4 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? t("settings:accessManagement.editUserModal.saving") : t('settings:accessManagement.editUserModal.save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* NUEVO: Modal de Confirmación */}
            {confirmModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 max-w-md w-full border border-[#e2e8f0] dark:border-[#374151]">
                        <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">{confirmModal.title}</h3>
                        <p className="text-[#64748b] dark:text-[#94a3b8] my-4">{confirmModal.message}</p>
                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={() => setConfirmModal(null)}
                                disabled={loading}
                                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-[#1e293b] dark:text-white font-bold rounded-lg transition-all disabled:opacity-50"
                            >
                                {t('settings:accessManagement.removeUserModal.cancel')}
                            </button>
                            <button
                                onClick={confirmModal.onConfirm}
                                disabled={loading}
                                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? t("settings:accessManagement.removeUserModal.deleting") : t('settings:accessManagement.removeUserModal.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* NUEVO: Contenedor de Notificaciones Toast */}
            <div className="fixed bottom-4 right-4 z-[100] space-y-3 w-full max-w-xs">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border ${toast.type === 'success'
                            ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                            : 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700'
                            } animate-fade-in-right`}
                    >
                        <div className={`flex-shrink-0 ${toast.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                            {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        </div>
                        <p className={`flex-1 text-sm font-medium ${toast.type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                            {toast.message}
                        </p>
                        <button
                            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                            className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                ))}
            </div>

            {/* 4. Definición de animaciones corregida a <style> estándar */}
            <style>{`
                @keyframes fade-in-right {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                .animate-fade-in-right {
                    animation: fade-in-right 0.3s ease-out;
                }
            `}</style>
        </>
    );
}

// --- COMPONENTES AUXILIARES ---
// (Sin cambios, ya estaban bien)

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-center gap-4 px-5 4xl:px-7 py-3 4xl:py-4">
            <span className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">{label}</span>
            <span className="text-sm 4xl:text-base text-[#1e293b] dark:text-[#f8fafc] font-mono text-right break-all">{value}</span>
        </div>
    );
}

/** Grupo de ajustes: titulo, explicacion y filas separadas por lineas finas. */
function SettingsGroup({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section>
            <div className="flex items-end justify-between gap-4 mb-3 px-1">
                <div className="min-w-0">
                    <h2 className="text-lg md:text-xl 4xl:text-2xl font-extrabold text-[#1e293b] dark:text-[#f8fafc]">{title}</h2>
                    {description && <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8] mt-0.5 max-w-3xl">{description}</p>}
                </div>
                {action}
            </div>
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] divide-y divide-[#e2e8f0] dark:divide-[#374151] overflow-hidden">
                {children}
            </div>
        </section>
    );
}

/** Una fila: que es y que hace a la izquierda, el control a la derecha. */
function SettingsRow({ icon, title, description, children }: { icon?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 4xl:px-7 py-4 4xl:py-5">
            <div className="flex items-center gap-3 4xl:gap-4 min-w-0">
                {icon && <div className="flex-shrink-0">{icon}</div>}
                <div className="min-w-0">
                    <div className="font-bold text-base 4xl:text-lg text-[#1e293b] dark:text-[#f8fafc] truncate">{title}</div>
                    {description && <div className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">{description}</div>}
                </div>
            </div>
            {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
        </div>
    );
}

function Linked({ children }: { children: React.ReactNode }) {
    return (
        <span className="text-green-600 dark:text-green-400 inline-flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> {children}
        </span>
    );
}

/** Icono de plataforma para las filas (color de la marca). */
function PlatformIcon({ color, dark = false, children }: { color: string; dark?: boolean; children: React.ReactNode }) {
    return (
        <div className="w-10 h-10 4xl:w-12 4xl:h-12 rounded-xl flex items-center justify-center" style={{ background: color, color: dark ? '#000' : '#fff' }}>
            {children}
        </div>
    );
}

/** Ficha de la cabecera: encendida si la plataforma esta vinculada, gris si no. */
function PlatformTile({
    name,
    color,
    dark = false,
    on,
    statusText,
    onClick,
    children,
}: {
    name: string;
    color: string;
    dark?: boolean;
    on: boolean;
    statusText: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            title={`${name}: ${statusText}`}
            aria-label={`${name}: ${statusText}`}
            className={`relative w-11 h-11 4xl:w-14 4xl:h-14 rounded-xl flex items-center justify-center transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] ${
                on ? 'shadow-sm' : 'bg-gray-100 dark:bg-[#262626] text-[#94a3b8] border border-dashed border-[#cbd5e1] dark:border-[#4b5563]'
            }`}
            style={on ? { background: color, color: dark ? '#000' : '#fff' } : undefined}
        >
            {children}
            {on && (
                <span className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white dark:border-[#1B1C1D] flex items-center justify-center">
                    <CheckCircle className="w-2.5 h-2.5 text-white" />
                </span>
            )}
        </button>
    );
}

const TIER_CONFIG: Record<string, { label: string; color: string; description: string }> = {
    free:      { label: 'Free',      color: 'bg-gray-500',    description: 'Plan gratuito' },
    supporter: { label: '⚡ Supporter', color: 'bg-blue-600', description: 'Gracias por apoyar el proyecto' },
    premium:   { label: '💎 Premium',  color: 'bg-purple-600', description: 'Acceso completo a todas las funciones' },
    fundador:  { label: '🌟 Fundador', color: 'bg-amber-500',  description: 'Apoyo fundador — gracias por estar desde el principio' },
    admin:     { label: 'Admin',     color: 'bg-yellow-500',  description: 'Acceso total de administrador' },
};

function TierBadge({ tier }: { tier: AccountTier }) {
    // Un tier desconocido se muestra tal cual, nunca como 'free'. Caer a gratuito hacía que
    // una compra real pareciera no haber pasado: el tier estaba activo y la pantalla decía
    // que no. Es mejor un badge con un nombre raro que un badge que miente.
    const config = TIER_CONFIG[tier.tier] ?? {
        label: tier.tier,
        color: 'bg-slate-600',
        description: 'Plan activo',
    };
    const startDate = tier.tierStartedAt ? new Date(tier.tierStartedAt).toLocaleDateString('es-ES') : null;
    const expiresDate = tier.tierExpiresAt ? new Date(tier.tierExpiresAt).toLocaleDateString('es-ES') : null;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <span className={`px-4 py-2 ${config.color} text-white font-bold rounded-lg text-sm`}>
                    {config.label}
                </span>
                <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">{config.description}</span>
            </div>
            {startDate && (
                <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                    Activo desde: {startDate}
                    {expiresDate && <span className="ml-3">· Expira: {expiresDate}</span>}
                </div>
            )}
        </div>
    );
}

/** Plan en chico para la cabecera. */
function TierPill({ tier }: { tier: AccountTier }) {
    const config = TIER_CONFIG[tier.tier] ?? { label: tier.tier, color: 'bg-slate-600', description: '' };
    return <span className={`px-2.5 py-0.5 ${config.color} text-white font-bold rounded-md text-xs 4xl:text-sm`}>{config.label}</span>;
}

interface LinkedGuild {
    id: number;
    guildId: string;
    guildName: string;
    guildIcon: string | null;
}

interface DiscordGuild {
    id: string;
    name: string;
    icon: string | null;
}

function DiscordIntegration() {
    const [linkedGuilds, setLinkedGuilds] = useState<LinkedGuild[]>([]);
    const [availableGuilds, setAvailableGuilds] = useState<DiscordGuild[]>([]);
    const [loading, setLoading] = useState(true);
    const [linking, setLinking] = useState(false);
    const [showGuildPicker, setShowGuildPicker] = useState(false);

    useEffect(() => {
        loadLinkedGuilds();
        // Check if returning from Discord OAuth
        const params = new URLSearchParams(window.location.search);
        if (params.get('discord') === 'select') {
            loadAvailableGuilds();
            // Clean URL
            window.history.replaceState({}, '', '/settings');
        }
    }, []);

    const loadLinkedGuilds = async () => {
        try {
            const res = await api.get('/discord/linked');
            if (res.data.success) {
                setLinkedGuilds(res.data.guilds);
            }
        } catch (err) {
            console.error('Error loading linked guilds:', err);
        } finally {
            setLoading(false);
        }
    };

    const startDiscordAuth = async () => {
        try {
            const res = await api.get('/discord/auth');
            if (res.data.success) {
                window.location.href = res.data.url;
            }
        } catch (err) {
            console.error('Error starting Discord auth:', err);
        }
    };

    const loadAvailableGuilds = async () => {
        try {
            const res = await api.get('/discord/guilds');
            if (res.data.success) {
                setAvailableGuilds(res.data.guilds);
                setShowGuildPicker(true);
            }
        } catch (err) {
            console.error('Error loading guilds:', err);
        }
    };

    const linkGuild = async (guild: DiscordGuild) => {
        try {
            setLinking(true);
            const res = await api.post('/discord/link', {
                guildId: guild.id,
                guildName: guild.name,
                guildIcon: guild.icon
            });
            if (res.data.success) {
                setShowGuildPicker(false);
                loadLinkedGuilds();
            }
        } catch (err) {
            console.error('Error linking guild:', err);
        } finally {
            setLinking(false);
        }
    };

    const unlinkGuild = async (guildId: string) => {
        try {
            await api.delete(`/discord/unlink/${guildId}`);
            loadLinkedGuilds();
        } catch (err) {
            console.error('Error unlinking guild:', err);
        }
    };

    return (
        <div className="p-4 bg-gray-50 dark:bg-[#222324] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex items-center gap-4 mb-3">
                <div className="p-3 bg-indigo-600 rounded-lg text-white">
                    <MessageSquare className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <div className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Discord</div>
                    <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                        {loading ? 'Cargando...' : linkedGuilds.length > 0 ? `${linkedGuilds.length} servidor${linkedGuilds.length > 1 ? 'es' : ''} vinculado${linkedGuilds.length > 1 ? 's' : ''}` : 'No vinculado'}
                    </div>
                </div>
                <button
                    onClick={startDiscordAuth}
                    className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                >
                    <ExternalLink className="w-4 h-4" />
                    Conectar servidor
                </button>
            </div>

            {/* Linked guilds */}
            {linkedGuilds.length > 0 && (
                <div className="space-y-2 mt-3 pt-3 border-t border-[#e2e8f0] dark:border-[#374151]">
                    {linkedGuilds.map(guild => (
                        <div key={guild.guildId} className="flex items-center gap-3 p-2 bg-white dark:bg-[#1B1C1D] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                            {guild.guildIcon ? (
                                <img src={guild.guildIcon} alt="" className="w-8 h-8 rounded-full" />
                            ) : (
                                <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                                    {guild.guildName.charAt(0)}
                                </div>
                            )}
                            <span className="flex-1 text-sm font-medium text-[#1e293b] dark:text-white">{guild.guildName}</span>
                            <button
                                onClick={() => unlinkGuild(guild.guildId)}
                                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 transition-colors"
                                title="Desvincular"
                            >
                                <Unlink className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Guild picker modal */}
            {showGuildPicker && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 max-w-md w-full border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">Selecciona un servidor</h3>
                            <button onClick={() => setShowGuildPicker(false)} className="text-[#64748b] hover:text-[#1e293b] dark:hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">
                            Servidores donde eres administrador:
                        </p>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {availableGuilds.length === 0 ? (
                                <p className="text-center text-[#64748b] py-4">No se encontraron servidores</p>
                            ) : (
                                availableGuilds.map(guild => (
                                    <button
                                        key={guild.id}
                                        onClick={() => linkGuild(guild)}
                                        disabled={linking}
                                        className="w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#222324] hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] transition-all text-left disabled:opacity-50"
                                    >
                                        {guild.icon ? (
                                            <img src={guild.icon} alt="" className="w-10 h-10 rounded-full" />
                                        ) : (
                                            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                                {guild.name.charAt(0)}
                                            </div>
                                        )}
                                        <span className="font-medium text-[#1e293b] dark:text-white">{guild.name}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
