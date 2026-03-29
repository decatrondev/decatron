/**
 * CreateTab - Tab para crear/configurar un nuevo giveaway
 */

import React from 'react';
import { Gift, Clock, Users, Trophy } from 'lucide-react';
import type { GiveawayConfig } from '../../types';

interface CreateTabProps {
    config: GiveawayConfig;
    onUpdateConfig: (updates: Partial<GiveawayConfig>) => void;
}

export const CreateTab: React.FC<CreateTabProps> = ({ config, onUpdateConfig }) => {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-[#e2e8f0] dark:border-[#374151]">
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <Gift className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                        Crear Giveaway
                    </h2>
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                        Configura los detalles básicos de tu sorteo
                    </p>
                </div>
            </div>

            {/* Información del Premio */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Información del Premio
                </h3>

                <div className="grid grid-cols-1 gap-4">
                    {/* Nombre del Giveaway */}
                    <div>
                        <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Nombre del Giveaway
                        </label>
                        <input
                            type="text"
                            value={config.name}
                            onChange={(e) => onUpdateConfig({ name: e.target.value })}
                            placeholder="Ej: Sorteo de Navidad"
                            className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                    </div>

                    {/* Nombre del Premio */}
                    <div>
                        <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Nombre del Premio *
                        </label>
                        <input
                            type="text"
                            value={config.prizeName}
                            onChange={(e) => onUpdateConfig({ prizeName: e.target.value })}
                            placeholder="Ej: Steam Deck, $50 Amazon, Teclado Mecánico"
                            className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                    </div>

                    {/* Descripción del Premio */}
                    <div>
                        <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Descripción del Premio (Opcional)
                        </label>
                        <textarea
                            value={config.prizeDescription || ''}
                            onChange={(e) => onUpdateConfig({ prizeDescription: e.target.value })}
                            placeholder="Detalles adicionales sobre el premio..."
                            rows={3}
                            className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-slate-500 resize-none"
                        />
                    </div>
                </div>
            </div>

            {/* Duración */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-500" />
                    Duración
                </h3>

                <div className="space-y-4">
                    {/* Tipo de duración */}
                    <div className="flex gap-4">
                        <button
                            onClick={() => onUpdateConfig({ durationType: 'timed' })}
                            className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all ${
                                config.durationType === 'timed'
                                    ? 'bg-slate-700 text-white shadow-lg'
                                    : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                            }`}
                        >
                            ⏱️ Con Tiempo Límite
                        </button>
                        <button
                            onClick={() => onUpdateConfig({ durationType: 'manual' })}
                            className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all ${
                                config.durationType === 'manual'
                                    ? 'bg-slate-700 text-white shadow-lg'
                                    : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                            }`}
                        >
                            ✋ Manual
                        </button>
                    </div>

                    {/* Duración en minutos (solo si es timed) */}
                    {config.durationType === 'timed' && (
                        <div>
                            <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Duración (minutos)
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={1440}
                                value={config.durationMinutes}
                                onChange={(e) => onUpdateConfig({ durationMinutes: parseInt(e.target.value) || 10 })}
                                className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                El giveaway finalizará automáticamente después de {config.durationMinutes} minutos
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Participantes */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Users className="w-5 h-5 text-green-500" />
                    Participantes
                </h3>

                <div className="space-y-4">
                    {/* Comando de entrada */}
                    <div>
                        <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Comando de Entrada
                        </label>
                        <input
                            type="text"
                            value={config.entryCommand}
                            onChange={(e) => onUpdateConfig({ entryCommand: e.target.value })}
                            placeholder="!join"
                            className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </div>

                    {/* Entrada automática */}
                    <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <div>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Entrada Automática</p>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                Cualquiera que escriba en chat entra automáticamente
                            </p>
                        </div>
                        <button
                            onClick={() => onUpdateConfig({ allowAutoEntry: !config.allowAutoEntry })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                config.allowAutoEntry
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            {config.allowAutoEntry ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>

                    {/* Múltiples entradas */}
                    <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <div>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Permitir Múltiples Entradas</p>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                Un usuario puede usar el comando varias veces
                            </p>
                        </div>
                        <button
                            onClick={() => onUpdateConfig({ allowMultipleEntries: !config.allowMultipleEntries })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                config.allowMultipleEntries
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            {config.allowMultipleEntries ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>

                    {/* Límite de participantes */}
                    <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex-1 mr-4">
                            <div className="flex items-center gap-2 mb-2">
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Límite de Participantes</p>
                                <button
                                    onClick={() => onUpdateConfig({ maxParticipantsEnabled: !config.maxParticipantsEnabled })}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                        config.maxParticipantsEnabled
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                    }`}
                                >
                                    {config.maxParticipantsEnabled ? 'ON' : 'OFF'}
                                </button>
                            </div>
                            {config.maxParticipantsEnabled && (
                                <input
                                    type="number"
                                    min={1}
                                    value={config.maxParticipants}
                                    onChange={(e) => onUpdateConfig({ maxParticipants: parseInt(e.target.value) || 100 })}
                                    className="w-full px-3 py-2 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc]"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Ganadores */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    Ganadores
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Número de ganadores */}
                    <div>
                        <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Número de Ganadores
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={10}
                            value={config.numberOfWinners}
                            onChange={(e) => onUpdateConfig({ numberOfWinners: parseInt(e.target.value) || 1 })}
                            className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                    </div>

                    {/* Ganadores de respaldo */}
                    <div>
                        <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Ganadores de Respaldo
                        </label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => onUpdateConfig({ hasBackupWinners: !config.hasBackupWinners })}
                                className={`px-4 py-3 rounded-xl font-bold transition-all ${
                                    config.hasBackupWinners
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                }`}
                            >
                                {config.hasBackupWinners ? 'Activado' : 'Desactivado'}
                            </button>
                            {config.hasBackupWinners && (
                                <input
                                    type="number"
                                    min={1}
                                    max={5}
                                    value={config.numberOfBackupWinners}
                                    onChange={(e) => onUpdateConfig({ numberOfBackupWinners: parseInt(e.target.value) || 1 })}
                                    className="flex-1 px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc]"
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Timeout de respuesta */}
                <div>
                    <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                        Tiempo de Respuesta (segundos)
                    </label>
                    <input
                        type="number"
                        min={10}
                        max={300}
                        value={config.winnerResponseTimeout}
                        onChange={(e) => onUpdateConfig({ winnerResponseTimeout: parseInt(e.target.value) || 60 })}
                        className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                        Tiempo que tiene el ganador para responder antes de ser descalificado
                    </p>
                </div>

                {/* Auto reroll */}
                <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                    <div>
                        <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Re-sorteo Automático</p>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            Sortear nuevo ganador si no responde a tiempo
                        </p>
                    </div>
                    <button
                        onClick={() => onUpdateConfig({ autoRerollOnTimeout: !config.autoRerollOnTimeout })}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${
                            config.autoRerollOnTimeout
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                    >
                        {config.autoRerollOnTimeout ? 'Activado' : 'Desactivado'}
                    </button>
                </div>
            </div>
        </div>
    );
};
