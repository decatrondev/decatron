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
                <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                    <h3 className="text-sm font-bold text-ds-text mb-4">{t('timerAdvanced.presetTemplates')}</h3>
                    <div className="space-y-3">
                        {presetTemplateKeys.map((template) => (
                            <button
                                key={template.key}
                                onClick={() => onAdvancedConfigChange({ activeTemplate: template.key })}
                                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                                    advancedConfig.activeTemplate === template.key
                                        ? 'bg-ds-accent border-ds-accent '
                                        : 'bg-ds-surface border-transparent hover:border-ds-faint'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{template.icon}</span>
                                    <div className="flex-1">
                                        <p className="font-bold text-sm text-ds-text">{t(template.nameKey)}</p>
                                        <p className="text-xs text-ds-soft mt-1">{t(template.descKey)}</p>
                                    </div>
                                    {advancedConfig.activeTemplate === template.key && (
                                        <span className="text-ds-accent-text text-xl">✓</span>
                                    )}
                                </div>
                            </button>
                        ))}
                        <button
                            onClick={() => onAdvancedConfigChange({ activeTemplate: null })}
                            className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                                advancedConfig.activeTemplate === null
                                    ? 'bg-ds-bg border-ds-border '
                                    : 'bg-ds-surface border-transparent hover:border-ds-border'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🚫</span>
                                <div className="flex-1">
                                    <p className="font-bold text-sm text-ds-text">{t('timerAdvanced.noTemplate')}</p>
                                    <p className="text-xs text-ds-soft mt-1">{t('timerAdvanced.noTemplateDesc')}</p>
                                </div>
                                {advancedConfig.activeTemplate === null && <span className="text-ds-soft text-xl">✓</span>}
                            </div>
                        </button>
                    </div>
                </div>

                {/* Plantillas Personalizadas */}
                <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-ds-text">{t('timerAdvanced.myCustomTemplates')}</h3>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 bg-ds-raised hover:bg-ds-raised text-ds-text rounded-lg transition-colors flex items-center gap-2 font-bold text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            {t('timerAdvanced.createTemplate')}
                        </button>
                    </div>
                    {loadingTemplates ? (
                        <div className="text-center py-8 text-ds-soft">{t('timerAdvanced.loadingTemplates')}</div>
                    ) : customTemplates.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-ds-soft mb-4">{t('timerAdvanced.noCustomTemplates')}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {customTemplates.map((template) => (
                                <div key={template.id} className="p-4 rounded-lg border-2 border-ds-border bg-ds-surface hover:border-ds-faint transition-all">
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl flex-shrink-0">{template.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-ds-text">{template.name}</p>
                                            {template.description && <p className="text-xs text-ds-soft mt-1">{template.description}</p>}
                                        </div>
                                        <div className="flex gap-2 flex-shrink-0">
                                            <button onClick={() => onOpenApplyModal(template)} className="px-3 py-1.5 bg-ds-raised hover:bg-ds-raised text-ds-text rounded text-xs font-bold transition-colors">{t('timerAdvanced.apply')}</button>
                                            <button onClick={() => onOpenEditModal(template)} className="p-1.5 text-ds-soft hover:text-ds-text transition-colors"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => onDeleteTemplate(template)} className="p-1.5 text-ds-danger hover:text-ds-danger transition-colors"><Trash2 className="w-4 h-4" /></button>
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
                <div className="fixed inset-0 bg-ds-input/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold text-ds-text mb-4">{t('timerAdvanced.createNewTemplate')}</h3>
                        <div className="space-y-4">
                            <div><label className="text-xs font-bold text-ds-soft block mb-2">{t('timerAdvanced.nameRequired_label')}</label><input type="text" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text" /></div>
                            <div><label className="text-xs font-bold text-ds-soft block mb-2">{t('timerAdvanced.description')}</label><textarea value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} rows={3} className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text" /></div>
                            <div><label className="text-xs font-bold text-ds-soft block mb-2">{t('timerAdvanced.icon')}</label><input type="text" value={templateForm.icon} onChange={(e) => setTemplateForm({ ...templateForm, icon: e.target.value })} maxLength={10} className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text" /></div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => { setShowCreateModal(false); setTemplateForm({ name: '', description: '', icon: '📋' }); }} className="flex-1 px-4 py-2 border border-ds-border rounded-lg text-ds-soft hover:text-ds-text font-bold transition-colors">{t('timerAdvanced.cancel')}</button>
                            <button onClick={onCreateTemplate} className="flex-1 px-4 py-2 bg-ds-raised hover:bg-ds-raised text-ds-text rounded-lg font-bold transition-colors">{t('timerAdvanced.createTemplate')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Editar Plantilla */}
            {showEditModal && selectedTemplate && (
                <div className="fixed inset-0 bg-ds-input/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold text-ds-text mb-4">{t('timerAdvanced.editTemplate')}</h3>
                        <div className="space-y-4">
                            <div><label className="text-xs font-bold text-ds-soft block mb-2">{t('timerAdvanced.nameRequired_label')}</label><input type="text" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text" /></div>
                            <div><label className="text-xs font-bold text-ds-soft block mb-2">{t('timerAdvanced.description')}</label><textarea value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} rows={3} className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text" /></div>
                            <div><label className="text-xs font-bold text-ds-soft block mb-2">{t('timerAdvanced.icon')}</label><input type="text" value={templateForm.icon} onChange={(e) => setTemplateForm({ ...templateForm, icon: e.target.value })} maxLength={10} className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text" /></div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => { setShowEditModal(false); setSelectedTemplate(null); setTemplateForm({ name: '', description: '', icon: '📋' }); }} className="flex-1 px-4 py-2 border border-ds-border rounded-lg text-ds-soft hover:text-ds-text font-bold transition-colors">{t('timerAdvanced.cancel')}</button>
                            <button onClick={onEditTemplate} className="flex-1 px-4 py-2 bg-ds-raised hover:bg-ds-raised text-ds-text rounded-lg font-bold transition-colors">{t('timerAdvanced.saveChanges')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Aplicar Plantilla */}
            {showApplyModal && selectedTemplate && (
                <div className="fixed inset-0 bg-ds-input/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-6 max-w-lg w-full">
                        <h3 className="text-lg font-bold text-ds-text mb-2">{selectedTemplate.icon} {t('timerAdvanced.applyColon')} {selectedTemplate.name}</h3>
                        <p className="text-xs text-ds-soft mb-4">{t('timerAdvanced.selectPartsToApply')}</p>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {/* Opciones de aplicar plantilla simplificadas */}
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-ds-surface cursor-pointer hover:bg-ds-bg"><input type="checkbox" checked={applyOptions.applyBasic} onChange={(e) => setApplyOptions({ ...applyOptions, applyBasic: e.target.checked })} className="w-4 h-4" /><div className="flex-1"><p className="text-sm font-bold text-ds-text">{t('timerAdvanced.applyBasicTimer')}</p></div></label>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-ds-surface cursor-pointer hover:bg-ds-bg"><input type="checkbox" checked={applyOptions.applyCanvas} onChange={(e) => setApplyOptions({ ...applyOptions, applyCanvas: e.target.checked })} className="w-4 h-4" /><div className="flex-1"><p className="text-sm font-bold text-ds-text">Canvas</p></div></label>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-ds-surface cursor-pointer hover:bg-ds-bg"><input type="checkbox" checked={applyOptions.applyDisplay} onChange={(e) => setApplyOptions({ ...applyOptions, applyDisplay: e.target.checked })} className="w-4 h-4" /><div className="flex-1"><p className="text-sm font-bold text-ds-text">Display</p></div></label>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-ds-surface cursor-pointer hover:bg-ds-bg"><input type="checkbox" checked={applyOptions.applyProgressBar} onChange={(e) => setApplyOptions({ ...applyOptions, applyProgressBar: e.target.checked })} className="w-4 h-4" /><div className="flex-1"><p className="text-sm font-bold text-ds-text">{t('timerAdvanced.applyProgressBar')}</p></div></label>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-ds-surface cursor-pointer hover:bg-ds-bg"><input type="checkbox" checked={applyOptions.applyStyle} onChange={(e) => setApplyOptions({ ...applyOptions, applyStyle: e.target.checked })} className="w-4 h-4" /><div className="flex-1"><p className="text-sm font-bold text-ds-text">{t('timerAdvanced.applyTextStyles')}</p></div></label>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-ds-surface cursor-pointer hover:bg-ds-bg"><input type="checkbox" checked={applyOptions.applyAnimation} onChange={(e) => setApplyOptions({ ...applyOptions, applyAnimation: e.target.checked })} className="w-4 h-4" /><div className="flex-1"><p className="text-sm font-bold text-ds-text">{t('timerAdvanced.applyAnimations')}</p></div></label>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-ds-surface cursor-pointer hover:bg-ds-bg"><input type="checkbox" checked={applyOptions.applyAlerts} onChange={(e) => setApplyOptions({ ...applyOptions, applyAlerts: e.target.checked })} className="w-4 h-4" /><div className="flex-1"><p className="text-sm font-bold text-ds-text">{t('timerAdvanced.applyAlerts')}</p></div></label>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-ds-surface cursor-pointer hover:bg-ds-bg"><input type="checkbox" checked={applyOptions.applyEvents} onChange={(e) => setApplyOptions({ ...applyOptions, applyEvents: e.target.checked })} className="w-4 h-4" /><div className="flex-1"><p className="text-sm font-bold text-ds-text">{t('timerAdvanced.applyEvents')}</p></div></label>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-ds-surface cursor-pointer hover:bg-ds-bg"><input type="checkbox" checked={applyOptions.applyGoal} onChange={(e) => setApplyOptions({ ...applyOptions, applyGoal: e.target.checked })} className="w-4 h-4" /><div className="flex-1"><p className="text-sm font-bold text-ds-text">{t('timerAdvanced.applyGoal')}</p></div></label>
                        </div>
                        <div className="mt-4 p-3 bg-ds-warn/10 rounded-lg"><p className="text-xs text-ds-warn">{t('timerAdvanced.applyWarning')}</p></div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => { setShowApplyModal(false); setSelectedTemplate(null); }} className="flex-1 px-4 py-2 border border-ds-border rounded-lg text-ds-soft hover:text-ds-text font-bold transition-colors">{t('timerAdvanced.cancel')}</button>
                            <button onClick={onApplyTemplate} className="flex-1 px-4 py-2 bg-ds-raised hover:bg-ds-raised text-ds-text rounded-lg font-bold transition-colors">{t('timerAdvanced.applyNow')}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
