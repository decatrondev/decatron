/**
 * SupportersConfig — Admin page for managing the public supporters page
 * Visual style: same as EventAlertsConfig (2/3 editor + 1/3 preview)
 */

import React, { useState, useEffect } from 'react';
import {
    Save, ArrowLeft, Globe,
    ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import type { PageConfig, TierConfig, TierId, TierDuration, TabType } from './types';
import { DEFAULT_CONFIG, DEFAULT_TIERS, DEFAULT_TIER_DURATIONS, TABS } from './constants';
import { MiniPreview } from './shared';
import {
    GeneralTab,
    TiersTab,
    SupportersTab,
    CodesTab,
    TestingTab,
    AppearanceTab,
    SpotifySlotsTab,
} from './tabs';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SupportersConfig() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [config, setConfig] = useState<PageConfig>(DEFAULT_CONFIG);
    const [tiers, setTiers] = useState<TierConfig[]>(DEFAULT_TIERS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Lifted from TestingTab so duration settings persist when switching tabs
    const [tierDurations, setTierDurations] = useState<Record<TierId, TierDuration>>(DEFAULT_TIER_DURATIONS);

    // Load config
    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.get<{ config: PageConfig; tiers: TierConfig[] }>('/supporters/config');
                setConfig(res.data.config);
                setTiers(res.data.tiers?.length > 0 ? res.data.tiers : DEFAULT_TIERS);
                if (res.data.config.tierDurations) {
                    setTierDurations({ ...DEFAULT_TIER_DURATIONS, ...res.data.config.tierDurations });
                }
            } catch {
                // Use defaults — backend endpoint not ready yet
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaveMessage(null);
        try {
            await api.post('/supporters/config', { config, tiers });
            setSaveMessage({ type: 'success', text: '✅ Guardado correctamente' });
        } catch {
            setSaveMessage({ type: 'error', text: '❌ Error al guardar' });
        } finally {
            setSaving(false);
            setTimeout(() => setSaveMessage(null), 3000);
        }
    };

    const updateConfig = (patch: Partial<PageConfig>) => setConfig(c => ({ ...c, ...patch }));

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="text-center">
                    <div className="text-5xl mb-4">🌟</div>
                    <p className="text-[#64748b] dark:text-[#94a3b8] font-bold">Cargando configuración...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1920px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="p-3 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors shadow-lg"
                    >
                        <ArrowLeft className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                            🌟 Supporters
                        </h1>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                            Configura la página pública de apoyos a Decatron
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {saveMessage && (
                        <span className={`text-sm font-bold px-3 py-1.5 rounded-lg ${
                            saveMessage.type === 'success'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                            {saveMessage.text}
                        </span>
                    )}
                    <a
                        href="/supporters"
                        target="_blank"
                        rel="noopener"
                        className="px-4 py-2.5 border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] rounded-xl font-bold flex items-center gap-2 hover:bg-[#f8fafc] dark:hover:bg-[#374151] transition-colors shadow-lg"
                    >
                        <Globe className="w-4 h-4" />
                        Ver página
                    </a>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-3 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-60 text-white rounded-xl transition-all flex items-center gap-2 font-bold shadow-lg"
                    >
                        <Save className="w-5 h-5" />
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>

            {/* Main Grid: 2/3 Editor + 1/3 Preview */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left: Tabs + Content */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Tab Nav */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 shadow-lg">
                        <div className="flex flex-wrap gap-2">
                            {TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-lg'
                                            : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                                    }`}
                                >
                                    {tab.icon} {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div>
                        {activeTab === 'general' && <GeneralTab config={config} onChange={updateConfig} />}
                        {activeTab === 'tiers' && <TiersTab tiers={tiers} onChange={setTiers} />}
                        {activeTab === 'supporters' && <SupportersTab />}
                        {activeTab === 'codes' && <CodesTab />}
                        {activeTab === 'testing' && <TestingTab
                            tierDurations={tierDurations}
                            setTierDurations={setTierDurations}
                            onSaveDurations={async (durations) => {
                                const updatedConfig = { ...config, tierDurations: durations };
                                setConfig(updatedConfig);
                                await api.post('/supporters/config', { config: updatedConfig, tiers });
                            }}
                        />}
                        {activeTab === 'appearance' && <AppearanceTab config={config} onChange={updateConfig} />}
                        {activeTab === 'cupos' && <SpotifySlotsTab />}
                    </div>
                </div>

                {/* Right: Preview */}
                <div className="xl:col-span-1">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg sticky top-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">
                                📺 Preview
                            </h3>
                            <a
                                href="/supporters"
                                target="_blank"
                                rel="noopener"
                                className="text-xs text-[#2563eb] hover:text-[#1d4ed8] flex items-center gap-1 font-semibold"
                            >
                                <ExternalLink className="w-3 h-3" />
                                Ver completa
                            </a>
                        </div>
                        <MiniPreview config={config} tiers={tiers} />
                    </div>
                </div>
            </div>
        </div>
    );
}
