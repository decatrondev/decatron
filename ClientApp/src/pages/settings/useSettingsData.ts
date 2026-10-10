import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { parseJwt, initialSettingsTab } from './types';
import type { BotStatus, ChannelUser, EditAccessForm, UserInfo, AccountTier, SettingsTab, ChannelIdentity, Toast, ConfirmModal } from './types';

/** Estado, carga de datos y acciones de la pantalla de Configuración. Las pestañas lo reciben ya armado (SettingsCtx). */
export function useSettingsData() {
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

    // Plataformas y cuentas de juego del DUEÑO del canal activo (no de quien mira): con
    // control total sobre un canal ajeno se ve lo de ese dueño, en solo lectura.
    const [identity, setIdentity] = useState<ChannelIdentity | null>(null);
    useEffect(() => {
        api.get('/settings/channel-identity')
            .then((res) => setIdentity(res.data?.success ? res.data : null))
            .catch(() => setIdentity(null));
    }, [activeTab]);

    // --- NUEVOS ESTADOS PARA NOTIFICACIONES ---
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null);

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

    return {
        botStatus,
        channelUsers,
        userInfo,
        botEnabled,
        accountTier,
        newUserId,
        setNewUserId,
        newPermission,
        setNewPermission,
        newIsHidden,
        setNewIsHidden,
        newAlias,
        setNewAlias,
        isAccessOwner,
        editAccess,
        setEditAccess,
        loading,
        pageLoading,
        activeTab,
        setActiveTab,
        identity,
        showAddUserModal,
        setShowAddUserModal,
        toasts,
        setToasts,
        confirmModal,
        setConfirmModal,
        jwtClaims,
        authProvider,
        isDiscordOnly,
        discordUsername,
        discordAvatar,
        linkedKick,
        linkedTwitch,
        accountChannels,
        switchingChannel,
        loadAccountChannels,
        switchToChannel,
        addToast,
        handleBotToggle,
        addUser,
        openEditAccess,
        saveEditAccess,
        removeUser,
    };
}

export type SettingsData = ReturnType<typeof useSettingsData>;
