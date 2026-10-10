/**
 * Tips Configuration - Sistema de donaciones con PayPal
 * Integrado con Timer Extensible
 * Actualizado para usar TipsAlertSection (igual que Event Alerts)
 *
 * Orchestrator - tabs extracted to tips-extension/components/tabs/
 */

import { DEFAULT_PREMIUM_VOICE } from '../../components/tts/voiceDefaults';
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    DollarSign, Settings, Bell, Clock, Shield, ExternalLink,
    Check, X, AlertCircle, Info, Zap, Link2, Copy, Eye,
    Play, Image as ImageIcon, History, TrendingUp, Unlink
} from 'lucide-react';
import type { TipsSettings, TipStatistics, RecentTip } from './tips-extension/types/config';
import { CURRENCIES } from './tips-extension/types/config';
import type { TipsAlertConfig } from './tips-extension/types';
import { DEFAULT_TIPS_OVERLAY_CONFIG, DEFAULT_TIPS_ALERT_CONFIG, DEFAULT_TIPS_BASE_ALERT } from './tips-extension/constants/defaults';
import { GeneralTab, PageTab, AlertsTab, TimerTab, SecurityTab, HistoryTab } from './tips-extension/components/tabs';

const DEFAULT_SETTINGS: TipsSettings = {
    isEnabled: false,
    paypalConnected: false,
    paypalEmail: '',
    isProduction: false,

    minAmount: 1,
    maxAmount: 500,
    currency: 'USD',
    suggestedAmounts: '5,10,25,50',

    pageTitle: 'Apoya mi stream',
    pageDescription: 'Tu donación me ayuda a seguir creando contenido.',
    pageAccentColor: '#9146FF',
    pageBackgroundImage: '',

    alertConfig: '{}',

    alertMode: 'timer',
    basicAlertSound: '',
    basicAlertVolume: 80,
    basicAlertDuration: 5000,
    basicAlertAnimation: 'fade',
    basicAlertMessage: '¡{donorName} donó {amount}! {message}',
    basicAlertTts: {
        enabled: false,
        voice: DEFAULT_PREMIUM_VOICE,
        engine: 'standard',
        languageCode: 'es-US',
        template: '¡{donorName} donó {amount}!',
        templateVolume: 80,
        readUserMessage: true,
        userMessageVolume: 80,
        maxChars: 150,
        waitForSound: true
    },

    basicAlertOverlay: DEFAULT_TIPS_OVERLAY_CONFIG,

    tipsAlertConfig: DEFAULT_TIPS_ALERT_CONFIG,

    timerIntegrationEnabled: false,
    secondsPerCurrency: 60,
    timeUnit: 'seconds' as const,

    maxMessageLength: 255,
    cooldownSeconds: 0,
    badWordsFilter: true,
    requireMessage: false,
};

