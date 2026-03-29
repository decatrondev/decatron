/**
 * Timer Extension - Info Commands Tab Component
 *
 * Comandos informativos del chat para el timer (tiempo restante, stats, récord, top).
 */

import { useState, useRef } from 'react';
import { Clock, Calendar, BarChart2, Trophy, Users, Shield, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import type { CommandsConfig, InfoCommandConfig, InfoCommandPermissionLevel } from '../../types';

interface InfoCommandsTabProps {
    commandsConfig: CommandsConfig;
    onCommandsConfigChange: (updates: Partial<CommandsConfig>) => void;
}

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
    </label>
);

interface CommandDef {
    key: keyof Pick<CommandsConfig, 'dtiempo' | 'dcuando' | 'dstats' | 'drecord' | 'dtop'>;
    icon: React.FC<{ className?: string }>;
    title: string;
    desc: string;
    color: string;
    bg: string;
    variables: string[];
}

const commands: CommandDef[] = [
    {
        key: 'dtiempo',
        icon: Clock,
        title: '!dtiempo',
        desc: 'Tiempo restante formateado',
        color: 'text-blue-500',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        variables: ['{tiempo}', '{streamer}', '{estado}']
    },
    {
        key: 'dcuando',
        icon: Calendar,
        title: '!dcuando',
        desc: 'Fecha y hora de finalización',
        color: 'text-purple-500',
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        variables: ['{fecha}', '{hora}', '{tiempo}', '{streamer}']
    },
    {
        key: 'dstats',
        icon: BarChart2,
        title: '!dstats',
        desc: 'Stats de la sesión activa',
        color: 'text-green-500',
        bg: 'bg-green-50 dark:bg-green-900/20',
        variables: ['{total}', '{subs}', '{bits}', '{raids}', '{follows}', '{tips}', '{streamer}']
    },
    {
        key: 'drecord',
        icon: Trophy,
        title: '!drecord',
        desc: 'Récord histórico del canal',
        color: 'text-yellow-500',
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        variables: ['{record}', '{fecha_record}', '{streamer}']
    },
    {
        key: 'dtop',
        icon: Users,
        title: '!dtop',
        desc: 'Top contribuidores de la sesión',
        color: 'text-orange-500',
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        variables: ['{top}', '{periodo}', '{streamer}']
    }
];

