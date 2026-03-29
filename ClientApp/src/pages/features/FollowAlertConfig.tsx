import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Heart, TrendingUp, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import api from '../../services/api';

interface FollowAlertConfig {
    enabled: boolean;
    message: string;
    cooldownMinutes: number;
}

interface FollowStats {
    followsToday: number;
    totalFollows: number;
    messagesSent: number;
}

export default function FollowAlertConfig() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [config, setConfig] = useState<FollowAlertConfig>({
        enabled: true,
        message: '¡Gracias @{username} por el follow! ❤️',
        cooldownMinutes: 60
    });

    const [stats, setStats] = useState<FollowStats>({
        followsToday: 0,
        totalFollows: 0,
        messagesSent: 0
    });

    useEffect(() => {
        if (!permissionsLoading && hasMinimumLevel('moderation')) {
            loadData();
        } else if (!permissionsLoading) {
            navigate('/dashboard');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [configRes, statsRes] = await Promise.all([
                api.get('/followalert/config'),
                api.get('/followalert/stats')
            ]);

            if (configRes.data.success && configRes.data.config) {
                setConfig(configRes.data.config);
            }

            if (statsRes.data.success && statsRes.data.stats) {
                setStats(statsRes.data.stats);
            }
        } catch (error) {
            console.error('Error loading follow alert data:', error);
            showMessage('error', 'Error al cargar configuración');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const res = await api.post('/followalert/config', config);

            if (res.data.success) {
                showMessage('success', 'Configuración guardada exitosamente');
            }
        } catch (error) {
            console.error('Error saving config:', error);
            showMessage('error', 'Error al guardar la configuración');
        } finally {
            setSaving(false);
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setSaveMessage({ type, text });
        setTimeout(() => setSaveMessage(null), 3000);
    };

    if (!permissionsLoading && !hasMinimumLevel('moderation')) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#1B1C1D] p-6">
            {/* Header */}
            <div className="max-w-5xl mx-auto mb-6">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#3b82f6] mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver al Dashboard
                </button>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                            Follow Alerts
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">
                            Agradece automáticamente a tus nuevos seguidores
                        </p>
                    </div>
                </div>
            </div>

            {/* Save Message */}
            {saveMessage && (
                <div className="max-w-5xl mx-auto mb-6">
                    <div className={`flex items-center gap-2 p-4 rounded-lg ${saveMessage.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                        {saveMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="font-semibold">{saveMessage.text}</span>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="max-w-5xl mx-auto text-center py-12">
                    <p className="text-[#64748b] dark:text-[#94a3b8]">Cargando configuración...</p>
                </div>
            ) : (
                <div className="max-w-5xl mx-auto space-y-6">
                    {/* Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Follows Hoy</p>
                                    <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] mt-1">
                                        {stats.followsToday}
                                    </p>
                                </div>
                                <TrendingUp className="w-10 h-10 text-[#2563eb]" />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Total Follows</p>
                                    <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] mt-1">
                                        {stats.totalFollows}
                                    </p>
                                </div>
                                <Users className="w-10 h-10 text-purple-500" />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Mensajes Enviados</p>
                                    <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] mt-1">
                                        {stats.messagesSent}
                                    </p>
                                </div>
                                <Heart className="w-10 h-10 text-pink-500" />
                            </div>
                        </div>
                    </div>

                    {/* Configuration Card */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-6">
                            Configuración
                        </h2>

                        <div className="space-y-6">
                            {/* Enable/Disable */}
                            <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                                <div>
                                    <label className="block text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                        Activar Follow Alerts
                                    </label>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                        Enviar mensaje automático cuando alguien siga tu canal
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={config.enabled}
                                        onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {/* Message Template */}
                            <div>
                                <label className="block text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                    Mensaje Personalizado
                                </label>
                                <input
                                    type="text"
                                    value={config.message}
                                    onChange={(e) => setConfig({ ...config, message: e.target.value })}
                                    placeholder="¡Gracias @{username} por el follow! ❤️"
                                    className="w-full px-4 py-3 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">
                                    💡 Variables disponibles: <code className="bg-[#f1f5f9] dark:bg-[#374151] px-2 py-1 rounded">{'{username}'}</code>
                                </p>
                                {config.message && (
                                    <div className="mt-3 p-3 bg-[#f1f5f9] dark:bg-[#262626] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                                        <p className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] mb-1">Vista previa:</p>
                                        <p className="text-sm text-[#1e293b] dark:text-[#f8fafc]">
                                            {config.message.replace('{username}', 'Usuario123')}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Cooldown */}
                            <div>
                                <label className="block text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                    Cooldown (minutos)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="1440"
                                    value={config.cooldownMinutes}
                                    onChange={(e) => setConfig({ ...config, cooldownMinutes: parseInt(e.target.value) || 0 })}
                                    className="w-full px-4 py-3 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">
                                    ⏱️ Tiempo mínimo entre mensajes para el mismo usuario (evita spam por unfollow/follow)
                                </p>
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#2563eb] hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all shadow-lg"
                            >
                                <Save className="w-5 h-5" />
                                {saving ? 'Guardando...' : 'Guardar Configuración'}
                            </button>
                        </div>
                    </div>

                    {/* Info Card */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            <strong>ℹ️ Importante:</strong> Los follow alerts solo funcionan si tienes EventSub configurado correctamente.
                            Asegúrate de haber registrado el evento <code className="bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded">channel.follow</code> en la configuración de tu bot.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
