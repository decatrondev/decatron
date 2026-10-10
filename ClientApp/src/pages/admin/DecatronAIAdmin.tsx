import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Settings, Users, BarChart3, Cpu, X } from 'lucide-react';
import api from '../../services/api';

interface GlobalConfig {
    enabled: boolean;
    aiProvider: string;  // "gemini" o "openrouter"
    fallbackEnabled: boolean;
    model: string;  // Modelo de Gemini
    openRouterModel: string;  // Modelo de OpenRouter
    maxTokens: number;
    systemPrompt: string;
    responsePrefix: string;
    globalCooldownSeconds: number;
    minChannelCooldownSeconds: number;
    defaultChannelCooldownSeconds: number;
    maxPromptLength: number;
}

interface ChannelPermission {
    id: number;
    channelName: string;
    enabled: boolean;
    canConfigure: boolean;
    notes: string | null;
}

interface ChannelConfig {
    permissionLevel: string;
    whitelistEnabled: boolean;
    whitelistUsers: string[];
    blacklistUsers: string[];
    channelCooldownSeconds: number;
    userCooldownSeconds: number | null;
    customPrefix: string | null;
    customSystemPrompt: string | null;
}

interface Stats {
    totalUsage: number;
    todayUsage: number;
    weekUsage: number;
    monthUsage: number;
    totalChannels: number;
    totalTokens: number;
    topChannels: { channel: string; count: number }[];
    recentUsage: { channelName: string; username: string; prompt: string; success: boolean; usedAt: string }[];
}

