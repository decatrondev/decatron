/**
 * Giveaway Extension - Main Configuration Component
 * Sistema de sorteos/giveaways profesional 
 */

import TabIcon from '../../components/dashboard/TabIcon';
import { useEffect, useState } from 'react';
import { Save, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation('features');
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
        { id: 'create', label: t('giveaway.tabs.create'), icon: '🎁' },
        { id: 'requirements', label: t('giveaway.tabs.requirements'), icon: '🛡️' },
        { id: 'weights', label: t('giveaway.tabs.weights'), icon: '⚖️' },
        { id: 'active', label: t('giveaway.tabs.active'), icon: '🎲' },
        { id: 'history', label: t('giveaway.tabs.history'), icon: '📋' },
        { id: 'settings', label: t('giveaway.tabs.settings'), icon: '⚙️' },
        { id: 'debug', label: t('giveaway.tabs.debug'), icon: '🧪' },
    ];

    // ========================================================================
    // RENDER
    // ========================================================================

    if (persistence.loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ds-border mx-auto mb-4"></div>
                    <p className="text-ds-soft">{t('giveaway.loadingConfig')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ds-bg p-4 sm:p-6 lg:p-8">
            <div className="max-w-[1920px] mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/features')}
                            className="p-3 bg-ds-surface rounded-lg border border-ds-border hover:bg-ds-bg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-ds-soft" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-ds-text">
                                🎉 {t('giveaway.title')}
                            </h1>
                            <p className="text-sm text-ds-soft mt-1">
                                {t('giveaway.subtitle')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSave}
                            disabled={persistence.saving || giveawayState.isActive}
                            title={giveawayState.isActive ? t('giveaway.cannotSaveActive') : t('giveaway.saveConfig')}
                            className={`px-6 py-3 rounded-lg transition-all flex items-center gap-2 font-bold ${
                                persistence.saving || giveawayState.isActive
                                    ? 'bg-ds-faint cursor-not-allowed text-ds-text'
                                    : 'bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent border border-ds-accent'
                            }`}
                        >
                            <Save className="w-5 h-5" />
                            {persistence.saving ? t('giveaway.saving') : t('giveaway.saveConfig')}
                        </button>
                    </div>
                </div>

                {/* Save Message */}
                {persistence.saveMessage && (
                    <div className={`mb-6 p-4 rounded-lg border ${
                        persistence.saveMessage.type === 'success'
                            ? 'bg-ds-ok/10 border-ds-ok/40 text-ds-ok '
                            : 'bg-ds-accent/10 border-ds-accent text-ds-accent-text '
                    }`}>
                        {persistence.saveMessage.text}
                    </div>
                )}

                {/* Error Message from State */}
                {giveawayState.error && (
                    <div className="mb-6 p-4 rounded-lg border bg-ds-accent/10 border-ds-accent text-ds-accent-text">
                        <div className="flex items-center justify-between">
                            <span>{giveawayState.error}</span>
                            <button
                                onClick={() => giveawayState.clearError()}
                                className="text-ds-accent-text hover:text-ds-accent-text font-bold"
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
                        <div className="bg-ds-surface rounded-lg border border-ds-border p-4">
                            <div className="flex flex-wrap gap-2">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                                            activeTab === tab.id
                                                ? 'bg-ds-raised text-ds-text '
                                                : 'bg-ds-bg text-ds-soft hover:bg-ds-raised '
                                        }`}
                                    >
                                        <TabIcon emoji={tab.icon} />{tab.label}
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