const InfoCommandCard: React.FC<{
    def: CommandDef;
    cfg: InfoCommandConfig;
    onChange: (updated: InfoCommandConfig) => void;
}> = ({ def, cfg, onChange }) => {
    const [expanded, setExpanded] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const Icon = def.icon;

    const insertVariable = (variable: string) => {
        const ta = textareaRef.current;
        if (!ta) {
            onChange({ ...cfg, template: cfg.template + variable });
            return;
        }
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newTemplate = cfg.template.slice(0, start) + variable + cfg.template.slice(end);
        onChange({ ...cfg, template: newTemplate });
        // Restore cursor after React re-render
        setTimeout(() => {
            ta.selectionStart = ta.selectionEnd = start + variable.length;
            ta.focus();
        }, 0);
    };

    return (
        <div className={`bg-white dark:bg-[#1B1C1D] rounded-xl border transition-all duration-200 overflow-hidden ${
            expanded
                ? 'border-blue-500 shadow-md ring-1 ring-blue-500/20'
                : 'border-[#e2e8f0] dark:border-[#374151] hover:border-gray-300 dark:hover:border-gray-600'
        }`}>
            {/* Header */}
            <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${def.bg} ${def.color}`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{def.title}</h3>
                            <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">{def.desc}</p>
                        </div>
                    </div>
                    <ToggleSwitch
                        checked={cfg.enabled}
                        onChange={(checked) => onChange({ ...cfg, enabled: checked })}
                    />
                </div>

                {cfg.enabled && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#262626] hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                    >
                        <MessageSquare className="w-3 h-3" />
                        {expanded ? 'Ocultar Configuración' : 'Configurar Mensaje'}
                        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                )}
            </div>

            {/* Expandable area */}
            {cfg.enabled && expanded && (
                <div className="bg-[#f8fafc] dark:bg-[#202020] p-4 border-t border-[#e2e8f0] dark:border-[#374151] animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="space-y-4">
                        {/* Template */}
                        <div>
                            <label className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-1 block">
                                Mensaje
                            </label>
                            <textarea
                                ref={textareaRef}
                                value={cfg.template}
                                onChange={(e) => onChange({ ...cfg, template: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 text-xs border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                                placeholder="Escribe el mensaje..."
                            />
                            {/* Variable chips */}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                                {def.variables.map((v) => (
                                    <button
                                        key={v}
                                        onClick={() => insertVariable(v)}
                                        className="px-2 py-0.5 text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors font-mono"
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Permission Level */}
                        <div>
                            <label className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-1 block">
                                ¿Quién puede usarlo?
                            </label>
                            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                                {(
                                    [
                                        { value: 'everyone', label: '🌍 Todos',        desc: 'Cualquier espectador' },
                                        { value: 'subs',     label: '⭐ Subs+',        desc: 'Subs, VIPs y mods' },
                                        { value: 'vips',     label: '💎 VIPs+',        desc: 'VIPs y mods' },
                                        { value: 'mods',     label: '🛡️ Solo Mods',    desc: 'Mods y broadcaster' }
                                    ] as { value: InfoCommandPermissionLevel; label: string; desc: string }[]
                                ).map(({ value, label, desc }) => (
                                    <button
                                        key={value}
                                        onClick={() => onChange({ ...cfg, permissionLevel: value })}
                                        title={desc}
                                        className={`px-2 py-2 rounded-lg text-[10px] font-semibold border transition-all text-center ${
                                            cfg.permissionLevel === value
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'bg-white dark:bg-[#262626] border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:border-blue-400'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">
                                Jerarquía acumulativa — broadcaster y mods siempre pueden usar cualquier comando.
                            </p>
                        </div>

                        {/* Cooldown */}
                        <div>
                            <label className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-1 block">
                                Cooldown (segundos)
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={3600}
                                value={cfg.cooldown}
                                onChange={(e) => onChange({ ...cfg, cooldown: Math.max(0, parseInt(e.target.value) || 0) })}
                                className="w-32 px-3 py-2 text-xs border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Tiempo mínimo entre usos en el mismo canal.</p>
                        </div>

                        {/* Permissions */}
                        <div>
                            <p className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Shield className="w-3 h-3" /> Permisos
                            </p>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] text-[#64748b] dark:text-[#94a3b8] mb-1 block">
                                        Lista Negra (Bloquear)
                                    </label>
                                    <input
                                        type="text"
                                        value={cfg.blacklist.join(', ')}
                                        onChange={(e) => onChange({ ...cfg, blacklist: e.target.value.split(',').map(u => u.trim()).filter(u => u) })}
                                        className="w-full px-3 py-2 text-xs border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="usuario1, usuario2..."
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">Usuarios que NO pueden usar este comando.</p>
                                </div>
                                <div>
                                    <label className="text-[10px] text-[#64748b] dark:text-[#94a3b8] mb-1 block">
                                        Lista Blanca (Permitir)
                                    </label>
                                    <input
                                        type="text"
                                        value={cfg.whitelist.join(', ')}
                                        onChange={(e) => onChange({ ...cfg, whitelist: e.target.value.split(',').map(u => u.trim()).filter(u => u) })}
                                        className="w-full px-3 py-2 text-xs border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="usuario1, usuario2..."
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">Usuarios adicionales que SÍ pueden usarlo (además de mods).</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const InfoCommandsTab: React.FC<InfoCommandsTabProps> = ({
    commandsConfig,
    onCommandsConfigChange
}) => {
    return (
        <div className="space-y-6">
            {/* Info banner */}
            <div className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4">
                <div className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8] mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-1">
                            Comandos Informativos del Timer
                        </p>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                            Permite a moderadores (y usuarios en lista blanca) consultar información del timer desde el chat.
                            Personaliza el mensaje usando las variables disponibles en cada comando.
                        </p>
                    </div>
                </div>
            </div>

            {/* Command cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {commands.map((def) => {
                    const cfg = commandsConfig[def.key] as InfoCommandConfig;
                    return (
                        <InfoCommandCard
                            key={def.key}
                            def={def}
                            cfg={cfg}
                            onChange={(updated) => onCommandsConfigChange({ [def.key]: updated } as any)}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default InfoCommandsTab;
