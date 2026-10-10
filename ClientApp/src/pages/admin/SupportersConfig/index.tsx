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
    InvoicesTab,
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
                    <p className="text-ds-soft font-bold">Cargando configuración...</p>
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
                        className="p-3 bg-ds-surface rounded-lg border border-ds-border hover:bg-ds-bg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-ds-soft" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">
                            🌟 Supporters
                        </h1>
                        <p className="text-sm text-ds-soft mt-1">
                            Configura la página pública de apoyos a Decatron
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {saveMessage && (
                        <span className={`text-sm font-bold px-3 py-1.5 rounded-lg ${
                            saveMessage.type === 'success'
                                ? 'bg-ds-ok/10 text-ds-ok '
                                : 'bg-ds-danger/10 text-ds-danger '
                        }`}>
                            {saveMessage.text}
                        </span>
                    )}
                    <a
                        href="/supporters"
                        target="_blank"
                        rel="noopener"
                        className="px-4 py-2.5 border border-ds-border bg-ds-surface text-ds-soft rounded-lg font-bold flex items-center gap-2 hover:bg-ds-bg transition-colors"
                    >
                        <Globe className="w-4 h-4" />
                        Ver página
                    </a>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-3 bg-ds-accent hover:bg-ds-accent-hover disabled:opacity-60 text-ds-on-accent rounded-lg transition-all flex items-center gap-2 font-bold"
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
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-4">
                        <div className="flex flex-wrap gap-2">
                            {TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-ds-accent text-ds-on-accent'
                                            : 'bg-ds-bg text-ds-soft hover:bg-ds-raised '
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
                        {activeTab === 'invoices' && <InvoicesTab />}
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
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-6 sticky top-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-ds-text">
                                📺 Preview
                            </h3>
                            <a
                                href="/supporters"
                                target="_blank"
                                rel="noopener"
                                className="text-xs text-ds-accent-text hover:text-ds-accent-text flex items-center gap-1 font-semibold"
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
