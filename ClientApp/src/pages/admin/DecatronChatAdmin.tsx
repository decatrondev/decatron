import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Settings, Users, BarChart3, FileText, Search, Edit2 } from 'lucide-react';
import api from '../../services/api';

interface ChatConfig {
    enabled: boolean;
    aiProvider: string;
    fallbackEnabled: boolean;
    model: string;
    openRouterModel: string;
    maxTokens: number;
    systemPrompt: string;
    maxConversationsPerUser: number;
    maxMessagesPerConversation: number;
    contextMessages: number;
}

interface Permission {
    id: number;
    userId: number;
    username: string;
    displayName: string;
    canView: boolean;
    canChat: boolean;
    notes: string | null;
    createdAt: string;
}

interface Stats {
    totalConversations: number;
    totalMessages: number;
    todayMessages: number;
    weekMessages: number;
    monthMessages: number;
    totalTokens: number;
    avgResponseTime: number;
    topUsers: { userId: number; username: string; displayName: string; messageCount: number }[];
}

interface AuditConversation {
    id: string;
    userId: number;
    username: string;
    displayName: string;
    title: string;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
}

interface User {
    id: number;
    login: string;
    displayName: string;
    profileImageUrl: string;
}

export default function DecatronChatAdmin() {
    const navigate = useNavigate();
    const [isOwner, setIsOwner] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'config' | 'permissions' | 'stats' | 'audit'>('config');

    const [config, setConfig] = useState<ChatConfig>({
        enabled: false,
        aiProvider: 'gemini',
        fallbackEnabled: false,
        model: 'gemini-3.5-flash-lite',
        openRouterModel: 'qwen/qwen3.8-flash',
        maxTokens: 2000,
        systemPrompt: '',
        maxConversationsPerUser: 50,
        maxMessagesPerConversation: 100,
        contextMessages: 10
    });

    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [conversations, setConversations] = useState<AuditConversation[]>([]);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Add permission modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [newPermission, setNewPermission] = useState({ canView: true, canChat: false, notes: '' });

    // Edit permission modal
    const [editingPermission, setEditingPermission] = useState<Permission | null>(null);

    useEffect(() => {
        checkOwner();
    }, []);

    useEffect(() => {
        if (activeTab === 'audit' && isOwner) {
            loadAudit();
        }
    }, [activeTab]);

    const checkOwner = async () => {
        try {
            // Reutilizar el endpoint de DecatronAI para verificar owner
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
            const [configRes, permissionsRes, statsRes] = await Promise.all([
                api.get('/admin/chat/config'),
                api.get('/admin/chat/permissions'),
                api.get('/admin/chat/stats')
            ]);

            if (configRes.data.success) setConfig(configRes.data.config);
            if (permissionsRes.data.success) setPermissions(permissionsRes.data.permissions);
            if (statsRes.data.success) setStats(statsRes.data.stats);
        } catch (err) {
            showMessage('error', 'Error cargando datos');
        }
    };

    const loadAudit = async () => {
        try {
            const response = await api.get('/admin/chat/audit/conversations');
            if (response.data.success) {
                setConversations(response.data.conversations);
            }
        } catch (err) {
            showMessage('error', 'Error cargando auditoría');
        }
    };

    const saveConfig = async () => {
        setSaving(true);
        try {
            const response = await api.post('/admin/chat/config', config);
            if (response.data.success) {
                showMessage('success', 'Configuración guardada');
            }
        } catch {
            showMessage('error', 'Error guardando configuración');
        } finally {
            setSaving(false);
        }
    };

    const searchUsers = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }
        try {
            const response = await api.get(`/admin/chat/available-users?search=${encodeURIComponent(query)}`);
            if (response.data.success) {
                setSearchResults(response.data.users);
            }
        } catch (err) {
            console.error('Error searching users:', err);
        }
    };

    const addPermission = async () => {
        if (!selectedUser) return;
        try {
            const response = await api.post('/admin/chat/permissions', {
                userId: selectedUser.id,
                canView: newPermission.canView,
                canChat: newPermission.canChat,
                notes: newPermission.notes || null
            });
            if (response.data.success) {
                setPermissions([...permissions, response.data.permission]);
                setShowAddModal(false);
                setSelectedUser(null);
                setNewPermission({ canView: true, canChat: false, notes: '' });
                setSearchQuery('');
                setSearchResults([]);
                showMessage('success', 'Permiso agregado');
            }
        } catch (err: any) {
            showMessage('error', err.response?.data?.message || 'Error agregando permiso');
        }
    };

    const updatePermission = async (permission: Permission) => {
        try {
            const response = await api.put(`/admin/chat/permissions/${permission.id}`, {
                canView: permission.canView,
                canChat: permission.canChat,
                notes: permission.notes
            });
            if (response.data.success) {
                setPermissions(permissions.map(p => p.id === permission.id ? permission : p));
                setEditingPermission(null);
                showMessage('success', 'Permiso actualizado');
            }
        } catch {
            showMessage('error', 'Error actualizando permiso');
        }
    };

    const deletePermission = async (id: number) => {
        if (!confirm('¿Eliminar este permiso?')) return;
        try {
            const response = await api.delete(`/admin/chat/permissions/${id}`);
            if (response.data.success) {
                setPermissions(permissions.filter(p => p.id !== id));
                showMessage('success', 'Permiso eliminado');
            }
        } catch {
            showMessage('error', 'Error eliminando permiso');
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    if (loading) {
        return <div className="text-center py-8 text-ds-soft">Cargando...</div>;
    }

    if (!isOwner) {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="ds-btn ds-btn--ghost ds-icon-btn"
                    >
                        <ArrowLeft className="w-5 h-5 text-ds-soft" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">Admin: Decatron Chat IA</h1>
                        <p className="text-ds-soft mt-1">
                            Configuración del sistema de chat privado con IA
                        </p>
                    </div>
                </div>
            </div>

            {/* Message Toast */}
            {message && (
                <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-ds-ok/10 text-ds-ok ' : 'bg-ds-danger/10 text-ds-danger '}`}>
                    {message.text}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-ds-border">
                {[
                    { id: 'config', icon: Settings, label: 'Configuración' },
                    { id: 'permissions', icon: Users, label: 'Permisos' },
                    { id: 'stats', icon: BarChart3, label: 'Estadísticas' },
                    { id: 'audit', icon: FileText, label: 'Auditoría' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-3 font-bold transition-colors ${activeTab === tab.id
                            ? 'text-ds-accent-text border-b-2 border-ds-accent'
                            : 'text-ds-soft hover:text-ds-text '
                            }`}
                    >
                        <tab.icon className="w-5 h-5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'config' && (
                <div className="space-y-6">
                    <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                        {/* Enable Toggle */}
                        <div className="mb-6">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.enabled}
                                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                                    className="w-5 h-5 text-ds-accent-text rounded"
                                />
                                <span className="text-lg font-bold text-ds-text">
                                    Sistema Habilitado
                                </span>
                            </label>
                        </div>

                        {/* AI Provider */}
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-ds-text mb-2">
                                Proveedor de IA
                            </label>
                            <select
                                value={config.aiProvider}
                                onChange={(e) => setConfig({ ...config, aiProvider: e.target.value })}
                                className="ds-input w-full"
                            >
                                <option value="gemini">Gemini</option>
                                <option value="openrouter">OpenRouter</option>
                            </select>
                        </div>

                        {/* Fallback */}
                        <div className="mb-6">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.fallbackEnabled}
                                    onChange={(e) => setConfig({ ...config, fallbackEnabled: e.target.checked })}
                                    className="w-5 h-5 text-ds-accent-text rounded"
                                />
                                <span className="text-sm font-bold text-ds-text">
                                    Fallback Habilitado
                                </span>
                            </label>
                        </div>

                        {/* Models */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-bold text-ds-text mb-2">
                                    Modelo Gemini
                                </label>
                                <input
                                    type="text"
                                    value={config.model}
                                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                                    className="ds-input w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-ds-text mb-2">
                                    Modelo OpenRouter
                                </label>
                                <input
                                    type="text"
                                    value={config.openRouterModel}
                                    onChange={(e) => setConfig({ ...config, openRouterModel: e.target.value })}
                                    className="ds-input w-full"
                                />
                            </div>
                        </div>

                        {/* Limits */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-bold text-ds-text mb-2">
                                    Max Tokens
                                </label>
                                <input
                                    type="number"
                                    value={config.maxTokens}
                                    onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                                    className="ds-input w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-ds-text mb-2">
                                    Max Conversaciones
                                </label>
                                <input
                                    type="number"
                                    value={config.maxConversationsPerUser}
                                    onChange={(e) => setConfig({ ...config, maxConversationsPerUser: parseInt(e.target.value) })}
                                    className="ds-input w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-ds-text mb-2">
                                    Max Mensajes
                                </label>
                                <input
                                    type="number"
                                    value={config.maxMessagesPerConversation}
                                    onChange={(e) => setConfig({ ...config, maxMessagesPerConversation: parseInt(e.target.value) })}
                                    className="ds-input w-full"
                                />
                            </div>
                        </div>

                        {/* Context Messages */}
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-ds-text mb-2">
                                Mensajes de Contexto (enviados a la IA)
                            </label>
                            <input
                                type="number"
                                value={config.contextMessages}
                                onChange={(e) => setConfig({ ...config, contextMessages: parseInt(e.target.value) })}
                                className="ds-input w-full"
                            />
                            <p className="text-xs text-ds-soft mt-1">
                                Cuántos mensajes previos enviar para mantener contexto
                            </p>
                        </div>

                        {/* System Prompt */}
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-ds-text mb-2">
                                System Prompt
                            </label>
                            <textarea
                                value={config.systemPrompt}
                                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                                rows={6}
                                className="ds-input w-full resize-none"
                            />
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={saveConfig}
                            disabled={saving}
                            className="ds-btn ds-btn--primary ds-btn--lg w-full"
                        >
                            <Save className="w-5 h-5" />
                            {saving ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'permissions' && (
                <div className="space-y-6">
                    {/* Add Permission Button */}
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="ds-btn ds-btn--primary ds-btn--lg"
                    >
                        <Plus className="w-5 h-5" />
                        Agregar Permiso
                    </button>

                    {/* Permissions List */}
                    <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-ds-bg border-b border-ds-border">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-ds-soft uppercase">Usuario</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-ds-soft uppercase">Ver</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-ds-soft uppercase">Chatear</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-ds-soft uppercase">Notas</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-ds-soft uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ds-border">
                                {permissions.map(p => (
                                    <tr key={p.id} className="hover:bg-ds-bg">
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-bold text-ds-text">{p.username}</p>
                                                {p.displayName && (
                                                    <p className="text-xs text-ds-soft">{p.displayName}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${p.canView ? 'bg-ds-ok/10 text-ds-ok ' : 'bg-ds-bg text-ds-soft'}`}>
                                                {p.canView ? 'Sí' : 'No'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${p.canChat ? 'bg-ds-accent/10 text-ds-accent-text ' : 'bg-ds-bg text-ds-soft'}`}>
                                                {p.canChat ? 'Sí' : 'No'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-ds-soft truncate max-w-xs">
                                                {p.notes || '-'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEditingPermission(p)}
                                                    className="p-2 hover:bg-ds-accent/10 rounded transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-4 h-4 text-ds-accent-text" />
                                                </button>
                                                <button
                                                    onClick={() => deletePermission(p.id)}
                                                    className="p-2 hover:bg-ds-danger/10 rounded transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4 text-ds-danger" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {permissions.length === 0 && (
                            <div className="text-center py-8 text-ds-soft">
                                No hay permisos configurados
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'stats' && stats && (
                <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                            <p className="text-sm text-ds-soft mb-2">Conversaciones</p>
                            <p className="text-3xl font-black text-ds-text">{stats.totalConversations}</p>
                        </div>
                        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                            <p className="text-sm text-ds-soft mb-2">Mensajes</p>
                            <p className="text-3xl font-black text-ds-text">{stats.totalMessages}</p>
                        </div>
                        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                            <p className="text-sm text-ds-soft mb-2">Tokens Usados</p>
                            <p className="text-3xl font-black text-ds-text">{stats.totalTokens.toLocaleString()}</p>
                        </div>
                        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                            <p className="text-sm text-ds-soft mb-2">Tiempo Promedio</p>
                            <p className="text-3xl font-black text-ds-text">{Math.round(stats.avgResponseTime)}ms</p>
                        </div>
                    </div>

                    {/* Usage Stats */}
                    <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                        <h3 className="text-xl font-black text-ds-text mb-4">Uso por Período</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <p className="text-sm text-ds-soft mb-1">Hoy</p>
                                <p className="text-2xl font-bold text-ds-text">{stats.todayMessages}</p>
                            </div>
                            <div>
                                <p className="text-sm text-ds-soft mb-1">Esta Semana</p>
                                <p className="text-2xl font-bold text-ds-text">{stats.weekMessages}</p>
                            </div>
                            <div>
                                <p className="text-sm text-ds-soft mb-1">Este Mes</p>
                                <p className="text-2xl font-bold text-ds-text">{stats.monthMessages}</p>
                            </div>
                        </div>
                    </div>

                    {/* Top Users */}
                    <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                        <h3 className="text-xl font-black text-ds-text mb-4">Top Usuarios</h3>
                        <div className="space-y-2">
                            {stats.topUsers.map((user, idx) => (
                                <div key={user.userId} className="flex items-center justify-between p-3 bg-ds-bg rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg font-black text-ds-soft">#{idx + 1}</span>
                                        <div>
                                            <p className="font-bold text-ds-text">{user.username}</p>
                                            {user.displayName && (
                                                <p className="text-xs text-ds-soft">{user.displayName}</p>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-lg font-bold text-ds-accent-text">{user.messageCount} mensajes</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'audit' && (
                <div className="space-y-6">
                    <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-ds-bg border-b border-ds-border">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-ds-soft uppercase">Usuario</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-ds-soft uppercase">Título</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-ds-soft uppercase">Mensajes</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-ds-soft uppercase">Última Actualización</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ds-border">
                                {conversations.map(conv => (
                                    <tr key={conv.id} className="hover:bg-ds-bg">
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-bold text-ds-text">{conv.username}</p>
                                                {conv.displayName && (
                                                    <p className="text-xs text-ds-soft">{conv.displayName}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-ds-text">{conv.title}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-ds-accent/10 text-ds-accent-text rounded text-xs font-bold">
                                                {conv.messageCount}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-ds-soft">
                                                {new Date(conv.updatedAt).toLocaleString()}
                                            </p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {conversations.length === 0 && (
                            <div className="text-center py-8 text-ds-soft">
                                No hay conversaciones
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Add Permission Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-ds-input/50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
                    <div className="bg-ds-surface rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-ds-text mb-4">Agregar Permiso</h3>

                        {/* Search Users */}
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-ds-text mb-2">
                                Buscar Usuario
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ds-soft" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        searchUsers(e.target.value);
                                    }}
                                    placeholder="Buscar por nombre..."
                                    className="ds-input w-full pl-10 pr-4"
                                />
                            </div>
                            {searchResults.length > 0 && (
                                <div className="mt-2 max-h-40 overflow-y-auto border border-ds-border rounded-lg">
                                    {searchResults.map(user => (
                                        <button
                                            key={user.id}
                                            onClick={() => {
                                                setSelectedUser(user);
                                                setSearchQuery(user.login);
                                                setSearchResults([]);
                                            }}
                                            className="ds-btn ds-btn--ghost ds-icon-btn w-full"
                                        >
                                            <p className="font-bold text-ds-text">{user.login}</p>
                                            {user.displayName && (
                                                <p className="text-xs text-ds-soft">{user.displayName}</p>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {selectedUser && (
                            <>
                                {/* Permissions */}
                                <div className="mb-4 space-y-2">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newPermission.canView}
                                            onChange={(e) => setNewPermission({ ...newPermission, canView: e.target.checked })}
                                            className="w-4 h-4 text-ds-accent-text rounded"
                                        />
                                        <span className="text-sm font-bold text-ds-text">Puede Ver</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newPermission.canChat}
                                            onChange={(e) => setNewPermission({ ...newPermission, canChat: e.target.checked })}
                                            className="w-4 h-4 text-ds-accent-text rounded"
                                        />
                                        <span className="text-sm font-bold text-ds-text">Puede Chatear</span>
                                    </label>
                                </div>

                                {/* Notes */}
                                <div className="mb-4">
                                    <label className="block text-sm font-bold text-ds-text mb-2">
                                        Notas (opcional)
                                    </label>
                                    <textarea
                                        value={newPermission.notes}
                                        onChange={(e) => setNewPermission({ ...newPermission, notes: e.target.value })}
                                        rows={3}
                                        className="ds-input w-full resize-none"
                                    />
                                </div>
                            </>
                        )}

                        {/* Buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setSelectedUser(null);
                                    setSearchQuery('');
                                    setSearchResults([]);
                                    setNewPermission({ canView: true, canChat: false, notes: '' });
                                }}
                                className="ds-btn ds-btn--secondary flex-1"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={addPermission}
                                disabled={!selectedUser}
                                className="ds-btn ds-btn--primary flex-1"
                            >
                                Agregar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Permission Modal */}
            {editingPermission && (
                <div className="fixed inset-0 bg-ds-input/50 flex items-center justify-center z-50" onClick={() => setEditingPermission(null)}>
                    <div className="bg-ds-surface rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-ds-text mb-4">Editar Permiso</h3>

                        <div className="mb-4">
                            <p className="text-sm text-ds-soft mb-1">Usuario</p>
                            <p className="font-bold text-ds-text">{editingPermission.username}</p>
                        </div>

                        {/* Permissions */}
                        <div className="mb-4 space-y-2">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={editingPermission.canView}
                                    onChange={(e) => setEditingPermission({ ...editingPermission, canView: e.target.checked })}
                                    className="w-4 h-4 text-ds-accent-text rounded"
                                />
                                <span className="text-sm font-bold text-ds-text">Puede Ver</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={editingPermission.canChat}
                                    onChange={(e) => setEditingPermission({ ...editingPermission, canChat: e.target.checked })}
                                    className="w-4 h-4 text-ds-accent-text rounded"
                                />
                                <span className="text-sm font-bold text-ds-text">Puede Chatear</span>
                            </label>
                        </div>

                        {/* Notes */}
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-ds-text mb-2">
                                Notas
                            </label>
                            <textarea
                                value={editingPermission.notes || ''}
                                onChange={(e) => setEditingPermission({ ...editingPermission, notes: e.target.value })}
                                rows={3}
                                className="ds-input w-full resize-none"
                            />
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setEditingPermission(null)}
                                className="ds-btn ds-btn--secondary flex-1"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => updatePermission(editingPermission)}
                                className="ds-btn ds-btn--primary flex-1"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
