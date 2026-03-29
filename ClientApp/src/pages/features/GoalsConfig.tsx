// GoalsConfig - Main configuration page for Goals system

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, ArrowLeft } from 'lucide-react';
import { usePermissions } from '../../contexts/PermissionsContext';

// Hooks
import { useGoalsConfig } from './goals-extension/hooks/useGoalsConfig';
import { useGoalsPersistence } from './goals-extension/hooks/useGoalsPersistence';

// Components
import {
    GuideTab,
    BasicTab,
    SourcesTab,
    DesignTab,
    MilestonesTab,
    NotificationsTab,
    TimerIntegrationTab,
    CommandsTab,
    HistoryTab,
    MediaTab,
    OverlayTab
} from './goals-extension/components/tabs';
import { GoalsPreview } from './goals-extension/components/preview';

// Types
import type { GoalsTabType } from './goals-extension/types';

const GoalsConfig = () => {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();

    // Tab state
    const [activeTab, setActiveTab] = useState<GoalsTabType>('guide');

    // Goals config hook
    const goalsConfig = useGoalsConfig();

    // Persistence hook
    const persistence = useGoalsPersistence({
        onConfigLoaded: (config) => {
            goalsConfig.loadConfig(config);
        }
    });

    // Load config on mount
    useEffect(() => {
        if (!permissionsLoading && hasMinimumLevel('moderation')) {
            persistence.loadFrontendInfo();
            persistence.loadConfiguration();
        } else if (!permissionsLoading) {
            navigate('/dashboard');
        }
    }, [permissionsLoading]);

    // Handle save
    const handleSave = async () => {
        const config = goalsConfig.getCompleteConfig();
        await persistence.saveConfiguration(config);
    };

    // Tabs configuration
    const tabs: { id: GoalsTabType; label: string; icon: string }[] = [
        { id: 'guide', label: 'Guía', icon: '📚' },
        { id: 'basic', label: 'Metas', icon: '🎯' },
        { id: 'sources', label: 'Fuentes', icon: '⚡' },
        { id: 'design', label: 'Diseño', icon: '🎨' },
        { id: 'milestones', label: 'Hitos', icon: '🏁' },
        { id: 'notifications', label: 'Alertas', icon: '🔔' },
        { id: 'timer-integration', label: 'Timer', icon: '⏱️' },
        { id: 'commands', label: 'Comandos', icon: '💬' },
        { id: 'history', label: 'Historial', icon: '📊' },
        { id: 'media', label: 'Media', icon: '📁' },
        { id: 'overlay', label: 'Overlay', icon: '🖥️' }
    ];

    // Render active tab content
    const renderTabContent = () => {
        switch (activeTab) {
            case 'guide':
                return <GuideTab onNavigateToTab={(tab: string) => setActiveTab(tab as GoalsTabType)} />;

            case 'basic':
                return (
                    <BasicTab
                        goals={goalsConfig.goals}
                        activeGoalIds={goalsConfig.activeGoalIds}
                        onAddGoal={goalsConfig.addGoal}
                        onUpdateGoal={goalsConfig.updateGoal}
                        onDeleteGoal={goalsConfig.deleteGoal}
                        onDuplicateGoal={goalsConfig.duplicateGoal}
                        onToggleGoalActive={goalsConfig.toggleGoalActive}
                    />
                );

            case 'sources':
                return (
                    <SourcesTab
                        defaultSources={goalsConfig.defaultSources}
                        onUpdateDefaultSources={goalsConfig.updateDefaultSources}
                    />
                );

            case 'design':
                return (
                    <DesignTab
                        design={goalsConfig.design}
                        onUpdateDesign={goalsConfig.updateDesign}
                        onUpdateDesignProgressBar={goalsConfig.updateDesignProgressBar}
                        onUpdateDesignText={goalsConfig.updateDesignText}
                        onUpdateDesignContainer={goalsConfig.updateDesignContainer}
                        onUpdateDesignAnimations={goalsConfig.updateDesignAnimations}
                    />
                );

            case 'milestones':
                return (
                    <MilestonesTab
                        goals={goalsConfig.goals}
                        onAddMilestone={goalsConfig.addMilestone}
                        onUpdateMilestone={goalsConfig.updateMilestone}
                        onDeleteMilestone={goalsConfig.deleteMilestone}
                    />
                );

            case 'notifications':
                return (
                    <NotificationsTab
                        notifications={goalsConfig.notifications}
                        onUpdateNotifications={goalsConfig.updateNotifications}
                    />
                );

            case 'timer-integration':
                return (
                    <TimerIntegrationTab
                        timerIntegration={goalsConfig.timerIntegration}
                        onUpdateTimerIntegration={goalsConfig.updateTimerIntegration}
                    />
                );

            case 'commands':
                return (
                    <CommandsTab
                        commands={goalsConfig.commands}
                        onUpdateCommands={goalsConfig.updateCommands}
                    />
                );

            case 'history':
                return (
                    <HistoryTab
                        historyEnabled={goalsConfig.historyEnabled}
                        historyRetentionDays={goalsConfig.historyRetentionDays}
                        resetOnStreamEnd={goalsConfig.resetOnStreamEnd}
                        onSetHistoryEnabled={goalsConfig.setHistoryEnabled}
                        onSetHistoryRetentionDays={goalsConfig.setHistoryRetentionDays}
                        onSetResetOnStreamEnd={goalsConfig.setResetOnStreamEnd}
                    />
                );

            case 'media':
                return <MediaTab />;

            case 'overlay':
                return (
                    <OverlayTab
                        design={goalsConfig.design}
                        goals={goalsConfig.goals}
                        activeGoalIds={goalsConfig.activeGoalIds}
                        canvasWidth={goalsConfig.canvasWidth}
                        canvasHeight={goalsConfig.canvasHeight}
                        onUpdateDesign={goalsConfig.updateDesign}
                        onSetCanvasWidth={goalsConfig.setCanvasWidth}
                        onSetCanvasHeight={goalsConfig.setCanvasHeight}
                        goalPositions={goalsConfig.goalPositions}
                        onUpdateGoalPositions={goalsConfig.setGoalPositions}
                    />
                );

            default:
                return null;
        }
    };

    if (persistence.loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
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
                            onClick={() => navigate('/overlays')}
                            className="p-3 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors shadow-lg"
                        >
                            <ArrowLeft className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                🎯 Sistema de Metas
                            </h1>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                                Configura metas interactivas con múltiples fuentes y milestones
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSave}
                            disabled={persistence.saving}
                            className={`px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-bold shadow-lg ${
                                persistence.saving
                                    ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                                    : 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] text-white'
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
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                    }`}>
                        {persistence.saveMessage.text}
                    </div>
                )}

                {/* Main Grid: 2/3 Editor + 1/3 Preview */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Left Column: Tabs + Content (2/3 en XL+) */}
                    <div className="xl:col-span-2 space-y-6">
                        {/* Tabs Navigation - WRAPPING (No scroll) */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 shadow-lg">
                            <div className="flex flex-wrap gap-2">
                                {tabs.map((tab) => (
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
                            {renderTabContent()}
                        </div>
                    </div>

                    {/* Right Column: Preview (1/3 en XL+) */}
                    <div className="xl:col-span-1">
                        <GoalsPreview
                            goals={goalsConfig.goals}
                            activeGoalIds={goalsConfig.activeGoalIds}
                            design={goalsConfig.design}
                            overlayUrl={persistence.overlayUrl}
                            onCopyOverlayUrl={persistence.copyOverlayUrl}
                            canvasWidth={goalsConfig.canvasWidth}
                            canvasHeight={goalsConfig.canvasHeight}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GoalsConfig;
