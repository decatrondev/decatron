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
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-black text-ds-text">{t('timerAdvanced.autoPauseSchedules')}</h3>
                        <p className="text-sm text-ds-soft mt-1">
                            {t('timerAdvanced.autoPauseDescription')}
                        </p>
                    </div>
                    {!showCreateScheduleModal && (
                        <button
                            onClick={onPrepareCreate}
                            className="ds-btn ds-btn--primary"
                        >
                            <Plus className="w-5 h-5" />
                            {t('timerAdvanced.newSchedule')}
                        </button>
                    )}
                </div>

                {/* Inline Create/Edit Form */}
                {showCreateScheduleModal && (
                    <div className="mb-8 bg-ds-bg rounded-lg border-2 border-ds-accent/30 p-6 animate-fade-in-down">
                        <div className="flex justify-between items-start mb-6">
                            <h4 className="text-lg font-bold text-ds-text flex items-center gap-2">
                                {isEditingSchedule ? t('timerAdvanced.editSchedule') : t('timerAdvanced.configureNewSchedule')}
                            </h4>
                            <button
                                onClick={onResetForm}
                                className="text-ds-soft hover:text-ds-danger transition-colors text-sm font-bold"
                            >
                                {t('timerAdvanced.cancel')}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-5">
                                {/* Inputs Básicos */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-ds-soft uppercase tracking-wider mb-2 block">{t('timerAdvanced.name')}</label>
                                        <input
                                            type="text"
                                            value={scheduleForm.name}
                                            onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                                            placeholder="Ej: Hora de Dormir"
                                            className="ds-input w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-ds-soft uppercase tracking-wider mb-2 block">{t('timerAdvanced.reasonOptional')}</label>
                                        <input
                                            type="text"
                                            value={scheduleForm.reason}
                                            onChange={(e) => setScheduleForm({ ...scheduleForm, reason: e.target.value })}
                                            placeholder="Ej: Descanso"
                                            className="ds-input w-full"
                                        />
                                    </div>
                                </div>

                                {/* Horas */}
                                <div className="p-4 bg-ds-surface rounded-lg border border-ds-border">
                                    <label className="text-xs font-bold text-ds-soft uppercase tracking-wider mb-4 block text-center">{t('timerAdvanced.timeRange')}</label>
                                    <div className="flex items-center justify-center gap-4">
                                        <div className="text-center">
                                            <input
                                                type="time"
                                                value={scheduleForm.startTime}
                                                onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                                                className="text-2xl font-mono font-bold bg-transparent border-b-2 border-ds-accent text-ds-text focus:outline-none text-center w-32"
                                            />
                                            <p className="text-xs text-ds-soft mt-1">{t('timerAdvanced.start')}</p>
                                        </div>
                                        <span className="text-ds-soft font-bold">➜</span>
                                        <div className="text-center">
                                            <input
                                                type="time"
                                                value={scheduleForm.endTime}
                                                onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                                                className="text-2xl font-mono font-bold bg-transparent border-b-2 border-ds-accent text-ds-text focus:outline-none text-center w-32"
                                            />
                                            <p className="text-xs text-ds-soft mt-1">{t('timerAdvanced.end')}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Días */}
                                <div>
                                    <label className="text-xs font-bold text-ds-soft uppercase tracking-wider mb-3 block">{t('timerAdvanced.activeDays')}</label>
                                    <div className="flex justify-between gap-2">
                                        {dayLabels.map((day, index) => (
                                            <button
                                                key={index}
                                                onClick={() => {
                                                    const newDays = [...scheduleForm.daysOfWeek];
                                                    newDays[index] = !newDays[index];
                                                    setScheduleForm({ ...scheduleForm, daysOfWeek: newDays });
                                                }}
                                                className={`flex-1 py-3 rounded-lg text-xs font-black transition-all ${
                                                    scheduleForm.daysOfWeek[index]
                                                        ? 'bg-ds-accent text-ds-on-accent transform -translate-y-1'
                                                        : 'bg-ds-surface text-ds-soft border border-ds-border hover:border-ds-accent'
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
                                <div className="flex-1 bg-ds-accent/10 rounded-lg p-6 border border-ds-accent flex flex-col justify-center items-center text-center">
                                    <span className="text-4xl mb-3">📅</span>
                                    <h5 className="text-sm font-bold text-ds-accent-text mb-2">{t('timerAdvanced.scheduleSummary')}</h5>

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

                                        if (!foundDate) return <p className="text-sm text-ds-soft">Selecciona al menos un día futuro.</p>;

                                        return (
                                            <div className="space-y-2">
                                                <p className="text-lg leading-relaxed text-ds-text">
                                                    El timer se pausará cada <span className="font-bold text-ds-accent-text">
                                                        {scheduleForm.daysOfWeek.map((d, i) => d ? days[i] : null).filter(Boolean).join(', ')}
                                                    </span>
                                                </p>
                                                <div className={`py-3 px-4 rounded-lg border mt-4 ${status === 'active' ? 'bg-ds-ok/10 border-ds-ok/40 ' : 'bg-ds-surface border-ds-accent '}`}>
                                                    <p className="text-xs uppercase font-bold text-ds-soft mb-1">
                                                        {status === 'active' ? '🟢 EN CURSO AHORA' : `Próxima activación (Hora ${targetTimeZone}):`}
                                                    </p>
                                                    <p className="text-base font-black text-ds-text">
                                                        {days[foundDate.getDay()]}, {foundDate.getDate()} de {months[foundDate.getMonth()]}
                                                    </p>
                                                    <p className="text-xl font-mono text-ds-accent-text">
                                                        a las {scheduleForm.startTime} hs
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                <button
                                    onClick={isEditingSchedule ? onEditSchedule : onCreateSchedule}
                                    className="ds-btn ds-btn--primary ds-btn--lg mt-6 w-full"
                                >
                                    {isEditingSchedule ? t('timerAdvanced.saveChanges') : t('timerAdvanced.confirmAndSave')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {loadingSchedules ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ds-accent mx-auto mb-4"></div>
                        <p className="text-ds-soft">{t('timerAdvanced.loadingSchedules')}</p>
                    </div>
                ) : schedules.length === 0 ? (
                    // Empty State
                    !showCreateScheduleModal && (
                        <div className="text-center py-12 bg-ds-surface rounded-lg border border-dashed border-ds-border">
                            <span className="text-4xl block mb-3">😴</span>
                            <p className="text-ds-soft font-medium mb-4">
                                {t('timerAdvanced.noSchedules')}
                            </p>
                            <button
                                onClick={onPrepareCreate}
                                className="text-ds-accent-text hover:text-ds-accent-text font-bold text-sm"
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
                                    className={`p-5 rounded-lg border-2 transition-all group ${
                                        schedule.enabled
                                            ? 'border-ds-border bg-ds-surface hover:border-ds-accent '
                                            : 'border-transparent bg-ds-bg opacity-70'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-bold text-ds-text text-lg flex items-center gap-2">
                                                {schedule.name}
                                                {!schedule.enabled && <span className="text-xs bg-ds-raised text-ds-soft px-2 py-0.5 rounded">{t('timerAdvanced.inactive')}</span>}
                                            </h4>
                                            <p className="text-sm text-ds-soft">{schedule.reason || t('timerAdvanced.noDescription')}</p>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => onPrepareEdit(schedule)}
                                                className="p-2 hover:bg-ds-bg rounded-lg text-ds-accent-text transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => onDeleteSchedule(schedule)}
                                                className="p-2 hover:bg-ds-danger/10 rounded-lg text-ds-danger transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="bg-ds-accent/10 text-ds-accent-text px-3 py-1 rounded-lg font-mono text-sm font-bold border border-ds-accent">
                                            {schedule.startTime} - {schedule.endTime}
                                        </div>
                                        <div className="text-xs text-ds-soft font-medium">
                                            📅 {activeDays}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => onToggleSchedule(schedule)}
                                        className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${
                                            schedule.enabled
                                                ? 'bg-ds-bg text-ds-soft hover:bg-ds-danger/10 hover:text-ds-danger'
                                                : 'bg-ds-accent text-ds-on-accent hover:bg-ds-accent-hover '
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
