// HistoryTab - View and configure goals history/logs

import React, { useState } from 'react';
import { History, Trash2, Download, Settings, RefreshCw, Calendar, Filter } from 'lucide-react';
import type { GoalHistoryEntry } from '../../types';

interface HistoryTabProps {
    historyEnabled: boolean;
    historyRetentionDays: number;
    resetOnStreamEnd: boolean;
    onSetHistoryEnabled: (enabled: boolean) => void;
    onSetHistoryRetentionDays: (days: number) => void;
    onSetResetOnStreamEnd: (reset: boolean) => void;
}

// Mock data for preview (in production this would come from API)
const mockHistory: GoalHistoryEntry[] = [
    {
        id: '1',
        goalId: 'goal1',
        goalName: 'Meta de Subs',
        action: 'completed',
        previousValue: 95,
        newValue: 100,
        source: 'subs',
        triggeredBy: 'viewer123',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 min ago
    },
    {
        id: '2',
        goalId: 'goal1',
        goalName: 'Meta de Subs',
        action: 'milestone',
        previousValue: 70,
        newValue: 75,
        milestoneId: 'm1',
        milestoneName: '75% completado',
        source: 'subs',
        triggeredBy: 'viewer456',
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString() // 1 hour ago
    },
    {
        id: '3',
        goalId: 'goal1',
        goalName: 'Meta de Subs',
        action: 'progress',
        previousValue: 50,
        newValue: 55,
        source: 'subs',
        triggeredBy: 'viewer789',
        timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString() // 1.5 hours ago
    },
    {
        id: '4',
        goalId: 'goal1',
        goalName: 'Meta de Subs',
        action: 'started',
        newValue: 0,
        triggeredBy: 'system',
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString() // 2 hours ago
    }
];

