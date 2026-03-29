/**
 * Giveaway Extension - Main Configuration Component
 * Sistema de sorteos/giveaways profesional 
 */

import { useEffect, useState } from 'react';
import { Save, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';

// Hooks personalizados
import {
    useGiveawayConfig,
    useGiveawayState,
    useGiveawayPersistence,
} from './giveaway-extension/hooks';

// Componentes
import { StatePanel } from './giveaway-extension/components/StatePanel';
import {
    CreateTab,
    RequirementsTab,
    WeightsTab,
    ActiveTab,
    HistoryTab,
    SettingsTab,
    DebugTab,
} from './giveaway-extension/components/tabs';

// Types
import type { GiveawayTabType } from './giveaway-extension/types';

const GiveawayConfig = () => {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();

    // ========================================================================
    // STATE
    // ========================================================================
    const [activeTab, setActiveTab] = useState<GiveawayTabType>('create');

    // ========================================================================
    // HOOKS PERSONALIZADOS
    // ========================================================================

    // Configuración del giveaway
    const giveawayConfig = useGiveawayConfig();

    // Estado activo del giveaway
    const giveawayState = useGiveawayState();

    // Persistencia (guardar/cargar)
    const persistence = useGiveawayPersistence({
        onConfigLoaded: (config) => giveawayConfig.loadConfig(config),
    });

    // ========================================================================
    // EFFECTS
    // ========================================================================

    // Inicialización: cargar configuración y verificar permisos
    useEffect(() => {
        if (!permissionsLoading && hasMinimumLevel('moderation')) {
            persistence.loadConfiguration();
        } else if (!permissionsLoading) {
            navigate('/dashboard');
        }
    }, [permissionsLoading]);

    // ========================================================================
    // HANDLERS
    // ========================================================================

    const handleSave = async () => {
        const config = giveawayConfig.getCompleteConfig();
        await persistence.saveConfiguration(config);
    };

    const handleStartGiveaway = async () => {
        const config = giveawayConfig.getCompleteConfig();
        return await giveawayState.startGiveaway(config);
    };

    const handleEndGiveaway = async () => {
        return await giveawayState.endGiveaway();
    };

    const handleCancelGiveaway = async (reason?: string) => {
        return await giveawayState.cancelGiveaway(reason);
    };

    const handleRerollWinner = async (position?: number) => {
        return await giveawayState.rerollWinner(position);
    };

    const handleDisqualifyWinner = async (username: string, reason?: string) => {
        return await giveawayState.disqualifyWinner(username, reason);
    };

    const handleGenerateParticipants = async (config: any) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/giveaway/debug/generate-participants', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(config),
            });

            if (!response.ok) {
                throw new Error('Error generando participantes');
            }

            const result = await response.json();

            if (result.success) {
                alert(`✅ ${result.generated} participantes generados exitosamente`);

                // Refrescar estado si hay giveaway activo
                if (giveawayState.isActive) {
                    await giveawayState.refreshState();
                }
            } else {
                alert(`❌ Error: ${result.message}`);
            }
        } catch (error: any) {
            console.error('Error:', error);
            alert(`❌ Error al generar participantes: ${error.message || 'Error desconocido'}`);
        }
    };

    const handleClearParticipants = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/giveaway/debug/clear-participants', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Error limpiando participantes');
            }

            const result = await response.json();

            if (result.success) {
                alert(`✅ ${result.deleted} participantes eliminados`);

                // Refrescar estado si hay giveaway activo
                if (giveawayState.isActive) {
                    await giveawayState.refreshState();
                }
            } else {
                alert(`❌ Error: ${result.message}`);
            }
        } catch (error: any) {
            console.error('Error:', error);
            alert(`❌ Error al limpiar participantes: ${error.message || 'Error desconocido'}`);
        }
    };

    // ========================================================================
    // TAB COMPONENTS MAPPING
    // ========================================================================

    const tabs: { id: GiveawayTabType; label: string; icon: string }[] = [
        { id: 'create', label: 'Crear', icon: '🎁' },
        { id: 'requirements', label: 'Requisitos', icon: '🛡️' },
        { id: 'weights', label: 'Pesos', icon: '⚖️' },
        { id: 'active', label: 'Activo', icon: '🎲' },
        { id: 'history', label: 'Historial', icon: '📋' },
        { id: 'settings', label: 'Configuración', icon: '⚙️' },
        { id: 'debug', label: 'Debug', icon: '🧪' },
    ];

    // ========================================================================
    // RENDER
    // ========================================================================

    if (persistence.loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-500 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Cargando configuración...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#1B1C1D] p-4 sm:p-6 lg:p-8">
            <div className="max-w-[1920px] mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/features')}
                            className="p-3 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors shadow-lg"
                        >
                            <ArrowLeft className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                🎉 Sistema de Giveaways
                            </h1>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                                Crea sorteos profesionales con requisitos, pesos y validaciones
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSave}
                            disabled={persistence.saving || giveawayState.isActive}
                            title={giveawayState.isActive ? '⏸️ No puedes guardar mientras hay un giveaway activo' : 'Guardar configuración'}
                            className={`px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-bold shadow-lg ${
                                persistence.saving || giveawayState.isActive
                                    ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                                    : 'bg-[#3b82f6] hover:bg-[#2563eb] text-white border border-[#2563eb]'
                            }`}
                        >
                            <Save className="w-5 h-5" />
                            {persistence.saving ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                    </div>
                </div>

                {/* Save Message */}
                {persistence.saveMessage && (
                    <div className={`mb-6 p-4 rounded-xl border ${
                        persistence.saveMessage.type === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                    }`}>
                        {persistence.saveMessage.text}
                    </div>
                )}

                {/* Error Message from State */}
                {giveawayState.error && (
                    <div className="mb-6 p-4 rounded-xl border bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                        <div className="flex items-center justify-between">
                            <span>{giveawayState.error}</span>
                            <button
                                onClick={() => giveawayState.clearError()}
                                className="text-rose-500 hover:text-rose-700 font-bold"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                )}

                {/* Main Grid: 2/3 Editor + 1/3 State Panel */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Left Column: Tabs + Content (2/3 en XL+) */}
                    <div className="xl:col-span-2 space-y-6">
                        {/* Tabs Navigation */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 shadow-lg">
                            <div className="flex flex-wrap gap-2">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                                            activeTab === tab.id
                                                ? 'bg-slate-800 text-white shadow-lg dark:bg-slate-700'
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
                            {activeTab === 'create' && (
                                <CreateTab
                                    config={giveawayConfig.config}
                                    onUpdateConfig={giveawayConfig.updateBasicConfig}
                                />
                            )}

                            {activeTab === 'requirements' && (
                                <RequirementsTab
                                    requirements={giveawayConfig.config.requirements}
                                    onUpdateRequirements={giveawayConfig.updateRequirements}
                                />
                            )}

                            {activeTab === 'weights' && (
                                <WeightsTab
                                    weights={giveawayConfig.config.weights}
                                    onUpdateWeights={giveawayConfig.updateWeights}
                                />
                            )}

                            {activeTab === 'active' && (
                                <ActiveTab
                                    activeState={giveawayState.activeState}
                                    isActive={giveawayState.isActive}
                                    loading={giveawayState.loading}
                                    onStart={handleStartGiveaway}
                                    onEnd={handleEndGiveaway}
                                    onCancel={handleCancelGiveaway}
                                    onReroll={handleRerollWinner}
                                    onDisqualify={handleDisqualifyWinner}
                                />
                            )}

                            {activeTab === 'history' && (
                                <HistoryTab
                                    onLoadHistory={persistence.loadHistory}
                                    onLoadStatistics={persistence.loadStatistics}
                                    onDeleteEntry={persistence.deleteHistoryEntry}
                                    onExportHistory={persistence.exportHistory}
                                />
                            )}

                            {activeTab === 'settings' && (
                                <SettingsTab
                                    config={giveawayConfig.config}
                                    onUpdateConfig={giveawayConfig.updateBasicConfig}
                                />
                            )}

                            {activeTab === 'debug' && (
                                <DebugTab
                                    onGenerateParticipants={handleGenerateParticipants}
                                    onClearParticipants={handleClearParticipants}
                                />
                            )}
                        </div>
                    </div>

                    {/* Right Column: State Panel (1/3 en XL+) */}
                    <div className="xl:col-span-1">
                        <StatePanel
                            activeState={giveawayState.activeState}
                            isActive={giveawayState.isActive}
                            loading={giveawayState.loading}
                            currentConfig={giveawayConfig.config}
                            onStart={handleStartGiveaway}
                            onEnd={handleEndGiveaway}
                            onCancel={handleCancelGiveaway}
                            onReroll={handleRerollWinner}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GiveawayConfig;
