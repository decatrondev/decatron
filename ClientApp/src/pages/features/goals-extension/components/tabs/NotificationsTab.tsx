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
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-ds-accent rounded-lg flex items-center justify-center">
                        <Bell className="w-5 h-5 text-ds-text" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-ds-text">
                            Notificaciones
                        </h2>
                        <p className="text-sm text-ds-soft">
                            Configura alertas visuales y sonoras para eventos de metas
                        </p>
                    </div>
                </div>
            </div>

            {/* On Progress Notifications */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5 text-ds-accent-text" />
                        <h3 className="text-lg font-semibold text-ds-text">
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
                        <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ds-accent"></div>
                    </label>
                </div>

                {notifications.onProgress.enabled && (
                    <div className="space-y-4 pt-4 border-t border-ds-border">
                        <div>
                            <label className="block text-sm font-medium text-ds-soft mb-2">
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
                                    className="flex-1 h-2 bg-ds-raised rounded-lg appearance-none cursor-pointer accent-ds-accent"
                                />
                                <span className="w-12 text-center font-mono text-ds-text">
                                    {notifications.onProgress.minProgressPercent}%
                                </span>
                            </div>
                            <p className="text-xs text-ds-soft mt-1">
                                Se mostrará notificación cada vez que se alcance este porcentaje
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-ds-soft mb-2">
                                Mensaje
                            </label>
                            <input
                                type="text"
                                value={notifications.onProgress.message}
                                onChange={(e) => updateOnProgress({ message: e.target.value })}
                                placeholder="{goalName} avanzó a {percentage}%"
                                className="w-full px-4 py-3 bg-ds-bg border border-ds-border rounded-lg text-ds-text placeholder-ds-soft"
                            />
                            <p className="text-xs text-ds-soft mt-1">
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
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-ds-ok rounded-lg flex items-center justify-center">
                            <span className="text-ds-text text-lg">🏁</span>
                        </div>
                        <h3 className="text-lg font-semibold text-ds-text">
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
                        <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ds-ok"></div>
                    </label>
                </div>

                {notifications.onMilestone.enabled && (
                    <div className="space-y-4 pt-4 border-t border-ds-border">
                        <div>
                            <label className="block text-sm font-medium text-ds-soft mb-2">
                                Mensaje
                            </label>
                            <input
                                type="text"
                                value={notifications.onMilestone.message}
                                onChange={(e) => updateOnMilestone({ message: e.target.value })}
                                placeholder="🎯 ¡Milestone alcanzado: {milestoneName}!"
                                className="w-full px-4 py-3 bg-ds-bg border border-ds-border rounded-lg text-ds-text placeholder-ds-soft"
                            />
                            <p className="text-xs text-ds-soft mt-1">
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
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-ds-accent rounded-lg flex items-center justify-center">
                            <span className="text-ds-text text-lg">🏆</span>
                        </div>
                        <h3 className="text-lg font-semibold text-ds-text">
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
                        <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ds-warn"></div>
                    </label>
                </div>

                {notifications.onComplete.enabled && (
                    <div className="space-y-4 pt-4 border-t border-ds-border">
                        <div>
                            <label className="block text-sm font-medium text-ds-soft mb-2">
                                Mensaje
                            </label>
                            <input
                                type="text"
                                value={notifications.onComplete.message}
                                onChange={(e) => updateOnComplete({ message: e.target.value })}
                                placeholder="🏆 ¡META COMPLETADA: {goalName}!"
                                className="w-full px-4 py-3 bg-ds-bg border border-ds-border rounded-lg text-ds-text placeholder-ds-soft"
                            />
                            <p className="text-xs text-ds-soft mt-1">
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
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <MessageSquare className="w-5 h-5 text-ds-accent-text" />
                        <h3 className="text-lg font-semibold text-ds-text">
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
                        <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ds-accent"></div>
                    </label>
                </div>

                {notifications.chatAnnouncements.enabled && (
                    <div className="space-y-3 pt-4 border-t border-ds-border">
                        <p className="text-sm text-ds-soft">
                            El bot anunciará en el chat cuando:
                        </p>

                        <label className="flex items-center gap-3 p-3 bg-ds-bg rounded-lg cursor-pointer hover:bg-ds-raised transition-colors">
                            <input
                                type="checkbox"
                                checked={notifications.chatAnnouncements.onMilestone}
                                onChange={(e) => updateChatAnnouncements({ onMilestone: e.target.checked })}
                                className="w-4 h-4 rounded border-ds-border text-ds-accent-text focus:ring-ds-accent"
                            />
                            <div>
                                <span className="text-ds-text font-medium">
                                    🏁 Se alcanza un milestone
                                </span>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 bg-ds-bg rounded-lg cursor-pointer hover:bg-ds-raised transition-colors">
                            <input
                                type="checkbox"
                                checked={notifications.chatAnnouncements.onComplete}
                                onChange={(e) => updateChatAnnouncements({ onComplete: e.target.checked })}
                                className="w-4 h-4 rounded border-ds-border text-ds-accent-text focus:ring-ds-accent"
                            />
                            <div>
                                <span className="text-ds-text font-medium">
                                    🏆 Se completa una meta
                                </span>
                            </div>
                        </label>
                    </div>
                )}
            </div>

            {/* Info Card - Variables */}
            <div className="bg-ds-accent/10 rounded-lg border border-ds-accent/20 p-6">
                <h4 className="font-semibold text-ds-text mb-3 flex items-center gap-2">
                    <Info className="w-4 h-4 text-ds-accent-text" />
                    Variables disponibles
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div className="bg-ds-surface/50 rounded-lg p-2">
                        <code className="text-ds-accent-text">{'{goalName}'}</code>
                        <span className="text-ds-soft block text-xs">Nombre de la meta</span>
                    </div>
                    <div className="bg-ds-surface/50 rounded-lg p-2">
                        <code className="text-ds-accent-text">{'{milestoneName}'}</code>
                        <span className="text-ds-soft block text-xs">Nombre del milestone</span>
                    </div>
                    <div className="bg-ds-surface/50 rounded-lg p-2">
                        <code className="text-ds-accent-text">{'{percentage}'}</code>
                        <span className="text-ds-soft block text-xs">Porcentaje completado</span>
                    </div>
                    <div className="bg-ds-surface/50 rounded-lg p-2">
                        <code className="text-ds-accent-text">{'{current}'}</code>
                        <span className="text-ds-soft block text-xs">Valor actual</span>
                    </div>
                    <div className="bg-ds-surface/50 rounded-lg p-2">
                        <code className="text-ds-accent-text">{'{target}'}</code>
                        <span className="text-ds-soft block text-xs">Valor objetivo</span>
                    </div>
                    <div className="bg-ds-surface/50 rounded-lg p-2">
                        <code className="text-ds-accent-text">{'{totalTime}'}</code>
                        <span className="text-ds-soft block text-xs">Tiempo total</span>
                    </div>
                </div>
            </div>

            {/* Audio Tip */}
            <div className="bg-ds-accent/10 border border-ds-accent rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <Volume2 className="w-5 h-5 text-ds-accent-text mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-ds-accent-text mb-1">
                            Gestión de Sonidos
                        </h4>
                        <p className="text-sm text-ds-accent-text">
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
