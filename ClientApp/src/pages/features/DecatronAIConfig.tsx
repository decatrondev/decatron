import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Save, Plus, Trash2, Users, BarChart3, AlertCircle, ExternalLink, Cpu, Settings } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import api from '../../services/api';

interface ChannelConfig {
    channelName: string;
    permissionLevel: string;
    whitelistEnabled: boolean;
    whitelistUsers: string[];
    blacklistUsers: string[];
    channelCooldownSeconds: number;
    userCooldownSeconds: number | null;
    customPrefix: string | null;
    customSystemPrompt: string | null;
}

interface GlobalDefaults {
    minCooldown: number;
    defaultCooldown: number;
    maxPromptLength: number;
}

interface Stats {
    totalUsage: number;
    todayUsage: number;
    weekUsage: number;
    topUsers: { username: string; count: number }[];
    recentUsage: { username: string; prompt: string; response: string; success: boolean; usedAt: string }[];
}

export default function DecatronAIConfig() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const [canConfigure, setCanConfigure] = useState(false);
    const [noAccess, setNoAccess] = useState(false);
    const [noPermission, setNoPermission] = useState(false);
    const [channelName, setChannelName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'config' | 'users' | 'stats'>('config');

    const [config, setConfig] = useState<ChannelConfig>({
        channelName: '',
        permissionLevel: 'everyone',
        whitelistEnabled: false,
        whitelistUsers: [],
        blacklistUsers: [],
        channelCooldownSeconds: 300,
        userCooldownSeconds: null,
        customPrefix: null,
        customSystemPrompt: null
    });

    const [globalDefaults, setGlobalDefaults] = useState<GlobalDefaults>({
        minCooldown: 120,
        defaultCooldown: 300,
        maxPromptLength: 200
    });

    const [stats, setStats] = useState<Stats | null>(null);
    const [newWhitelistUser, setNewWhitelistUser] = useState('');
    const [newBlacklistUser, setNewBlacklistUser] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (!permissionsLoading) {
            // Verificar primero si tiene control_total
            if (!hasMinimumLevel('control_total')) {
                setNoPermission(true);
                setLoading(false);
                return;
            }
            checkAccess();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    const checkAccess = async () => {
        try {
            const response = await api.get('/decatron-ai/check-access');
            if (response.data.canConfigure) {
                setCanConfigure(true);
                setChannelName(response.data.channelName);
                await loadData();
            } else {
                setNoAccess(true);
            }
        } catch {
            setNoAccess(true);
        } finally {
            setLoading(false);
        }
    };

    const loadData = async () => {
        try {
            const [configRes, statsRes] = await Promise.all([
                api.get('/decatron-ai/config'),
                api.get('/decatron-ai/stats')
            ]);

            if (configRes.data.success) {
                const cfg = configRes.data.config;
                setConfig({
                    ...cfg,
                    whitelistUsers: typeof cfg.whitelistUsers === 'string' ? JSON.parse(cfg.whitelistUsers || '[]') : cfg.whitelistUsers || [],
                    blacklistUsers: typeof cfg.blacklistUsers === 'string' ? JSON.parse(cfg.blacklistUsers || '[]') : cfg.blacklistUsers || []
                });
                setGlobalDefaults(configRes.data.globalDefaults);
            }
            if (statsRes.data.success) setStats(statsRes.data.stats);
        } catch {
            showMessage('error', 'Error cargando datos');
        }
    };

    const saveConfig = async () => {
        setSaving(true);
        try {
            const response = await api.post('/decatron-ai/config', {
                ...config,
                whitelistUsers: config.whitelistUsers,
                blacklistUsers: config.blacklistUsers
            });
            if (response.data.success) {
                showMessage('success', 'Configuracion guardada');
            }
        } catch {
            showMessage('error', 'Error guardando configuracion');
        } finally {
            setSaving(false);
        }
    };

    const addWhitelistUser = () => {
        if (!newWhitelistUser.trim()) return;
        const user = newWhitelistUser.trim().toLowerCase();
        if (!config.whitelistUsers.includes(user)) {
            setConfig({ ...config, whitelistUsers: [...config.whitelistUsers, user] });
        }
        setNewWhitelistUser('');
    };

    const removeWhitelistUser = (user: string) => {
        setConfig({ ...config, whitelistUsers: config.whitelistUsers.filter(u => u !== user) });
    };

    const addBlacklistUser = () => {
        if (!newBlacklistUser.trim()) return;
        const user = newBlacklistUser.trim().toLowerCase();
        if (!config.blacklistUsers.includes(user)) {
            setConfig({ ...config, blacklistUsers: [...config.blacklistUsers, user] });
        }
        setNewBlacklistUser('');
    };

    const removeBlacklistUser = (user: string) => {
        setConfig({ ...config, blacklistUsers: config.blacklistUsers.filter(u => u !== user) });
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    if (permissionsLoading || loading) {
        return <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">Cargando...</div>;
    }

    // Sin permiso control_total
    if (noPermission) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 max-w-md text-center">
                    <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-red-600 dark:text-red-400 mb-2">Acceso Denegado</h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mb-6">
                        No tienes permisos suficientes para acceder a Decatron IA. Se requiere nivel de acceso "Control Total".
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                    >
                        Volver al Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // Canal no tiene permiso de Decatron IA
    if (noAccess) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-8 max-w-md text-center">
                    <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-yellow-600 dark:text-yellow-400 mb-2">Acceso Restringido</h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mb-6">
                        Necesitas permisos especiales para configurar Decatron IA en este canal.
                        Contacta con el desarrollador para solicitar acceso.
                    </p>
                    <div className="space-y-3">
                        <a
                            href="https://twitch.tv/AnthonyDeca"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Twitch: AnthonyDeca
                        </a>
                        <a
                            href="https://discord.gg/anthonydeca"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Discord: AnthonyDeca
                        </a>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc] rounded-lg font-bold transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            Volver al Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!canConfigure) return null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Cpu className="w-8 h-8 text-[#2563eb]" />
                        <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Decatron IA</h1>
                    </div>
                    <p className="text-[#64748b] dark:text-[#94a3b8]">
                        Configura la IA para el canal <span className="font-bold text-[#2563eb]">{channelName}</span>
                    </p>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`p-4 rounded-lg font-semibold ${message.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                    {message.text}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('config')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${activeTab === 'config' ? 'bg-[#2563eb] text-white' : 'bg-white dark:bg-[#1B1C1D] text-[#64748b] dark:text-[#94a3b8] border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb]'}`}
                >
                    <Settings className="w-4 h-4" /> Configuracion
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${activeTab === 'users' ? 'bg-[#2563eb] text-white' : 'bg-white dark:bg-[#1B1C1D] text-[#64748b] dark:text-[#94a3b8] border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb]'}`}
                >
                    <Users className="w-4 h-4" /> Usuarios
                </button>
                <button
                    onClick={() => setActiveTab('stats')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${activeTab === 'stats' ? 'bg-[#2563eb] text-white' : 'bg-white dark:bg-[#1B1C1D] text-[#64748b] dark:text-[#94a3b8] border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb]'}`}
                >
                    <BarChart3 className="w-4 h-4" /> Estadisticas
                </button>
            </div>

            {/* Config Tab */}
            {activeTab === 'config' && (
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">NIVEL DE PERMISO</label>
                            <select
                                value={config.permissionLevel}
                                onChange={(e) => setConfig({ ...config, permissionLevel: e.target.value })}
                                className="w-full px-4 py-3 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] font-medium"
                            >
                                <option value="everyone">Todos</option>
                                <option value="subscriber">Suscriptores+</option>
                                <option value="vip">VIPs+</option>
                                <option value="moderator">Moderadores+</option>
                                <option value="broadcaster">Solo Streamer</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                                COOLDOWN CANAL (seg) - Min: {globalDefaults.minCooldown}
                            </label>
                            <input
                                type="number"
                                value={config.channelCooldownSeconds}
                                min={globalDefaults.minCooldown}
                                onChange={(e) => setConfig({ ...config, channelCooldownSeconds: Math.max(parseInt(e.target.value) || 0, globalDefaults.minCooldown) })}
                                className="w-full px-4 py-3 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">COOLDOWN USUARIO (seg) - Opcional</label>
                            <input
                                type="number"
                                value={config.userCooldownSeconds || ''}
                                placeholder="Sin limite"
                                onChange={(e) => setConfig({ ...config, userCooldownSeconds: e.target.value ? parseInt(e.target.value) : null })}
                                className="w-full px-4 py-3 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">PREFIJO PERSONALIZADO</label>
                            <input
                                type="text"
                                value={config.customPrefix || ''}
                                placeholder="Usar default global"
                                onChange={(e) => setConfig({ ...config, customPrefix: e.target.value || null })}
                                className="w-full px-4 py-3 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] font-medium"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">PROMPT PERSONALIZADO</label>
                        <textarea
                            value={config.customSystemPrompt || ''}
                            placeholder="Usar prompt global por defecto..."
                            onChange={(e) => setConfig({ ...config, customSystemPrompt: e.target.value || null })}
                            rows={3}
                            className="w-full px-4 py-3 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] font-medium"
                        />
                    </div>

                    <button
                        onClick={saveConfig}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg font-bold transition-all disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar Configuracion'}
                    </button>
                </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
                <div className="space-y-6">
                    {/* Whitelist */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">Whitelist</h3>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.whitelistEnabled}
                                    onChange={(e) => setConfig({ ...config, whitelistEnabled: e.target.checked })}
                                    className="rounded border-[#e2e8f0] dark:border-[#374151]"
                                />
                                <span className="text-sm font-semibold text-[#64748b] dark:text-[#94a3b8]">Activar whitelist</span>
                            </label>
                        </div>
                        {config.whitelistEnabled && (
                            <>
                                <div className="flex gap-2 mb-4">
                                    <input
                                        type="text"
                                        value={newWhitelistUser}
                                        onChange={(e) => setNewWhitelistUser(e.target.value)}
                                        placeholder="Usuario..."
                                        className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                    />
                                    <button onClick={addWhitelistUser} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-all">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {config.whitelistUsers.map((user) => (
                                        <span key={user} className="flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-semibold">
                                            {user}
                                            <button onClick={() => removeWhitelistUser(user)} className="hover:text-red-600">
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </>
                        )}
                        {!config.whitelistEnabled && (
                            <p className="text-[#64748b] dark:text-[#94a3b8] text-sm">Whitelist desactivada. Se usa el nivel de permiso configurado.</p>
                        )}
                    </div>

                    {/* Blacklist */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                        <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">Blacklist</h3>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={newBlacklistUser}
                                onChange={(e) => setNewBlacklistUser(e.target.value)}
                                placeholder="Usuario a bloquear..."
                                className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                            />
                            <button onClick={addBlacklistUser} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {config.blacklistUsers.map((user) => (
                                <span key={user} className="flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full font-semibold">
                                    {user}
                                    <button onClick={() => removeBlacklistUser(user)} className="hover:text-red-900">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                            {config.blacklistUsers.length === 0 && (
                                <p className="text-[#64748b] dark:text-[#94a3b8] text-sm">No hay usuarios bloqueados</p>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={saveConfig}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg font-bold transition-all disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && stats && (
                <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                            <p className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">TOTAL</p>
                            <p className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">{stats.totalUsage}</p>
                        </div>
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                            <p className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">HOY</p>
                            <p className="text-3xl font-black text-[#2563eb]">{stats.todayUsage}</p>
                        </div>
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                            <p className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">ESTA SEMANA</p>
                            <p className="text-3xl font-black text-green-500">{stats.weekUsage}</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                        <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">Top Usuarios</h3>
                        <div className="space-y-2">
                            {stats.topUsers.map((item, i) => (
                                <div key={i} className="flex justify-between p-3 bg-[#f8fafc] dark:bg-[#262626] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                                    <span className="font-semibold text-[#1e293b] dark:text-[#f8fafc]">{item.username}</span>
                                    <span className="font-bold text-[#2563eb]">{item.count} usos</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                        <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">Uso Reciente</h3>
                        <div className="space-y-2">
                            {stats.recentUsage.map((item, i) => (
                                <div key={i} className="p-3 bg-[#f8fafc] dark:bg-[#262626] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                                    <div className="flex justify-between mb-1">
                                        <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{item.username}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${item.success ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                                            {item.success ? 'OK' : 'Error'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{item.prompt}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
