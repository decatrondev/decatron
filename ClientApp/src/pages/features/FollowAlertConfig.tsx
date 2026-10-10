import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation('features');
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
            showMessage('error', t('followAlert.errorLoading'));
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const res = await api.post('/followalert/config', config);

            if (res.data.success) {
                showMessage('success', t('followAlert.savedSuccess'));
            }
        } catch (error) {
            console.error('Error saving config:', error);
            showMessage('error', t('followAlert.errorSaving'));
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
        <div className="min-h-screen bg-ds-bg p-6">
            {/* Header */}
            <div className="max-w-5xl mx-auto mb-6">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center gap-2 text-ds-soft hover:text-ds-accent-text mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {t('followAlert.backToDashboard')}
                </button>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">
                            {t('followAlert.title')}
                        </h1>
                        <p className="text-ds-soft mt-1">
                            {t('followAlert.subtitle')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Save Message */}
            {saveMessage && (
                <div className="max-w-5xl mx-auto mb-6">
                    <div className={`flex items-center gap-2 p-4 rounded-lg ${saveMessage.type === 'success'
                        ? 'bg-ds-ok/10 text-ds-ok '
                        : 'bg-ds-danger/10 text-ds-danger '}`}>
                        {saveMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="font-semibold">{saveMessage.text}</span>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="max-w-5xl mx-auto text-center py-12">
                    <p className="text-ds-soft">{t('followAlert.loadingConfig')}</p>
                </div>
            ) : (
                <div className="max-w-5xl mx-auto space-y-6">
                    {/* Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-ds-soft">{t('followAlert.followsToday')}</p>
                                    <p className="text-2xl font-black text-ds-text mt-1">
                                        {stats.followsToday}
                                    </p>
                                </div>
                                <TrendingUp className="w-10 h-10 text-ds-accent-text" />
                            </div>
                        </div>

                        <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-ds-soft">{t('followAlert.totalFollows')}</p>
                                    <p className="text-2xl font-black text-ds-text mt-1">
                                        {stats.totalFollows}
                                    </p>
                                </div>
                                <Users className="w-10 h-10 text-ds-accent-text" />
                            </div>
                        </div>

                        <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-ds-soft">{t('followAlert.messagesSent')}</p>
                                    <p className="text-2xl font-black text-ds-text mt-1">
                                        {stats.messagesSent}
                                    </p>
                                </div>
                                <Heart className="w-10 h-10 text-ds-accent-text" />
                            </div>
                        </div>
                    </div>

                    {/* Configuration Card */}
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                        <h2 className="text-xl font-black text-ds-text mb-6">
                            {t('followAlert.configuration')}
                        </h2>

                        <div className="space-y-6">
                            {/* Enable/Disable */}
                            <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                                <div>
                                    <label className="block text-sm font-semibold text-ds-text">
                                        {t('followAlert.enableFollowAlerts')}
                                    </label>
                                    <p className="text-xs text-ds-soft mt-1">
                                        {t('followAlert.enableDescription')}
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={config.enabled}
                                        onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all border-ds-border peer-checked:bg-ds-accent"></div>
                                </label>
                            </div>

                            {/* Message Template */}
                            <div>
                                <label className="block text-sm font-semibold text-ds-text mb-2">
                                    {t('followAlert.customMessage')}
                                </label>
                                <input
                                    type="text"
                                    value={config.message}
                                    onChange={(e) => setConfig({ ...config, message: e.target.value })}
                                    placeholder="¡Gracias @{username} por el follow! ❤️"
                                    className="w-full px-4 py-3 bg-ds-surface border border-ds-border rounded-lg text-ds-text focus:ring-2 focus:ring-ds-accent"
                                />
                                <p className="text-xs text-ds-soft mt-2">
                                    {t('followAlert.availableVars')} <code className="bg-ds-raised px-2 py-1 rounded">{'{username}'}</code>
                                </p>
                                {config.message && (
                                    <div className="mt-3 p-3 bg-ds-raised rounded-lg border border-ds-border">
                                        <p className="text-xs font-semibold text-ds-soft mb-1">{t('followAlert.preview')}</p>
                                        <p className="text-sm text-ds-text">
                                            {config.message.replace('{username}', 'Usuario123')}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Cooldown */}
                            <div>
                                <label className="block text-sm font-semibold text-ds-text mb-2">
                                    {t('followAlert.cooldownMinutes')}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="1440"
                                    value={config.cooldownMinutes}
                                    onChange={(e) => setConfig({ ...config, cooldownMinutes: parseInt(e.target.value) || 0 })}
                                    className="w-full px-4 py-3 bg-ds-surface border border-ds-border rounded-lg text-ds-text focus:ring-2 focus:ring-ds-accent"
                                />
                                <p className="text-xs text-ds-soft mt-2">
                                    {t('followAlert.cooldownDescription')}
                                </p>
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-ds-accent hover:bg-ds-accent-hover disabled:bg-ds-faint text-ds-on-accent font-bold rounded-lg transition-all"
                            >
                                <Save className="w-5 h-5" />
                                {saving ? t('followAlert.saving') : t('followAlert.saveConfig')}
                            </button>
                        </div>
                    </div>

                    {/* Info Card */}
                    <div className="bg-ds-accent/10 border border-ds-accent rounded-lg p-4">
                        <p className="text-sm text-ds-accent-text">
                            <strong>{t('followAlert.importantLabel')}</strong> {t('followAlert.importantNote')} <code className="bg-ds-accent/10 px-2 py-1 rounded">channel.follow</code>.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