export default function DecatronAIAdmin() {
    const navigate = useNavigate();
    const [isOwner, setIsOwner] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'config' | 'channels' | 'stats'>('config');

    const [config, setConfig] = useState<GlobalConfig>({
        enabled: false,
        aiProvider: 'gemini',
        fallbackEnabled: false,
        model: 'gemini-3.5-flash-lite',
        openRouterModel: 'qwen/qwen3.8-flash',
        maxTokens: 60,
        systemPrompt: '',
        responsePrefix: '',
        globalCooldownSeconds: 30,
        minChannelCooldownSeconds: 120,
        defaultChannelCooldownSeconds: 300,
        maxPromptLength: 200
    });

    const [channels, setChannels] = useState<ChannelPermission[]>([]);
    const [newChannel, setNewChannel] = useState('');
    const [stats, setStats] = useState<Stats | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Modal de configuración de canal
    const [editingChannel, setEditingChannel] = useState<string | null>(null);
    const [channelConfig, setChannelConfig] = useState<ChannelConfig>({
        permissionLevel: 'everyone',
        whitelistEnabled: false,
        whitelistUsers: [],
        blacklistUsers: [],
        channelCooldownSeconds: 300,
        userCooldownSeconds: null,
        customPrefix: null,
        customSystemPrompt: null
    });
    const [newWhitelistUser, setNewWhitelistUser] = useState('');
    const [newBlacklistUser, setNewBlacklistUser] = useState('');
    const [savingChannelConfig, setSavingChannelConfig] = useState(false);

    useEffect(() => {
        checkOwner();
    }, []);

    const checkOwner = async () => {
        try {
            const response = await api.get('/admin/decatron-ai/check-owner');
            if (response.data.isOwner) {
                setIsOwner(true);
                await loadData();
            } else {
                navigate('/dashboard');
            }
        } catch {
            navigate('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const loadData = async () => {
        try {
            const [configRes, channelsRes, statsRes] = await Promise.all([
                api.get('/admin/decatron-ai/global-config'),
                api.get('/admin/decatron-ai/channels'),
                api.get('/admin/decatron-ai/stats')
            ]);

            if (configRes.data.success) setConfig(configRes.data.config);
            if (channelsRes.data.success) setChannels(channelsRes.data.channels);
            if (statsRes.data.success) setStats(statsRes.data.stats);
        } catch (err) {
            showMessage('error', 'Error cargando datos');
        }
    };

    const saveConfig = async () => {
        setSaving(true);
        try {
            const response = await api.post('/admin/decatron-ai/global-config', config);
            if (response.data.success) {
                showMessage('success', 'Configuracion guardada');
            }
        } catch {
            showMessage('error', 'Error guardando configuracion');
        } finally {
            setSaving(false);
        }
    };

    const addChannel = async () => {
        if (!newChannel.trim()) return;
        try {
            const response = await api.post('/admin/decatron-ai/channels', {
                channelName: newChannel.trim().toLowerCase()
            });
            if (response.data.success) {
                setChannels([...channels, response.data.channel]);
                setNewChannel('');
                showMessage('success', 'Canal agregado');
            }
        } catch {
            showMessage('error', 'Error agregando canal');
        }
    };

    const updateChannel = async (channelName: string, updates: Partial<ChannelPermission>) => {
        try {
            await api.put(`/admin/decatron-ai/channels/${channelName}`, updates);
            setChannels(channels.map(c =>
                c.channelName === channelName ? { ...c, ...updates } : c
            ));
        } catch {
            showMessage('error', 'Error actualizando canal');
        }
    };

    const deleteChannel = async (channelName: string) => {
        if (!confirm(`Eliminar canal ${channelName}?`)) return;
        try {
            await api.delete(`/admin/decatron-ai/channels/${channelName}`);
            setChannels(channels.filter(c => c.channelName !== channelName));
            showMessage('success', 'Canal eliminado');
        } catch {
            showMessage('error', 'Error eliminando canal');
        }
    };

    // ==================== CONFIGURACIÓN DE CANAL ====================

    const openChannelConfig = async (channelName: string) => {
        try {
            const response = await api.get(`/admin/decatron-ai/channels/${channelName}/config`);
            if (response.data.success) {
                const cfg = response.data.config;
                setChannelConfig({
                    permissionLevel: cfg.permissionLevel || 'everyone',
                    whitelistEnabled: cfg.whitelistEnabled || false,
                    whitelistUsers: typeof cfg.whitelistUsers === 'string' ? JSON.parse(cfg.whitelistUsers || '[]') : cfg.whitelistUsers || [],
                    blacklistUsers: typeof cfg.blacklistUsers === 'string' ? JSON.parse(cfg.blacklistUsers || '[]') : cfg.blacklistUsers || [],
                    channelCooldownSeconds: cfg.channelCooldownSeconds || 300,
                    userCooldownSeconds: cfg.userCooldownSeconds || null,
                    customPrefix: cfg.customPrefix || null,
                    customSystemPrompt: cfg.customSystemPrompt || null
                });
                setEditingChannel(channelName);
            }
        } catch {
            showMessage('error', 'Error cargando configuración del canal');
        }
    };

    const saveChannelConfig = async () => {
        if (!editingChannel) return;
        setSavingChannelConfig(true);
        try {
            const response = await api.post(`/admin/decatron-ai/channels/${editingChannel}/config`, {
                permissionLevel: channelConfig.permissionLevel,
                whitelistEnabled: channelConfig.whitelistEnabled,
                whitelistUsers: channelConfig.whitelistUsers,
                blacklistUsers: channelConfig.blacklistUsers,
                channelCooldownSeconds: channelConfig.channelCooldownSeconds,
                userCooldownSeconds: channelConfig.userCooldownSeconds,
                customPrefix: channelConfig.customPrefix,
                customSystemPrompt: channelConfig.customSystemPrompt
            });
            if (response.data.success) {
                showMessage('success', 'Configuración del canal guardada');
                setEditingChannel(null);
            }
        } catch {
            showMessage('error', 'Error guardando configuración del canal');
        } finally {
            setSavingChannelConfig(false);
        }
    };

    const addWhitelistUserAdmin = () => {
        if (!newWhitelistUser.trim()) return;
        const user = newWhitelistUser.trim().toLowerCase();
        if (!channelConfig.whitelistUsers.includes(user)) {
            setChannelConfig({ ...channelConfig, whitelistUsers: [...channelConfig.whitelistUsers, user] });
        }
        setNewWhitelistUser('');
    };

    const removeWhitelistUserAdmin = (user: string) => {
        setChannelConfig({ ...channelConfig, whitelistUsers: channelConfig.whitelistUsers.filter(u => u !== user) });
    };

    const addBlacklistUserAdmin = () => {
        if (!newBlacklistUser.trim()) return;
        const user = newBlacklistUser.trim().toLowerCase();
        if (!channelConfig.blacklistUsers.includes(user)) {
            setChannelConfig({ ...channelConfig, blacklistUsers: [...channelConfig.blacklistUsers, user] });
        }
        setNewBlacklistUser('');
    };

    const removeBlacklistUserAdmin = (user: string) => {
        setChannelConfig({ ...channelConfig, blacklistUsers: channelConfig.blacklistUsers.filter(u => u !== user) });
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ds-accent"></div>
            </div>
        );
    }

    if (!isOwner) return null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/dashboard')} className="ds-btn ds-btn--secondary ds-icon-btn">
                        <ArrowLeft className="w-5 h-5 text-ds-soft" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Cpu className="w-8 h-8 text-ds-accent-text" />
                            <h1 className="text-3xl font-black text-ds-text">Decatron IA - Admin</h1>
                        </div>
                        <p className="text-ds-soft">Configuración global del sistema de IA</p>
                    </div>
                </div>

                {/* Toggle Global */}
                <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${config.enabled ? 'text-ds-ok ' : 'text-ds-danger '}`}>
                        {config.enabled ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                    <button
                        onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.enabled ? 'bg-ds-accent' : 'bg-ds-raised '}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-ds-surface transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`p-4 rounded-lg font-semibold ${message.type === 'success' ? 'bg-ds-ok/10 text-ds-ok ' : 'bg-ds-danger/10 text-ds-danger '}`}>
                    {message.text}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('config')}
                    className={activeTab === 'config' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                >
                    <Settings className="w-4 h-4" /> Configuración
                </button>
                <button
                    onClick={() => setActiveTab('channels')}
                    className={activeTab === 'channels' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                >
                    <Users className="w-4 h-4" /> Canales ({channels.length})
                </button>
                <button
                    onClick={() => setActiveTab('stats')}
                    className={activeTab === 'stats' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                >
                    <BarChart3 className="w-4 h-4" /> Estadísticas
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'config' && (
                <div className="bg-ds-surface rounded-lg p-6 border border-ds-border space-y-6">
                    {/* Provider Selection */}
                    <div className="bg-ds-accent/10 border border-ds-accent rounded-lg p-4 space-y-4">
                        <h3 className="font-bold text-ds-accent-text">Proveedor de IA</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-ds-soft mb-2">PROVIDER PRINCIPAL</label>
                                <select
                                    value={config.aiProvider}
                                    onChange={(e) => setConfig({ ...config, aiProvider: e.target.value })}
                                    className="ds-input w-full"
                                >
                                    <option value="gemini">Gemini (Google)</option>
                                    <option value="openrouter">OpenRouter</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-ds-soft mb-2">FALLBACK</label>
                                <div className="flex items-center gap-3 h-10">
                                    <button
                                        onClick={() => setConfig({ ...config, fallbackEnabled: !config.fallbackEnabled })}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.fallbackEnabled ? 'bg-ds-accent' : 'bg-ds-raised '}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-ds-surface transition-transform ${config.fallbackEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                    <span className="text-sm font-semibold text-ds-soft">
                                        {config.fallbackEnabled ? 'Activado' : 'Desactivado'}
                                    </span>
                                </div>
                                <p className="text-xs text-ds-soft mt-1">Si falla, intenta con el otro</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-ds-soft mb-2">MAX TOKENS</label>
                                <input
                                    type="number"
                                    value={config.maxTokens}
                                    onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) || 60 })}
                                    className="ds-input w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Models Configuration */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className={`p-4 rounded-lg border-2 ${config.aiProvider === 'gemini' ? 'border-ds-accent bg-ds-accent/10 ' : 'border-ds-border '}`}>
                            <label className="block text-sm font-bold text-ds-soft mb-2">
                                MODELO GEMINI {config.aiProvider === 'gemini' && <span className="text-ds-accent-text">(Activo)</span>}
                            </label>
                            <input
                                type="text"
                                value={config.model}
                                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                                placeholder="gemini-3.5-flash-lite"
                                className="ds-input w-full"
                            />
                            <p className="text-xs text-ds-soft mt-1">Ej: gemini-3.5-flash-lite, gemini-3.5-flash, gemini-2.5-flash-lite</p>
                        </div>
                        <div className={`p-4 rounded-lg border-2 ${config.aiProvider === 'openrouter' ? 'border-ds-accent bg-ds-accent/10 ' : 'border-ds-border '}`}>
                            <label className="block text-sm font-bold text-ds-soft mb-2">
                                MODELO OPENROUTER {config.aiProvider === 'openrouter' && <span className="text-ds-accent-text">(Activo)</span>}
                            </label>
                            <input
                                type="text"
                                value={config.openRouterModel}
                                onChange={(e) => setConfig({ ...config, openRouterModel: e.target.value })}
                                placeholder="qwen/qwen3.8-flash"
                                className="ds-input w-full"
                            />
                            <p className="text-xs text-ds-soft mt-1">Ej: qwen/qwen3.8-flash, deepseek/deepseek-v4.1-flash — precios y uso en Admin → Costos de IA</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">PREFIJO RESPUESTA</label>
                            <input
                                type="text"
                                value={config.responsePrefix}
                                onChange={(e) => setConfig({ ...config, responsePrefix: e.target.value })}
                                className="ds-input w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">MAX LONGITUD PROMPT</label>
                            <input
                                type="number"
                                value={config.maxPromptLength}
                                onChange={(e) => setConfig({ ...config, maxPromptLength: parseInt(e.target.value) || 200 })}
                                className="ds-input w-full"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">SYSTEM PROMPT</label>
                        <textarea
                            value={config.systemPrompt}
                            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                            rows={4}
                            className="ds-input w-full"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">CD CANAL MÍNIMO (seg)</label>
                            <input
                                type="number"
                                value={config.minChannelCooldownSeconds}
                                onChange={(e) => setConfig({ ...config, minChannelCooldownSeconds: parseInt(e.target.value) || 120 })}
                                className="ds-input w-full"
                            />
                            <p className="text-xs text-ds-soft mt-1">Mín que puede poner streamer</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">CD CANAL DEFAULT (seg)</label>
                            <input
                                type="number"
                                value={config.defaultChannelCooldownSeconds}
                                onChange={(e) => setConfig({ ...config, defaultChannelCooldownSeconds: parseInt(e.target.value) || 300 })}
                                className="ds-input w-full"
                            />
                            <p className="text-xs text-ds-soft mt-1">Default para nuevos canales</p>
                        </div>
                    </div>

                    <button
                        onClick={saveConfig}
                        disabled={saving}
                        className="ds-btn ds-btn--primary ds-btn--lg"
                    >
                        <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                </div>
            )}

            {activeTab === 'channels' && (
                <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                    {/* Add Channel */}
                    <div className="flex gap-2 mb-6">
                        <input
                            type="text"
                            value={newChannel}
                            onChange={(e) => setNewChannel(e.target.value)}
                            placeholder="Nombre del canal..."
                            className="ds-input flex-1"
                        />
                        <button
                            onClick={addChannel}
                            className="ds-btn ds-btn--primary"
                        >
                            <Plus className="w-4 h-4" /> Agregar
                        </button>
                    </div>

                    {/* Channels List */}
                    <div className="space-y-3">
                        {channels.map((channel) => (
                            <div key={channel.id} className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-ds-text">{channel.channelName}</span>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={channel.enabled}
                                                onChange={(e) => updateChannel(channel.channelName, { enabled: e.target.checked })}
                                                className="rounded border-ds-border"
                                            />
                                            <span className="font-semibold text-ds-soft">Habilitado</span>
                                        </label>
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={channel.canConfigure}
                                                onChange={(e) => updateChannel(channel.channelName, { canConfigure: e.target.checked })}
                                                className="rounded border-ds-border"
                                            />
                                            <span className="font-semibold text-ds-soft">Puede Configurar</span>
                                        </label>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openChannelConfig(channel.channelName)}
                                        className="ds-btn ds-btn--primary"
                                    >
                                        <Settings className="w-4 h-4" /> Configurar
                                    </button>
                                    <button
                                        onClick={() => deleteChannel(channel.channelName)}
                                        className="p-2 text-ds-danger hover:bg-ds-danger/10 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {channels.length === 0 && (
                            <div className="text-center py-8 text-ds-soft">
                                No hay canales configurados
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Configuración de Canal */}
            {editingChannel && (
                <div className="fixed inset-0 bg-ds-input/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-ds-surface rounded-lg p-6 border border-ds-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-black text-ds-text">
                                Configurar: {editingChannel}
                            </h2>
                            <button onClick={() => setEditingChannel(null)} className="ds-btn ds-btn--ghost ds-icon-btn">
                                <X className="w-5 h-5 text-ds-soft" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Nivel de Permiso */}
                            <div>
                                <label className="block text-sm font-bold text-ds-soft mb-2">NIVEL DE PERMISO</label>
                                <select
                                    value={channelConfig.permissionLevel}
                                    onChange={(e) => setChannelConfig({ ...channelConfig, permissionLevel: e.target.value })}
                                    className="ds-input w-full"
                                >
                                    <option value="everyone">Todos</option>
                                    <option value="subscriber">Suscriptores+</option>
                                    <option value="vip">VIPs+</option>
                                    <option value="moderator">Moderadores+</option>
                                    <option value="broadcaster">Solo Streamer</option>
                                </select>
                            </div>

                            {/* Cooldowns */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-ds-soft mb-2">COOLDOWN CANAL (seg)</label>
                                    <input
                                        type="number"
                                        value={channelConfig.channelCooldownSeconds}
                                        onChange={(e) => setChannelConfig({ ...channelConfig, channelCooldownSeconds: parseInt(e.target.value) || 300 })}
                                        className="ds-input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-ds-soft mb-2">COOLDOWN USUARIO (seg)</label>
                                    <input
                                        type="number"
                                        value={channelConfig.userCooldownSeconds || ''}
                                        placeholder="Sin límite"
                                        onChange={(e) => setChannelConfig({ ...channelConfig, userCooldownSeconds: e.target.value ? parseInt(e.target.value) : null })}
                                        className="ds-input w-full"
                                    />
                                </div>
                            </div>

                            {/* Whitelist */}
                            <div className="p-4 bg-ds-ok/10 border border-ds-ok/40 rounded-lg">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-ds-ok">Whitelist</h3>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={channelConfig.whitelistEnabled}
                                            onChange={(e) => setChannelConfig({ ...channelConfig, whitelistEnabled: e.target.checked })}
                                            className="rounded"
                                        />
                                        <span className="text-sm font-semibold text-ds-ok">Activar</span>
                                    </label>
                                </div>
                                {channelConfig.whitelistEnabled && (
                                    <>
                                        <div className="flex gap-2 mb-3">
                                            <input
                                                type="text"
                                                value={newWhitelistUser}
                                                onChange={(e) => setNewWhitelistUser(e.target.value)}
                                                placeholder="Usuario..."
                                                className="ds-input flex-1"
                                            />
                                            <button onClick={addWhitelistUserAdmin} className="ds-btn ds-btn--primary">
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {channelConfig.whitelistUsers.map((user) => (
                                                <span key={user} className="flex items-center gap-1 px-3 py-1 bg-ds-ok/10 text-ds-ok rounded-full font-semibold text-sm">
                                                    {user}
                                                    <button onClick={() => removeWhitelistUserAdmin(user)} className="hover:text-ds-danger">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </span>
                                            ))}
                                            {channelConfig.whitelistUsers.length === 0 && (
                                                <span className="text-sm text-ds-ok">Sin usuarios</span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Blacklist */}
                            <div className="p-4 bg-ds-danger/10 border border-ds-danger/40 rounded-lg">
                                <h3 className="font-bold text-ds-danger mb-3">Blacklist</h3>
                                <div className="flex gap-2 mb-3">
                                    <input
                                        type="text"
                                        value={newBlacklistUser}
                                        onChange={(e) => setNewBlacklistUser(e.target.value)}
                                        placeholder="Usuario a bloquear..."
                                        className="ds-input flex-1"
                                    />
                                    <button onClick={addBlacklistUserAdmin} className="ds-btn ds-btn--danger">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {channelConfig.blacklistUsers.map((user) => (
                                        <span key={user} className="flex items-center gap-1 px-3 py-1 bg-ds-danger/10 text-ds-danger rounded-full font-semibold text-sm">
                                            {user}
                                            <button onClick={() => removeBlacklistUserAdmin(user)} className="hover:text-ds-danger">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                    {channelConfig.blacklistUsers.length === 0 && (
                                        <span className="text-sm text-ds-danger">Sin usuarios bloqueados</span>
                                    )}
                                </div>
                            </div>

                            {/* Botones */}
                            <div className="flex gap-3 pt-4 border-t border-ds-border">
                                <button
                                    onClick={saveChannelConfig}
                                    disabled={savingChannelConfig}
                                    className="ds-btn ds-btn--primary ds-btn--lg flex-1"
                                >
                                    <Save className="w-4 h-4" /> {savingChannelConfig ? 'Guardando...' : 'Guardar'}
                                </button>
                                <button
                                    onClick={() => setEditingChannel(null)}
                                    className="ds-btn ds-btn--secondary ds-btn--lg"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'stats' && stats && (
                <div className="space-y-6">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                            <p className="text-sm font-bold text-ds-soft mb-1">TOTAL</p>
                            <p className="text-3xl font-black text-ds-text">{stats.totalUsage}</p>
                        </div>
                        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                            <p className="text-sm font-bold text-ds-soft mb-1">HOY</p>
                            <p className="text-3xl font-black text-ds-accent-text">{stats.todayUsage}</p>
                        </div>
                        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                            <p className="text-sm font-bold text-ds-soft mb-1">ESTA SEMANA</p>
                            <p className="text-3xl font-black text-ds-ok">{stats.weekUsage}</p>
                        </div>
                        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                            <p className="text-sm font-bold text-ds-soft mb-1">TOKENS USADOS</p>
                            <p className="text-3xl font-black text-ds-accent-text">{stats.totalTokens}</p>
                        </div>
                    </div>

                    {/* Top Channels */}
                    <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                        <h3 className="text-xl font-black text-ds-text mb-4">Top Canales</h3>
                        <div className="space-y-2">
                            {stats.topChannels.map((item, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-ds-bg rounded-lg border border-ds-border">
                                    <span className="font-semibold text-ds-text">{item.channel}</span>
                                    <span className="font-bold text-ds-accent-text">{item.count} usos</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Usage */}
                    <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                        <h3 className="text-xl font-black text-ds-text mb-4">Uso Reciente</h3>
                        <div className="space-y-2">
                            {stats.recentUsage.map((item, i) => (
                                <div key={i} className="p-3 bg-ds-bg rounded-lg border border-ds-border">
                                    <div className="flex justify-between mb-1">
                                        <div>
                                            <span className="font-bold text-ds-text">{item.channelName}</span>
                                            <span className="text-ds-soft mx-2">|</span>
                                            <span className="font-semibold text-ds-soft">{item.username}</span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${item.success ? 'bg-ds-ok/10 text-ds-ok ' : 'bg-ds-danger/10 text-ds-danger '}`}>
                                            {item.success ? 'OK' : 'Error'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-ds-soft">{item.prompt}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
