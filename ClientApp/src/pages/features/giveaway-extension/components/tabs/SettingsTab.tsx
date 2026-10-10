/**
 * SettingsTab - Configuración de anuncios, mensajes y cooldowns
 */

import React from 'react';
import { Settings, Bell, MessageCircle, Clock } from 'lucide-react';
import type { GiveawayConfig } from '../../types';

interface SettingsTabProps {
    config: GiveawayConfig;
    onUpdateConfig: (updates: Partial<GiveawayConfig>) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ config, onUpdateConfig }) => {
    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-ds-border">
                <div className="p-3 bg-ds-raised rounded-lg">
                    <Settings className="w-6 h-6 text-ds-text" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-ds-text">
                        Configuración General
                    </h2>
                    <p className="text-sm text-ds-soft">
                        Anuncios, mensajes y cooldowns
                    </p>
                </div>
            </div>

            {/* Announcements */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Bell className="w-5 h-5 text-ds-accent-text" />
                    Anuncios Automáticos
                </h3>

                <div className="space-y-3">
                    {/* Announce on Start */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">Anunciar al Iniciar</p>
                            <p className="text-xs text-ds-soft">Enviar mensaje al chat cuando inicia el giveaway</p>
                        </div>
                        <button
                            onClick={() => onUpdateConfig({ announceOnStart: !config.announceOnStart })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                config.announceOnStart
                                    ? 'bg-ds-accent text-ds-on-accent'
                                    : 'bg-ds-raised text-ds-soft '
                            }`}
                        >
                            {config.announceOnStart ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>

                    {/* Announce Reminders */}
                    <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="font-bold text-ds-text">Recordatorios</p>
                                <p className="text-xs text-ds-soft">Enviar recordatorios periódicos durante el giveaway</p>
                            </div>
                            <button
                                onClick={() => onUpdateConfig({ announceReminders: !config.announceReminders })}
                                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                    config.announceReminders
                                        ? 'bg-ds-accent text-ds-on-accent'
                                        : 'bg-ds-raised text-ds-soft '
                                }`}
                            >
                                {config.announceReminders ? 'Activado' : 'Desactivado'}
                            </button>
                        </div>
                        {config.announceReminders && (
                            <div>
                                <label className="block text-sm font-bold text-ds-soft mb-2">
                                    Intervalo (minutos)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={30}
                                    value={config.reminderIntervalMinutes}
                                    onChange={(e) => onUpdateConfig({ reminderIntervalMinutes: parseInt(e.target.value) || 3 })}
                                    className="w-full px-4 py-3 bg-ds-surface border border-ds-border rounded-lg text-ds-text"
                                />
                            </div>
                        )}
                    </div>

                    {/* Announce Participant Count */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">Mostrar Contador de Participantes</p>
                            <p className="text-xs text-ds-soft">Incluir número de participantes en anuncios</p>
                        </div>
                        <button
                            onClick={() => onUpdateConfig({ announceParticipantCount: !config.announceParticipantCount })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                config.announceParticipantCount
                                    ? 'bg-ds-accent text-ds-on-accent'
                                    : 'bg-ds-raised text-ds-soft '
                            }`}
                        >
                            {config.announceParticipantCount ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Custom Messages */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-ds-accent-text" />
                    Mensajes Personalizados
                </h3>

                <div className="p-4 bg-ds-accent/10 border border-ds-accent rounded-lg">
                    <p className="text-sm text-ds-accent-text">
                        <strong>Variables disponibles:</strong><br />
                        <code className="bg-ds-accent/10 px-2 py-1 rounded">{'{command}'}</code> - Comando de entrada<br />
                        <code className="bg-ds-accent/10 px-2 py-1 rounded">{'{prize}'}</code> - Nombre del premio<br />
                        <code className="bg-ds-accent/10 px-2 py-1 rounded">{'{count}'}</code> - Número de participantes<br />
                        <code className="bg-ds-accent/10 px-2 py-1 rounded">{'{winner}'}</code> - Nombre del ganador<br />
                        <code className="bg-ds-accent/10 px-2 py-1 rounded">{'{timeout}'}</code> - Tiempo de respuesta
                    </p>
                </div>

                <div className="space-y-4">
                    {/* Start Message */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            Mensaje de Inicio
                        </label>
                        <textarea
                            value={config.startMessage}
                            onChange={(e) => onUpdateConfig({ startMessage: e.target.value })}
                            rows={2}
                            className="w-full px-4 py-3 bg-ds-bg border border-ds-border rounded-lg text-ds-text resize-none"
                        />
                    </div>

                    {/* Reminder Message */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            Mensaje de Recordatorio
                        </label>
                        <textarea
                            value={config.reminderMessage}
                            onChange={(e) => onUpdateConfig({ reminderMessage: e.target.value })}
                            rows={2}
                            className="w-full px-4 py-3 bg-ds-bg border border-ds-border rounded-lg text-ds-text resize-none"
                        />
                    </div>

                    {/* Winner Message */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            Mensaje de Ganador
                        </label>
                        <textarea
                            value={config.winnerMessage}
                            onChange={(e) => onUpdateConfig({ winnerMessage: e.target.value })}
                            rows={2}
                            className="w-full px-4 py-3 bg-ds-bg border border-ds-border rounded-lg text-ds-text resize-none"
                        />
                    </div>

                    {/* No Response Message */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            Mensaje Sin Respuesta
                        </label>
                        <textarea
                            value={config.noResponseMessage}
                            onChange={(e) => onUpdateConfig({ noResponseMessage: e.target.value })}
                            rows={2}
                            className="w-full px-4 py-3 bg-ds-bg border border-ds-border rounded-lg text-ds-text resize-none"
                        />
                    </div>
                </div>
            </div>

            {/* Cooldowns */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Clock className="w-5 h-5 text-ds-accent-text" />
                    Cooldown de Ganadores
                </h3>

                <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="font-bold text-ds-text">Activar Cooldown</p>
                            <p className="text-xs text-ds-soft">Evitar que ganadores recientes vuelvan a ganar</p>
                        </div>
                        <button
                            onClick={() => onUpdateConfig({ winnerCooldownEnabled: !config.winnerCooldownEnabled })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                config.winnerCooldownEnabled
                                    ? 'bg-ds-warn text-ds-on-accent'
                                    : 'bg-ds-raised text-ds-soft '
                            }`}
                        >
                            {config.winnerCooldownEnabled ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>

                    {config.winnerCooldownEnabled && (
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">
                                Días de Cooldown
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={365}
                                value={config.winnerCooldownDays}
                                onChange={(e) => onUpdateConfig({ winnerCooldownDays: parseInt(e.target.value) || 7 })}
                                className="w-full px-4 py-3 bg-ds-surface border border-ds-border rounded-lg text-ds-text"
                            />
                            <p className="text-xs text-ds-soft mt-2">
                                Los ganadores no podrán participar por {config.winnerCooldownDays} días después de ganar
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
