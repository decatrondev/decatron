/**
 * Timer Extension - Commands Tab Component
 * 
 * Control de comandos de chat para el timer con blacklist/whitelist.
 * Diseño en Grid de Tarjetas compactas y configurables.
 */

import { useState } from 'react';
import { Play, Pause, RotateCcw, StopCircle, Terminal, Shield, PlusCircle, MinusCircle, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import type { CommandsConfig } from '../../types';

interface CommandsTabProps {
    commandsConfig: CommandsConfig;
    onCommandsConfigChange: (updates: Partial<CommandsConfig>) => void;
}

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-9 h-5 bg-ds-raised peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ds-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all border-ds-border peer-checked:bg-ds-accent"></div>
    </label>
);

export const CommandsTab: React.FC<CommandsTabProps> = ({
    commandsConfig,
    onCommandsConfigChange
}) => {
    // Estado para controlar qué tarjeta está expandida
    const [expandedCommand, setExpandedCommand] = useState<string | null>(null);

    const toggleExpand = (key: string) => {
        setExpandedCommand(expandedCommand === key ? null : key);
    };

    const commands = [
        { key: 'play', icon: Play, title: '!dplay', desc: 'Iniciar o resumir', color: 'text-ds-ok', bg: 'bg-ds-ok/10 ' },
        { key: 'pause', icon: Pause, title: '!dpause', desc: 'Pausar el timer', color: 'text-ds-warn', bg: 'bg-ds-warn/10 ' },
        { key: 'stop', icon: StopCircle, title: '!dstop', desc: 'Detener y ocultar', color: 'text-ds-danger', bg: 'bg-ds-danger/10 ' },
        { key: 'reset', icon: RotateCcw, title: '!dreset', desc: 'Reiniciar a cero', color: 'text-ds-warn', bg: 'bg-ds-warn/10 ' },
        { key: 'addTime', icon: PlusCircle, title: '!dtimer +{t}', desc: 'Añadir tiempo', color: 'text-ds-accent-text', bg: 'bg-ds-accent/10 ' },
        { key: 'removeTime', icon: MinusCircle, title: '!dtimer -{t}', desc: 'Restar tiempo', color: 'text-ds-accent-text', bg: 'bg-ds-accent/10 ' }
    ];

    return (
        <div className="space-y-6">
            <div className="bg-ds-bg border border-ds-border rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <Terminal className="w-5 h-5 text-ds-soft mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-ds-text mb-1">
                            Control por Comandos de Chat
                        </p>
                        <p className="text-xs text-ds-soft">
                            Activa los comandos que desees permitir. Por defecto, solo moderadores y el streamer pueden usarlos.
                            Usa "Configurar" para restringir el acceso a usuarios específicos.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {commands.map(({ key, icon: Icon, title, desc, color, bg }) => {
                    const cmdKey = key as keyof CommandsConfig;
                    const cmd = commandsConfig[cmdKey];
                    const isExpanded = expandedCommand === key;

                    return (
                        <div 
                            key={key} 
                            className={`bg-ds-surface rounded-lg border transition-all duration-200 overflow-hidden ${
                                isExpanded 
                                    ? 'border-ds-accent ring-1 ring-ds-accent/20' 
                                    : 'border-ds-border hover:border-ds-border '
                            }`}
                        >
                            {/* Card Header */}
                            <div className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg} ${color}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-ds-text">{title}</h3>
                                            <p className="text-[10px] text-ds-soft">{desc}</p>
                                        </div>
                                    </div>
                                    <ToggleSwitch
                                        checked={cmd.enabled}
                                        onChange={(checked) => onCommandsConfigChange({ [cmdKey]: { ...cmd, enabled: checked } } as any)}
                                    />
                                </div>

                                {/* Config Toggle Button */}
                                {cmd.enabled && (
                                    <button
                                        onClick={() => toggleExpand(key)}
                                        className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-medium text-ds-soft bg-ds-surface hover:bg-ds-bg rounded-lg transition-colors border border-transparent hover:border-ds-border"
                                    >
                                        <Settings2 className="w-3 h-3" />
                                        {isExpanded ? 'Ocultar Configuración' : 'Configurar Permisos'}
                                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    </button>
                                )}
                            </div>

                            {/* Expandable Config Area */}
                            {cmd.enabled && isExpanded && (
                                <div className="bg-ds-bg p-4 border-t border-ds-border animate-in slide-in-from-top-2 fade-in duration-200">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-ds-soft uppercase tracking-wider mb-2 flex items-center gap-1">
                                                <Shield className="w-3 h-3" /> Lista Negra (Bloquear)
                                            </label>
                                            <input
                                                type="text"
                                                value={cmd.blacklist.join(', ')}
                                                onChange={(e) => onCommandsConfigChange({ [cmdKey]: { ...cmd, blacklist: e.target.value.split(',').map(u => u.trim()).filter(u => u) } } as any)}
                                                className="w-full px-3 py-2 text-xs border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-1 focus:ring-ds-accent outline-none"
                                                placeholder="usuario1, usuario2..."
                                            />
                                            <p className="text-[10px] text-ds-soft mt-1">Usuarios que NO pueden usar este comando.</p>
                                        </div>
                                        
                                        <div>
                                            <label className="text-[10px] font-bold text-ds-soft uppercase tracking-wider mb-2 flex items-center gap-1">
                                                <Shield className="w-3 h-3 text-ds-accent-text" /> Lista Blanca (Permitir)
                                            </label>
                                            <input
                                                type="text"
                                                value={cmd.whitelist.join(', ')}
                                                onChange={(e) => onCommandsConfigChange({ [cmdKey]: { ...cmd, whitelist: e.target.value.split(',').map(u => u.trim()).filter(u => u) } } as any)}
                                                className="w-full px-3 py-2 text-xs border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-1 focus:ring-ds-accent outline-none"
                                                placeholder="usuario1, usuario2..."
                                            />
                                            <p className="text-[10px] text-ds-soft mt-1">Usuarios específicos que SÍ pueden usarlo (además de mods).</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CommandsTab;
