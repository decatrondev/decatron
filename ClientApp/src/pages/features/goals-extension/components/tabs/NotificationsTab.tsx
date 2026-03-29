// NotificationsTab - Configure visual and audio notifications for goals

import React from 'react';
import { Bell, MessageSquare, Sparkles, Info, Volume2 } from 'lucide-react';
import type { GoalsNotificationsConfig } from '../../types';
import TimeUnitInput from '../TimeUnitInput';
import MediaInputWithSelector from '../../../../../components/timer/MediaInputWithSelector';

interface NotificationsTabProps {
    notifications: GoalsNotificationsConfig;
    onUpdateNotifications: (updates: Partial<GoalsNotificationsConfig>) => void;
}

export const NotificationsTab: React.FC<NotificationsTabProps> = ({
    notifications,
    onUpdateNotifications
}) => {
    // Update nested notification settings
    const updateOnProgress = (updates: Partial<GoalsNotificationsConfig['onProgress']>) => {
        onUpdateNotifications({
            onProgress: { ...notifications.onProgress, ...updates }
        });
    };

    const updateOnMilestone = (updates: Partial<GoalsNotificationsConfig['onMilestone']>) => {
        onUpdateNotifications({
            onMilestone: { ...notifications.onMilestone, ...updates }
        });
    };

    const updateOnComplete = (updates: Partial<GoalsNotificationsConfig['onComplete']>) => {
        onUpdateNotifications({
            onComplete: { ...notifications.onComplete, ...updates }
        });
    };

    const updateChatAnnouncements = (updates: Partial<GoalsNotificationsConfig['chatAnnouncements']>) => {
        onUpdateNotifications({
            chatAnnouncements: { ...notifications.chatAnnouncements, ...updates }
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#f59e0b] to-[#d97706] rounded-xl flex items-center justify-center">
                        <Bell className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            Notificaciones
                        </h2>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            Configura alertas visuales y sonoras para eventos de metas
                        </p>
                    </div>
                </div>
            </div>

            {/* On Progress Notifications */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5 text-[#667eea]" />
                        <h3 className="text-lg font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                            Al Avanzar
                        </h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={notifications.onProgress.enabled}
                            onChange={(e) => updateOnProgress({ enabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#e2e8f0] dark:bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#667eea]"></div>
                    </label>
                </div>

                {notifications.onProgress.enabled && (
                    <div className="space-y-4 pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Notificar cada (%)
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min={5}
                                    max={50}
                                    step={5}
                                    value={notifications.onProgress.minProgressPercent}
                                    onChange={(e) => updateOnProgress({ minProgressPercent: Number(e.target.value) })}
                                    className="flex-1 h-2 bg-[#e2e8f0] dark:bg-[#374151] rounded-lg appearance-none cursor-pointer accent-[#667eea]"
                                />
                                <span className="w-12 text-center font-mono text-[#1e293b] dark:text-[#f8fafc]">
                                    {notifications.onProgress.minProgressPercent}%
                                </span>
                            </div>
                            <p className="text-xs text-[#94a3b8] mt-1">
                                Se mostrará notificación cada vez que se alcance este porcentaje
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Mensaje
                            </label>
                            <input
                                type="text"
                                value={notifications.onProgress.message}
                                onChange={(e) => updateOnProgress({ message: e.target.value })}
                                placeholder="{goalName} avanzó a {percentage}%"
                                className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] placeholder-[#94a3b8]"
                            />
                            <p className="text-xs text-[#94a3b8] mt-1">
                                Variables: {'{goalName}'}, {'{percentage}'}, {'{current}'}, {'{target}'}
                            </p>
                        </div>

                        <MediaInputWithSelector
                            label="Sonido de notificación"
                            value={notifications.onProgress.sound || ''}
                            onChange={(url) => updateOnProgress({ sound: url || undefined })}
                            placeholder="Selecciona o ingresa URL del sonido"
                            allowedTypes={['audio']}
                        />
                    </div>
                )}
            </div>

            {/* On Milestone Notifications */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#22c55e] rounded-lg flex items-center justify-center">
                            <span className="text-white text-lg">🏁</span>
                        </div>
                        <h3 className="text-lg font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                            Al Alcanzar Milestone
                        </h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={notifications.onMilestone.enabled}
                            onChange={(e) => updateOnMilestone({ enabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#e2e8f0] dark:bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#22c55e]"></div>
                    </label>
                </div>

                {notifications.onMilestone.enabled && (
                    <div className="space-y-4 pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Mensaje
                            </label>
                            <input
                                type="text"
                                value={notifications.onMilestone.message}
                                onChange={(e) => updateOnMilestone({ message: e.target.value })}
                                placeholder="🎯 ¡Milestone alcanzado: {milestoneName}!"
                                className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] placeholder-[#94a3b8]"
                            />
                            <p className="text-xs text-[#94a3b8] mt-1">
                                Variables: {'{goalName}'}, {'{milestoneName}'}, {'{percentage}'}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TimeUnitInput
                                label="Duración de la alerta"
                                value={Math.floor(notifications.onMilestone.duration / 1000)}
                                onChange={(seconds) => updateOnMilestone({ duration: seconds * 1000 })}
                            />

                            <MediaInputWithSelector
                                label="Sonido"
                                value={notifications.onMilestone.sound || ''}
                                onChange={(url) => updateOnMilestone({ sound: url || undefined })}
                                placeholder="Selecciona sonido"
                                allowedTypes={['audio']}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* On Complete Notifications */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-[#f59e0b] to-[#ef4444] rounded-lg flex items-center justify-center">
                            <span className="text-white text-lg">🏆</span>
                        </div>
                        <h3 className="text-lg font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                            Al Completar Meta
                        </h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={notifications.onComplete.enabled}
                            onChange={(e) => updateOnComplete({ enabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#e2e8f0] dark:bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f59e0b]"></div>
                    </label>
                </div>

                {notifications.onComplete.enabled && (
                    <div className="space-y-4 pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Mensaje
                            </label>
                            <input
                                type="text"
                                value={notifications.onComplete.message}
                                onChange={(e) => updateOnComplete({ message: e.target.value })}
                                placeholder="🏆 ¡META COMPLETADA: {goalName}!"
                                className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] placeholder-[#94a3b8]"
                            />
                            <p className="text-xs text-[#94a3b8] mt-1">
                                Variables: {'{goalName}'}, {'{target}'}, {'{totalTime}'}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TimeUnitInput
                                label="Duración de la alerta"
                                value={Math.floor(notifications.onComplete.duration / 1000)}
                                onChange={(seconds) => updateOnComplete({ duration: seconds * 1000 })}
                            />

                            <MediaInputWithSelector
                                label="Sonido"
                                value={notifications.onComplete.sound || ''}
                                onChange={(url) => updateOnComplete({ sound: url || undefined })}
                                placeholder="Selecciona sonido"
                                allowedTypes={['audio']}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Chat Announcements */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <MessageSquare className="w-5 h-5 text-[#667eea]" />
                        <h3 className="text-lg font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                            Anuncios en Chat
                        </h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={notifications.chatAnnouncements.enabled}
                            onChange={(e) => updateChatAnnouncements({ enabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#e2e8f0] dark:bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#667eea]"></div>
                    </label>
                </div>

                {notifications.chatAnnouncements.enabled && (
                    <div className="space-y-3 pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            El bot anunciará en el chat cuando:
                        </p>

                        <label className="flex items-center gap-3 p-3 bg-[#f8fafc] dark:bg-[#262626] rounded-lg cursor-pointer hover:bg-[#f1f5f9] dark:hover:bg-[#333333] transition-colors">
                            <input
                                type="checkbox"
                                checked={notifications.chatAnnouncements.onMilestone}
                                onChange={(e) => updateChatAnnouncements({ onMilestone: e.target.checked })}
                                className="w-4 h-4 rounded border-[#e2e8f0] text-[#667eea] focus:ring-[#667eea]"
                            />
                            <div>
                                <span className="text-[#1e293b] dark:text-[#f8fafc] font-medium">
                                    🏁 Se alcanza un milestone
                                </span>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 bg-[#f8fafc] dark:bg-[#262626] rounded-lg cursor-pointer hover:bg-[#f1f5f9] dark:hover:bg-[#333333] transition-colors">
                            <input
                                type="checkbox"
                                checked={notifications.chatAnnouncements.onComplete}
                                onChange={(e) => updateChatAnnouncements({ onComplete: e.target.checked })}
                                className="w-4 h-4 rounded border-[#e2e8f0] text-[#667eea] focus:ring-[#667eea]"
                            />
                            <div>
                                <span className="text-[#1e293b] dark:text-[#f8fafc] font-medium">
                                    🏆 Se completa una meta
                                </span>
                            </div>
                        </label>
                    </div>
                )}
            </div>

            {/* Info Card - Variables */}
            <div className="bg-gradient-to-r from-[#667eea]/10 to-[#764ba2]/10 rounded-2xl border border-[#667eea]/20 p-6">
                <h4 className="font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-3 flex items-center gap-2">
                    <Info className="w-4 h-4 text-[#667eea]" />
                    Variables disponibles
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div className="bg-white/50 dark:bg-[#262626]/50 rounded-lg p-2">
                        <code className="text-[#667eea]">{'{goalName}'}</code>
                        <span className="text-[#64748b] block text-xs">Nombre de la meta</span>
                    </div>
                    <div className="bg-white/50 dark:bg-[#262626]/50 rounded-lg p-2">
                        <code className="text-[#667eea]">{'{milestoneName}'}</code>
                        <span className="text-[#64748b] block text-xs">Nombre del milestone</span>
                    </div>
                    <div className="bg-white/50 dark:bg-[#262626]/50 rounded-lg p-2">
                        <code className="text-[#667eea]">{'{percentage}'}</code>
                        <span className="text-[#64748b] block text-xs">Porcentaje completado</span>
                    </div>
                    <div className="bg-white/50 dark:bg-[#262626]/50 rounded-lg p-2">
                        <code className="text-[#667eea]">{'{current}'}</code>
                        <span className="text-[#64748b] block text-xs">Valor actual</span>
                    </div>
                    <div className="bg-white/50 dark:bg-[#262626]/50 rounded-lg p-2">
                        <code className="text-[#667eea]">{'{target}'}</code>
                        <span className="text-[#64748b] block text-xs">Valor objetivo</span>
                    </div>
                    <div className="bg-white/50 dark:bg-[#262626]/50 rounded-lg p-2">
                        <code className="text-[#667eea]">{'{totalTime}'}</code>
                        <span className="text-[#64748b] block text-xs">Tiempo total</span>
                    </div>
                </div>
            </div>

            {/* Audio Tip */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                    <Volume2 className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-1">
                            Gestión de Sonidos
                        </h4>
                        <p className="text-sm text-blue-600 dark:text-blue-300">
                            Usa la pestaña "📁 Media" para subir y organizar tus archivos de audio.
                            Luego podrás seleccionarlos desde la galería en cada notificación.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationsTab;
