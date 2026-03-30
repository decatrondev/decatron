/**
 * AdvancedTab - Templates Section
 *
 * Preset templates, custom templates list, and create/edit/apply modals.
 */

import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import type { AdvancedConfig } from '../../../types';

export interface CustomTemplate {
    id: number;
    name: string;
    description: string | null;
    icon: string;
    createdAt: string;
    updatedAt: string;
}

interface TemplatesSectionProps {
    advancedConfig: AdvancedConfig;
    onAdvancedConfigChange: (updates: Partial<AdvancedConfig>) => void;

    // Custom templates
    customTemplates: CustomTemplate[];
    loadingTemplates: boolean;

    // Create modal
    showCreateModal: boolean;
    setShowCreateModal: (show: boolean) => void;

    // Edit modal
    showEditModal: boolean;
    setShowEditModal: (show: boolean) => void;
    selectedTemplate: CustomTemplate | null;
    setSelectedTemplate: (t: CustomTemplate | null) => void;

    // Apply modal
    showApplyModal: boolean;
    setShowApplyModal: (show: boolean) => void;
    applyOptions: {
        applyBasic: boolean;
        applyCanvas: boolean;
        applyDisplay: boolean;
        applyProgressBar: boolean;
        applyStyle: boolean;
        applyAnimation: boolean;
        applyTheme: boolean;
        applyEvents: boolean;
        applyAlerts: boolean;
        applyGoal: boolean;
    };
    setApplyOptions: (opts: TemplatesSectionProps['applyOptions']) => void;

    // Form
    templateForm: { name: string; description: string; icon: string };
    setTemplateForm: (form: { name: string; description: string; icon: string }) => void;

    // Handlers
    onCreateTemplate: () => void;
    onEditTemplate: () => void;
    onDeleteTemplate: (template: CustomTemplate) => void;
    onApplyTemplate: () => void;
    onOpenEditModal: (template: CustomTemplate) => void;
    onOpenApplyModal: (template: CustomTemplate) => void;
}

const presetTemplateKeys = [
    { key: 'speedrun', nameKey: 'timerAdvanced.presetSpeedrun', icon: '⚡', descKey: 'timerAdvanced.presetSpeedrunDesc' },
    { key: 'subathon', nameKey: 'timerAdvanced.presetSubathon', icon: '🎯', descKey: 'timerAdvanced.presetSubathonDesc' },
    { key: 'gamingMarathon', nameKey: 'timerAdvanced.presetGamingMarathon', icon: '🎮', descKey: 'timerAdvanced.presetGamingMarathonDesc' }
];

