/**
 * Timer Extension - Basic Tab Component
 *
 * Configuración básica del timer: duración inicial, auto-start, controles y URL del overlay.
 */

import { Play, Pause, RotateCcw, StopCircle, Copy, Clock, Save, CloudUpload } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../../../../../services/api';
import { formatTimeProfessional } from '../../utils';

interface TimerSessionBasic {
    id: number;
    startedAt: string;
    endedAt: string | null;
    initialDuration: number;
    totalAddedTime: number;
    isActive: boolean;
    hasBackup: boolean;
    backupRemainingSeconds: number | null;
    backupCreatedAt: string | null;
    backupReason: string | null;
}

    interface BasicTabProps {
        defaultDuration: number;
        autoStart: boolean;
        overlayUrl: string;
        activeTimerRemaining?: number | null;
        activeTotalDuration?: number | null;
        activeTimerStatus?: string;
        maxChances?: number;
        resurrectionMessage?: string; // Nuevo
        gameOverMessage?: string; // Nuevo
        onDefaultDurationChange: (duration: number) => void;
        onAutoStartChange: (autoStart: boolean) => void;
        onMaxChancesChange?: (chances: number) => void;
        onResurrectionMessageChange?: (msg: string) => void; // Nuevo
        onGameOverMessageChange?: (msg: string) => void; // Nuevo
        onCopyOverlayUrl: () => void;
        initialTimeOffset?: number;
        onInitialTimeOffsetChange?: (offset: number) => void;
        onStateRefresh?: () => void;
        autoPlayOnStreamOnline?: boolean;
        autoStopOnStreamOffline?: boolean;
        onAutoPlayOnStreamOnlineChange?: (v: boolean) => void;
        onAutoStopOnStreamOfflineChange?: (v: boolean) => void;
    }
    
    export const BasicTab: React.FC<BasicTabProps> = ({
        defaultDuration,
        autoStart,
        overlayUrl,
        activeTimerRemaining,
        activeTotalDuration,
        activeTimerStatus,
        maxChances = 0,
        resurrectionMessage = "",
        gameOverMessage = "",
        onDefaultDurationChange,
        onAutoStartChange,
        onMaxChancesChange,
        onResurrectionMessageChange,
        onGameOverMessageChange,
        onCopyOverlayUrl,
        initialTimeOffset = 0,
        onInitialTimeOffsetChange,
        onStateRefresh,
        autoPlayOnStreamOnline = false,
        autoStopOnStreamOffline = false,
        onAutoPlayOnStreamOnlineChange,
        onAutoStopOnStreamOfflineChange,
    }) => {    // Usar activeTimerRemaining si hay timer activo (running/paused), sino defaultDuration
    const displayDuration = (activeTimerStatus === 'running' || activeTimerStatus === 'paused' || activeTimerStatus === 'auto_paused' || activeTimerStatus === 'stream_paused') && activeTimerRemaining !== null
        ? activeTimerRemaining
        : defaultDuration;

    // Estado local para el input de texto del offset (ej: "5h 30m")
    const [offsetInput, setOffsetInput] = useState("");
    const [offsetFeedback, setOffsetFeedback] = useState<string>("");
    const [copied, setCopied] = useState(false);
    
    // Estado para backup en nube
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [backupStatus, setBackupStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [sessions, setSessions] = useState<TimerSessionBasic[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
    const [isRestoring, setIsRestoring] = useState(false);
    const [manualRestoreInput, setManualRestoreInput] = useState('');

    // Estado para Game Over (Chances)
    const [enableResurrection, setEnableResurrection] = useState(maxChances > 0);

    const isTimerActive = activeTimerStatus === 'running' || activeTimerStatus === 'paused' || activeTimerStatus === 'auto_paused' || activeTimerStatus === 'stream_paused';

    // Cargar sesiones cuando el timer está detenido
    useEffect(() => {
        if (activeTimerStatus === 'stopped') {
            const fetchSessions = async () => {
                try {
                    const res = await api.get('/timer/sessions');
                    if (res.data.success && res.data.sessions) {
                        const loaded: TimerSessionBasic[] = res.data.sessions;
                        setSessions(loaded);
                        // Prioridad: 1) Sesión activa (raro en stopped), 2) Con backup, 3) Primera
                        const activeSession = loaded.find(s => s.isActive);
                        const withBackup = loaded.find(s => s.hasBackup);
                        setSelectedSessionId(activeSession?.id ?? withBackup?.id ?? loaded[0]?.id ?? null);
                    } else {
                        setSessions([]);
                        setSelectedSessionId(null);
                    }
                } catch (err) {
                    console.error("Error fetching sessions", err);
                }
            };
            fetchSessions();
        } else {
            setSessions([]);
            setSelectedSessionId(null);
        }
    }, [activeTimerStatus]);

    // Sincronizar input con valor numérico al montar
    useEffect(() => {
        if (initialTimeOffset > 0 && !offsetInput) {
            const h = Math.floor(initialTimeOffset / 3600);
            const m = Math.floor((initialTimeOffset % 3600) / 60);
            const s = initialTimeOffset % 60;
            let str = "";
            if (h > 0) str += `${h}h `;
            if (m > 0) str += `${m}m `;
            if (s > 0) str += `${s}s`;
            setOffsetInput(str.trim());
        }
    }, [initialTimeOffset]);

    // Sync Game Over toggle
    useEffect(() => {
        setEnableResurrection(maxChances > 0);
    }, [maxChances]);

    // Parsear input de tiempo (1d 2h 30m)
    const parseTimeInput = (input: string): number => {
        let totalSeconds = 0;
        const regex = /(\d+)\s*([dhms])/gi;
        let match;
        let foundUnit = false;
        
        regex.lastIndex = 0;

        while ((match = regex.exec(input)) !== null) {
            foundUnit = true;
            const value = parseInt(match[1]);
            const unit = match[2].toLowerCase();
            if (unit === 'd') totalSeconds += value * 86400;
            if (unit === 'h') totalSeconds += value * 3600;
            if (unit === 'm') totalSeconds += value * 60;
            if (unit === 's') totalSeconds += value;
        }
        
        if (!foundUnit && /^\d+$/.test(input.trim())) {
             const val = parseInt(input.trim());
             return val * 3600; // Default a horas
        }
        return totalSeconds;
    };

    const handleOffsetChange = (val: string) => {
        setOffsetInput(val);
        const seconds = parseTimeInput(val);
        
        if (!val.trim()) {
            setOffsetFeedback("");
        } else if (/^\d+$/.test(val.trim())) {
            setOffsetFeedback(`⚠️ Se interpretará como: ${val} HORAS`);
        } else {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            setOffsetFeedback(`Total: ${h}h ${m}m ${s}s`);
        }

        if (onInitialTimeOffsetChange) {
            onInitialTimeOffsetChange(seconds);
        }
    };

    const handleCopy = () => {
        onCopyOverlayUrl();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleResurrectionToggle = (enabled: boolean) => {
        setEnableResurrection(enabled);
        if (!enabled && onMaxChancesChange) {
            onMaxChancesChange(0);
        } else if (enabled && onMaxChancesChange && maxChances === 0) {
            onMaxChancesChange(1); // Default to 1 if enabling
        }
    };

    const handleCloudBackup = async () => {
        if (!activeTimerRemaining) return;
        
        try {
            setIsBackingUp(true);
            setBackupStatus('idle');
            
            // Calcular valores para enviar
            const baseDuration = activeTotalDuration || defaultDuration;
            let elapsed = (baseDuration + initialTimeOffset) - activeTimerRemaining;
            if (elapsed < 0) elapsed = 0;

            await api.post('/timer/backup', {
                remainingSeconds: activeTimerRemaining,
                totalElapsedSeconds: elapsed,
                totalDurationAtSnapshot: baseDuration + initialTimeOffset,
                reason: 'manual_user_backup'
            });

            setBackupStatus('success');
            setTimeout(() => setBackupStatus('idle'), 3000);
        } catch (error) {
            console.error('Error creating backup:', error);
            setBackupStatus('error');
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleTimerControl = async (action: string, duration?: number) => {
        if (action === 'start' && isTimerActive) return;

        try {
            await api.post('/timer/control', {
                action,
                ...(duration !== undefined && { duration })
            });
            // Refresh inmediato del estado
            onStateRefresh?.();
        } catch (error) {
            console.error(`Error al ${action} timer:`, error);
        }
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
            } catch (error) {
                console.error('Error restoring session:', error);
                alert('Error al restaurar la sesión');
            } finally {
                setIsRestoring(false);
            }
        } else {
            const seconds = parseTimeInput(manualRestoreInput);
            if (seconds <= 0) { alert('Ingresa un tiempo válido. Ej: 5h 30m'); return; }
            if (!confirm(`¿Restaurar sesión #${sessionId} con ${manualRestoreInput}?`)) return;
            try {
                setIsRestoring(true);
                await api.post('/timer/backup/restore-session', { sessionId, remainingSeconds: seconds });
                window.location.reload();
            } catch (error) {
                console.error('Error restoring session manually:', error);
                alert('Error al restaurar la sesión');
            } finally {
                setIsRestoring(false);
            }
        }
    };

    const formatBackupReason = (reason: string): string => {
        const map: Record<string, string> = {
            'manual_stop': 'Parada manual',
            'auto_save': 'Auto-guardado',
            'manual_user_backup': 'Respaldo manual',
            'emergency_stop': 'Parada de emergencia',
            'manual': 'Manual',
        };
        return map[reason] || reason.replace(/_/g, ' ');
    };

    const selectedSession = sessions.find(s => s.id === selectedSessionId);

    return (
        <div className="space-y-6">
            {/* Tiempo Inicial del Timer */}
            <div className={`rounded-2xl border p-6 shadow-lg transition-all ${isTimerActive ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-white dark:bg-[#1B1C1D] border-[#e2e8f0] dark:border-[#374151]'}`}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                            ⏱️ {isTimerActive ? 'Timer EN CURSO' : 'Tiempo Inicial del Timer'}
                            {isTimerActive && <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span></span>}
                        </label>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                            {isTimerActive
                                ? `El timer está ${activeTimerStatus === 'running' ? 'corriendo' : activeTimerStatus === 'auto_paused' ? 'en pausa automática (horario)' : activeTimerStatus === 'stream_paused' ? 'en pausa automática (stream offline)' : 'pausado'}. Los cambios aquí solo afectarán al próximo reinicio.`
                                : 'Duración que tendrá el timer al iniciarse.'}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className={`text-3xl font-black ${isTimerActive ? 'text-green-600 dark:text-green-400' : 'text-[#2563eb]'}`}>
                            {Math.floor(displayDuration / 86400) > 0 && `${Math.floor(displayDuration / 86400)}d `}
                            {Math.floor((displayDuration % 86400) / 3600) > 0 && `${Math.floor((displayDuration % 86400) / 3600)}h `}
                            {Math.floor((displayDuration % 3600) / 60) > 0 && `${Math.floor((displayDuration % 3600) / 60)}m `}
                            {displayDuration % 60 > 0 && `${displayDuration % 60}s`}
                        </div>
                    </div>
                </div>

                {/* Inputs personalizados por unidad - DESHABILITADOS SI CORRE */}
                <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 ${isTimerActive ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                    {['Días', 'Horas', 'Minutos', 'Segundos'].map((label, idx) => {
                        const maxValues = [365, 23, 59, 59];
                        const multipliers = [86400, 3600, 60, 1];
                        const currentVal = idx === 0 
                            ? Math.floor(defaultDuration / 86400)
                            : Math.floor((defaultDuration % multipliers[idx-1]) / multipliers[idx]);
                        
                        return (
                            <div key={label}>
                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-1">{label}</label>
                                <input
                                    type="number"
                                    min="0"
                                    max={maxValues[idx]}
                                    value={currentVal}
                                    onChange={(e) => {
                                        const newVal = Number(e.target.value) || 0;
                                        // Reconstruir total
                                        const d = idx === 0 ? newVal : Math.floor(defaultDuration / 86400);
                                        const h = idx === 1 ? newVal : Math.floor((defaultDuration % 86400) / 3600);
                                        const m = idx === 2 ? newVal : Math.floor((defaultDuration % 3600) / 60);
                                        const s = idx === 3 ? newVal : defaultDuration % 60;
                                        onDefaultDurationChange(d * 86400 + h * 3600 + m * 60 + s);
                                    }}
                                    className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-center font-bold"
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Offset de Tiempo Acumulado */}
                <div className="mt-6 pt-6 border-t border-[#e2e8f0] dark:border-[#374151]">
                    <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-purple-500" />
                        Tiempo Base Acumulado (Offset)
                    </label>
                    <div className="flex gap-3 items-start">
                        <div className="flex-1">
                            <input
                                type="text"
                                value={offsetInput}
                                onChange={(e) => handleOffsetChange(e.target.value)}
                                placeholder="Ej: 500h, 4d 2h, o 1800000"
                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                            <div className="flex justify-between mt-1">
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                    Suma tiempo previo. Ej: <code>500h</code>, <code>30m</code>.
                                </p>
                                {offsetFeedback && (
                                    <p className={`text-xs font-bold ${offsetFeedback.includes('⚠️') ? 'text-orange-500' : 'text-green-500'}`}>
                                        {offsetFeedback}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="text-right pl-4 border-l border-[#e2e8f0] dark:border-[#374151]">
                            <span className="block text-2xl font-bold text-purple-600 dark:text-purple-400">
                                +{Math.floor(initialTimeOffset / 3600)}h
                            </span>
                            <span className="text-xs text-[#64748b]">Agregados</span>
                        </div>
                    </div>
                </div>

                {/* Respaldo de Sesión (Visible solo si está activo) */}
                {isTimerActive && activeTimerRemaining !== null && (
                    <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <h4 className="text-xs font-bold text-yellow-800 dark:text-yellow-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            🛡️ Respaldo de Sesión (Emergencia)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Tarjeta 1: Tiempo Restante */}
                            <div className="bg-white dark:bg-[#1B1C1D] p-3 rounded-lg border border-yellow-100 dark:border-yellow-900 shadow-sm relative group">
                                <span className="text-[10px] text-gray-500 block mb-1">TIEMPO RESTANTE ACTUAL</span>
                                <div className="text-lg font-mono font-bold text-gray-800 dark:text-gray-200">
                                    {(() => {
                                        const d = Math.floor(activeTimerRemaining / 86400);
                                        const h = Math.floor((activeTimerRemaining % 86400) / 3600);
                                        const m = Math.floor((activeTimerRemaining % 3600) / 60);
                                        const s = activeTimerRemaining % 60;
                                        const parts = [];
                                        if (d > 0) parts.push(`${d}d`);
                                        if (h > 0) parts.push(`${h}h`);
                                        if (m > 0) parts.push(`${m}m`);
                                        parts.push(`${s}s`);
                                        return parts.join(' ') || '0s';
                                    })()}
                                </div>
                                <span className="text-[10px] text-gray-400">
                                    Valor exacto en segundos: <span className="font-mono text-gray-600 dark:text-gray-400">{activeTimerRemaining}</span>
                                </span>
                                <button 
                                    onClick={() => navigator.clipboard.writeText(activeTimerRemaining.toString())}
                                    className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                    title="Copiar segundos"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Tarjeta 2: Tiempo Transcurrido Total */}
                            <div className="bg-white dark:bg-[#1B1C1D] p-3 rounded-lg border border-yellow-100 dark:border-yellow-900 shadow-sm relative group">
                                <span className="text-[10px] text-gray-500 block mb-1">TIEMPO TRANSCURRIDO (APROX)</span>
                                <div className="text-lg font-mono font-bold text-gray-800 dark:text-gray-200">
                                    {(() => {
                                        const baseDuration = activeTotalDuration || defaultDuration;
                                        let elapsed = (baseDuration + initialTimeOffset) - activeTimerRemaining;
                                        if (elapsed < 0) elapsed = 0;
                                        
                                        const d = Math.floor(elapsed / 86400);
                                        const h = Math.floor((elapsed % 86400) / 3600);
                                        const m = Math.floor((elapsed % 3600) / 60);
                                        const s = elapsed % 60;
                                        
                                        const parts = [];
                                        if (d > 0) parts.push(`${d}d`);
                                        if (h > 0) parts.push(`${h}h`);
                                        if (m > 0) parts.push(`${m}m`);
                                        parts.push(`${s}s`);
                                        
                                        return parts.join(' ') || '0s';
                                    })()}
                                </div>
                                <span className="text-[10px] text-gray-400">
                                    Basado en duración total real + offset
                                </span>
                            </div>
                        </div>
                        <button 
                            onClick={handleCloudBackup}
                            disabled={isBackingUp}
                            className={`w-full mt-3 py-2 rounded-lg flex items-center justify-center gap-2 font-bold transition-all ${backupStatus === 'success' ? 'bg-green-500 text-white' : backupStatus === 'error' ? 'bg-red-500 text-white' : 'bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-200 hover:bg-yellow-300 dark:hover:bg-yellow-700'}`}
                        >
                            {isBackingUp ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                            ) : backupStatus === 'success' ? (
                                <><CloudUpload className="w-4 h-4" /> ¡Guardado en Servidor!</>
                            ) : backupStatus === 'error' ? (
                                '❌ Error al guardar'
                            ) : (
                                <><CloudUpload className="w-4 h-4" /> Guardar Snapshot en Base de Datos</>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Auto-iniciar */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <label htmlFor="autoStart" className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-1">
                            🚀 Auto-iniciar Timer
                        </label>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                            El timer comenzará automáticamente cuando se cargue el overlay. Ideal para eventos programados.
                        </p>
                    </div>
                    <input
                        type="checkbox"
                        id="autoStart"
                        checked={autoStart}
                        onChange={(e) => onAutoStartChange(e.target.checked)}
                        className="w-6 h-6 text-[#2563eb] rounded ml-4 flex-shrink-0"
                    />
                </div>
            </div>

            {/* Detección de Stream */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-4">
                    📡 Detección de Stream
                </h3>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
                    El timer reacciona automáticamente cuando el stream inicia o termina. Desactivado por defecto.
                </p>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <label htmlFor="autoPlayOnStreamOnline" className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-1">
                                🟢 Reanudar al iniciar stream
                            </label>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                Si el timer está en pausa, se reanuda automáticamente cuando empieces a transmitir.
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            id="autoPlayOnStreamOnline"
                            checked={autoPlayOnStreamOnline}
                            onChange={(e) => onAutoPlayOnStreamOnlineChange?.(e.target.checked)}
                            className="w-6 h-6 text-[#2563eb] rounded ml-4 flex-shrink-0"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <label htmlFor="autoStopOnStreamOffline" className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-1">
                                🔴 Pausar al terminar stream
                            </label>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                El timer se pausa automáticamente cuando termines de transmitir. El tiempo se conserva.
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            id="autoStopOnStreamOffline"
                            checked={autoStopOnStreamOffline}
                            onChange={(e) => onAutoStopOnStreamOfflineChange?.(e.target.checked)}
                            className="w-6 h-6 text-[#2563eb] rounded ml-4 flex-shrink-0"
                        />
                    </div>
                </div>
            </div>

            {/* NUEVA TARJETA: Reglas de Game Over */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                            🎮 Reglas de Game Over
                        </h3>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                            Define qué pasa cuando el timer llega a cero.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                            {enableResurrection ? 'Resurrección ACTIVA' : 'Muerte Súbita'}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={enableResurrection}
                                onChange={(e) => handleResurrectionToggle(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#94a3b8] dark:peer-focus:ring-[#64748b] rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                        </label>
                    </div>
                </div>

                {enableResurrection && (
                    <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white dark:bg-[#1a1a1a] rounded-lg shadow-sm border border-purple-100 dark:border-purple-800">
                                <span className="text-2xl">🍄</span>
                            </div>
                            <div className="flex-1">
                                <label className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider block mb-1">
                                    Vidas Extra (Chances)
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min="1"
                                        max="99"
                                        value={maxChances || 1}
                                        onChange={(e) => onMaxChancesChange?.(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-20 px-3 py-2 border border-purple-200 dark:border-purple-800 rounded-lg bg-white dark:bg-[#1a1a1a] text-purple-900 dark:text-purple-100 font-bold text-center"
                                    />
                                                                            <p className="text-xs text-purple-600 dark:text-purple-400 leading-tight">
                                                                                Si el tiempo se agota, una donación o comando podrá "revivir" el timer gastando una vida.
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                    
                                                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div>
                                                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Mensaje de Resurrección</label>
                                                                        <input 
                                                                            type="text" 
                                                                            value={resurrectionMessage}
                                                                            onChange={(e) => onResurrectionMessageChange?.(e.target.value)}
                                                                            placeholder="🍄 ¡1UP! Se usó una vida ({lives}/{max})."
                                                                            className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#1a1a1a] text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                                                        />
                                                                        <p className="text-[10px] text-[#64748b] mt-1">Variables: <code>{'{lives}'}</code> (usadas), <code>{'{max}'}</code> (totales)</p>
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Mensaje de Game Over (Sin vidas)</label>
                                                                        <input 
                                                                            type="text" 
                                                                            value={gameOverMessage}
                                                                            onChange={(e) => onGameOverMessageChange?.(e.target.value)}
                                                                            placeholder="💀 Game Over. No quedan vidas."
                                                                            className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#1a1a1a] text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}            </div>

            {/* SECCIÓN DE RECUPERACIÓN (Solo si está detenido y hay sesiones) */}
            {activeTimerStatus === 'stopped' && sessions.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-200 dark:border-blue-800 p-6 shadow-lg animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl shrink-0">
                            <RotateCcw className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide mb-3">
                                ¿Continuar Sesión Anterior?
                            </h3>

                            {/* Selector de Sesión */}
                            <select
                                value={selectedSessionId || ''}
                                onChange={(e) => setSelectedSessionId(Number(e.target.value))}
                                className="w-full text-xs border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 bg-white dark:bg-[#1B1C1D] text-gray-700 dark:text-gray-300 mb-4"
                            >
                                {sessions.map(s => {
                                    const d = new Date(s.startedAt);
                                    const dateStr = `${d.getDate()}/${d.getMonth()+1} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
                                    const initial = s.initialDuration > 0 ? ` | Ini: ${formatTimeProfessional(s.initialDuration)}` : '';
                                    const added = s.totalAddedTime > 0 ? ` | +${formatTimeProfessional(s.totalAddedTime)}` : '';
                                    const backup = s.hasBackup && s.backupRemainingSeconds !== null
                                        ? ` 💾 ${formatTimeProfessional(s.backupRemainingSeconds)} rest.`
                                        : '';
                                    return (
                                        <option key={s.id} value={s.id}>
                                            📅 #{s.id} — {dateStr}{initial}{added}{backup}
                                        </option>
                                    );
                                })}
                            </select>

                            {/* Panel de backup o restauración manual */}
                            {selectedSession?.hasBackup && selectedSession.backupRemainingSeconds !== null ? (
                                <>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                                        <div className="bg-white dark:bg-[#1B1C1D] p-2.5 rounded-lg border border-blue-100 dark:border-blue-900">
                                            <span className="text-[10px] font-bold text-gray-500 block mb-1">TIEMPO RESTANTE</span>
                                            <span className="font-mono font-bold text-blue-700 dark:text-blue-300 text-sm">
                                                {formatTimeProfessional(selectedSession.backupRemainingSeconds)}
                                            </span>
                                        </div>
                                        <div className="bg-white dark:bg-[#1B1C1D] p-2.5 rounded-lg border border-blue-100 dark:border-blue-900">
                                            <span className="text-[10px] font-bold text-gray-500 block mb-1">TIEMPO AÑADIDO</span>
                                            <span className="font-mono font-bold text-gray-800 dark:text-gray-200 text-sm">
                                                {formatTimeProfessional(selectedSession.totalAddedTime)}
                                            </span>
                                        </div>
                                        <div className="bg-white dark:bg-[#1B1C1D] p-2.5 rounded-lg border border-blue-100 dark:border-blue-900 col-span-2 sm:col-span-1">
                                            <span className="text-[10px] font-bold text-gray-500 block mb-1">RAZÓN</span>
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                {selectedSession.backupReason ? formatBackupReason(selectedSession.backupReason) : '—'}
                                            </span>
                                        </div>
                                    </div>
                                    {selectedSession.backupCreatedAt && (
                                        <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
                                            Guardado el <strong>{new Date(selectedSession.backupCreatedAt).toLocaleString()}</strong>
                                        </p>
                                    )}
                                    <button
                                        onClick={() => handleRestoreSession(selectedSession.id, true)}
                                        disabled={isRestoring}
                                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md hover:shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        {isRestoring
                                            ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Restaurando...</>
                                            : <><RotateCcw className="w-4 h-4" /> Restaurar esta sesión</>
                                        }
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-3">
                                        Sin backup automático. Indica con cuánto tiempo restaurar:
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
                                        onClick={() => selectedSession && handleRestoreSession(selectedSession.id, false)}
                                        disabled={isRestoring || parseTimeInput(manualRestoreInput) <= 0}
                                        className="w-full py-3 bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 disabled:opacity-40 text-white rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2"
                                    >
                                        {isRestoring
                                            ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Restaurando...</>
                                            : <><RotateCcw className="w-4 h-4" /> Restaurar con este tiempo</>
                                        }
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Controles del Timer - REORGANIZADO */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-4">
                    🎮 Controles del Timer
                </label>
                
                <div className="flex flex-col gap-4">
                    {/* Grupo 1: Flujo Normal (Verde/Azul/Amarillo) */}
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            onClick={() => handleTimerControl('start', defaultDuration)}
                            disabled={isTimerActive}
                            className={`py-3 text-white rounded-xl transition-all flex flex-col items-center justify-center gap-1 font-bold shadow-sm ${isTimerActive ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-200 dark:border-gray-700' : 'bg-green-500 hover:bg-green-600 hover:-translate-y-0.5 hover:shadow-green-500/20'}`}
                        >
                            <Play className="w-5 h-5" />
                            <span className="text-xs">{isTimerActive ? 'En Curso' : 'Iniciar'}</span>
                        </button>
                        
                        <button
                            onClick={() => handleTimerControl('pause')}
                            disabled={!isTimerActive || activeTimerStatus === 'paused' || activeTimerStatus === 'auto_paused' || activeTimerStatus === 'stream_paused'}
                            className="py-3 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex flex-col items-center justify-center gap-1 font-bold shadow-sm"
                        >
                            <Pause className="w-5 h-5" />
                            <span className="text-xs">Pausar</span>
                        </button>
                        
                        <button
                            onClick={() => handleTimerControl('resume')}
                            disabled={activeTimerStatus !== 'paused' && activeTimerStatus !== 'auto_paused' && activeTimerStatus !== 'stream_paused'}
                            className="py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex flex-col items-center justify-center gap-1 font-bold shadow-sm"
                        >
                            <Play className="w-5 h-5" />
                            <span className="text-xs">Reanudar</span>
                        </button>
                    </div>

                    {/* Separador Visual */}
                    <div className="h-px bg-gray-100 dark:bg-gray-800 w-full"></div>

                    {/* Grupo 2: Zona de Peligro (Naranja/Rojo) */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => {
                                if(confirm('¿Seguro que quieres REINICIAR el timer?\nSe perderá el progreso actual y volverá al tiempo inicial.')) {
                                    handleTimerControl('reset');
                                }
                            }}
                            className="py-3 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-2 border-orange-200 dark:border-orange-800 hover:bg-orange-200 dark:hover:bg-orange-900/40 rounded-xl transition-colors flex items-center justify-center gap-2 font-bold"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reiniciar
                        </button>
                        
                        <button
                            onClick={() => {
                                if(confirm('⚠️ ¿PARADA DE EMERGENCIA?\nEsto detendrá el timer inmediatamente y cerrará la sesión actual.')) {
                                handleTimerControl('stop');
                            }
                            }}
                            className="py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all flex items-center justify-center gap-2 font-bold shadow-md hover:shadow-red-600/30"
                        >
                            <StopCircle className="w-5 h-5" />
                            DETENER TODO
                        </button>
                    </div>
                </div>
            </div>

            {/* URL del Overlay */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-3">
                    🔗 URL del Overlay para OBS
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        value={overlayUrl}
                        readOnly
                        className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm font-mono"
                    />
                    <button
                        onClick={handleCopy}
                        className={`px-6 py-2 text-white rounded-lg transition-all flex items-center justify-center gap-2 font-bold whitespace-nowrap min-w-[120px] ${copied ? 'bg-green-500 scale-105' : 'bg-[#2563eb] hover:bg-[#1d4ed8]'}`}
                    >
                        {copied ? '¡Copiado!' : <><Copy className="w-4 h-4" /> Copiar</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BasicTab;