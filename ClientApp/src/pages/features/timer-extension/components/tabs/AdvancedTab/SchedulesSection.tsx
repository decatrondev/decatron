/**
 * AdvancedTab - Schedules Section
 *
 * Auto-pause schedules list + inline create/edit form.
 */

import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2 } from 'lucide-react';

export interface Schedule {
    id: number;
    name: string;
    reason: string | null;
    startTime: string;
    endTime: string;
    daysOfWeek: string; // JSON string
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ScheduleFormData {
    name: string;
    reason: string;
    startTime: string;
    endTime: string;
    daysOfWeek: boolean[];
    enabled: boolean;
}

interface SchedulesSectionProps {
    schedules: Schedule[];
    loadingSchedules: boolean;
    showCreateScheduleModal: boolean;
    isEditingSchedule: boolean;
    scheduleForm: ScheduleFormData;
    setScheduleForm: (form: ScheduleFormData) => void;
    timeZone?: string;

    // Handlers
    onPrepareCreate: () => void;
    onPrepareEdit: (schedule: Schedule) => void;
    onCreateSchedule: () => void;
    onEditSchedule: () => void;
    onDeleteSchedule: (schedule: Schedule) => void;
    onToggleSchedule: (schedule: Schedule) => void;
    onResetForm: () => void;
}

const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const SchedulesSection: React.FC<SchedulesSectionProps> = ({
    schedules,
    loadingSchedules,
    showCreateScheduleModal,
    isEditingSchedule,
    scheduleForm,
    setScheduleForm,
    timeZone,
    onPrepareCreate,
    onPrepareEdit,
    onCreateSchedule,
    onEditSchedule,
    onDeleteSchedule,
    onToggleSchedule,
    onResetForm
}) => {
    const { t } = useTranslation('features');
    return (
        <div className="space-y-6">
            {/* Gestión de Horarios Auto-Pausa */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">{t('timerAdvanced.autoPauseSchedules')}</h3>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                            {t('timerAdvanced.autoPauseDescription')}
                        </p>
                    </div>
                    {!showCreateScheduleModal && (
                        <button
                            onClick={onPrepareCreate}
                            className="px-6 py-2.5 bg-gradient-to-r from-[#64748b] to-[#475569] hover:from-[#475569] hover:to-[#334155] text-white rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 font-bold transform hover:-translate-y-0.5"
                        >
                            <Plus className="w-5 h-5" />
                            {t('timerAdvanced.newSchedule')}
                        </button>
                    )}
                </div>

                {/* Inline Create/Edit Form */}
                {showCreateScheduleModal && (
                    <div className="mb-8 bg-[#f8fafc] dark:bg-[#262626] rounded-2xl border-2 border-blue-500/30 p-6 animate-fade-in-down">
                        <div className="flex justify-between items-start mb-6">
                            <h4 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                {isEditingSchedule ? t('timerAdvanced.editSchedule') : t('timerAdvanced.configureNewSchedule')}
                            </h4>
                            <button
                                onClick={onResetForm}
                                className="text-[#64748b] hover:text-red-500 transition-colors text-sm font-bold"
                            >
                                {t('timerAdvanced.cancel')}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-5">
                                {/* Inputs Básicos */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-2 block">{t('timerAdvanced.name')}</label>
                                        <input
                                            type="text"
                                            value={scheduleForm.name}
                                            onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                                            placeholder="Ej: Hora de Dormir"
                                            className="w-full px-4 py-3 border border-[#e2e8f0] dark:border-[#374151] rounded-xl bg-white dark:bg-[#1a1a1a] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-2 block">{t('timerAdvanced.reasonOptional')}</label>
                                        <input
                                            type="text"
                                            value={scheduleForm.reason}
                                            onChange={(e) => setScheduleForm({ ...scheduleForm, reason: e.target.value })}
                                            placeholder="Ej: Descanso"
                                            className="w-full px-4 py-3 border border-[#e2e8f0] dark:border-[#374151] rounded-xl bg-white dark:bg-[#1a1a1a] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Horas */}
                                <div className="p-4 bg-white dark:bg-[#1a1a1a] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-4 block text-center">{t('timerAdvanced.timeRange')}</label>
                                    <div className="flex items-center justify-center gap-4">
                                        <div className="text-center">
                                            <input
                                                type="time"
                                                value={scheduleForm.startTime}
                                                onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                                                className="text-2xl font-mono font-bold bg-transparent border-b-2 border-blue-500 text-[#1e293b] dark:text-[#f8fafc] focus:outline-none text-center w-32"
                                            />
                                            <p className="text-xs text-[#64748b] mt-1">{t('timerAdvanced.start')}</p>
                                        </div>
                                        <span className="text-[#64748b] font-bold">➜</span>
                                        <div className="text-center">
                                            <input
                                                type="time"
                                                value={scheduleForm.endTime}
                                                onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                                                className="text-2xl font-mono font-bold bg-transparent border-b-2 border-pink-500 text-[#1e293b] dark:text-[#f8fafc] focus:outline-none text-center w-32"
                                            />
                                            <p className="text-xs text-[#64748b] mt-1">{t('timerAdvanced.end')}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Días */}
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-3 block">{t('timerAdvanced.activeDays')}</label>
                                    <div className="flex justify-between gap-2">
                                        {dayLabels.map((day, index) => (
                                            <button
                                                key={index}
                                                onClick={() => {
                                                    const newDays = [...scheduleForm.daysOfWeek];
                                                    newDays[index] = !newDays[index];
                                                    setScheduleForm({ ...scheduleForm, daysOfWeek: newDays });
                                                }}
                                                className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${
                                                    scheduleForm.daysOfWeek[index]
                                                        ? 'bg-blue-500 text-white shadow-lg transform -translate-y-1'
                                                        : 'bg-white dark:bg-[#1a1a1a] text-gray-400 border border-[#e2e8f0] dark:border-[#374151] hover:border-blue-300'
                                                }`}
                                            >
                                                {day.charAt(0)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Preview & Info - CON FIX DE TIMEZONE */}
                            <div className="flex flex-col h-full">
                                <div className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl p-6 border border-blue-100 dark:border-blue-800/30 flex flex-col justify-center items-center text-center">
                                    <span className="text-4xl mb-3">📅</span>
                                    <h5 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">{t('timerAdvanced.scheduleSummary')}</h5>

                                    {(() => {
                                        // LOGICA DE TIEMPO REAL CON TIMEZONE FIX
                                        const targetTimeZone = timeZone || 'UTC';

                                        const now = new Date();
                                        const options: Intl.DateTimeFormatOptions = {
                                            timeZone: targetTimeZone,
                                            year: 'numeric', month: 'numeric', day: 'numeric',
                                            hour: 'numeric', minute: 'numeric', second: 'numeric',
                                            hour12: false
                                        };
                                        const localDateString = new Intl.DateTimeFormat('en-US', options).format(now);
                                        const nowInTz = new Date(localDateString);

                                        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                                        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

                                        const [startH, startM] = scheduleForm.startTime.split(':').map(Number);
                                        const [endH, endM] = scheduleForm.endTime.split(':').map(Number);

                                        let foundDate: Date | null = null;
                                        let status = "future"; // future, active

                                        for (let i = 0; i < 7; i++) {
                                            const candidate = new Date(nowInTz);
                                            candidate.setDate(candidate.getDate() + i);
                                            candidate.setHours(startH, startM, 0, 0);

                                            // Calculate End Time relative to this candidate
                                            const endCandidate = new Date(candidate);
                                            endCandidate.setHours(endH, endM, 59, 999);
                                            if (endCandidate <= candidate) endCandidate.setDate(endCandidate.getDate() + 1);

                                            const dayIndex = candidate.getDay();

                                            if (scheduleForm.daysOfWeek[dayIndex]) {
                                                if (i === 0) {
                                                    // Si es hoy, verificamos si AÚN no ha terminado
                                                    if (nowInTz < endCandidate) {
                                                        foundDate = candidate;
                                                        // Si ya empezó pero no ha terminado
                                                        if (nowInTz >= candidate) {
                                                            status = "active";
                                                        }
                                                        break;
                                                    }
                                                } else {
                                                    // Días futuros siempre son válidos
                                                    foundDate = candidate;
                                                    break;
                                                }
                                            }
                                        }

                                        if (!foundDate) return <p className="text-sm text-gray-500">Selecciona al menos un día futuro.</p>;

                                        return (
                                            <div className="space-y-2">
                                                <p className="text-lg leading-relaxed text-[#1e293b] dark:text-[#f8fafc]">
                                                    El timer se pausará cada <span className="font-bold text-blue-600 dark:text-blue-400">
                                                        {scheduleForm.daysOfWeek.map((d, i) => d ? days[i] : null).filter(Boolean).join(', ')}
                                                    </span>
                                                </p>
                                                <div className={`py-3 px-4 rounded-lg border shadow-sm mt-4 ${status === 'active' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-white dark:bg-[#1a1a1a] border-blue-200 dark:border-blue-800'}`}>
                                                    <p className="text-xs uppercase font-bold text-gray-500 mb-1">
                                                        {status === 'active' ? '🟢 EN CURSO AHORA' : `Próxima activación (Hora ${targetTimeZone}):`}
                                                    </p>
                                                    <p className="text-base font-black text-[#1e293b] dark:text-[#f8fafc]">
                                                        {days[foundDate.getDay()]}, {foundDate.getDate()} de {months[foundDate.getMonth()]}
                                                    </p>
                                                    <p className="text-xl font-mono text-blue-600 dark:text-blue-400">
                                                        a las {scheduleForm.startTime} hs
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                <button
                                    onClick={isEditingSchedule ? onEditSchedule : onCreateSchedule}
                                    className="mt-6 w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg hover:shadow-blue-500/25 transition-all transform active:scale-95"
                                >
                                    {isEditingSchedule ? t('timerAdvanced.saveChanges') : t('timerAdvanced.confirmAndSave')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {loadingSchedules ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">{t('timerAdvanced.loadingSchedules')}</p>
                    </div>
                ) : schedules.length === 0 ? (
                    // Empty State
                    !showCreateScheduleModal && (
                        <div className="text-center py-12 bg-gray-50 dark:bg-[#262626] rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                            <span className="text-4xl block mb-3">😴</span>
                            <p className="text-[#64748b] dark:text-[#94a3b8] font-medium mb-4">
                                {t('timerAdvanced.noSchedules')}
                            </p>
                            <button
                                onClick={onPrepareCreate}
                                className="text-blue-500 hover:text-blue-600 font-bold text-sm"
                            >
                                {t('timerAdvanced.createFirstSchedule')}
                            </button>
                        </div>
                    )
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {schedules.map((schedule) => {
                            let daysArray: boolean[] = [];
                            try {
                                daysArray = typeof schedule.daysOfWeek === 'string' ? JSON.parse(schedule.daysOfWeek) : schedule.daysOfWeek;
                            } catch (e) { daysArray = []; }

                            const activeDays = dayLabels.filter((_, i) => daysArray[i]).join(', ');

                            return (
                                <div
                                    key={schedule.id}
                                    className={`p-5 rounded-xl border-2 transition-all group ${
                                        schedule.enabled
                                            ? 'border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#262626] hover:border-blue-400 dark:hover:border-blue-600'
                                            : 'border-transparent bg-gray-100 dark:bg-[#1a1a1a] opacity-70'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-lg flex items-center gap-2">
                                                {schedule.name}
                                                {!schedule.enabled && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">{t('timerAdvanced.inactive')}</span>}
                                            </h4>
                                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{schedule.reason || t('timerAdvanced.noDescription')}</p>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => onPrepareEdit(schedule)}
                                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-blue-500 transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => onDeleteSchedule(schedule)}
                                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-lg font-mono text-sm font-bold border border-blue-100 dark:border-blue-800">
                                            {schedule.startTime} - {schedule.endTime}
                                        </div>
                                        <div className="text-xs text-[#64748b] dark:text-[#94a3b8] font-medium">
                                            📅 {activeDays}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => onToggleSchedule(schedule)}
                                        className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${
                                            schedule.enabled
                                                ? 'bg-gray-100 dark:bg-[#333] text-[#64748b] dark:text-[#94a3b8] hover:bg-red-50 hover:text-red-500'
                                                : 'bg-green-500 text-white hover:bg-green-600 shadow-md'
                                        }`}
                                    >
                                        {schedule.enabled ? t('timerAdvanced.disableSchedule') : t('timerAdvanced.enableSchedule')}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
