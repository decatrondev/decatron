// GoalsConfig - Main configuration page for Goals system

import TabIcon from '../../components/dashboard/TabIcon';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation('features');
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
        { id: 'guide', label: t('goals.tabs.guide'), icon: '📚' },
        { id: 'basic', label: t('goals.tabs.goals'), icon: '🎯' },
        { id: 'sources', label: t('goals.tabs.sources'), icon: '⚡' },
        { id: 'design', label: t('goals.tabs.design'), icon: '🎨' },
        { id: 'milestones', label: t('goals.tabs.milestones'), icon: '🏁' },
        { id: 'notifications', label: t('goals.tabs.alerts'), icon: '🔔' },
        { id: 'timer-integration', label: t('goals.tabs.timer'), icon: '⏱️' },
        { id: 'commands', label: t('goals.tabs.commands'), icon: '💬' },
        { id: 'history', label: t('goals.tabs.history'), icon: '📊' },
        { id: 'media', label: t('goals.tabs.media'), icon: '📁' },
        { id: 'overlay', label: t('goals.tabs.overlay'), icon: '🖥️' }
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
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ds-accent mx-auto mb-4"></div>
                    <p className="text-ds-soft">{t('goals.loadingConfig')}</p>
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
                            onClick={() => navigate('/overlays')}
                            className="ds-btn ds-btn--secondary ds-icon-btn"
                        >
                            <ArrowLeft className="w-5 h-5 text-ds-soft" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-ds-text">
                                🎯 {t('goals.title')}
                            </h1>
                            <p className="text-sm text-ds-soft mt-1">
                                {t('goals.subtitle')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSave}
                            disabled={persistence.saving}
                            className={`px-6 py-3 rounded-lg transition-all flex items-center gap-2 font-bold ${
                                persistence.saving
                                    ? 'bg-ds-faint cursor-not-allowed text-ds-text'
                                    : 'bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent'
                            }`}
                        >
                            <Save className="w-5 h-5" />
                            {persistence.saving ? t('goals.saving') : t('goals.saveConfig')}
                        </button>
                    </div>
                </div>

                {/* Save Message */}
                {persistence.saveMessage && (
                    <div className={`mb-6 p-4 rounded-lg border ${
                        persistence.saveMessage.type === 'success'
                            ? 'bg-ds-ok/10 border-ds-ok/40 text-ds-ok '
                            : 'bg-ds-danger/10 border-ds-danger/40 text-ds-danger '
                    }`}>
                        {persistence.saveMessage.text}
                    </div>
                )}

                {/* Main Grid: 2/3 Editor + 1/3 Preview */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Left Column: Tabs + Content (2/3 en XL+) */}
                    <div className="xl:col-span-2 space-y-6">
                        {/* Tabs Navigation - WRAPPING (No scroll) */}
                        <div className="bg-ds-surface rounded-lg border border-ds-border p-4">
                            <div className="flex flex-wrap gap-2">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={activeTab === tab.id ? 'ds-btn ds-btn--primary ds-btn--sm whitespace-nowrap' : 'ds-btn ds-btn--secondary ds-btn--sm whitespace-nowrap'}
                                    >
                                        <TabIcon emoji={tab.icon} />{tab.label}
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
