/**
 * Timer Extension - HistoryTab Component
 *
 * Historial de eventos, analytics y configuración de logs.
 */

import { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, RefreshCw, RotateCcw } from 'lucide-react';
import api from '../../../../../services/api';
import type { HistoryConfig, EventLogEntry } from '../../types';
import { formatTimeProfessional } from '../../utils';

interface HistoryTabProps {
    historyConfig: HistoryConfig;
    onHistoryConfigChange: (updates: Partial<HistoryConfig>) => void;
}

interface TimerSession {
    id: number;
    startedAt: string;
    endedAt: string | null;
    initialDuration: number;
    totalAddedTime: number;
    isActive: boolean;
    // Campos enriquecidos del backend
    hasBackup: boolean;
    backupRemainingSeconds: number | null;
    backupCreatedAt: string | null;
    backupReason: string | null;
}

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#94a3b8] dark:peer-focus:ring-[#64748b] rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#64748b]"></div>
    </label>
);

export const HistoryTab: React.FC<HistoryTabProps> = ({
    historyConfig,
    onHistoryConfigChange
}) => {
    // Estado para sesiones y logs
    const [sessions, setSessions] = useState<TimerSession[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
    const [sessionLogs, setSessionLogs] = useState<EventLogEntry[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    // Estado para restore
    const [isRestoring, setIsRestoring] = useState(false);
    const [manualRestoreInput, setManualRestoreInput] = useState('');

    // Cargar lista de sesiones al montar
    useEffect(() => {
        loadSessions();
    }, []);

    // Cargar logs cuando cambia la sesión o el límite
    useEffect(() => {
        if (selectedSessionId) {
            loadSessionLogs(selectedSessionId);
        }
    }, [selectedSessionId, historyConfig.maxEntries]);

    const loadSessions = async () => {
        try {
            const res = await api.get('/timer/sessions');
            if (res.data.success && res.data.sessions) {
                const loaded: TimerSession[] = res.data.sessions;
                setSessions(loaded);
                // Prioridad: 1) Mantener selección válida, 2) Sesión activa, 3) Primera sesión
                setSelectedSessionId(prev => {
                    if (prev && loaded.some(s => s.id === prev)) return prev;
                    const activeSession = loaded.find(s => s.isActive);
                    if (activeSession) return activeSession.id;
                    return loaded.length > 0 ? loaded[0].id : null;
                });
            }
        } catch (error) {
            console.error('Error loading sessions:', error);
        }
    };

    const formatBackupReason = (reason: string): string => {
        const map: Record<string, string> = {
            'manual_stop': 'Parada manual (!dstop)',
            'auto_save': 'Auto-guardado',
            'manual_user_backup': 'Respaldo manual',
            'emergency_stop': 'Parada de emergencia',
            'manual': 'Manual',
        };
        return map[reason] || reason.replace(/_/g, ' ');
    };

    const parseTimeInput = (input: string): number => {
        let total = 0;
        const regex = /(\d+)\s*([dhms])/gi;
        let match;
        while ((match = regex.exec(input)) !== null) {
            const v = parseInt(match[1]);
            const u = match[2].toLowerCase();
            if (u === 'd') total += v * 86400;
            if (u === 'h') total += v * 3600;
            if (u === 'm') total += v * 60;
            if (u === 's') total += v;
        }
        if (total === 0 && /^\d+$/.test(input.trim())) total = parseInt(input.trim()) * 3600;
        return total;
    };

    const handleRestoreSession = async (sessionId: number, hasBackup: boolean) => {
        if (hasBackup) {
            if (!confirm('¿Restaurar esta sesión? El timer se pondrá en PAUSA con el tiempo guardado.')) return;
            try {
                setIsRestoring(true);
                const backupRes = await api.get(`/timer/backup/by-session/${sessionId}`);
                if (!backupRes.data.success || !backupRes.data.backup) {
                    alert('No se encontró el respaldo para esta sesión.');
                    return;
                }
                await api.post(`/timer/backup/restore/${backupRes.data.backup.id}`);
                window.location.reload();
            } catch (err) {
                console.error('Error restoring session:', err);
                alert('Error al restaurar la sesión');
            } finally {
                setIsRestoring(false);
            }
        } else {
            const seconds = parseTimeInput(manualRestoreInput);
            if (seconds <= 0) {
                alert('Ingresa un tiempo válido. Ej: 5h 30m');
                return;
            }
            if (!confirm(`¿Restaurar sesión #${sessionId} con ${manualRestoreInput}? El timer se pondrá en PAUSA.`)) return;
            try {
                setIsRestoring(true);
                await api.post('/timer/backup/restore-session', { sessionId, remainingSeconds: seconds });
                window.location.reload();
            } catch (err) {
                console.error('Error restoring session manually:', err);
                alert('Error al restaurar la sesión');
            } finally {
                setIsRestoring(false);
            }
        }
    };

    const loadSessionLogs = async (sessionId: number) => {
        setLoadingLogs(true);
        try {
            const res = await api.get(`/timer/sessions/${sessionId}/logs`, {
                params: { limit: historyConfig.maxEntries }
            });
            if (res.data.success) {
                setSessionLogs(res.data.logs);
            }
        } catch (error) {
            console.error('Error loading logs:', error);
        } finally {
            setLoadingLogs(false);
        }
    };

    // Calcular estadísticas en tiempo real usando los logs de la sesión seleccionada
    const stats = useMemo(() => {
        const result = {
            total: 0,
            bits: 0,
            follows: 0,
            raids: 0,
            hypeTrain: 0,
            commands: 0,
            subs: {
                total: 0,
                prime: 0,
                tier1: 0,
                tier2: 0,
                tier3: 0,
                gift: 0
            }
        };

        // Usar sessionLogs en lugar de historyConfig.logs
        sessionLogs.forEach(log => {
            const time = log.timeAdded;
            result.total += time;
            
            const type = log.eventType?.toLowerCase() || '';
            const details = log.details || '';

            if (type.includes('bits') || type.includes('cheer')) result.bits += time;
            else if (type.includes('follow')) result.follows += time;
            else if (type.includes('raid')) result.raids += time;
            else if (type.includes('hype')) result.hypeTrain += time;
            else if (type.includes('command')) result.commands += time;
            else if (type.includes('sub') || type.includes('gift')) {
                result.subs.total += time;
                
                if (type === 'subscribe_prime' || details.includes('Prime')) result.subs.prime += time;
                else if (type === 'giftsub' || type.includes('gift') || details.includes('regalo')) result.subs.gift += time;
                else if (details.includes('Tier 3')) result.subs.tier3 += time;
                else if (details.includes('Tier 2')) result.subs.tier2 += time;
                else result.subs.tier1 += time; // Default a Tier 1
            }
        });

        return result;
    }, [sessionLogs]); // Recalcular cuando cambian los logs cargados

    // Función para obtener etiqueta legible del evento
    const getEventLabel = (log: EventLogEntry): string => {
        const type = log.eventType?.toLowerCase() || '';
        
        if (type.includes('sub')) {
            if (type === 'subscribe_prime' || (log.details && log.details.includes('Prime'))) return '👑 Prime Sub';
            if (type === 'giftsub' || (log.details && log.details.includes('regalo'))) return '🎁 Gift Sub';
            if (log.details) {
                if (log.details.includes('Tier 3')) return '⭐⭐⭐ Sub Tier 3';
                if (log.details.includes('Tier 2')) return '⭐⭐ Sub Tier 2';
                if (log.details.includes('Tier 1')) return '⭐ Sub Tier 1';
            }
            return '⭐ Suscripción';
        }

        if (type === 'bits' || type === 'cheer') return '💎 Bits';
        if (type === 'raid') return '🚀 Raid';
        if (type === 'follow') return '❤️ Follow';
        if (type === 'hypetrain' || type === 'hype') return '🔥 Hype Train';
        if (type === 'command') return '💬 Comando';

        return type.charAt(0).toUpperCase() + type.slice(1);
    };

    return (
        <div className="space-y-6">
            <div className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4">
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                    ℹ️ Historial completo de eventos, analytics en tiempo real y gestión de logs.
                </p>
            </div>

            {/* Activar Historial */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">📜 Activar Sistema de Historial</h3>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                            Registra todos los eventos que modifican el timer
                        </p>
                    </div>
                    <ToggleSwitch
                        checked={historyConfig.enabled}
                        onChange={(checked) => onHistoryConfigChange({ enabled: checked })}
                    />
                </div>
            </div>

            {historyConfig.enabled && (
                <>
                    {/* Selector de Sesión y Config */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <div className="flex flex-col md:flex-row gap-6">
                            {/* Selector de Sesión */}
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] flex items-center gap-2">
                                        <Calendar className="w-3 h-3" /> Seleccionar Sesión (Partida)
                                    </label>
                                    <button 
                                        onClick={loadSessions}
                                        className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
                                    >
                                        <RefreshCw className="w-3 h-3" /> Actualizar
                                    </button>
                                </div>
                                <select
                                    value={selectedSessionId || ''}
                                    onChange={(e) => setSelectedSessionId(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                >
                                    {sessions.map(session => {
                                        const d = new Date(session.startedAt);
                                        const dateStr = `${d.getDate()}/${d.getMonth()+1} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
                                        const statusIcon = session.isActive ? '🔴 ACTIVA' : '📅';
                                        const initial = session.initialDuration > 0 ? ` | Ini: ${formatTimeProfessional(session.initialDuration)}` : '';
                                        const added = session.totalAddedTime > 0 ? ` | +${formatTimeProfessional(session.totalAddedTime)}` : '';
                                        const backup = session.hasBackup && session.backupRemainingSeconds !== null
                                            ? ` 💾 ${formatTimeProfessional(session.backupRemainingSeconds)} rest.`
                                            : '';
                                        return (
                                            <option key={session.id} value={session.id}>
                                                {statusIcon} #{session.id} — {dateStr}{initial}{added}{backup}
                                            </option>
                                        );
                                    })}
                                    {sessions.length === 0 && <option value="">No hay sesiones registradas</option>}
                                </select>
                            </div>

                            {/* Límite de Logs */}
                            <div className="flex-1">
                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                    Mostrar Logs: {historyConfig.maxEntries} últimos
                                </label>
                                <input
                                    type="range"
                                    min="10"
                                    max="500"
                                    step="10"
                                    value={historyConfig.maxEntries}
                                    onChange={(e) => onHistoryConfigChange({ maxEntries: Number(e.target.value) })}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Panel de Restaurar — aparece para CUALQUIER sesión seleccionada */}
                    {(() => {
                        const selectedSession = sessions.find(s => s.id === selectedSessionId);
                        if (!selectedSession) return null;
                        const hasBackup = selectedSession.hasBackup && selectedSession.backupRemainingSeconds !== null;
                        return (
                            <div className={`rounded-2xl border p-5 shadow-lg ${hasBackup ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'bg-gray-50 dark:bg-[#1B1C1D] border-[#e2e8f0] dark:border-[#374151]'}`}>
                                <div className="flex items-start gap-4">
                                    <div className={`p-2.5 rounded-xl shrink-0 ${hasBackup ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-[#262626]'}`}>
                                        <RotateCcw className={`w-5 h-5 ${hasBackup ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`text-sm font-bold mb-1 ${hasBackup ? 'text-blue-800 dark:text-blue-300' : 'text-[#1e293b] dark:text-[#f8fafc]'}`}>
                                            {hasBackup ? 'Respaldo guardado disponible' : 'Restaurar sesión manualmente'}
                                        </h3>
                                        <p className={`text-xs mb-3 ${hasBackup ? 'text-blue-600 dark:text-blue-400' : 'text-[#64748b] dark:text-[#94a3b8]'}`}>
                                            Sesión iniciada el <strong>{new Date(selectedSession.startedAt).toLocaleString()}</strong>
                                            {hasBackup && selectedSession.backupCreatedAt && (
                                                <> · Backup del <strong>{new Date(selectedSession.backupCreatedAt).toLocaleString()}</strong></>
                                            )}
                                        </p>

                                        {hasBackup ? (
                                            <>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                                                    <div className="bg-white dark:bg-[#1B1C1D] p-2.5 rounded-lg border border-blue-100 dark:border-blue-900">
                                                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block mb-1">TIEMPO RESTANTE</span>
                                                        <span className="text-sm font-mono font-bold text-blue-700 dark:text-blue-300">
                                                            {formatTimeProfessional(selectedSession.backupRemainingSeconds!)}
                                                        </span>
                                                    </div>
                                                    <div className="bg-white dark:bg-[#1B1C1D] p-2.5 rounded-lg border border-blue-100 dark:border-blue-900">
                                                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block mb-1">TOTAL AÑADIDO</span>
                                                        <span className="text-sm font-mono font-bold text-gray-800 dark:text-gray-200">
                                                            {formatTimeProfessional(selectedSession.totalAddedTime)}
                                                        </span>
                                                    </div>
                                                    <div className="bg-white dark:bg-[#1B1C1D] p-2.5 rounded-lg border border-blue-100 dark:border-blue-900 col-span-2 sm:col-span-1">
                                                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block mb-1">RAZÓN</span>
                                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                            {selectedSession.backupReason ? formatBackupReason(selectedSession.backupReason) : '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRestoreSession(selectedSession.id, true)}
                                                    disabled={isRestoring}
                                                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                                                >
                                                    {isRestoring ? <><RefreshCw className="w-4 h-4 animate-spin" /> Restaurando...</> : <><RotateCcw className="w-4 h-4" /> Restaurar esta sesión</>}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-3">
                                                    Esta sesión no tiene backup automático. Indica con cuánto tiempo quieres restaurarla:
                                                </p>
                                                <div className="flex gap-2 mb-3">
                                                    <input
                                                        type="text"
                                                        value={manualRestoreInput}
                                                        onChange={(e) => setManualRestoreInput(e.target.value)}
                                                        placeholder="Ej: 5h 30m, 2h, 90m"
                                                        className="flex-1 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm font-mono"
                                                    />
                                                </div>
                                                {manualRestoreInput && parseTimeInput(manualRestoreInput) > 0 && (
                                                    <p className="text-xs text-green-600 dark:text-green-400 mb-3">
                                                        Se restaurará con: <strong>{formatTimeProfessional(parseTimeInput(manualRestoreInput))}</strong>
                                                    </p>
                                                )}
                                                <button
                                                    onClick={() => handleRestoreSession(selectedSession.id, false)}
                                                    disabled={isRestoring || parseTimeInput(manualRestoreInput) <= 0}
                                                    className="w-full py-2.5 bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 disabled:opacity-40 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                                                >
                                                    {isRestoring ? <><RefreshCw className="w-4 h-4 animate-spin" /> Restaurando...</> : <><RotateCcw className="w-4 h-4" /> Restaurar con este tiempo</>}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Analytics */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                            📊 Analytics de la Sesión
                            {loadingLogs && <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />}
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-1">Total Agregado</p>
                                <p className="text-sm md:text-base font-black text-[#1e293b] dark:text-[#f8fafc] break-words">
                                    {formatTimeProfessional(stats.total)}
                                </p>
                            </div>
                            <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                                <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">💎 Bits</p>
                                <p className="text-sm md:text-base font-black text-[#1e293b] dark:text-[#f8fafc] break-words">
                                    {formatTimeProfessional(stats.bits)}
                                </p>
                            </div>
                            <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                                <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">🚀 Raids</p>
                                <p className="text-sm md:text-base font-black text-[#1e293b] dark:text-[#f8fafc] break-words">
                                    {formatTimeProfessional(stats.raids)}
                                </p>
                            </div>
                            <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                                <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">🔥 Hype Train</p>
                                <p className="text-sm md:text-base font-black text-[#1e293b] dark:text-[#f8fafc] break-words">
                                    {formatTimeProfessional(stats.hypeTrain)}
                                </p>
                            </div>
                        </div>

                        {/* Desglose de Suscripciones */}
                        <div className="mb-4 p-4 bg-gray-50 dark:bg-[#262626] rounded-xl border border-gray-200 dark:border-gray-700">
                            <h4 className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-3 uppercase tracking-wider">Suscripciones</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                <div className="p-2 rounded bg-white dark:bg-[#1B1C1D] border border-gray-200 dark:border-gray-700">
                                    <p className="text-[10px] font-bold text-yellow-600 mb-1">👑 Prime</p>
                                    <p className="text-xs font-bold dark:text-white truncate" title={formatTimeProfessional(stats.subs.prime)}>{formatTimeProfessional(stats.subs.prime)}</p>
                                </div>
                                <div className="p-2 rounded bg-white dark:bg-[#1B1C1D] border border-gray-200 dark:border-gray-700">
                                    <p className="text-[10px] font-bold text-purple-600 mb-1">⭐ Tier 1</p>
                                    <p className="text-xs font-bold dark:text-white truncate" title={formatTimeProfessional(stats.subs.tier1)}>{formatTimeProfessional(stats.subs.tier1)}</p>
                                </div>
                                <div className="p-2 rounded bg-white dark:bg-[#1B1C1D] border border-gray-200 dark:border-gray-700">
                                    <p className="text-[10px] font-bold text-purple-600 mb-1">⭐⭐ Tier 2</p>
                                    <p className="text-xs font-bold dark:text-white truncate" title={formatTimeProfessional(stats.subs.tier2)}>{formatTimeProfessional(stats.subs.tier2)}</p>
                                </div>
                                <div className="p-2 rounded bg-white dark:bg-[#1B1C1D] border border-gray-200 dark:border-gray-700">
                                    <p className="text-[10px] font-bold text-purple-600 mb-1">⭐⭐⭐ Tier 3</p>
                                    <p className="text-xs font-bold dark:text-white truncate" title={formatTimeProfessional(stats.subs.tier3)}>{formatTimeProfessional(stats.subs.tier3)}</p>
                                </div>
                                <div className="p-2 rounded bg-white dark:bg-[#1B1C1D] border border-gray-200 dark:border-gray-700">
                                    <p className="text-[10px] font-bold text-pink-600 mb-1">🎁 Gift</p>
                                    <p className="text-xs font-bold dark:text-white truncate" title={formatTimeProfessional(stats.subs.gift)}>{formatTimeProfessional(stats.subs.gift)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                                <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">❤️ Follows</p>
                                <p className="text-sm md:text-base font-black text-[#1e293b] dark:text-[#f8fafc] break-words">
                                    {formatTimeProfessional(stats.follows)}
                                </p>
                            </div>
                            <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                                <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">💬 Comandos</p>
                                <p className="text-sm md:text-base font-black text-[#1e293b] dark:text-[#f8fafc] break-words">
                                    {formatTimeProfessional(stats.commands)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Historial de Eventos */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center justify-between">
                            <span>📋 Logs de la Sesión</span>
                            <span className="text-xs font-normal text-[#64748b] dark:text-[#94a3b8]">
                                Mostrando {sessionLogs.length} eventos
                            </span>
                        </h3>

                        {sessionLogs.length === 0 ? (
                            <div className="p-8 text-center bg-gray-50 dark:bg-[#262626] rounded-xl border border-gray-200 dark:border-gray-700">
                                <Clock className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                    No hay eventos registrados en esta sesión.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                {sessionLogs.map((log) => (
                                    <div
                                        key={log.id}
                                        className="p-3 bg-gray-50 dark:bg-[#262626] rounded-lg border border-gray-200 dark:border-gray-700 hover:border-[#94a3b8] dark:hover:border-[#374151] transition-all"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                                        {log.username}
                                                    </span>
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white dark:bg-[#1B1C1D] border border-gray-200 dark:border-gray-600 text-[#64748b] dark:text-[#94a3b8] font-medium shadow-sm">
                                                        {getEventLabel(log)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-bold ${
                                                        log.timeAdded >= 0
                                                            ? 'text-green-600 dark:text-green-400'
                                                            : 'text-red-600 dark:text-red-400'
                                                    }`}>
                                                        {formatTimeProfessional(log.timeAdded)}
                                                    </span>
                                                    {log.details && (
                                                        <span className="text-xs text-[#64748b] dark:text-[#94a3b8] border-l border-gray-300 dark:border-gray-600 pl-2 ml-1">
                                                            {log.details}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-[#94a3b8] dark:text-[#64748b] whitespace-nowrap mt-1 font-mono">
                                                {new Date(log.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default HistoryTab;