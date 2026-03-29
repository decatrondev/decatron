/**
 * AdvancedTab - Happy Hour Section
 *
 * Happy hours grid, manual activation, and scheduled editor.
 */

import { Plus, Edit2, Trash2 } from 'lucide-react';

export interface HappyHour {
    id: number;
    name: string;
    description: string | null;
    startTime: string;
    endTime: string;
    multiplier: number;
    daysOfWeek: string; // JSON string
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface HappyHourFormData {
    name: string;
    description: string;
    startTime: string;
    endTime: string;
    multiplier: number;
    daysOfWeek: boolean[];
    enabled: boolean;
}

interface HappyHourSectionProps {
    happyHours: HappyHour[];
    loadingHappyHours: boolean;
    showCreateHappyHourModal: boolean;
    isEditingHappyHour: boolean;
    happyHourForm: HappyHourFormData;
    setHappyHourForm: (form: HappyHourFormData) => void;
    timeZone?: string;

    // Manual Happy Hour
    manualMultiplier: number;
    setManualMultiplier: (v: number) => void;
    manualDuration: number;
    setManualDuration: (v: number) => void;
    manualActive: boolean;
    manualCountdown: string;
    onManualActivate: () => void;
    onManualDeactivate: () => void;

    // Handlers
    onPrepareCreate: () => void;
    onPrepareEdit: (hh: HappyHour) => void;
    onCreateHappyHour: () => void;
    onEditHappyHour: () => void;
    onDeleteHappyHour: (id: number) => void;
    onToggleHappyHour: (id: number, enabled: boolean) => void;
    onResetForm: () => void;
}

const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const HappyHourSection: React.FC<HappyHourSectionProps> = ({
    happyHours,
    loadingHappyHours,
    showCreateHappyHourModal,
    isEditingHappyHour,
    happyHourForm,
    setHappyHourForm,
    timeZone,
    manualMultiplier,
    setManualMultiplier,
    manualDuration,
    setManualDuration,
    manualActive,
    manualCountdown,
    onManualActivate,
    onManualDeactivate,
    onPrepareCreate,
    onPrepareEdit,
    onCreateHappyHour,
    onEditHappyHour,
    onDeleteHappyHour,
    onToggleHappyHour,
    onResetForm
}) => {
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">🎉 Happy Hour - Multiplicador</h3>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                            Multiplica el tiempo agregado automáticamente en horarios específicos (ej: x2 en fin de semana).
                        </p>
                    </div>
                    {!showCreateHappyHourModal && (
                        <button
                            onClick={onPrepareCreate}
                            className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 font-bold transform hover:-translate-y-0.5"
                        >
                            <Plus className="w-5 h-5" />
                            Nuevo Happy Hour
                        </button>
                    )}
                </div>

                {/* Manual Happy Hour Activation */}
                <div className="mb-6 p-5 rounded-xl border-2 border-dashed border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/10">
                    <h4 className="text-base font-bold text-[#1e293b] dark:text-[#f8fafc] mb-3 flex items-center gap-2">
                        Activar Happy Hour Manual
                    </h4>
                    {manualActive ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-bold border border-green-200 dark:border-green-800 animate-pulse">
                                    ACTIVO - {manualCountdown}
                                </span>
                            </div>
                            <button
                                onClick={onManualDeactivate}
                                className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold text-sm transition-colors"
                            >
                                Desactivar
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-end gap-4">
                            <div>
                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-1">Multiplicador</label>
                                <input type="number" min={1} max={10} step={0.5} value={manualMultiplier} onChange={(e) => setManualMultiplier(parseFloat(e.target.value) || 2)} className="w-24 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-1">Minutos</label>
                                <input type="number" min={1} max={1440} value={manualDuration} onChange={(e) => setManualDuration(parseInt(e.target.value) || 60)} className="w-24 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm" />
                            </div>
                            <button
                                onClick={onManualActivate}
                                className="px-5 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-lg font-bold text-sm shadow-md transition-all"
                            >
                                Activar Happy Hour Manual
                            </button>
                        </div>
                    )}
                </div>