export const TemplatesSection: React.FC<TemplatesSectionProps> = ({
    advancedConfig,
    onAdvancedConfigChange,
    customTemplates,
    loadingTemplates,
    showCreateModal,
    setShowCreateModal,
    showEditModal,
    setShowEditModal,
    selectedTemplate,
    setSelectedTemplate,
    showApplyModal,
    setShowApplyModal,
    applyOptions,
    setApplyOptions,
    templateForm,
    setTemplateForm,
    onCreateTemplate,
    onEditTemplate,
    onDeleteTemplate,
    onApplyTemplate,
    onOpenEditModal,
    onOpenApplyModal
}) => {
    const { t } = useTranslation('features');
    return (
        <>
            <div className="space-y-6">
                {/* Plantillas Predefinidas */}
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">{t('timerAdvanced.presetTemplates')}</h3>
                    <div className="space-y-3">
                        {presetTemplateKeys.map((template) => (
                            <button
                                key={template.key}
                                onClick={() => onAdvancedConfigChange({ activeTemplate: template.key })}
                                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                                    advancedConfig.activeTemplate === template.key
                                        ? 'bg-[#e2e8f0] dark:bg-[#374151] border-[#64748b] shadow-lg'
                                        : 'bg-gray-50 dark:bg-[#262626] border-transparent hover:border-[#94a3b8]'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{template.icon}</span>
                                    <div className="flex-1">
                                        <p className="font-bold text-sm text-[#1e293b] dark:text-[#f8fafc]">{t(template.nameKey)}</p>
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t(template.descKey)}</p>
                                    </div>
                                    {advancedConfig.activeTemplate === template.key && (
                                        <span className="text-blue-500 text-xl">✓</span>
                                    )}
                                </div>
                            </button>
                        ))}
                        <button
                            onClick={() => onAdvancedConfigChange({ activeTemplate: null })}
                            className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                                advancedConfig.activeTemplate === null
                                    ? 'bg-gray-100 dark:bg-gray-800 border-gray-400 shadow-lg'
                                    : 'bg-gray-50 dark:bg-[#262626] border-transparent hover:border-gray-300'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🚫</span>
                                <div className="flex-1">
                                    <p className="font-bold text-sm text-[#1e293b] dark:text-[#f8fafc]">{t('timerAdvanced.noTemplate')}</p>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('timerAdvanced.noTemplateDesc')}</p>
                                </div>
                                {advancedConfig.activeTemplate === null && <span className="text-gray-500 text-xl">✓</span>}
                            </div>
                        </button>
                    </div>
                </div>

                {/* Plantillas Personalizadas */}
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('timerAdvanced.myCustomTemplates')}</h3>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 bg-[#64748b] hover:bg-[#475569] text-white rounded-lg transition-colors flex items-center gap-2 font-bold text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            {t('timerAdvanced.createTemplate')}
                        </button>
                    </div>
                    {loadingTemplates ? (
                        <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">{t('timerAdvanced.loadingTemplates')}</div>
                    ) : customTemplates.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-[#64748b] dark:text-[#94a3b8] mb-4">{t('timerAdvanced.noCustomTemplates')}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {customTemplates.map((template) => (
                                <div key={template.id} className="p-4 rounded-lg border-2 border-[#e2e8f0] dark:border-[#374151] bg-gray-50 dark:bg-[#262626] hover:border-[#94a3b8] transition-all">
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl flex-shrink-0">{template.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-[#1e293b] dark:text-[#f8fafc]">{template.name}</p>
                                            {template.description && <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{template.description}</p>}
                                        </div>
                                        <div className="flex gap-2 flex-shrink-0">
                                            <button onClick={() => onOpenApplyModal(template)} className="px-3 py-1.5 bg-[#64748b] hover:bg-[#475569] text-white rounded text-xs font-bold transition-colors">{t('timerAdvanced.apply')}</button>
                                            <button onClick={() => onOpenEditModal(template)} className="p-1.5 text-[#64748b] hover:text-[#1e293b] dark:hover:text-[#f8fafc] transition-colors"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => onDeleteTemplate(template)} className="p-1.5 text-red-500 hover:text-red-700 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal: Crear Plantilla */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 max-w-md w-full shadow-2xl">
                        <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">{t('timerAdvanced.createNewTemplate')}</h3>
                        <div className="space-y-4">
                            <div><label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">{t('timerAdvanced.nameRequired_label')}</label><input type="text" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]" /></div>
                            <div><label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">{t('timerAdvanced.description')}</label><textarea value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} rows={3} className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]" /></div>
                            <div><label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">{t('timerAdvanced.icon')}</label><input type="text" value={templateForm.icon} onChange={(e) => setTemplateForm({ ...templateForm, icon: e.target.value })} maxLength={10} className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]" /></div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => { setShowCreateModal(false); setTemplateForm({ name: '', description: '', icon: '📋' }); }} className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#64748b] hover:text-[#1e293b] dark:hover:text-[#f8fafc] font-bold transition-colors">{t('timerAdvanced.cancel')}</button>
                            <button onClick={onCreateTemplate} className="flex-1 px-4 py-2 bg-[#64748b] hover:bg-[#475569] text-white rounded-lg font-bold transition-colors">{t('timerAdvanced.createTemplate')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Editar Plantilla */}
            {showEditModal && selectedTemplate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 max-w-md w-full shadow-2xl">
                        <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">{t('timerAdvanced.editTemplate')}</h3>
                        <div className="space-y-4">
                            <div><label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">{t('timerAdvanced.nameRequired_label')}</label><input type="text" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]" /></div>
                            <div><label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">{t('timerAdvanced.description')}</label><textarea value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} rows={3} className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]" /></div>
                            <div><label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">{t('timerAdvanced.icon')}</label><input type="text" value={templateForm.icon} onChange={(e) => setTemplateForm({ ...templateForm, icon: e.target.value })} maxLength={10} className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]" /></div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => { setShowEditModal(false); setSelectedTemplate(null); setTemplateForm({ name: '', description: '', icon: '📋' }); }} className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#64748b] hover:text-[#1e293b] dark:hover:text-[#f8fafc] font-bold transition-colors">{t('timerAdvanced.cancel')}</button>
                            <button onClick={onEditTemplate} className="flex-1 px-4 py-2 bg-[#64748b] hover:bg-[#475569] text-white rounded-lg font-bold transition-colors">{t('timerAdvanced.saveChanges')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Aplicar Plantilla */}
            {showApplyModal && selectedTemplate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 max-w-lg w-full shadow-2xl">
                        <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">{selectedTemplate.icon} {t('timerAdvanced.applyColon')} {selectedTemplate.name}</h3>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">{t('timerAdvanced.selectPartsToApply')}</p>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {/* Opciones de aplicar plantilla simplificadas */}
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-[#262626] cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"><input type="checkbox" checked={applyOptions.applyBasic} onChange={(e) => setApplyOptions({ ...applyOptions, applyBasic: e.target.checked })} className="w-4 h-4" /><div className="flex-1"><p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('timerAdvanced.applyBasicTimer')}</p></div></label>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-[#262626] cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"><input type="checkbox" checked={applyOptions.applyCanvas} onChange={(e) => setApplyOptions({ ...applyOptions, applyCanvas: e.target.checked })} className="w-4 h-4" /><div className="flex-1"><p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">Canvas</p></div></label>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-[#262626] cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"><input type="checkbox" checked={applyOptions.applyDisplay} onChange={(e) => setApplyOptions({ ...applyOptions, applyDisplay: e.target.checked })} className="w-4 h-4" /><div className="flex-1"><p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">Display</p></div></label>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-[#262626] cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"><input type="checkbox" checked={applyOptions.applyProgressBar} onChange={(e) => setApplyOptions({ ...applyOptions, applyProgressBar: e.target.checked })} className="w-4 h-4" /><div className="flex-1"><p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('timerAdvanced.applyProgressBar')}</p></div></label>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-[#262626] cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"><input type="checkbox" checked={applyOptions.applyStyle} onChange={(e) => setApplyOptions({ ...applyOptions, applyStyle: e.target.checked })} className="w-4 h-4" /><div className="flex-1"><p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('timerAdvanced.applyTextStyles')}</p></div></label>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-[#262626] cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"><input type="checkbox" checked={applyOptions.applyAnimation} onChange={(e) => setApplyOptions({ ...applyOptions, applyAnimation: e.target.checked })} className="w-4 h-4" /><div className="flex-1"><p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('timerAdvanced.applyAnimations')}</p></div></label>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-[#262626] cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"><input type="checkbox" checked={applyOptions.applyAlerts} onChange={(e) => setApplyOptions({ ...applyOptions, applyAlerts: e.target.checked })} className="w-4 h-4" /><div className="flex-1"><p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('timerAdvanced.applyAlerts')}</p></div></label>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-[#262626] cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"><input type="checkbox" checked={applyOptions.applyEvents} onChange={(e) => setApplyOptions({ ...applyOptions, applyEvents: e.target.checked })} className="w-4 h-4" /><div className="flex-1"><p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('timerAdvanced.applyEvents')}</p></div></label>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-[#262626] cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"><input type="checkbox" checked={applyOptions.applyGoal} onChange={(e) => setApplyOptions({ ...applyOptions, applyGoal: e.target.checked })} className="w-4 h-4" /><div className="flex-1"><p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('timerAdvanced.applyGoal')}</p></div></label>
                        </div>
                        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"><p className="text-xs text-yellow-700 dark:text-yellow-300">{t('timerAdvanced.applyWarning')}</p></div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => { setShowApplyModal(false); setSelectedTemplate(null); }} className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#64748b] hover:text-[#1e293b] dark:hover:text-[#f8fafc] font-bold transition-colors">{t('timerAdvanced.cancel')}</button>
                            <button onClick={onApplyTemplate} className="flex-1 px-4 py-2 bg-[#64748b] hover:bg-[#475569] text-white rounded-lg font-bold transition-colors">{t('timerAdvanced.applyNow')}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
