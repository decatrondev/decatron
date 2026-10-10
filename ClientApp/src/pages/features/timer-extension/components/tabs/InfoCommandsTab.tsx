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
        <div className="w-9 h-5 bg-ds-raised peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ds-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all border-ds-border peer-checked:bg-ds-accent"></div>
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
        color: 'text-ds-accent-text',
        bg: 'bg-ds-accent/10 ',
        variables: ['{tiempo}', '{streamer}', '{estado}']
    },
    {
        key: 'dcuando',
        icon: Calendar,
        title: '!dcuando',
        desc: 'Fecha y hora de finalización',
        color: 'text-ds-accent-text',
        bg: 'bg-ds-accent/10 ',
        variables: ['{fecha}', '{hora}', '{tiempo}', '{streamer}']
    },
    {
        key: 'dstats',
        icon: BarChart2,
        title: '!dstats',
        desc: 'Stats de la sesión activa',
        color: 'text-ds-ok',
        bg: 'bg-ds-ok/10 ',
        variables: ['{total}', '{subs}', '{bits}', '{raids}', '{follows}', '{tips}', '{streamer}']
    },
    {
        key: 'drecord',
        icon: Trophy,
        title: '!drecord',
        desc: 'Récord histórico del canal',
        color: 'text-ds-warn',
        bg: 'bg-ds-warn/10 ',
        variables: ['{record}', '{fecha_record}', '{streamer}']
    },
    {
        key: 'dtop',
        icon: Users,
        title: '!dtop',
        desc: 'Top contribuidores de la sesión',
        color: 'text-ds-warn',
        bg: 'bg-ds-warn/10 ',
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
        <div className={`bg-ds-surface rounded-lg border transition-all duration-200 overflow-hidden ${
            expanded
                ? 'border-ds-accent ring-1 ring-ds-accent/20'
                : 'border-ds-border hover:border-ds-border '
        }`}>
            {/* Header */}
            <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${def.bg} ${def.color}`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-ds-text">{def.title}</h3>
                            <p className="text-[10px] text-ds-soft">{def.desc}</p>
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
                        className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-medium text-ds-soft bg-ds-surface hover:bg-ds-bg rounded-lg transition-colors border border-transparent hover:border-ds-border"
                    >
                        <MessageSquare className="w-3 h-3" />
                        {expanded ? 'Ocultar Configuración' : 'Configurar Mensaje'}
                        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                )}
            </div>

            {/* Expandable area */}
            {cfg.enabled && expanded && (
                <div className="bg-ds-bg p-4 border-t border-ds-border animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="space-y-4">
                        {/* Template */}
                        <div>
                            <label className="text-[10px] font-bold text-ds-soft uppercase tracking-wider mb-1 block">
                                Mensaje
                            </label>
                            <textarea
                                ref={textareaRef}
                                value={cfg.template}
                                onChange={(e) => onChange({ ...cfg, template: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 text-xs border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-1 focus:ring-ds-accent outline-none resize-none"
                                placeholder="Escribe el mensaje..."
                            />
                            {/* Variable chips */}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                                {def.variables.map((v) => (
                                    <button
                                        key={v}
                                        onClick={() => insertVariable(v)}
                                        className="px-2 py-0.5 text-[10px] bg-ds-accent/10 text-ds-accent-text border border-ds-accent rounded-full hover:bg-ds-accent/10 transition-colors font-mono"
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Permission Level */}
                        <div>
                            <label className="text-[10px] font-bold text-ds-soft uppercase tracking-wider mb-1 block">
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
                                                ? 'bg-ds-accent border-ds-accent text-ds-on-accent'
                                                : 'bg-ds-surface border-ds-border text-ds-soft hover:border-ds-accent'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-ds-soft mt-1">
                                Jerarquía acumulativa — broadcaster y mods siempre pueden usar cualquier comando.
                            </p>
                        </div>

                        {/* Cooldown */}
                        <div>
                            <label className="text-[10px] font-bold text-ds-soft uppercase tracking-wider mb-1 block">
                                Cooldown (segundos)
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={3600}
                                value={cfg.cooldown}
                                onChange={(e) => onChange({ ...cfg, cooldown: Math.max(0, parseInt(e.target.value) || 0) })}
                                className="w-32 px-3 py-2 text-xs border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-1 focus:ring-ds-accent outline-none"
                            />
                            <p className="text-[10px] text-ds-soft mt-1">Tiempo mínimo entre usos en el mismo canal.</p>
                        </div>

                        {/* Permissions */}
                        <div>
                            <p className="text-[10px] font-bold text-ds-soft uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Shield className="w-3 h-3" /> Permisos
                            </p>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] text-ds-soft mb-1 block">
                                        Lista Negra (Bloquear)
                                    </label>
                                    <input
                                        type="text"
                                        value={cfg.blacklist.join(', ')}
                                        onChange={(e) => onChange({ ...cfg, blacklist: e.target.value.split(',').map(u => u.trim()).filter(u => u) })}
                                        className="w-full px-3 py-2 text-xs border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-1 focus:ring-ds-accent outline-none"
                                        placeholder="usuario1, usuario2..."
                                    />
                                    <p className="text-[10px] text-ds-soft mt-1">Usuarios que NO pueden usar este comando.</p>
                                </div>
                                <div>
                                    <label className="text-[10px] text-ds-soft mb-1 block">
                                        Lista Blanca (Permitir)
                                    </label>
                                    <input
                                        type="text"
                                        value={cfg.whitelist.join(', ')}
                                        onChange={(e) => onChange({ ...cfg, whitelist: e.target.value.split(',').map(u => u.trim()).filter(u => u) })}
                                        className="w-full px-3 py-2 text-xs border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-1 focus:ring-ds-accent outline-none"
                                        placeholder="usuario1, usuario2..."
                                    />
                                    <p className="text-[10px] text-ds-soft mt-1">Usuarios adicionales que SÍ pueden usarlo (además de mods).</p>
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
            <div className="bg-ds-bg border border-ds-border rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-ds-soft mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-ds-text mb-1">
                            Comandos Informativos del Timer
                        </p>
                        <p className="text-xs text-ds-soft">
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