                {/* Inline Create/Edit Form */}
                {showCreateHappyHourModal && (
                    <div className="mb-8 bg-[#f8fafc] dark:bg-[#262626] rounded-2xl border-2 border-purple-500/30 p-6 animate-fade-in-down">
                        <div className="flex justify-between items-start mb-6">
                            <h4 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                {isEditingHappyHour ? '✏️ Editar Happy Hour' : '🎉 Configurar Nuevo Happy Hour'}
                            </h4>
                            <button
                                onClick={onResetForm}
                                className="text-[#64748b] hover:text-red-500 transition-colors text-sm font-bold"
                            >
                                Cancelar
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-5">
                                {/* Inputs Básicos */}
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-2 block">Nombre *</label>
                                    <input
                                        type="text"
                                        value={happyHourForm.name}
                                        onChange={(e) => setHappyHourForm({ ...happyHourForm, name: e.target.value })}
                                        placeholder="Ej: Fin de Semana Salvaje"
                                        className="w-full px-4 py-3 border border-[#e2e8f0] dark:border-[#374151] rounded-xl bg-white dark:bg-[#1a1a1a] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-2 block">Multiplicador: <span className="text-purple-500 text-lg">{happyHourForm.multiplier}x</span></label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        step="0.5"
                                        value={happyHourForm.multiplier}
                                        onChange={(e) => setHappyHourForm({ ...happyHourForm, multiplier: Number(e.target.value) })}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-purple-500"
                                    />
                                    <p className="text-xs text-[#64748b] mt-1">El tiempo añadido se multiplicará por este valor.</p>
                                </div>

                                {/* Horas */}
                                <div className="p-4 bg-white dark:bg-[#1a1a1a] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-4 block text-center">Rango de Horas</label>
                                    <div className="flex items-center justify-center gap-4">
                                        <div className="text-center">
                                            <input
                                                type="time"
                                                value={happyHourForm.startTime}
                                                onChange={(e) => setHappyHourForm({ ...happyHourForm, startTime: e.target.value })}
                                                className="text-2xl font-mono font-bold bg-transparent border-b-2 border-purple-500 text-[#1e293b] dark:text-[#f8fafc] focus:outline-none text-center w-32"
                                            />
                                            <p className="text-xs text-[#64748b] mt-1">Inicio</p>
                                        </div>
                                        <span className="text-[#64748b] font-bold">➜</span>
                                        <div className="text-center">
                                            <input
                                                type="time"
                                                value={happyHourForm.endTime}
                                                onChange={(e) => setHappyHourForm({ ...happyHourForm, endTime: e.target.value })}
                                                className="text-2xl font-mono font-bold bg-transparent border-b-2 border-pink-500 text-[#1e293b] dark:text-[#f8fafc] focus:outline-none text-center w-32"
                                            />
                                            <p className="text-xs text-[#64748b] mt-1">Fin</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Días */}
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-3 block">Días Activos</label>
                                    <div className="flex justify-between gap-2">
                                        {dayLabels.map((day, index) => (
                                            <button
                                                key={index}
                                                onClick={() => {
                                                    const newDays = [...happyHourForm.daysOfWeek];
                                                    newDays[index] = !newDays[index];
                                                    setHappyHourForm({ ...happyHourForm, daysOfWeek: newDays });
                                                }}
                                                className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${
                                                    happyHourForm.daysOfWeek[index]
                                                        ? 'bg-purple-500 text-white shadow-lg transform -translate-y-1'
                                                        : 'bg-white dark:bg-[#1a1a1a] text-gray-400 border border-[#e2e8f0] dark:border-[#374151] hover:border-purple-300'
                                                }`}
                                            >
                                                {day.charAt(0)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Preview & Info */}
                            <div className="flex flex-col h-full">
                                <div className="flex-1 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 rounded-xl p-6 border border-purple-100 dark:border-purple-800/30 flex flex-col justify-center items-center text-center">
                                    <span className="text-4xl mb-3">🚀</span>
                                    <h5 className="text-sm font-bold text-purple-800 dark:text-purple-300 mb-2">Resumen de Happy Hour</h5>

                                    {(() => {
                                        const targetTimeZone = timeZone || 'UTC';
                                        const now = new Date();
                                        const options: Intl.DateTimeFormatOptions = { timeZone: targetTimeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false };
                                        const localDateString = new Intl.DateTimeFormat('en-US', options).format(now);
                                        const nowInTz = new Date(localDateString);

                                        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                                        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

                                        const [startH, startM] = happyHourForm.startTime.split(':').map(Number);
                                        const [endH, endM] = happyHourForm.endTime.split(':').map(Number);

                                        let foundDate: Date | null = null;
                                        let status = "future";

                                        for (let i = 0; i < 7; i++) {
                                            const candidate = new Date(nowInTz);
                                            candidate.setDate(candidate.getDate() + i);
                                            candidate.setHours(startH, startM, 0, 0);

                                            // Calculate End Time
                                            const endCandidate = new Date(candidate);
                                            endCandidate.setHours(endH, endM, 59, 999);
                                            if (endCandidate <= candidate) endCandidate.setDate(endCandidate.getDate() + 1);

                                            const dayIndex = candidate.getDay();

                                            if (happyHourForm.daysOfWeek[dayIndex]) {
                                                if (i === 0) {
                                                    // Si es hoy y NO ha terminado, es válido
                                                    if (nowInTz < endCandidate) {
                                                        foundDate = candidate;
                                                        // Si ya empezó, está activo
                                                        if (nowInTz >= candidate) status = "active";
                                                        break;
                                                    }
                                                } else {
                                                    foundDate = candidate;
                                                    break;
                                                }
                                            }
                                        }

                                        if (!foundDate) return <p className="text-sm text-gray-500">Selecciona al menos un día futuro.</p>;

                                        return (
                                            <div className="space-y-2">
                                                <p className="text-lg leading-relaxed text-[#1e293b] dark:text-[#f8fafc]">
                                                    El tiempo se multiplicará por <span className="font-black text-2xl text-purple-600 dark:text-purple-400">{happyHourForm.multiplier}x</span>
                                                </p>
                                                <div className={`py-3 px-4 rounded-lg border shadow-sm mt-4 ${status === 'active' ? 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800' : 'bg-white dark:bg-[#1a1a1a] border-purple-200 dark:border-purple-800'}`}>
                                                    <p className="text-xs uppercase font-bold text-gray-500 mb-1">
                                                        {status === 'active' ? '🚀 ACTIVO AHORA' : `Próximo inicio (Hora ${targetTimeZone}):`}
                                                    </p>
                                                    <p className="text-base font-black text-[#1e293b] dark:text-[#f8fafc]">
                                                        {days[foundDate.getDay()]}, {foundDate.getDate()} de {months[foundDate.getMonth()]}
                                                    </p>
                                                    <p className="text-xl font-mono text-purple-600 dark:text-purple-400">
                                                        a las {happyHourForm.startTime} hs
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                <button
                                    onClick={isEditingHappyHour ? onEditHappyHour : onCreateHappyHour}
                                    className="mt-6 w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-bold shadow-lg hover:shadow-purple-500/25 transition-all transform active:scale-95"
                                >
                                    {isEditingHappyHour ? 'Guardar Cambios' : 'Activar Happy Hour'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {loadingHappyHours ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">Cargando Happy Hours...</p>
                    </div>
                ) : happyHours.length === 0 ? (
                    !showCreateHappyHourModal && (
                        <div className="text-center py-12 bg-gray-50 dark:bg-[#262626] rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                            <span className="text-4xl block mb-3">🎉</span>
                            <p className="text-[#64748b] dark:text-[#94a3b8] font-medium mb-4">
                                No hay Happy Hours configurados
                            </p>
                            <button
                                onClick={onPrepareCreate}
                                className="text-purple-500 hover:text-purple-600 font-bold text-sm"
                            >
                                + Crear el primer Happy Hour
                            </button>
                        </div>
                    )
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {happyHours.map((hh) => {
                            let daysArray: boolean[] = [];
                            try {
                                daysArray = typeof hh.daysOfWeek === 'string' ? JSON.parse(hh.daysOfWeek) : hh.daysOfWeek;
                            } catch (e) { daysArray = []; }

                            // Fix 3: Detect if this Happy Hour is active now
                            let isActiveNow = false;
                            if (hh.enabled && daysArray.length >= 7) {
                                try {
                                    const targetTz = timeZone || 'UTC';
                                    const nowStr = new Intl.DateTimeFormat('en-US', { timeZone: targetTz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false }).format(new Date());
                                    const nowInTz = new Date(nowStr);
                                    const currentDay = nowInTz.getDay();
                                    if (daysArray[currentDay]) {
                                        const [sH, sM] = hh.startTime.split(':').map(Number);
                                        const [eH, eM] = hh.endTime.split(':').map(Number);
                                        const currentMins = nowInTz.getHours() * 60 + nowInTz.getMinutes();
                                        const startMins = sH * 60 + sM;
                                        const endMins = eH * 60 + eM;
                                        if (endMins >= startMins) {
                                            isActiveNow = currentMins >= startMins && currentMins <= endMins;
                                        } else {
                                            isActiveNow = currentMins >= startMins || currentMins <= endMins;
                                        }
                                    }
                                } catch { /* ignore timezone errors */ }
                            }

                            return (
                                <div key={hh.id} className={`p-5 rounded-xl border-2 transition-all group ${isActiveNow ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/10' : hh.enabled ? 'border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#262626] hover:border-purple-400 dark:hover:border-purple-600' : 'border-transparent bg-gray-100 dark:bg-[#1a1a1a] opacity-70'}`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-lg flex items-center gap-2">
                                                {hh.name}
                                                {isActiveNow && <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">ACTIVO AHORA</span>}
                                                {!hh.enabled && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">Inactivo</span>}
                                            </h4>
                                            <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg text-xs font-bold border border-purple-200 dark:border-purple-800">
                                                Multiplicador: {hh.multiplier}x
                                            </span>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => onPrepareEdit(hh)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-purple-500 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => onDeleteHappyHour(hh.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-lg font-mono text-sm font-bold border border-purple-100 dark:border-purple-800">
                                            {hh.startTime} - {hh.endTime}
                                        </div>
                                        <div className="text-xs text-[#64748b] dark:text-[#94a3b8] font-medium">
                                            📅 {daysArray.map((active: boolean, i: number) => active ? dayLabels[i].charAt(0) : null).filter(Boolean).join(', ')}
                                        </div>
                                    </div>
                                    <button onClick={() => onToggleHappyHour(hh.id, !hh.enabled)} className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${hh.enabled ? 'bg-gray-100 dark:bg-[#333] text-[#64748b] dark:text-[#94a3b8] hover:bg-red-50 hover:text-red-500' : 'bg-green-500 text-white hover:bg-green-600 shadow-md'}`}>{hh.enabled ? 'Desactivar' : 'Activar'}</button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