export default function TipsConfig() {
    const { t } = useTranslation('features');
    const [searchParams, setSearchParams] = useSearchParams();
    const [settings, setSettings] = useState<TipsSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'page' | 'alerts' | 'timer' | 'security' | 'history'>('general');
    const [copied, setCopied] = useState<string | null>(null);
    const [testing, setTesting] = useState(false);
    const [channelName, setChannelName] = useState('');
    const [connecting, setConnecting] = useState(false);

    // Statistics and history
    const [stats, setStats] = useState<TipStatistics | null>(null);
    const [recentTips, setRecentTips] = useState<RecentTip[]>([]);
    const [statsPeriod, setStatsPeriod] = useState<string>('month');

    const tipsUrl = `https://twitch.decatron.net/tip/${channelName}`;
    const overlayUrl = `https://decatron.net/overlay/tips?channel=${channelName}`;

    // Handle PayPal OAuth callback
    useEffect(() => {
        const paypalStatus = searchParams.get('paypal');
        const emailToken = searchParams.get('token');

        if (paypalStatus === 'success' && emailToken) {
            const confirmPayPal = async () => {
                try {
                    const authToken = localStorage.getItem('token');
                    const response = await fetch(`/api/tips/paypal/resolve-token?token=${emailToken}`, {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    }).then(r => r.json());
                    if (response?.email) {
                        setSettings(prev => ({ ...prev, paypalEmail: response.email, paypalConnected: true }));
                        savePayPalEmail(response.email);
                    }
                } catch (e) {
                    console.error('Error confirming PayPal:', e);
                    alert(t('tipsConfig.paypalError'));
                }
                setSearchParams({});
            };
            confirmPayPal();
        } else if (paypalStatus === 'no_email') {
            alert(t('tipsConfig.paypalNoEmail', 'Could not get email from PayPal. Please try again.'));
            setSearchParams({});
        } else if (paypalStatus === 'error') {
            alert(t('tipsConfig.paypalError'));
            setSearchParams({});
        }
    }, [searchParams]);

    useEffect(() => {
        loadSettings();
        loadChannelName();
    }, []);

    const loadChannelName = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/settings/frontend-info', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.channel?.login) {
                    setChannelName(data.channel.login);
                }
            }
        } catch (e) {
            console.error('Error loading channel name:', e);
        }
    };

    useEffect(() => {
        if (activeTab === 'history') {
            loadStatistics();
            loadRecentTips();
        }
    }, [activeTab, statsPeriod]);

    const loadSettings = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/tips/config', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setSettings({
                    ...DEFAULT_SETTINGS,
                    ...data,
                });
            }
        } catch (error) {
            console.error('Error loading tips settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadStatistics = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/tips/statistics?period=${statsPeriod}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    };

    const loadRecentTips = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/tips/history?limit=20', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setRecentTips(data);
            }
        } catch (error) {
            console.error('Error loading recent tips:', error);
        }
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/tips/config', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });
            if (response.ok) {
                // Show success feedback
                setCopied('saved');
                setTimeout(() => setCopied(null), 2000);
            }
        } catch (error) {
            console.error('Error saving tips settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const savePayPalEmail = async (email: string) => {
        try {
            const token = localStorage.getItem('token');
            await fetch('/api/tips/config', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...settings,
                    paypalEmail: email,
                    paypalConnected: true
                })
            });
            loadSettings();
        } catch (error) {
            console.error('Error saving PayPal email:', error);
        }
    };

    const connectPayPal = async () => {
        setConnecting(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/tips/paypal/connect', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                window.location.href = data.authUrl;
            } else {
                alert('Error al iniciar conexión con PayPal');
                setConnecting(false);
            }
        } catch (error) {
            console.error('Error connecting PayPal:', error);
            alert('Error de conexión');
            setConnecting(false);
        }
    };

    const disconnectPayPal = async () => {
        if (!confirm(t('tipsConfig.disconnectConfirm'))) return;
        try {
            const token = localStorage.getItem('token');
            await fetch('/api/tips/paypal/disconnect', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setSettings(prev => ({ ...prev, paypalEmail: '', paypalConnected: false }));
        } catch (error) {
            console.error('Error disconnecting PayPal:', error);
        }
    };

    const testTip = async () => {
        setTesting(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/tips/test', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    donorName: 'Test User',
                    amount: 5.00,
                    currency: settings.currency,
                    message: '¡Esto es una donación de prueba!'
                })
            });

            if (response.ok) {
                const data = await response.json();
                alert(`Test enviado. Tiempo añadido: ${data.timeAdded}s`);
            }
        } catch (error) {
            console.error('Error testing tip:', error);
            alert('Error al enviar test');
        } finally {
            setTesting(false);
        }
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const updateSettings = (updates: Partial<TipsSettings>) => {
        setSettings(prev => ({ ...prev, ...updates }));
    };

    const inputClass = "w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none";
    const labelClass = "text-xs font-bold text-ds-soft block mb-2";
    const cardClass = "rounded-lg border border-ds-border bg-ds-surface p-6 ";

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ds-accent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-ds-text flex items-center gap-3">
                        <DollarSign className="w-8 h-8 text-ds-ok" />
                        {t('tipsConfig.title')}
                    </h1>
                    <p className="text-ds-soft mt-1">
                        {t('tipsConfig.subtitle')}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={testTip}
                        disabled={testing || !settings.isEnabled}
                        className="px-4 py-2 bg-ds-accent/10 text-ds-accent-text rounded-lg font-bold flex items-center gap-2 transition-all hover:bg-ds-accent/10 disabled:opacity-50"
                    >
                        <Play className="w-4 h-4" />
                        {testing ? t('tipsConfig.sending') : t('tipsConfig.test')}
                    </button>
                    <button
                        onClick={saveSettings}
                        disabled={saving}
                        className="px-6 py-2 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent rounded-lg font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-ds-border border-t-transparent rounded-full animate-spin" />
                        ) : copied === 'saved' ? (
                            <Check className="w-4 h-4" />
                        ) : (
                            <Check className="w-4 h-4" />
                        )}
                        {copied === 'saved' ? t('tipsConfig.saved') : t('tipsConfig.save')}
                    </button>
                </div>
            </div>

            {/* PayPal Connection */}
            <div className={cardClass}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${
                            settings.paypalConnected && settings.paypalEmail
                                ? 'bg-ds-ok/10 '
                                : 'bg-ds-bg '
                        }`}>
                            <DollarSign className={`w-7 h-7 ${
                                settings.paypalConnected && settings.paypalEmail ? 'text-ds-ok' : 'text-ds-soft'
                            }`} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-ds-text">
                                {t('tipsConfig.paypalAccount')}
                            </h2>
                            {settings.paypalConnected && settings.paypalEmail ? (
                                <div className="flex items-center gap-2 mt-1">
                                    <Check className="w-4 h-4 text-ds-ok" />
                                    <span className="text-ds-ok font-semibold">{t('tipsConfig.connected')}</span>
                                    <span className="text-ds-soft">· {settings.paypalEmail}</span>
                                </div>
                            ) : (
                                <p className="text-sm text-ds-soft">
                                    {t('tipsConfig.connectDesc')}
                                </p>
                            )}
                        </div>
                    </div>

                    {settings.paypalConnected && settings.paypalEmail ? (
                        <button
                            onClick={disconnectPayPal}
                            className="px-4 py-2 bg-ds-danger/10 text-ds-danger rounded-lg font-bold flex items-center gap-2 hover:bg-ds-danger/10"
                        >
                            <Unlink className="w-4 h-4" />
                            {t('tipsConfig.disconnect')}
                        </button>
                    ) : (
                        <button
                            onClick={connectPayPal}
                            disabled={connecting}
                            className="px-6 py-3 bg-[#0070ba] hover:bg-[#005ea6] text-ds-text rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                        >
                            {connecting ? (
                                <div className="w-5 h-5 border-2 border-ds-border border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <ExternalLink className="w-5 h-5" />
                            )}
                            {connecting ? t('tipsConfig.connecting') : t('tipsConfig.connectPayPal')}
                        </button>
                    )}
                </div>

                {settings.paypalConnected && settings.paypalEmail && (
                    <div className="mt-4 p-4 bg-ds-ok/10 border border-ds-ok/40 rounded-lg">
                        <div className="flex items-start gap-3">
                            <Check className="w-5 h-5 text-ds-ok mt-0.5" />
                            <div className="text-sm text-ds-ok" dangerouslySetInnerHTML={{ __html: t('tipsConfig.donationsSentTo', { email: settings.paypalEmail }) }}>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* URLs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Donation Page URL */}
                <div className={cardClass}>
                    <h3 className="text-sm font-bold text-ds-text flex items-center gap-2 mb-3">
                        <Link2 className="w-4 h-4" />
                        {t('tipsConfig.donationPage')}
                    </h3>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 p-3 bg-ds-bg rounded-lg border border-ds-border">
                            <code className="text-xs text-ds-accent-text font-mono break-all">
                                {tipsUrl}
                            </code>
                        </div>
                        <button
                            onClick={() => copyToClipboard(tipsUrl, 'tipsUrl')}
                            className={`p-2 rounded-lg transition-all ${
                                copied === 'tipsUrl'
                                    ? 'bg-ds-accent text-ds-on-accent'
                                    : 'bg-ds-bg hover:bg-ds-raised '
                            }`}
                        >
                            {copied === 'tipsUrl' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <a
                            href={tipsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-ds-bg hover:bg-ds-raised transition-all"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                </div>

                {/* Overlay URL */}
                <div className={cardClass}>
                    <h3 className="text-sm font-bold text-ds-text flex items-center gap-2 mb-3">
                        <Eye className="w-4 h-4" />
                        {t('tipsConfig.overlayObs')}
                    </h3>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 p-3 bg-ds-bg rounded-lg border border-ds-border">
                            <code className="text-xs text-ds-accent-text font-mono break-all">
                                {overlayUrl}
                            </code>
                        </div>
                        <button
                            onClick={() => copyToClipboard(overlayUrl, 'overlayUrl')}
                            className={`p-2 rounded-lg transition-all ${
                                copied === 'overlayUrl'
                                    ? 'bg-ds-accent text-ds-on-accent'
                                    : 'bg-ds-bg hover:bg-ds-raised '
                            }`}
                        >
                            {copied === 'overlayUrl' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-ds-border pb-4 overflow-x-auto">
                {[
                    { id: 'general', icon: <Settings className="w-4 h-4" />, label: t('tipsConfig.tabs.general') },
                    { id: 'page', icon: <ImageIcon className="w-4 h-4" />, label: t('tipsConfig.tabs.page') },
                    { id: 'alerts', icon: <Bell className="w-4 h-4" />, label: t('tipsConfig.tabs.alerts') },
                    { id: 'timer', icon: <Clock className="w-4 h-4" />, label: t('tipsConfig.tabs.timer') },
                    { id: 'security', icon: <Shield className="w-4 h-4" />, label: t('tipsConfig.tabs.security') },
                    { id: 'history', icon: <History className="w-4 h-4" />, label: t('tipsConfig.tabs.history') },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'bg-ds-accent text-ds-on-accent'
                                : 'text-ds-soft hover:bg-ds-bg '
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
                {activeTab === 'general' && (
                    <GeneralTab
                        settings={settings}
                        updateSettings={updateSettings}
                        inputClass={inputClass}
                        labelClass={labelClass}
                        cardClass={cardClass}
                    />
                )}

                {activeTab === 'page' && (
                    <PageTab
                        settings={settings}
                        updateSettings={updateSettings}
                        inputClass={inputClass}
                        labelClass={labelClass}
                        cardClass={cardClass}
                    />
                )}

                {activeTab === 'alerts' && (
                    <AlertsTab
                        settings={settings}
                        updateSettings={updateSettings}
                        cardClass={cardClass}
                        testTip={testTip}
                    />
                )}

                {activeTab === 'timer' && (
                    <TimerTab
                        settings={settings}
                        updateSettings={updateSettings}
                        inputClass={inputClass}
                        labelClass={labelClass}
                        cardClass={cardClass}
                    />
                )}

                {activeTab === 'security' && (
                    <SecurityTab
                        settings={settings}
                        updateSettings={updateSettings}
                        inputClass={inputClass}
                        labelClass={labelClass}
                        cardClass={cardClass}
                    />
                )}

                {activeTab === 'history' && (
                    <HistoryTab
                        stats={stats}
                        recentTips={recentTips}
                        statsPeriod={statsPeriod}
                        setStatsPeriod={setStatsPeriod}
                        currency={settings.currency}
                        cardClass={cardClass}
                    />
                )}
            </div>
        </div>
    );
}
