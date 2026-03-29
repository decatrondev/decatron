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
        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
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
        { key: 'play', icon: Play, title: '!dplay', desc: 'Iniciar o resumir', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
        { key: 'pause', icon: Pause, title: '!dpause', desc: 'Pausar el timer', color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
        { key: 'stop', icon: StopCircle, title: '!dstop', desc: 'Detener y ocultar', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
        { key: 'reset', icon: RotateCcw, title: '!dreset', desc: 'Reiniciar a cero', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
        { key: 'addTime', icon: PlusCircle, title: '!dtimer +{t}', desc: 'Añadir tiempo', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
        { key: 'removeTime', icon: MinusCircle, title: '!dtimer -{t}', desc: 'Restar tiempo', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' }
    ];

    return (
        <div className="space-y-6">
            <div className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4">
                <div className="flex items-start gap-3">
                    <Terminal className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8] mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-1">
                            Control por Comandos de Chat
                        </p>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
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
                            className={`bg-white dark:bg-[#1B1C1D] rounded-xl border transition-all duration-200 overflow-hidden ${
                                isExpanded 
                                    ? 'border-blue-500 shadow-md ring-1 ring-blue-500/20' 
                                    : 'border-[#e2e8f0] dark:border-[#374151] hover:border-gray-300 dark:hover:border-gray-600'
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
                                            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{title}</h3>
                                            <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">{desc}</p>
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
                                        className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#262626] hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                                    >
                                        <Settings2 className="w-3 h-3" />
                                        {isExpanded ? 'Ocultar Configuración' : 'Configurar Permisos'}
                                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    </button>
                                )}
                            </div>

                            {/* Expandable Config Area */}
                            {cmd.enabled && isExpanded && (
                                <div className="bg-[#f8fafc] dark:bg-[#202020] p-4 border-t border-[#e2e8f0] dark:border-[#374151] animate-in slide-in-from-top-2 fade-in duration-200">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-2 flex items-center gap-1">
                                                <Shield className="w-3 h-3" /> Lista Negra (Bloquear)
                                            </label>
                                            <input
                                                type="text"
                                                value={cmd.blacklist.join(', ')}
                                                onChange={(e) => onCommandsConfigChange({ [cmdKey]: { ...cmd, blacklist: e.target.value.split(',').map(u => u.trim()).filter(u => u) } } as any)}
                                                className="w-full px-3 py-2 text-xs border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-1 focus:ring-blue-500 outline-none"
                                                placeholder="usuario1, usuario2..."
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1">Usuarios que NO pueden usar este comando.</p>
                                        </div>
                                        
                                        <div>
                                            <label className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-2 flex items-center gap-1">
                                                <Shield className="w-3 h-3 text-green-500" /> Lista Blanca (Permitir)
                                            </label>
                                            <input
                                                type="text"
                                                value={cmd.whitelist.join(', ')}
                                                onChange={(e) => onCommandsConfigChange({ [cmdKey]: { ...cmd, whitelist: e.target.value.split(',').map(u => u.trim()).filter(u => u) } } as any)}
                                                className="w-full px-3 py-2 text-xs border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-1 focus:ring-blue-500 outline-none"
                                                placeholder="usuario1, usuario2..."
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1">Usuarios específicos que SÍ pueden usarlo (además de mods).</p>
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
