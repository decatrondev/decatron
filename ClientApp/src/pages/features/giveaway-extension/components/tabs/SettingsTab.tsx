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
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-[#e2e8f0] dark:border-[#374151]">
                <div className="p-3 bg-gradient-to-r from-gray-500 to-gray-700 rounded-xl">
                    <Settings className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                        Configuración General
                    </h2>
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                        Anuncios, mensajes y cooldowns
                    </p>
                </div>
            </div>

            {/* Announcements */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Bell className="w-5 h-5 text-blue-500" />
                    Anuncios Automáticos
                </h3>

                <div className="space-y-3">
                    {/* Announce on Start */}
                    <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <div>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Anunciar al Iniciar</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Enviar mensaje al chat cuando inicia el giveaway</p>
                        </div>
                        <button
                            onClick={() => onUpdateConfig({ announceOnStart: !config.announceOnStart })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                config.announceOnStart
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            {config.announceOnStart ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>

                    {/* Announce Reminders */}
                    <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Recordatorios</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Enviar recordatorios periódicos durante el giveaway</p>
                            </div>
                            <button
                                onClick={() => onUpdateConfig({ announceReminders: !config.announceReminders })}
                                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                    config.announceReminders
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                }`}
                            >
                                {config.announceReminders ? 'Activado' : 'Desactivado'}
                            </button>
                        </div>
                        {config.announceReminders && (
                            <div>
                                <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                                    Intervalo (minutos)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={30}
                                    value={config.reminderIntervalMinutes}
                                    onChange={(e) => onUpdateConfig({ reminderIntervalMinutes: parseInt(e.target.value) || 3 })}
                                    className="w-full px-4 py-3 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc]"
                                />
                            </div>
                        )}
                    </div>

                    {/* Announce Participant Count */}
                    <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <div>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Mostrar Contador de Participantes</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Incluir número de participantes en anuncios</p>
                        </div>
                        <button
                            onClick={() => onUpdateConfig({ announceParticipantCount: !config.announceParticipantCount })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                config.announceParticipantCount
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            {config.announceParticipantCount ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Custom Messages */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-purple-500" />
                    Mensajes Personalizados
                </h3>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>Variables disponibles:</strong><br />
                        <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">{'{command}'}</code> - Comando de entrada<br />
                        <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">{'{prize}'}</code> - Nombre del premio<br />
                        <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">{'{count}'}</code> - Número de participantes<br />
                        <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">{'{winner}'}</code> - Nombre del ganador<br />
                        <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">{'{timeout}'}</code> - Tiempo de respuesta
                    </p>
                </div>

                <div className="space-y-4">
                    {/* Start Message */}
                    <div>
                        <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Mensaje de Inicio
                        </label>
                        <textarea
                            value={config.startMessage}
                            onChange={(e) => onUpdateConfig({ startMessage: e.target.value })}
                            rows={2}
                            className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] resize-none"
                        />
                    </div>

                    {/* Reminder Message */}
                    <div>
                        <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Mensaje de Recordatorio
                        </label>
                        <textarea
                            value={config.reminderMessage}
                            onChange={(e) => onUpdateConfig({ reminderMessage: e.target.value })}
                            rows={2}
                            className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] resize-none"
                        />
                    </div>

                    {/* Winner Message */}
                    <div>
                        <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Mensaje de Ganador
                        </label>
                        <textarea
                            value={config.winnerMessage}
                            onChange={(e) => onUpdateConfig({ winnerMessage: e.target.value })}
                            rows={2}
                            className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] resize-none"
                        />
                    </div>

                    {/* No Response Message */}
                    <div>
                        <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Mensaje Sin Respuesta
                        </label>
                        <textarea
                            value={config.noResponseMessage}
                            onChange={(e) => onUpdateConfig({ noResponseMessage: e.target.value })}
                            rows={2}
                            className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] resize-none"
                        />
                    </div>
                </div>
            </div>

            {/* Cooldowns */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-500" />
                    Cooldown de Ganadores
                </h3>

                <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Activar Cooldown</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Evitar que ganadores recientes vuelvan a ganar</p>
                        </div>
                        <button
                            onClick={() => onUpdateConfig({ winnerCooldownEnabled: !config.winnerCooldownEnabled })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                config.winnerCooldownEnabled
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            {config.winnerCooldownEnabled ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>

                    {config.winnerCooldownEnabled && (
                        <div>
                            <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Días de Cooldown
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={365}
                                value={config.winnerCooldownDays}
                                onChange={(e) => onUpdateConfig({ winnerCooldownDays: parseInt(e.target.value) || 7 })}
                                className="w-full px-4 py-3 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc]"
                            />
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">
                                Los ganadores no podrán participar por {config.winnerCooldownDays} días después de ganar
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
