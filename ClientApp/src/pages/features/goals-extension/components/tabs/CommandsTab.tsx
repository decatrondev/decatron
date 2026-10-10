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
            broadcaster: { icon: '👑', label: 'Broadcaster', color: 'from-ds-accent to-ds-accent' },
            moderator: { icon: '🛡️', label: 'Moderador', color: 'from-ds-accent to-ds-accent' },
            vip: { icon: '💎', label: 'VIP', color: 'from-ds-accent to-ds-accent' }
        };
        const info = roleInfo[role];

        return (
            <button
                onClick={onClick}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                    selected
                        ? `border-transparent bg-gradient-to-r ${info.color} text-ds-text`
                        : 'border-ds-border bg-ds-bg text-ds-soft hover:border-ds-accent/50'
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
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-ds-accent rounded-lg flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-ds-text" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-ds-text">
                            Comandos de Chat
                        </h2>
                        <p className="text-sm text-ds-soft">
                            Configura los comandos para interactuar con metas desde el chat
                        </p>
                    </div>
                </div>
            </div>

            {/* !meta command */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <code className="px-3 py-1 bg-ds-accent/10 text-ds-accent-text rounded-lg font-mono font-bold">
                            !meta
                        </code>
                        <h3 className="text-lg font-semibold text-ds-text">
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
                        <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ds-accent"></div>
                    </label>
                </div>

                {commands.meta.enabled && (
                    <div className="space-y-4 pt-4 border-t border-ds-border">
                        {/* Aliases */}
                        <div>
                            <label className="block text-sm font-medium text-ds-soft mb-2">
                                Alias del comando
                            </label>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {commands.meta.aliases.map((alias) => (
                                    <span
                                        key={alias}
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-ds-accent/10 text-ds-accent-text rounded-lg font-mono text-sm"
                                    >
                                        {alias}
                                        <button
                                            onClick={() => handleRemoveAlias(alias)}
                                            className="hover:text-ds-danger transition-colors"
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
                                    className="flex-1 px-4 py-2 bg-ds-bg border border-ds-border rounded-lg text-ds-text placeholder-ds-soft"
                                />
                                <button
                                    onClick={handleAddAlias}
                                    className="px-4 py-2 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent rounded-lg transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Cooldown */}
                        <div>
                            <label className="block text-sm font-medium text-ds-soft mb-2">
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
                                    className="flex-1 h-2 bg-ds-raised rounded-lg appearance-none cursor-pointer accent-ds-accent"
                                />
                                <span className="w-12 text-center font-mono text-ds-text">
                                    {commands.meta.cooldown}s
                                </span>
                            </div>
                        </div>

                        {/* Response */}
                        <div>
                            <label className="block text-sm font-medium text-ds-soft mb-2">
                                Respuesta
                            </label>
                            <input
                                type="text"
                                value={commands.meta.response}
                                onChange={(e) => updateMeta({ response: e.target.value })}
                                className="w-full px-4 py-3 bg-ds-bg border border-ds-border rounded-lg text-ds-text"
                            />
                            <p className="text-xs text-ds-soft mt-1">
                                Variables: {'{goalName}'}, {'{current}'}, {'{target}'}, {'{percentage}'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* !meta reset command */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <code className="px-3 py-1 bg-ds-danger-solid/10 text-ds-danger rounded-lg font-mono font-bold">
                            !meta reset
                        </code>
                        <h3 className="text-lg font-semibold text-ds-text">
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
                        <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ds-danger-solid"></div>
                    </label>
                </div>

                {commands.metaReset.enabled && (
                    <div className="pt-4 border-t border-ds-border">
                        <div className="flex items-center gap-2 mb-3">
                            <Shield className="w-4 h-4 text-ds-soft" />
                            <label className="text-sm font-medium text-ds-soft">
                                Roles permitidos
                            </label>
                        </div>
                        <RoleSelector
                            allowedRoles={commands.metaReset.allowedRoles}
                            availableRoles={['broadcaster', 'moderator', 'vip']}
                            onChange={(roles) => updateMetaReset({ allowedRoles: roles })}
                        />
                        <p className="text-xs text-ds-soft mt-2">
                            Uso: <code className="bg-ds-bg px-1 rounded">!meta reset</code> o <code className="bg-ds-bg px-1 rounded">!meta reset [nombre]</code>
                        </p>
                    </div>
                )}
            </div>

            {/* !meta add command */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <code className="px-3 py-1 bg-ds-ok/10 text-ds-ok rounded-lg font-mono font-bold">
                            !meta add
                        </code>
                        <h3 className="text-lg font-semibold text-ds-text">
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
                        <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ds-ok"></div>
                    </label>
                </div>

                {commands.metaAdd.enabled && (
                    <div className="pt-4 border-t border-ds-border">
                        <div className="flex items-center gap-2 mb-3">
                            <Shield className="w-4 h-4 text-ds-soft" />
                            <label className="text-sm font-medium text-ds-soft">
                                Roles permitidos
                            </label>
                        </div>
                        <RoleSelector
                            allowedRoles={commands.metaAdd.allowedRoles}
                            availableRoles={['broadcaster', 'moderator']}
                            onChange={(roles) => updateMetaAdd({ allowedRoles: roles })}
                        />
                        <p className="text-xs text-ds-soft mt-2">
                            Uso: <code className="bg-ds-bg px-1 rounded">!meta add 10</code> o <code className="bg-ds-bg px-1 rounded">!meta add 10 [nombre]</code>
                        </p>
                    </div>
                )}
            </div>

            {/* !meta set command */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <code className="px-3 py-1 bg-ds-warn/10 text-ds-warn rounded-lg font-mono font-bold">
                            !meta set
                        </code>
                        <h3 className="text-lg font-semibold text-ds-text">
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
                        <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ds-warn"></div>
                    </label>
                </div>

                {commands.metaSet.enabled && (
                    <div className="pt-4 border-t border-ds-border">
                        <div className="flex items-center gap-2 mb-3">
                            <Shield className="w-4 h-4 text-ds-soft" />
                            <label className="text-sm font-medium text-ds-soft">
                                Roles permitidos
                            </label>
                        </div>
                        <RoleSelector
                            allowedRoles={commands.metaSet.allowedRoles}
                            availableRoles={['broadcaster', 'moderator']}
                            onChange={(roles) => updateMetaSet({ allowedRoles: roles })}
                        />
                        <p className="text-xs text-ds-soft mt-2">
                            Uso: <code className="bg-ds-bg px-1 rounded">!meta set 50</code> o <code className="bg-ds-bg px-1 rounded">!meta set 50 [nombre]</code>
                        </p>
                    </div>
                )}
            </div>

            {/* Command Reference */}
            <div className="bg-ds-accent/10 rounded-lg border border-ds-accent/20 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Info className="w-5 h-5 text-ds-accent-text" />
                    <h4 className="font-semibold text-ds-text">
                        Referencia de comandos
                    </h4>
                </div>
                <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                        <code className="px-2 py-1 bg-ds-surface/50 rounded text-ds-accent-text whitespace-nowrap">
                            !meta
                        </code>
                        <span className="text-ds-soft">
                            Muestra el progreso de la meta activa principal
                        </span>
                    </div>
                    <div className="flex items-start gap-3">
                        <code className="px-2 py-1 bg-ds-surface/50 rounded text-ds-accent-text whitespace-nowrap">
                            !meta [nombre]
                        </code>
                        <span className="text-ds-soft">
                            Muestra el progreso de una meta específica
                        </span>
                    </div>
                    <div className="flex items-start gap-3">
                        <code className="px-2 py-1 bg-ds-surface/50 rounded text-ds-danger whitespace-nowrap">
                            !meta reset
                        </code>
                        <span className="text-ds-soft">
                            Reinicia el progreso de la meta activa a 0
                        </span>
                    </div>
                    <div className="flex items-start gap-3">
                        <code className="px-2 py-1 bg-ds-surface/50 rounded text-ds-ok whitespace-nowrap">
                            !meta add 10
                        </code>
                        <span className="text-ds-soft">
                            Agrega 10 puntos a la meta activa
                        </span>
                    </div>
                    <div className="flex items-start gap-3">
                        <code className="px-2 py-1 bg-ds-surface/50 rounded text-ds-warn whitespace-nowrap">
                            !meta set 50
                        </code>
                        <span className="text-ds-soft">
                            Establece el progreso de la meta a 50
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandsTab;
