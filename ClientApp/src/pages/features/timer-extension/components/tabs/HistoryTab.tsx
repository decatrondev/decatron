/**
 * Timer Extension - HistoryTab Component
 *
 * Historial de eventos, analytics y configuración de logs.
 */

import { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, RefreshCw, RotateCcw } from 'lucide-react';
import api from '../../../../../services/api';
import type { HistoryConfig, EventLogEntry } from '../../types';
import {
    formatTimeProfessional,
    formatDateTimeIn,
    formatTimeOnlyIn,
    formatShortDateTimeIn,
    timeZoneLabel
} from '../../utils';

interface HistoryTabProps {
    historyConfig: HistoryConfig;
    onHistoryConfigChange: (updates: Partial<HistoryConfig>) => void;
    /** Zona horaria configurada por el streamer (IANA, ej: "America/Lima"). */
    timeZone?: string;
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
        <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-faint rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all border-ds-border peer-checked:bg-ds-accent"></div>
    </label>
);

export const HistoryTab: React.FC<HistoryTabProps> = ({
    historyConfig,
    onHistoryConfigChange,
    timeZone
}) => {
    // Las fechas se muestran en la zona horaria que configuró el streamer.
    const zoneLabel = timeZoneLabel(timeZone);
    const formatDateTime = (v: string | null | undefined) => formatDateTimeIn(v, timeZone);
    const formatTimeOnly = (v: string | null | undefined) => formatTimeOnlyIn(v, timeZone);
    const formatShortDateTime = (v: string | null | undefined) => formatShortDateTimeIn(v, timeZone);

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
            tips: 0,
            gacha: 0,
            wheel: 0,
            others: 0,
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
            else if (type.includes('tip') || type.includes('donation')) result.tips += time;
            else if (type.includes('gacha')) result.gacha += time;
            else if (type.includes('wheel') || type.includes('ruleta')) result.wheel += time;
            else if (type.includes('sub') || type.includes('gift')) {
                result.subs.total += time;
                
                if (type === 'subscribe_prime' || details.includes('Prime')) result.subs.prime += time;
                else if (type === 'giftsub' || type.includes('gift') || details.includes('regalo')) result.subs.gift += time;
                else if (details.includes('Tier 3')) result.subs.tier3 += time;
                else if (details.includes('Tier 2')) result.subs.tier2 += time;
                else result.subs.tier1 += time; // Default a Tier 1
            }
            else result.others += time;
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
        if (type === 'tips' || type === 'tip' || type === 'donation') return '💰 Tip';
        if (type === 'gacha') return '🎰 Gachapón';
        if (type === 'wheel') return '🎡 Ruleta';
        if (type === 'migration_offset') return '📦 Tiempo base';

        return type.charAt(0).toUpperCase() + type.slice(1);
    };

    return (
        <div className="space-y-6">
            <div className="bg-ds-bg border border-ds-border rounded-lg p-4">
                <p className="text-sm text-ds-soft">
                    ℹ️ Historial completo de eventos, analytics en tiempo real y gestión de logs.
                </p>
            </div>

            {/* Activar Historial */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-ds-text">📜 Activar Sistema de Historial</h3>
                        <p className="text-xs text-ds-soft mt-1">
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
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                        <div className="flex flex-col md:flex-row gap-6">
                            {/* Selector de Sesión */}
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-ds-soft flex items-center gap-2">
                                        <Calendar className="w-3 h-3" /> Seleccionar Sesión (Partida)
                                    </label>
                                    <button 
                                        onClick={loadSessions}
                                        className="text-xs text-ds-accent-text hover:text-ds-accent-text flex items-center gap-1"
                                    >
                                        <RefreshCw className="w-3 h-3" /> Actualizar
                                    </button>
                                </div>
                                <select
                                    value={selectedSessionId || ''}
                                    onChange={(e) => setSelectedSessionId(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg border border-ds-border bg-ds-surface text-ds-text text-sm"
                                >
                                    {sessions.map(session => {
                                        const dateStr = formatShortDateTime(session.startedAt);
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
                                <label className="text-xs font-bold text-ds-soft block mb-2">
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
                            <div className={`rounded-lg border p-5 ${hasBackup ? 'bg-ds-accent/10 border-ds-accent ' : 'bg-ds-surface border-ds-border '}`}>
                                <div className="flex items-start gap-4">
                                    <div className={`p-2.5 rounded-lg shrink-0 ${hasBackup ? 'bg-ds-accent/10 ' : 'bg-ds-bg '}`}>
                                        <RotateCcw className={`w-5 h-5 ${hasBackup ? 'text-ds-accent-text ' : 'text-ds-soft '}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`text-sm font-bold mb-1 ${hasBackup ? 'text-ds-accent-text ' : 'text-ds-text '}`}>
                                            {hasBackup ? 'Respaldo guardado disponible' : 'Restaurar sesión manualmente'}
                                        </h3>
                                        <p className={`text-xs mb-3 ${hasBackup ? 'text-ds-accent-text ' : 'text-ds-soft '}`}>
                                            Sesión iniciada el <strong>{formatDateTime(selectedSession.startedAt)}</strong>
                                            {hasBackup && selectedSession.backupCreatedAt && (
                                                <> · Backup del <strong>{formatDateTime(selectedSession.backupCreatedAt)}</strong></>
                                            )}
                                        </p>

                                        {hasBackup ? (
                                            <>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                                                    <div className="bg-ds-surface p-2.5 rounded-lg border border-ds-accent">
                                                        <span className="text-[10px] font-bold text-ds-soft block mb-1">TIEMPO RESTANTE</span>
                                                        <span className="text-sm font-mono font-bold text-ds-accent-text">
                                                            {formatTimeProfessional(selectedSession.backupRemainingSeconds!)}
                                                        </span>
                                                    </div>
                                                    <div className="bg-ds-surface p-2.5 rounded-lg border border-ds-accent">
                                                        <span className="text-[10px] font-bold text-ds-soft block mb-1">TOTAL AÑADIDO</span>
                                                        <span className="text-sm font-mono font-bold text-ds-text">
                                                            {formatTimeProfessional(selectedSession.totalAddedTime)}
                                                        </span>
                                                    </div>
                                                    <div className="bg-ds-surface p-2.5 rounded-lg border border-ds-accent col-span-2 sm:col-span-1">
                                                        <span className="text-[10px] font-bold text-ds-soft block mb-1">RAZÓN</span>
                                                        <span className="text-xs font-bold text-ds-soft">
                                                            {selectedSession.backupReason ? formatBackupReason(selectedSession.backupReason) : '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRestoreSession(selectedSession.id, true)}
                                                    disabled={isRestoring}
                                                    className="w-full py-2.5 bg-ds-accent hover:bg-ds-accent-hover disabled:opacity-50 text-ds-on-accent rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2"
                                                >
                                                    {isRestoring ? <><RefreshCw className="w-4 h-4 animate-spin" /> Restaurando...</> : <><RotateCcw className="w-4 h-4" /> Restaurar esta sesión</>}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-xs text-ds-soft mb-3">
                                                    Esta sesión no tiene backup automático. Indica con cuánto tiempo quieres restaurarla:
                                                </p>
                                                <div className="flex gap-2 mb-3">
                                                    <input
                                                        type="text"
                                                        value={manualRestoreInput}
                                                        onChange={(e) => setManualRestoreInput(e.target.value)}
                                                        placeholder="Ej: 5h 30m, 2h, 90m"
                                                        className="flex-1 px-3 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text text-sm font-mono"
                                                    />
                                                </div>
                                                {manualRestoreInput && parseTimeInput(manualRestoreInput) > 0 && (
                                                    <p className="text-xs text-ds-ok mb-3">
                                                        Se restaurará con: <strong>{formatTimeProfessional(parseTimeInput(manualRestoreInput))}</strong>
                                                    </p>
                                                )}
                                                <button
                                                    onClick={() => handleRestoreSession(selectedSession.id, false)}
                                                    disabled={isRestoring || parseTimeInput(manualRestoreInput) <= 0}
                                                    className="w-full py-2.5 bg-ds-raised hover:bg-ds-raised disabled:opacity-40 text-ds-text rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2"
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
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                        <h3 className="text-sm font-bold text-ds-text mb-4 flex items-center gap-2">
                            📊 Analytics de la Sesión
                            {loadingLogs && <RefreshCw className="w-3 h-3 animate-spin text-ds-accent-text" />}
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <div className="p-4 bg-ds-accent/10 rounded-lg border border-ds-accent">
                                <p className="text-xs font-bold text-ds-accent-text mb-1">Total Agregado</p>
                                <p className="text-sm md:text-base font-black text-ds-text break-words">
                                    {formatTimeProfessional(stats.total)}
                                </p>
                            </div>
                            <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                                <p className="text-xs font-bold text-ds-soft mb-1">💎 Bits</p>
                                <p className="text-sm md:text-base font-black text-ds-text break-words">
                                    {formatTimeProfessional(stats.bits)}
                                </p>
                            </div>
                            <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                                <p className="text-xs font-bold text-ds-soft mb-1">🚀 Raids</p>
                                <p className="text-sm md:text-base font-black text-ds-text break-words">
                                    {formatTimeProfessional(stats.raids)}
                                </p>
                            </div>
                            <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                                <p className="text-xs font-bold text-ds-soft mb-1">🔥 Hype Train</p>
                                <p className="text-sm md:text-base font-black text-ds-text break-words">
                                    {formatTimeProfessional(stats.hypeTrain)}
                                </p>
                            </div>
                        </div>

                        {/* Desglose de Suscripciones */}
                        <div className="mb-4 p-4 bg-ds-surface rounded-lg border border-ds-border">
                            <h4 className="text-xs font-bold text-ds-soft mb-3 uppercase tracking-wider">Suscripciones</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                <div className="p-2 rounded bg-ds-surface border border-ds-border">
                                    <p className="text-[10px] font-bold text-ds-warn mb-1">👑 Prime</p>
                                    <p className="text-xs font-bold text-ds-text truncate" title={formatTimeProfessional(stats.subs.prime)}>{formatTimeProfessional(stats.subs.prime)}</p>
                                </div>
                                <div className="p-2 rounded bg-ds-surface border border-ds-border">
                                    <p className="text-[10px] font-bold text-ds-accent-text mb-1">⭐ Tier 1</p>
                                    <p className="text-xs font-bold text-ds-text truncate" title={formatTimeProfessional(stats.subs.tier1)}>{formatTimeProfessional(stats.subs.tier1)}</p>
                                </div>
                                <div className="p-2 rounded bg-ds-surface border border-ds-border">
                                    <p className="text-[10px] font-bold text-ds-accent-text mb-1">⭐⭐ Tier 2</p>
                                    <p className="text-xs font-bold text-ds-text truncate" title={formatTimeProfessional(stats.subs.tier2)}>{formatTimeProfessional(stats.subs.tier2)}</p>
                                </div>
                                <div className="p-2 rounded bg-ds-surface border border-ds-border">
                                    <p className="text-[10px] font-bold text-ds-accent-text mb-1">⭐⭐⭐ Tier 3</p>
                                    <p className="text-xs font-bold text-ds-text truncate" title={formatTimeProfessional(stats.subs.tier3)}>{formatTimeProfessional(stats.subs.tier3)}</p>
                                </div>
                                <div className="p-2 rounded bg-ds-surface border border-ds-border">
                                    <p className="text-[10px] font-bold text-ds-accent-text mb-1">🎁 Gift</p>
                                    <p className="text-xs font-bold text-ds-text truncate" title={formatTimeProfessional(stats.subs.gift)}>{formatTimeProfessional(stats.subs.gift)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                                <p className="text-xs font-bold text-ds-soft mb-1">❤️ Follows</p>
                                <p className="text-sm md:text-base font-black text-ds-text break-words">
                                    {formatTimeProfessional(stats.follows)}
                                </p>
                            </div>
                            <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                                <p className="text-xs font-bold text-ds-soft mb-1">💬 Comandos</p>
                                <p className="text-sm md:text-base font-black text-ds-text break-words">
                                    {formatTimeProfessional(stats.commands)}
                                </p>
                            </div>
                            <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                                <p className="text-xs font-bold text-ds-soft mb-1">💰 Tips</p>
                                <p className="text-sm md:text-base font-black text-ds-text break-words">
                                    {formatTimeProfessional(stats.tips)}
                                </p>
                            </div>
                            <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                                <p className="text-xs font-bold text-ds-soft mb-1">🎰 Gachapón</p>
                                <p className="text-sm md:text-base font-black text-ds-text break-words">
                                    {formatTimeProfessional(stats.gacha)}
                                </p>
                            </div>
                            <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                                <p className="text-xs font-bold text-ds-soft mb-1">🎡 Ruleta</p>
                                <p className="text-sm md:text-base font-black text-ds-text break-words">
                                    {formatTimeProfessional(stats.wheel)}
                                </p>
                            </div>
                            {stats.others !== 0 && (
                                <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                                    <p className="text-xs font-bold text-ds-soft mb-1">📦 Otros</p>
                                    <p className="text-sm md:text-base font-black text-ds-text break-words">
                                        {formatTimeProfessional(stats.others)}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Historial de Eventos */}
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                        <h3 className="text-sm font-bold text-ds-text mb-4 flex items-center justify-between">
                            <span>📋 Logs de la Sesión</span>
                            <span className="text-xs font-normal text-ds-soft">
                                Mostrando {sessionLogs.length} eventos · horas en {zoneLabel}
                            </span>
                        </h3>

                        {sessionLogs.length === 0 ? (
                            <div className="p-8 text-center bg-ds-surface rounded-lg border border-ds-border">
                                <Clock className="w-8 h-8 text-ds-soft mx-auto mb-3" />
                                <p className="text-sm text-ds-soft">
                                    No hay eventos registrados en esta sesión.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                {sessionLogs.map((log) => (
                                    <div
                                        key={log.id}
                                        className="p-3 bg-ds-surface rounded-lg border border-ds-border hover:border-ds-faint transition-all"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className="text-sm font-bold text-ds-text">
                                                        {log.username}
                                                    </span>
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-ds-surface border border-ds-border text-ds-soft font-medium">
                                                        {getEventLabel(log)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-bold ${
                                                        log.timeAdded >= 0
                                                            ? 'text-ds-ok '
                                                            : 'text-ds-danger '
                                                    }`}>
                                                        {formatTimeProfessional(log.timeAdded)}
                                                    </span>
                                                    {log.details && (
                                                        <span className="text-xs text-ds-soft border-l border-ds-border pl-2 ml-1">
                                                            {log.details}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-ds-soft whitespace-nowrap mt-1 font-mono">
                                                {formatTimeOnly(log.timestamp)}
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