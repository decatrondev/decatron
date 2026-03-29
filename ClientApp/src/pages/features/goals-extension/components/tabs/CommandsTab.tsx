// CommandsTab - Configure chat commands for goals

import React, { useState } from 'react';
import { MessageSquare, Plus, X, Shield, Clock, Info } from 'lucide-react';
import type { GoalsCommandsConfig } from '../../types';

interface CommandsTabProps {
    commands: GoalsCommandsConfig;
    onUpdateCommands: (updates: Partial<GoalsCommandsConfig>) => void;
}

type RoleType = 'broadcaster' | 'moderator' | 'vip';

export const CommandsTab: React.FC<CommandsTabProps> = ({
    commands,
    onUpdateCommands
}) => {
    const [newAlias, setNewAlias] = useState('');

    // Update nested command settings
    const updateMeta = (updates: Partial<GoalsCommandsConfig['meta']>) => {
        onUpdateCommands({
            meta: { ...commands.meta, ...updates }
        });
    };

    const updateMetaReset = (updates: Partial<GoalsCommandsConfig['metaReset']>) => {
        onUpdateCommands({
            metaReset: { ...commands.metaReset, ...updates }
        });
    };

    const updateMetaAdd = (updates: Partial<GoalsCommandsConfig['metaAdd']>) => {
        onUpdateCommands({
            metaAdd: { ...commands.metaAdd, ...updates }
        });
    };

    const updateMetaSet = (updates: Partial<GoalsCommandsConfig['metaSet']>) => {
        onUpdateCommands({
            metaSet: { ...commands.metaSet, ...updates }
        });
    };

    // Add alias
    const handleAddAlias = () => {
        if (!newAlias.trim()) return;
        const alias = newAlias.startsWith('!') ? newAlias : `!${newAlias}`;
        if (!commands.meta.aliases.includes(alias)) {
            updateMeta({ aliases: [...commands.meta.aliases, alias] });
        }
        setNewAlias('');
    };

    // Remove alias
    const handleRemoveAlias = (alias: string) => {
        updateMeta({ aliases: commands.meta.aliases.filter(a => a !== alias) });
    };

    // Role badge component
    const RoleBadge: React.FC<{ role: RoleType; selected: boolean; onClick: () => void }> = ({
        role,
        selected,
        onClick
    }) => {
        const roleInfo = {
            broadcaster: { icon: '👑', label: 'Broadcaster', color: 'from-[#f59e0b] to-[#d97706]' },
            moderator: { icon: '🛡️', label: 'Moderador', color: 'from-[#22c55e] to-[#16a34a]' },
            vip: { icon: '💎', label: 'VIP', color: 'from-[#a855f7] to-[#7c3aed]' }
        };
        const info = roleInfo[role];

        return (
            <button
                onClick={onClick}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                    selected
                        ? `border-transparent bg-gradient-to-r ${info.color} text-white`
                        : 'border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] hover:border-[#667eea]/50'
                }`}
            >
                <span>{info.icon}</span>
                <span className="text-sm font-medium">{info.label}</span>
            </button>
        );
    };

    // Role selector component
    const RoleSelector: React.FC<{
        allowedRoles: RoleType[];
        availableRoles: RoleType[];
        onChange: (roles: RoleType[]) => void;
    }> = ({ allowedRoles, availableRoles, onChange }) => {
        const toggleRole = (role: RoleType) => {
            if (allowedRoles.includes(role)) {
                onChange(allowedRoles.filter(r => r !== role));
            } else {
                onChange([...allowedRoles, role]);
            }
        };

        return (
            <div className="flex flex-wrap gap-2">
                {availableRoles.map(role => (
                    <RoleBadge
                        key={role}
                        role={role}
                        selected={allowedRoles.includes(role)}
                        onClick={() => toggleRole(role)}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-xl flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            Comandos de Chat
                        </h2>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            Configura los comandos para interactuar con metas desde el chat
                        </p>
                    </div>
                </div>
            </div>

            {/* !meta command */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <code className="px-3 py-1 bg-[#667eea]/10 text-[#667eea] rounded-lg font-mono font-bold">
                            !meta
                        </code>
                        <h3 className="text-lg font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                            Ver progreso
                        </h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={commands.meta.enabled}
                            onChange={(e) => updateMeta({ enabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#e2e8f0] dark:bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#667eea]"></div>
                    </label>
                </div>

                {commands.meta.enabled && (
                    <div className="space-y-4 pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                        {/* Aliases */}
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Alias del comando
                            </label>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {commands.meta.aliases.map((alias) => (
                                    <span
                                        key={alias}
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-[#667eea]/10 text-[#667eea] rounded-lg font-mono text-sm"
                                    >
                                        {alias}
                                        <button
                                            onClick={() => handleRemoveAlias(alias)}
                                            className="hover:text-[#ef4444] transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newAlias}
                                    onChange={(e) => setNewAlias(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddAlias()}
                                    placeholder="Agregar alias (ej: !goal)"
                                    className="flex-1 px-4 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] placeholder-[#94a3b8]"
                                />
                                <button
                                    onClick={handleAddAlias}
                                    className="px-4 py-2 bg-[#667eea] hover:bg-[#5a6fd6] text-white rounded-xl transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Cooldown */}
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                <Clock className="w-4 h-4 inline mr-1" />
                                Cooldown (segundos)
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min={0}
                                    max={60}
                                    value={commands.meta.cooldown}
                                    onChange={(e) => updateMeta({ cooldown: Number(e.target.value) })}
                                    className="flex-1 h-2 bg-[#e2e8f0] dark:bg-[#374151] rounded-lg appearance-none cursor-pointer accent-[#667eea]"
                                />
                                <span className="w-12 text-center font-mono text-[#1e293b] dark:text-[#f8fafc]">
                                    {commands.meta.cooldown}s
                                </span>
                            </div>
                        </div>

                        {/* Response */}
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Respuesta
                            </label>
                            <input
                                type="text"
                                value={commands.meta.response}
                                onChange={(e) => updateMeta({ response: e.target.value })}
                                className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc]"
                            />
                            <p className="text-xs text-[#94a3b8] mt-1">
                                Variables: {'{goalName}'}, {'{current}'}, {'{target}'}, {'{percentage}'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* !meta reset command */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <code className="px-3 py-1 bg-[#ef4444]/10 text-[#ef4444] rounded-lg font-mono font-bold">
                            !meta reset
                        </code>
                        <h3 className="text-lg font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                            Reiniciar meta
                        </h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={commands.metaReset.enabled}
                            onChange={(e) => updateMetaReset({ enabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#e2e8f0] dark:bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ef4444]"></div>
                    </label>
                </div>

                {commands.metaReset.enabled && (
                    <div className="pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center gap-2 mb-3">
                            <Shield className="w-4 h-4 text-[#64748b]" />
                            <label className="text-sm font-medium text-[#64748b] dark:text-[#94a3b8]">
                                Roles permitidos
                            </label>
                        </div>
                        <RoleSelector
                            allowedRoles={commands.metaReset.allowedRoles}
                            availableRoles={['broadcaster', 'moderator', 'vip']}
                            onChange={(roles) => updateMetaReset({ allowedRoles: roles })}
                        />
                        <p className="text-xs text-[#94a3b8] mt-2">
                            Uso: <code className="bg-[#262626] px-1 rounded">!meta reset</code> o <code className="bg-[#262626] px-1 rounded">!meta reset [nombre]</code>
                        </p>
                    </div>
                )}
            </div>

            {/* !meta add command */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <code className="px-3 py-1 bg-[#22c55e]/10 text-[#22c55e] rounded-lg font-mono font-bold">
                            !meta add
                        </code>
                        <h3 className="text-lg font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                            Agregar puntos
                        </h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={commands.metaAdd.enabled}
                            onChange={(e) => updateMetaAdd({ enabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#e2e8f0] dark:bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#22c55e]"></div>
                    </label>
                </div>

                {commands.metaAdd.enabled && (
                    <div className="pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center gap-2 mb-3">
                            <Shield className="w-4 h-4 text-[#64748b]" />
                            <label className="text-sm font-medium text-[#64748b] dark:text-[#94a3b8]">
                                Roles permitidos
                            </label>
                        </div>
                        <RoleSelector
                            allowedRoles={commands.metaAdd.allowedRoles}
                            availableRoles={['broadcaster', 'moderator']}
                            onChange={(roles) => updateMetaAdd({ allowedRoles: roles })}
                        />
                        <p className="text-xs text-[#94a3b8] mt-2">
                            Uso: <code className="bg-[#262626] px-1 rounded">!meta add 10</code> o <code className="bg-[#262626] px-1 rounded">!meta add 10 [nombre]</code>
                        </p>
                    </div>
                )}
            </div>

            {/* !meta set command */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <code className="px-3 py-1 bg-[#f59e0b]/10 text-[#f59e0b] rounded-lg font-mono font-bold">
                            !meta set
                        </code>
                        <h3 className="text-lg font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                            Establecer valor
                        </h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={commands.metaSet.enabled}
                            onChange={(e) => updateMetaSet({ enabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#e2e8f0] dark:bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f59e0b]"></div>
                    </label>
                </div>

                {commands.metaSet.enabled && (
                    <div className="pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center gap-2 mb-3">
                            <Shield className="w-4 h-4 text-[#64748b]" />
                            <label className="text-sm font-medium text-[#64748b] dark:text-[#94a3b8]">
                                Roles permitidos
                            </label>
                        </div>
                        <RoleSelector
                            allowedRoles={commands.metaSet.allowedRoles}
                            availableRoles={['broadcaster', 'moderator']}
                            onChange={(roles) => updateMetaSet({ allowedRoles: roles })}
                        />
                        <p className="text-xs text-[#94a3b8] mt-2">
                            Uso: <code className="bg-[#262626] px-1 rounded">!meta set 50</code> o <code className="bg-[#262626] px-1 rounded">!meta set 50 [nombre]</code>
                        </p>
                    </div>
                )}
            </div>

            {/* Command Reference */}
            <div className="bg-gradient-to-r from-[#667eea]/10 to-[#764ba2]/10 rounded-2xl border border-[#667eea]/20 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Info className="w-5 h-5 text-[#667eea]" />
                    <h4 className="font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                        Referencia de comandos
                    </h4>
                </div>
                <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                        <code className="px-2 py-1 bg-white/50 dark:bg-[#262626]/50 rounded text-[#667eea] whitespace-nowrap">
                            !meta
                        </code>
                        <span className="text-[#64748b] dark:text-[#94a3b8]">
                            Muestra el progreso de la meta activa principal
                        </span>
                    </div>
                    <div className="flex items-start gap-3">
                        <code className="px-2 py-1 bg-white/50 dark:bg-[#262626]/50 rounded text-[#667eea] whitespace-nowrap">
                            !meta [nombre]
                        </code>
                        <span className="text-[#64748b] dark:text-[#94a3b8]">
                            Muestra el progreso de una meta específica
                        </span>
                    </div>
                    <div className="flex items-start gap-3">
                        <code className="px-2 py-1 bg-white/50 dark:bg-[#262626]/50 rounded text-[#ef4444] whitespace-nowrap">
                            !meta reset
                        </code>
                        <span className="text-[#64748b] dark:text-[#94a3b8]">
                            Reinicia el progreso de la meta activa a 0
                        </span>
                    </div>
                    <div className="flex items-start gap-3">
                        <code className="px-2 py-1 bg-white/50 dark:bg-[#262626]/50 rounded text-[#22c55e] whitespace-nowrap">
                            !meta add 10
                        </code>
                        <span className="text-[#64748b] dark:text-[#94a3b8]">
                            Agrega 10 puntos a la meta activa
                        </span>
                    </div>
                    <div className="flex items-start gap-3">
                        <code className="px-2 py-1 bg-white/50 dark:bg-[#262626]/50 rounded text-[#f59e0b] whitespace-nowrap">
                            !meta set 50
                        </code>
                        <span className="text-[#64748b] dark:text-[#94a3b8]">
                            Establece el progreso de la meta a 50
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandsTab;
