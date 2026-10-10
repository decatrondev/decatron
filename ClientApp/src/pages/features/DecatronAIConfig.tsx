import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation('features');
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
            showMessage('error', t('decatronAI.errorLoading'));
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
                showMessage('success', t('decatronAI.configSaved'));
            }
        } catch {
            showMessage('error', t('decatronAI.errorSaving'));
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
        return <div className="text-center py-8 text-ds-soft">{t('decatronAI.loading')}</div>;
    }

    // Sin permiso control_total
    if (noPermission) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-ds-danger/10 border border-ds-danger/40 rounded-lg p-8 max-w-md text-center">
                    <Lock className="w-16 h-16 text-ds-accent-text mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-ds-danger mb-2">{t('decatronAI.accessDenied')}</h2>
                    <p className="text-ds-soft mb-6">
                        {t('decatronAI.noPermission')}
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="ds-btn ds-btn--primary ds-btn--lg"
                    >
                        {t('decatronAI.backToDashboard')}
                    </button>
                </div>
            </div>
        );
    }

    // Canal no tiene permiso de Decatron IA
    if (noAccess) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-ds-warn/10 border border-ds-warn/40 rounded-lg p-8 max-w-md text-center">
                    <AlertCircle className="w-16 h-16 text-ds-warn mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-ds-warn mb-2">{t('decatronAI.accessRestricted')}</h2>
                    <p className="text-ds-soft mb-6">
                        {t('decatronAI.needSpecialPermission')}
                    </p>
                    <div className="space-y-3">
                        <a
                            href="https://twitch.tv/AnthonyDeca"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent rounded-lg font-bold transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Twitch: AnthonyDeca
                        </a>
                        <a
                            href="https://discord.gg/anthonydeca"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent rounded-lg font-bold transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Discord: AnthonyDeca
                        </a>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="ds-btn ds-btn--secondary ds-btn--lg w-full"
                        >
                            {t('decatronAI.backToDashboard')}
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
                        <Cpu className="w-8 h-8 text-ds-accent-text" />
                        <h1 className="text-3xl font-black text-ds-text">{t('decatronAI.title')}</h1>
                    </div>
                    <p className="text-ds-soft">
                        {t('decatronAI.configureForChannel')} <span className="font-bold text-ds-accent-text">{channelName}</span>
                    </p>
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
                    <Settings className="w-4 h-4" /> {t('decatronAI.tabs.config')}
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={activeTab === 'users' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                >
                    <Users className="w-4 h-4" /> {t('decatronAI.tabs.users')}
                </button>
                <button
                    onClick={() => setActiveTab('stats')}
                    className={activeTab === 'stats' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                >
                    <BarChart3 className="w-4 h-4" /> {t('decatronAI.tabs.stats')}
                </button>
            </div>

            {/* Config Tab */}
            {activeTab === 'config' && (
                <div className="bg-ds-surface rounded-lg p-6 border border-ds-border space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">{t('decatronAI.config.permissionLevel')}</label>
                            <select
                                value={config.permissionLevel}
                                onChange={(e) => setConfig({ ...config, permissionLevel: e.target.value })}
                                className="ds-input w-full"
                            >
                                <option value="everyone">{t('decatronAI.config.everyone')}</option>
                                <option value="subscriber">{t('decatronAI.config.subscribers')}</option>
                                <option value="vip">{t('decatronAI.config.vips')}</option>
                                <option value="moderator">{t('decatronAI.config.moderators')}</option>
                                <option value="broadcaster">{t('decatronAI.config.broadcasterOnly')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">
                                {t('decatronAI.config.channelCooldown', { min: globalDefaults.minCooldown })}
                            </label>
                            <input
                                type="number"
                                value={config.channelCooldownSeconds}
                                min={globalDefaults.minCooldown}
                                onChange={(e) => setConfig({ ...config, channelCooldownSeconds: Math.max(parseInt(e.target.value) || 0, globalDefaults.minCooldown) })}
                                className="ds-input w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">{t('decatronAI.config.userCooldown')}</label>
                            <input
                                type="number"
                                value={config.userCooldownSeconds || ''}
                                placeholder={t('decatronAI.config.noLimit')}
                                onChange={(e) => setConfig({ ...config, userCooldownSeconds: e.target.value ? parseInt(e.target.value) : null })}
                                className="ds-input w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">{t('decatronAI.config.customPrefix')}</label>
                            <input
                                type="text"
                                value={config.customPrefix || ''}
                                placeholder={t('decatronAI.config.useGlobalDefault')}
                                onChange={(e) => setConfig({ ...config, customPrefix: e.target.value || null })}
                                className="ds-input w-full"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">{t('decatronAI.config.customPrompt')}</label>
                        <textarea
                            value={config.customSystemPrompt || ''}
                            placeholder={t('decatronAI.config.useGlobalPrompt')}
                            onChange={(e) => setConfig({ ...config, customSystemPrompt: e.target.value || null })}
                            rows={3}
                            className="ds-input w-full"
                        />
                    </div>

                    <button
                        onClick={saveConfig}
                        disabled={saving}
                        className="ds-btn ds-btn--primary ds-btn--lg"
                    >
                        <Save className="w-4 h-4" /> {saving ? t('decatronAI.config.saving') : t('decatronAI.config.saveConfig')}
                    </button>
                </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
                <div className="space-y-6">
                    {/* Whitelist */}
                    <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-black text-ds-text">{t('decatronAI.users.whitelist')}</h3>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.whitelistEnabled}
                                    onChange={(e) => setConfig({ ...config, whitelistEnabled: e.target.checked })}
                                    className="rounded border-ds-border"
                                />
                                <span className="text-sm font-semibold text-ds-soft">{t('decatronAI.users.enableWhitelist')}</span>
                            </label>
                        </div>
                        {config.whitelistEnabled && (
                            <>
                                <div className="flex gap-2 mb-4">
                                    <input
                                        type="text"
                                        value={newWhitelistUser}
                                        onChange={(e) => setNewWhitelistUser(e.target.value)}
                                        placeholder={t('decatronAI.users.userPlaceholder')}
                                        className="ds-input flex-1"
                                    />
                                    <button onClick={addWhitelistUser} className="ds-btn ds-btn--primary">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {config.whitelistUsers.map((user) => (
                                        <span key={user} className="flex items-center gap-1 px-3 py-1 bg-ds-ok/10 text-ds-ok rounded-full font-semibold">
                                            {user}
                                            <button onClick={() => removeWhitelistUser(user)} className="hover:text-ds-danger">
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </>
                        )}
                        {!config.whitelistEnabled && (
                            <p className="text-ds-soft text-sm">{t('decatronAI.users.whitelistDisabled')}</p>
                        )}
                    </div>

                    {/* Blacklist */}
                    <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                        <h3 className="text-xl font-black text-ds-text mb-4">{t('decatronAI.users.blacklist')}</h3>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={newBlacklistUser}
                                onChange={(e) => setNewBlacklistUser(e.target.value)}
                                placeholder={t('decatronAI.users.blockUserPlaceholder')}
                                className="ds-input flex-1"
                            />
                            <button onClick={addBlacklistUser} className="ds-btn ds-btn--danger">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {config.blacklistUsers.map((user) => (
                                <span key={user} className="flex items-center gap-1 px-3 py-1 bg-ds-danger/10 text-ds-danger rounded-full font-semibold">
                                    {user}
                                    <button onClick={() => removeBlacklistUser(user)} className="hover:text-ds-danger">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                            {config.blacklistUsers.length === 0 && (
                                <p className="text-ds-soft text-sm">{t('decatronAI.users.noBlockedUsers')}</p>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={saveConfig}
                        disabled={saving}
                        className="ds-btn ds-btn--primary ds-btn--lg"
                    >
                        <Save className="w-4 h-4" /> {saving ? t('decatronAI.config.saving') : t('decatronAI.config.saveChanges')}
                    </button>
                </div>
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && stats && (
                <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                            <p className="text-sm font-bold text-ds-soft mb-1">{t('decatronAI.stats.total')}</p>
                            <p className="text-3xl font-black text-ds-text">{stats.totalUsage}</p>
                        </div>
                        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                            <p className="text-sm font-bold text-ds-soft mb-1">{t('decatronAI.stats.today')}</p>
                            <p className="text-3xl font-black text-ds-accent-text">{stats.todayUsage}</p>
                        </div>
                        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                            <p className="text-sm font-bold text-ds-soft mb-1">{t('decatronAI.stats.thisWeek')}</p>
                            <p className="text-3xl font-black text-ds-ok">{stats.weekUsage}</p>
                        </div>
                    </div>

                    <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                        <h3 className="text-xl font-black text-ds-text mb-4">{t('decatronAI.stats.topUsers')}</h3>
                        <div className="space-y-2">
                            {stats.topUsers.map((item, i) => (
                                <div key={i} className="flex justify-between p-3 bg-ds-bg rounded-lg border border-ds-border">
                                    <span className="font-semibold text-ds-text">{item.username}</span>
                                    <span className="font-bold text-ds-accent-text">{t('decatronAI.stats.uses', { count: item.count })}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                        <h3 className="text-xl font-black text-ds-text mb-4">{t('decatronAI.stats.recentUsage')}</h3>
                        <div className="space-y-2">
                            {stats.recentUsage.map((item, i) => (
                                <div key={i} className="p-3 bg-ds-bg rounded-lg border border-ds-border">
                                    <div className="flex justify-between mb-1">
                                        <span className="font-bold text-ds-text">{item.username}</span>
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
