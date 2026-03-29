/**
 * Timer Extension - AdvancedTab Component (Orchestrator)
 *
 * Configuración avanzada: plantillas, auto-pause y happy hour.
 * State management, API calls, and section switching.
 */

import { useState, useEffect } from 'react';
import api from '../../../../../../services/api';
import type { AdvancedConfig } from '../../../types';
import { GeneralSection } from './GeneralSection';
import { TemplatesSection, type CustomTemplate } from './TemplatesSection';
import { SchedulesSection, type Schedule, type ScheduleFormData } from './SchedulesSection';
import { HappyHourSection, type HappyHour, type HappyHourFormData } from './HappyHourSection';

interface AdvancedTabProps {
    advancedConfig: AdvancedConfig;
    onAdvancedConfigChange: (updates: Partial<AdvancedConfig>) => void;
    timeZone?: string;
    onTimeZoneChange: (tz: string) => void;
}

type AdvancedSection = 'general' | 'templates' | 'autoPause' | 'happyHour';

export const AdvancedTab: React.FC<AdvancedTabProps> = ({
    advancedConfig,
    onAdvancedConfigChange,
    timeZone,
    onTimeZoneChange
}) => {
    const [selectedSection, setSelectedSection] = useState<AdvancedSection>('general');

    // Templates state
    const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<CustomTemplate | null>(null);
    const [templateForm, setTemplateForm] = useState({ name: '', description: '', icon: '📋' });
    const [applyOptions, setApplyOptions] = useState({
        applyBasic: true,
        applyCanvas: true,
        applyDisplay: true,
        applyProgressBar: true,
        applyStyle: true,
        applyAnimation: true,
        applyTheme: true,
        applyEvents: true,
        applyAlerts: true,
        applyGoal: true
    });

    // Schedules state
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loadingSchedules, setLoadingSchedules] = useState(false);
    const [showCreateScheduleModal, setShowCreateScheduleModal] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
    const [isEditingSchedule, setIsEditingSchedule] = useState(false);

    const [scheduleForm, setScheduleForm] = useState<ScheduleFormData>({
        name: '',
        reason: '',
        startTime: '00:00',
        endTime: '23:59',
        daysOfWeek: [true, true, true, true, true, true, true],
        enabled: true
    });

    // Happy Hour state
    const [happyHours, setHappyHours] = useState<HappyHour[]>([]);
    const [loadingHappyHours, setLoadingHappyHours] = useState(false);
    const [showCreateHappyHourModal, setShowCreateHappyHourModal] = useState(false);
    const [editingHappyHour, setEditingHappyHour] = useState<HappyHour | null>(null);
    const [isEditingHappyHour, setIsEditingHappyHour] = useState(false);

    const [happyHourForm, setHappyHourForm] = useState<HappyHourFormData>({
        name: '',
        description: '',
        startTime: '00:00',
        endTime: '23:59',
        multiplier: 2.0,
        daysOfWeek: [true, true, true, true, true, true, true],
        enabled: true
    });

    // Manual Happy Hour state
    const [manualMultiplier, setManualMultiplier] = useState(2.0);
    const [manualDuration, setManualDuration] = useState(60);
    const [manualActive, setManualActive] = useState(false);
    const [manualExpiresAt, setManualExpiresAt] = useState<string | null>(null);
    const [manualCountdown, setManualCountdown] = useState('');

    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const sections: { type: AdvancedSection; label: string; icon: string }[] = [
        { type: 'general', label: 'General', icon: '🌍' },
        { type: 'templates', label: 'Plantillas', icon: '📋' },
        { type: 'autoPause', label: 'Auto-Pausa', icon: '⏸️' },
        { type: 'happyHour', label: 'Happy Hour', icon: '🎉' }
    ];

    // Data Loading Functions
    const loadCustomTemplates = async () => {
        try {
            setLoadingTemplates(true);
            const res = await api.get('/timer/templates');
            if (res.data.success) {
                setCustomTemplates(res.data.templates);
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            showMessage('error', 'Error al cargar plantillas');
        } finally {
            setLoadingTemplates(false);
        }
    };

    const loadSchedules = async () => {
        try {
            setLoadingSchedules(true);
            const res = await api.get('/timer/schedules');
            if (res.data.success) {
                setSchedules(res.data.schedules);
            }
        } catch (error) {
            console.error('Error loading schedules:', error);
            showMessage('error', 'Error al cargar horarios');
        } finally {
            setLoadingSchedules(false);
        }
    };

    const loadHappyHours = async () => {
        try {
            setLoadingHappyHours(true);
            const res = await api.get('/timer/happyhour');
            if (res.data.success) {
                setHappyHours(res.data.happyHours);
            }
        } catch (error: any) {
            console.error('Error loading happy hours:', error);
            showMessage('error', error.response?.data?.message || 'Error al cargar horarios de Happy Hour');
        } finally {
            setLoadingHappyHours(false);
        }
    };

    const loadManualHappyHourStatus = async () => {
        try {
            const res = await api.get('/timer/happy-hour/manual-status');
            if (res.data.success) {
                setManualActive(res.data.active);
                setManualExpiresAt(res.data.active ? res.data.expiresAt : null);
            }
        } catch (error) {
            console.error('Error loading manual HH status:', error);
        }
    };

    const handleManualActivate = async () => {
        try {
            const res = await api.post('/timer/happy-hour/manual-activate', {
                multiplier: manualMultiplier,
                durationMinutes: manualDuration
            });
            if (res.data.success) {
                showMessage('success', res.data.message);
                setManualActive(true);
                setManualExpiresAt(res.data.expiresAt);
            }
        } catch (error: any) {
            showMessage('error', error.response?.data?.message || 'Error al activar Happy Hour manual');
        }
    };

    const handleManualDeactivate = async () => {
        try {
            const res = await api.post('/timer/happy-hour/manual-deactivate');
            if (res.data.success) {
                showMessage('success', res.data.message);
                setManualActive(false);
                setManualExpiresAt(null);
                setManualCountdown('');
            }
        } catch (error: any) {
            showMessage('error', error.response?.data?.message || 'Error al desactivar Happy Hour manual');
        }
    };

    // Countdown timer for manual Happy Hour
    useEffect(() => {
        if (!manualActive || !manualExpiresAt) return;
        const interval = setInterval(() => {
            const now = new Date().getTime();
            const expires = new Date(manualExpiresAt).getTime();
            const diff = expires - now;
            if (diff <= 0) {
                setManualActive(false);
                setManualExpiresAt(null);
                setManualCountdown('');
                clearInterval(interval);
                return;
            }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setManualCountdown(`${h > 0 ? h + 'h ' : ''}${m}m ${s}s`);
        }, 1000);
        return () => clearInterval(interval);
    }, [manualActive, manualExpiresAt]);

    // Load data when section changes
    useEffect(() => {
        if (selectedSection === 'templates') {
            loadCustomTemplates();
        } else if (selectedSection === 'autoPause') {
            loadSchedules();
        } else if (selectedSection === 'happyHour') {
            loadHappyHours();
            loadManualHappyHourStatus();
        }
    }, [selectedSection]);

    const showMessage = (type: 'success' | 'error', text: string) => {
        setActionMessage({ type, text });
        setTimeout(() => setActionMessage(null), 3000);
    };

    // --- TEMPLATE HANDLERS ---

    const handleCreateTemplate = async () => {
        if (!templateForm.name.trim()) {
            showMessage('error', 'El nombre es requerido');
            return;
        }

        try {
            const res = await api.post('/timer/templates', templateForm);
            if (res.data.success) {
                showMessage('success', 'Plantilla creada exitosamente');
                setShowCreateModal(false);
                setTemplateForm({ name: '', description: '', icon: '📋' });
                await loadCustomTemplates();
            }
        } catch (error: any) {
            console.error('Error creating template:', error);
            showMessage('error', error.response?.data?.message || 'Error al crear plantilla');
        }
    };

    const handleEditTemplate = async () => {
        if (!selectedTemplate || !templateForm.name.trim()) {
            showMessage('error', 'El nombre es requerido');
            return;
        }

        try {
            const res = await api.put(`/timer/templates/${selectedTemplate.id}`, templateForm);
            if (res.data.success) {
                showMessage('success', 'Plantilla actualizada exitosamente');
                setShowEditModal(false);
                setSelectedTemplate(null);
                setTemplateForm({ name: '', description: '', icon: '📋' });
                await loadCustomTemplates();
            }
        } catch (error: any) {
            console.error('Error updating template:', error);
            showMessage('error', error.response?.data?.message || 'Error al actualizar plantilla');
        }
    };

    const handleDeleteTemplate = async (template: CustomTemplate) => {
        if (!confirm(`¿Seguro que quieres eliminar la plantilla "${template.name}"?`)) {
            return;
        }

        try {
            const res = await api.delete(`/timer/templates/${template.id}`);
            if (res.data.success) {
                showMessage('success', 'Plantilla eliminada exitosamente');
                await loadCustomTemplates();
            }
        } catch (error: any) {
            console.error('Error deleting template:', error);
            showMessage('error', error.response?.data?.message || 'Error al eliminar plantilla');
        }
    };

    const handleApplyTemplate = async () => {
        if (!selectedTemplate) return;

        try {
            const res = await api.post(`/timer/templates/${selectedTemplate.id}/apply`, applyOptions);
            if (res.data.success) {
                showMessage('success', 'Plantilla aplicada exitosamente');
                setShowApplyModal(false);
                setSelectedTemplate(null);
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (error: any) {
            console.error('Error applying template:', error);
            showMessage('error', error.response?.data?.message || 'Error al aplicar plantilla');
        }
    };

    const openEditModal = (template: CustomTemplate) => {
        setSelectedTemplate(template);
        setTemplateForm({
            name: template.name,
            description: template.description || '',
            icon: template.icon
        });
        setShowEditModal(true);
    };

    const openApplyModal = (template: CustomTemplate) => {
        setSelectedTemplate(template);
        setShowApplyModal(true);
    };

    // ========================================================================
    // SCHEDULES HANDLERS
    // ========================================================================

    const resetScheduleForm = () => {
        setShowCreateScheduleModal(false);
        setIsEditingSchedule(false);
        setSelectedSchedule(null);
        setScheduleForm({
            name: '',
            reason: '',
            startTime: '00:00',
            endTime: '23:59',
            daysOfWeek: [true, true, true, true, true, true, true],
            enabled: true
        });
    };

    const handleCreateSchedule = async () => {
        if (!scheduleForm.name.trim()) {
            showMessage('error', 'El nombre es requerido');
            return;
        }

        try {
            const res = await api.post('/timer/schedules', scheduleForm);
            if (res.data.success) {
                showMessage('success', 'Horario creado exitosamente');
                resetScheduleForm();
                await loadSchedules();
            }
        } catch (error: any) {
            console.error('Error creating schedule:', error);
            showMessage('error', error.response?.data?.message || 'Error al crear horario');
        }
    };

    const handleEditSchedule = async () => {
        if (!selectedSchedule || !scheduleForm.name.trim()) {
            showMessage('error', 'El nombre es requerido');
            return;
        }

        try {
            const res = await api.put(`/timer/schedules/${selectedSchedule.id}`, scheduleForm);
            if (res.data.success) {
                showMessage('success', 'Horario actualizado exitosamente');
                resetScheduleForm();
                await loadSchedules();
            }
        } catch (error: any) {
            console.error('Error updating schedule:', error);
            showMessage('error', error.response?.data?.message || 'Error al actualizar horario');
        }
    };

    const handleDeleteSchedule = async (schedule: Schedule) => {
        if (!confirm(`¿Seguro que quieres eliminar el horario "${schedule.name}"?`)) {
            return;
        }

        try {
            const res = await api.delete(`/timer/schedules/${schedule.id}`);
            if (res.data.success) {
                showMessage('success', 'Horario eliminado exitosamente');
                await loadSchedules();
            }
        } catch (error: any) {
            console.error('Error deleting schedule:', error);
            showMessage('error', error.response?.data?.message || 'Error al eliminar horario');
        }
    };

    const handleToggleSchedule = async (schedule: Schedule) => {
        try {
            const res = await api.put(`/timer/schedules/${schedule.id}`, { enabled: !schedule.enabled });
            if (res.data.success) {
                showMessage('success', `Horario ${!schedule.enabled ? 'activado' : 'desactivado'}`);
                await loadSchedules();
            }
        } catch (error: any) {
            console.error('Error toggling schedule:', error);
            showMessage('error', 'Error al cambiar estado del horario');
        }
    };

    const prepareCreateSchedule = () => {
        resetScheduleForm();
        setShowCreateScheduleModal(true);
    };

    const prepareEditSchedule = (schedule: Schedule) => {
        setSelectedSchedule(schedule);
        const daysArray = JSON.parse(schedule.daysOfWeek);
        setScheduleForm({
            name: schedule.name,
            reason: schedule.reason || '',
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            daysOfWeek: daysArray,
            enabled: schedule.enabled
        });
        setIsEditingSchedule(true);
        setShowCreateScheduleModal(true);

        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // ========================================================================
    // HAPPY HOUR HANDLERS
    // ========================================================================

    const resetHappyHourForm = () => {
        setShowCreateHappyHourModal(false);
        setIsEditingHappyHour(false);
        setEditingHappyHour(null);
        setHappyHourForm({
            name: '',
            description: '',
            startTime: '00:00',
            endTime: '23:59',
            multiplier: 2.0,
            daysOfWeek: [true, true, true, true, true, true, true],
            enabled: true
        });
    };

    const handleCreateHappyHour = async () => {
        if (!happyHourForm.name.trim()) {
            showMessage('error', 'El nombre es requerido');
            return;
        }
        if (!timeZone) {
            showMessage('error', 'Configura tu zona horaria en la pestaña General antes de crear un Happy Hour');
            return;
        }
        try {
            const res = await api.post('/timer/happyhour', happyHourForm);
            if (res.data.success) {
                showMessage('success', 'Happy Hour creado exitosamente');
                resetHappyHourForm();
                await loadHappyHours();
            }
        } catch (error: any) {
            showMessage('error', error.response?.data?.message || 'Error al crear Happy Hour');
        }
    };

    const handleEditHappyHour = async () => {
        if (!editingHappyHour || !happyHourForm.name.trim()) {
            showMessage('error', 'El nombre es requerido');
            return;
        }
        try {
            const res = await api.put(`/timer/happyhour/${editingHappyHour.id}`, happyHourForm);
            if (res.data.success) {
                showMessage('success', 'Happy Hour actualizado exitosamente');
                resetHappyHourForm();
                await loadHappyHours();
            }
        } catch (error: any) {
            showMessage('error', error.response?.data?.message || 'Error al actualizar Happy Hour');
        }
    };

    const handleDeleteHappyHour = async (id: number) => {
        if (!confirm('¿Seguro que quieres eliminar este Happy Hour?')) return;
        try {
            const res = await api.delete(`/timer/happyhour/${id}`);
            if (res.data.success) {
                showMessage('success', 'Happy Hour eliminado exitosamente');
                await loadHappyHours();
            }
        } catch (error: any) {
            showMessage('error', error.response?.data?.message || 'Error al eliminar Happy Hour');
        }
    };

    const handleToggleHappyHour = async (id: number, enabled: boolean) => {
        try {
            const res = await api.put(`/timer/happyhour/${id}`, { enabled });
            if (res.data.success) {
                showMessage('success', `Happy Hour ${enabled ? 'activado' : 'desactivado'}`);
                await loadHappyHours();
            }
        } catch (error: any) {
            showMessage('error', 'Error al cambiar estado del Happy Hour');
        }
    };

    const handleResetConfig = async () => {
        if (!confirm('⚠️ ¡PELIGRO! ¿RESTABLECIMIENTO TOTAL DE FÁBRICA?\n\nEsta acción es IRREVERSIBLE y borrará:\n\n❌ Toda tu configuración visual y alertas.\n❌ Todas tus Plantillas guardadas.\n❌ Todos tus Horarios de Auto-Pausa.\n❌ Todos tus horarios de Happy Hour.\n❌ Todo el historial de sesiones y eventos.\n\nEl timer volverá a estar como si fueras un usuario nuevo.\n¿Estás seguro?')) {
            return;
        }

        try {
            const res = await api.post('/timer/config/reset');
            if (res.data.success) {
                showMessage('success', 'Cuenta de Timer reiniciada a fábrica correctamente');
                // Recargar página para obtener defaults
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (error: any) {
            console.error('Error resetting config:', error);
            showMessage('error', 'Error al restaurar configuración');
        }
    };

    const prepareCreateHappyHour = () => {
        resetHappyHourForm();
        setShowCreateHappyHourModal(true);
    };

    const prepareEditHappyHour = (hh: HappyHour) => {
        setEditingHappyHour(hh);
        const daysArray = JSON.parse(hh.daysOfWeek);
        setHappyHourForm({
            name: hh.name,
            description: hh.description || '',
            startTime: hh.startTime,
            endTime: hh.endTime,
            multiplier: hh.multiplier,
            daysOfWeek: daysArray,
            enabled: hh.enabled
        });
        setIsEditingHappyHour(true);
        setShowCreateHappyHourModal(true);

        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="space-y-6">
            {/* Info General */}
            <div className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4">
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                    ℹ️ Configuración avanzada con plantillas predefinidas, auto-pausa programada y multiplicadores de tiempo.
                </p>
            </div>

            {/* Selector de Sección */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">🎯 Configurar Sección Avanzada</h3>

                <div className="grid grid-cols-3 gap-3">
                    {sections.map((section) => (
                        <button
                            key={section.type}
                            onClick={() => setSelectedSection(section.type)}
                            className={`px-4 py-3 rounded-lg text-sm font-bold transition-all border-2 ${
                                selectedSection === section.type
                                    ? 'bg-[#64748b] text-white border-[#64748b] shadow-lg'
                                    : 'bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] border-transparent hover:border-[#94a3b8]'
                            }`}
                        >
                            {section.icon} {section.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Action Message */}
            {actionMessage && (
                <div className={`p-4 rounded-xl border ${
                    actionMessage.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                }`}>
                    {actionMessage.text}
                </div>
            )}

            {/* Contenido según sección seleccionada */}
            {selectedSection === 'general' && (
                <GeneralSection
                    timeZone={timeZone}
                    onTimeZoneChange={onTimeZoneChange}
                    onResetConfig={handleResetConfig}
                />
            )}

            {selectedSection === 'templates' && (
                <TemplatesSection
                    advancedConfig={advancedConfig}
                    onAdvancedConfigChange={onAdvancedConfigChange}
                    customTemplates={customTemplates}
                    loadingTemplates={loadingTemplates}
                    showCreateModal={showCreateModal}
                    setShowCreateModal={setShowCreateModal}
                    showEditModal={showEditModal}
                    setShowEditModal={setShowEditModal}
                    selectedTemplate={selectedTemplate}
                    setSelectedTemplate={setSelectedTemplate}
                    showApplyModal={showApplyModal}
                    setShowApplyModal={setShowApplyModal}
                    applyOptions={applyOptions}
                    setApplyOptions={setApplyOptions}
                    templateForm={templateForm}
                    setTemplateForm={setTemplateForm}
                    onCreateTemplate={handleCreateTemplate}
                    onEditTemplate={handleEditTemplate}
                    onDeleteTemplate={handleDeleteTemplate}
                    onApplyTemplate={handleApplyTemplate}
                    onOpenEditModal={openEditModal}
                    onOpenApplyModal={openApplyModal}
                />
            )}

            {selectedSection === 'autoPause' && (
                <SchedulesSection
                    schedules={schedules}
                    loadingSchedules={loadingSchedules}
                    showCreateScheduleModal={showCreateScheduleModal}
                    isEditingSchedule={isEditingSchedule}
                    scheduleForm={scheduleForm}
                    setScheduleForm={setScheduleForm}
                    timeZone={timeZone}
                    onPrepareCreate={prepareCreateSchedule}
                    onPrepareEdit={prepareEditSchedule}
                    onCreateSchedule={handleCreateSchedule}
                    onEditSchedule={handleEditSchedule}
                    onDeleteSchedule={handleDeleteSchedule}
                    onToggleSchedule={handleToggleSchedule}
                    onResetForm={resetScheduleForm}
                />
            )}

            {selectedSection === 'happyHour' && (
                <HappyHourSection
                    happyHours={happyHours}
                    loadingHappyHours={loadingHappyHours}
                    showCreateHappyHourModal={showCreateHappyHourModal}
                    isEditingHappyHour={isEditingHappyHour}
                    happyHourForm={happyHourForm}
                    setHappyHourForm={setHappyHourForm}
                    timeZone={timeZone}
                    manualMultiplier={manualMultiplier}
                    setManualMultiplier={setManualMultiplier}
                    manualDuration={manualDuration}
                    setManualDuration={setManualDuration}
                    manualActive={manualActive}
                    manualCountdown={manualCountdown}
                    onManualActivate={handleManualActivate}
                    onManualDeactivate={handleManualDeactivate}
                    onPrepareCreate={prepareCreateHappyHour}
                    onPrepareEdit={prepareEditHappyHour}
                    onCreateHappyHour={handleCreateHappyHour}
                    onEditHappyHour={handleEditHappyHour}
                    onDeleteHappyHour={handleDeleteHappyHour}
                    onToggleHappyHour={handleToggleHappyHour}
                    onResetForm={resetHappyHourForm}
                />
            )}
        </div>
    );
};

export default AdvancedTab;
