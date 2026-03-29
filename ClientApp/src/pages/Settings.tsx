import { useState, useEffect } from 'react';
// 1. 'Save' ha sido eliminado de esta línea
import { Users, Trash2, Plus, Music, Gamepad2, Youtube, Crown, X, AlertTriangle, CheckCircle, Lock, Languages } from 'lucide-react';
import api from '../services/api'; // Se comenta para evitar error de compilación en el entorno de vista previa
import { usePermissions } from '../hooks/usePermissions';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '../components/LanguageSelector';

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
}

interface UserInfo {
    uniqueId: string;
    login: string;
    displayName: string;
    createdAt: string;
    updatedAt: string;
}

interface AccountTier {
    tier: 'free' | 'supporter' | 'premium' | 'admin';
    tierStartedAt: string | null;
    tierExpiresAt: string | null;
    source: string | null;
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
    const [loading, setLoading] = useState(false); // Para operaciones de C/R/U/D
    const [pageLoading, setPageLoading] = useState(true); // Para la carga inicial

    // --- NUEVOS ESTADOS PARA NOTIFICACIONES ---
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null);

    // --- VALIDACIÓN DE PERMISOS ---
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const navigate = useNavigate();

    // Efecto para cargar todos los datos iniciales
    useEffect(() => {
        const loadAllData = async () => {
            setPageLoading(true);
            await Promise.all([
                loadBotStatus(),
                loadChannelUsers(),
                loadUserInfo(),
                loadAccountTier()
            ]);
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
                        updatedAt?: string
                    }
                }).activeChannel;

                setUserInfo({
                    uniqueId: channel.uniqueId || 'N/A',
                    login: channel.login,
                    displayName: channel.displayName,
                    createdAt: channel.createdAt ? new Date(channel.createdAt).toLocaleDateString('es-ES') : 'N/A',
                    updatedAt: channel.updatedAt ? new Date(channel.updatedAt).toLocaleString('es-ES') : new Date().toLocaleString('es-ES')
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
                permissionLevel: newPermission
            });
            // Comprobación de tipo
            if (res.data && typeof res.data === 'object' && 'success' in res.data && res.data.success) {
                setNewUserId('');
                setNewPermission('commands');
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

    if (!hasMinimumLevel('control_total')) {
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

    return (
        <>
            {/* --- LAYOUT MODIFICADO (REQUEST 1) --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Columna Izquierda (2 tarjetas) */}
                <div className="space-y-6">
                    {/* Configuración General */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                        <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-6">{t('settings:general.title')}</h2>
                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#222324] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                                <div>
                                    <div className="font-bold text-[#1e293b] dark:text-[#f8fafc] mb-1">{t('settings:general.botStatus.title')}</div>
                                    <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">{t('settings:general.botStatus.description')}</div>
                                </div>
                                <button
                                    onClick={handleBotToggle} // --- CAMBIO (REQUEST 2) ---
                                    className={`relative w-14 h-8 rounded-full transition-colors ${botEnabled ? 'bg-[#2563eb]' : 'bg-gray-300 dark:bg-gray-600'}`}
                                >
                                    <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${botEnabled ? 'translate-x-6' : ''}`} />
                                </button>
                            </div>
                            {/* --- BOTÓN ELIMINADO (REQUEST 2) --- */}
                        </div>
                    </div>

                    {/* Preferencias de Idioma */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center gap-2 mb-6">
                            <Languages className="w-6 h-6 text-[#2563eb]" />
                            <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">{t('settings:language.title')}</h2>
                        </div>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-6">
                            {t('settings:language.description')}
                        </p>
                        <LanguageSelector variant="radio" showLabel={false} />
                        <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                ℹ️ {t('settings:language.note')}
                            </p>
                        </div>
                    </div>

                    {/* Información del Sistema */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                        <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-6">{t('settings:systemInfo.title')}</h2>
                        <div className="space-y-4">
                            <InfoRow label={t("settings:systemInfo.version")} value="Decatron v2.0" />
                            <InfoRow label={t("settings:systemInfo.uniqueId")} value={userInfo.uniqueId} />
                            <InfoRow label={t("settings:systemInfo.channel")} value={userInfo.login} />
                            <InfoRow label={t("settings:systemInfo.memberSince")} value={userInfo.createdAt} />
                            <InfoRow label={t("settings:systemInfo.lastUpdate")} value={userInfo.updatedAt} />
                        </div>

                        {/* Nivel de cuenta */}
                        <div className="mt-6 pt-6 border-t border-[#e2e8f0] dark:border-[#374151]">
                            <div className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-3">Nivel de cuenta</div>
                            {accountTier ? (
                                <TierBadge tier={accountTier} />
                            ) : (
                                <div className="inline-block px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-500 font-bold rounded-lg text-sm animate-pulse">
                                    Cargando...
                                </div>
                            )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-[#e2e8f0] dark:border-[#374151]">
                            <div className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">{t('settings:systemInfo.yourAccessLevel')}</div>
                            <div className="inline-block px-4 py-2 bg-purple-600 text-white font-bold rounded-lg text-sm">
                                {t('settings:accessLevels.owner')}
                            </div>
                            <div className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-2">{t('settings:systemInfo.accessLevelDescription')}</div>
                        </div>
                    </div>
                </div>

                {/* Columna Derecha (2 tarjetas) */}
                <div className="space-y-6">
                    {/* Gestión de Accesos */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] h-fit">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">{t('settings:accessManagement.title')}</h2>
                            <button
                                onClick={() => setShowAddUserModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                {t('settings:accessManagement.addAccess')}
                            </button>
                        </div>

                        {/* Propietario */}
                        <div className="mb-6">
                            <div className="flex items-center gap-2 text-[#2563eb] font-bold mb-3">
                                <Crown className="w-5 h-5" />
                                {t('settings:accessManagement.owner')}
                            </div>
                            <div className="bg-gray-50 dark:bg-[#222324] rounded-lg p-4 border border-purple-600">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{userInfo.displayName}</div>
                                        <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">@{userInfo.login}</div>
                                    </div>
                                    <div className="px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded">
                                        {t('settings:accessLevels.owner')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Usuarios con Acceso */}
                        <div>
                            <div className="flex items-center gap-2 text-[#2563eb] font-bold mb-3">
                                <Users className="w-5 h-5" />
                                {t('settings:accessManagement.usersWithAccess')}
                            </div>
                            {channelUsers.length === 0 ? (
                                <div className="text-center text-[#64748b] dark:text-[#94a3b8] py-8 text-sm">
                                    {t('settings:accessManagement.noUsers')}
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-[#222324]">
                                                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">{t('settings:accessManagement.tableHeaders.name')}</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">{t('settings:accessManagement.tableHeaders.username')}</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">{t('settings:accessManagement.tableHeaders.permissions')}</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">{t('settings:accessManagement.tableHeaders.addedBy')}</th>
                                                <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">{t('settings:accessManagement.tableHeaders.actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                                            {channelUsers.map((user) => (
                                                <tr key={user.id} className="bg-white dark:bg-[#1B1C1D] hover:bg-slate-50 dark:hover:bg-[#222324] transition-colors">
                                                    <td className="px-4 py-3 text-[#1e293b] dark:text-[#f8fafc] font-medium">{user.displayName}</td>
                                                    <td className="px-4 py-3 text-[#64748b] dark:text-[#94a3b8]">@{user.username}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold text-white ${user.accessLevel === 'control_total' ? 'bg-purple-600' : user.accessLevel === 'moderation' ? 'bg-[#2563eb]' : 'bg-gray-500'}`}>
                                                            {user.permissionLabel.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-[#64748b] dark:text-[#94a3b8]">{user.grantedBy}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => removeUser(user.id)} // --- CAMBIO (REQUEST 3) ---
                                                            disabled={loading}
                                                            className="p-1 hover:bg-red-600 rounded text-red-500 hover:text-white transition-all disabled:opacity-50"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Integraciones (MOVIDA AQUÍ) */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                        <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-6">{t('settings:integrations.title')}</h2>
                        <div className="space-y-3">
                            <IntegrationCard icon={<Music className="w-6 h-6" />} name={t("settings:integrations.spotify")} status={t("settings:integrations.comingSoon")} color="bg-green-600" />
                            <IntegrationCard icon={<Gamepad2 className="w-6 h-6" />} name={t("settings:integrations.steam")} status={t("settings:integrations.comingSoon")} color="bg-blue-600" />
                            <IntegrationCard icon={<Youtube className="w-6 h-6" />} name={t("settings:integrations.youtube")} status={t("settings:integrations.comingSoon")} color="bg-red-600" />
                        </div>
                    </div>
                </div>
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
        <div className="flex justify-between items-center py-3 border-b border-[#e2e8f0] dark:border-[#374151]">
            <span className="text-[#64748b] dark:text-[#94a3b8] font-semibold">{label}</span>
            <span className="text-[#1e293b] dark:text-[#f8fafc] font-mono text-sm">{value}</span>
        </div>
    );
}

const TIER_CONFIG = {
    free:      { label: 'Free',      color: 'bg-gray-500',    description: 'Plan gratuito' },
    supporter: { label: 'Supporter', color: 'bg-blue-600',    description: 'Gracias por apoyar el proyecto' },
    premium:   { label: 'Premium',   color: 'bg-purple-600',  description: 'Acceso completo a todas las funciones' },
    admin:     { label: 'Admin',     color: 'bg-yellow-500',  description: 'Acceso total de administrador' },
};

function TierBadge({ tier }: { tier: AccountTier }) {
    const config = TIER_CONFIG[tier.tier] ?? TIER_CONFIG.free;
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

function IntegrationCard({ icon, name, status, color }: { icon: React.ReactNode; name: string; status: string; color: string }) {
    return (
        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-[#222324] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
            <div className={`p-3 ${color} rounded-lg text-white`}>
                {icon}
            </div>
            <div className="flex-1">
                <div className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{name}</div>
                <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">{status}</div>
            </div>
        </div>
    );
}