export const HistoryTab: React.FC<HistoryTabProps> = ({
    historyEnabled,
    historyRetentionDays,
    resetOnStreamEnd,
    onSetHistoryEnabled,
    onSetHistoryRetentionDays,
    onSetResetOnStreamEnd
}) => {
    const [showSettings, setShowSettings] = useState(false);
    const [filter, setFilter] = useState<'all' | 'milestone' | 'completed' | 'reset'>('all');

    // Format timestamp
    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const mins = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));

        if (mins < 60) return `hace ${mins}m`;
        if (hours < 24) return `hace ${hours}h`;
        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    };

    // Get action info
    const getActionInfo = (action: GoalHistoryEntry['action']) => {
        const actionMap = {
            created: { icon: '➕', label: 'Creada', color: 'text-[#64748b]' },
            started: { icon: '▶️', label: 'Iniciada', color: 'text-[#22c55e]' },
            progress: { icon: '📈', label: 'Progreso', color: 'text-[#667eea]' },
            milestone: { icon: '🏁', label: 'Milestone', color: 'text-[#f59e0b]' },
            completed: { icon: '🏆', label: 'Completada', color: 'text-[#22c55e]' },
            reset: { icon: '🔄', label: 'Reiniciada', color: 'text-[#ef4444]' },
            expired: { icon: '⏰', label: 'Expirada', color: 'text-[#94a3b8]' }
        };
        return actionMap[action];
    };

    // Filter history
    const filteredHistory = filter === 'all'
        ? mockHistory
        : mockHistory.filter(h => h.action === filter);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-xl flex items-center justify-center">
                            <History className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                Historial
                            </h2>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                Registro de eventos y cambios en las metas
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-2 rounded-lg transition-colors ${
                                showSettings
                                    ? 'bg-[#667eea] text-white'
                                    : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] hover:text-[#667eea]'
                            }`}
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                    <h3 className="text-lg font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                        Configuración del Historial
                    </h3>

                    <div className="space-y-4">
                        {/* Enable History */}
                        <label className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl cursor-pointer">
                            <div className="flex items-center gap-3">
                                <History className="w-5 h-5 text-[#667eea]" />
                                <div>
                                    <span className="text-[#1e293b] dark:text-[#f8fafc] font-medium">
                                        Guardar historial
                                    </span>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                        Registra todos los eventos de metas
                                    </p>
                                </div>
                            </div>
                            <div className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={historyEnabled}
                                    onChange={(e) => onSetHistoryEnabled(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-[#e2e8f0] dark:bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#667eea]"></div>
                            </div>
                        </label>

                        {/* Retention Days */}
                        <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl">
                            <div className="flex items-center gap-3 mb-3">
                                <Calendar className="w-5 h-5 text-[#667eea]" />
                                <span className="text-[#1e293b] dark:text-[#f8fafc] font-medium">
                                    Retención de datos
                                </span>
                            </div>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min={1}
                                    max={90}
                                    value={historyRetentionDays}
                                    onChange={(e) => onSetHistoryRetentionDays(Number(e.target.value))}
                                    className="flex-1 h-2 bg-[#e2e8f0] dark:bg-[#374151] rounded-lg appearance-none cursor-pointer accent-[#667eea]"
                                />
                                <span className="w-16 text-center font-mono text-[#1e293b] dark:text-[#f8fafc]">
                                    {historyRetentionDays} días
                                </span>
                            </div>
                            <p className="text-xs text-[#94a3b8] mt-2">
                                Los registros más antiguos serán eliminados automáticamente
                            </p>
                        </div>

                        {/* Reset on Stream End */}
                        <label className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl cursor-pointer">
                            <div className="flex items-center gap-3">
                                <RefreshCw className="w-5 h-5 text-[#f59e0b]" />
                                <div>
                                    <span className="text-[#1e293b] dark:text-[#f8fafc] font-medium">
                                        Reiniciar al terminar stream
                                    </span>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                        El progreso de metas se reinicia cuando termina el stream
                                    </p>
                                </div>
                            </div>
                            <div className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={resetOnStreamEnd}
                                    onChange={(e) => onSetResetOnStreamEnd(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-[#e2e8f0] dark:bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f59e0b]"></div>
                            </div>
                        </label>
                    </div>
                </div>
            )}

            {/* Filters and Actions */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-[#64748b]" />
                        <div className="flex gap-1">
                            {[
                                { id: 'all', label: 'Todo' },
                                { id: 'milestone', label: '🏁 Milestones' },
                                { id: 'completed', label: '🏆 Completadas' },
                                { id: 'reset', label: '🔄 Reinicios' }
                            ].map((f) => (
                                <button
                                    key={f.id}
                                    onClick={() => setFilter(f.id as typeof filter)}
                                    className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                                        filter === f.id
                                            ? 'bg-[#667eea] text-white'
                                            : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] hover:text-[#667eea] rounded-lg text-sm transition-colors">
                            <Download className="w-4 h-4" />
                            Exportar
                        </button>
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20 rounded-lg text-sm transition-colors">
                            <Trash2 className="w-4 h-4" />
                            Limpiar
                        </button>
                    </div>
                </div>
            </div>

            {/* History List */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] shadow-lg overflow-hidden">
                {historyEnabled ? (
                    filteredHistory.length > 0 ? (
                        <div className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                            {filteredHistory.map((entry) => {
                                const actionInfo = getActionInfo(entry.action);
                                return (
                                    <div
                                        key={entry.id}
                                        className="p-4 hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 bg-[#f8fafc] dark:bg-[#262626] rounded-lg flex items-center justify-center text-xl">
                                                {actionInfo.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`font-medium ${actionInfo.color}`}>
                                                        {actionInfo.label}
                                                    </span>
                                                    <span className="text-[#1e293b] dark:text-[#f8fafc]">
                                                        {entry.goalName}
                                                    </span>
                                                    {entry.milestoneName && (
                                                        <span className="text-[#64748b] dark:text-[#94a3b8]">
                                                            - {entry.milestoneName}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-sm text-[#64748b] dark:text-[#94a3b8]">
                                                    {entry.previousValue !== undefined && entry.newValue !== undefined && (
                                                        <span>
                                                            {entry.previousValue} → {entry.newValue}
                                                        </span>
                                                    )}
                                                    {entry.triggeredBy && entry.triggeredBy !== 'system' && (
                                                        <span>por @{entry.triggeredBy}</span>
                                                    )}
                                                    {entry.source && (
                                                        <span className="px-2 py-0.5 bg-[#667eea]/10 text-[#667eea] rounded text-xs">
                                                            {entry.source}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-sm text-[#94a3b8] whitespace-nowrap">
                                                {formatTime(entry.timestamp)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-[#f8fafc] dark:bg-[#262626] rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <History className="w-8 h-8 text-[#94a3b8]" />
                            </div>
                            <h3 className="text-lg font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                Sin registros
                            </h3>
                            <p className="text-[#64748b] dark:text-[#94a3b8]">
                                {filter !== 'all'
                                    ? 'No hay eventos de este tipo'
                                    : 'Los eventos aparecerán aquí cuando haya actividad en las metas'}
                            </p>
                        </div>
                    )
                ) : (
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-[#f8fafc] dark:bg-[#262626] rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <History className="w-8 h-8 text-[#94a3b8]" />
                        </div>
                        <h3 className="text-lg font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                            Historial desactivado
                        </h3>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mb-4">
                            Activa el historial para ver los eventos de metas
                        </p>
                        <button
                            onClick={() => {
                                onSetHistoryEnabled(true);
                                setShowSettings(true);
                            }}
                            className="px-4 py-2 bg-[#667eea] hover:bg-[#5a6fd6] text-white rounded-lg transition-colors"
                        >
                            Activar historial
                        </button>
                    </div>
                )}
            </div>

            {/* Info Note */}
            {historyEnabled && (
                <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 text-center text-sm text-[#64748b] dark:text-[#94a3b8]">
                    Este es un preview del historial. Los datos reales se cargarán del servidor.
                </div>
            )}
        </div>
    );
};

export default HistoryTab;
