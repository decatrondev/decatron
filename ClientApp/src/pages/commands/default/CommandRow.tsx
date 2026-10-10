import { ToggleLeft, ToggleRight, Zap, Clock, Users, Gamepad2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { COMMAND_GROUPS, getCommandGroup } from '../../../config/defaultCommandsCatalog';

export interface Command {
    name: string;
    aliases: string[];
    description: string;
    enabled: boolean;
    isActive: boolean;
    usageExamples?: string[];
}

export type KickStatus = 'coming-soon' | 'unavailable' | null;

// Grupos y estados de Kick: viven en config/defaultCommandsCatalog.ts, compartido con la documentación.
// Aquí solo se asigna el icono de cada grupo (todos con el azul de la marca).
const COMMAND_CATEGORIES: Record<string, { icon: React.ReactNode; commands: string[] }> = {
    stream: { icon: <Zap className="w-4 h-4" />, commands: COMMAND_GROUPS.stream },
    timer: { icon: <Clock className="w-4 h-4" />, commands: COMMAND_GROUPS.timer },
    community: { icon: <Users className="w-4 h-4" />, commands: COMMAND_GROUPS.community },
    games: { icon: <Gamepad2 className="w-4 h-4" />, commands: COMMAND_GROUPS.games },
};

// Ejemplos de uso por comando (además del comando solo). Textos tal cual estaban.
const USAGE_EXAMPLES: Record<string, string[]> = {
    title: ['!title Mi nuevo titulo de stream'],
    game: ['!game Just Chatting'],
    dstart: ['!dstart 5m'],
    dtimer: ['!dtimer add 1h', '!dtimer remove 30s'],
    so: ['!so @username'],
    raffle: ['!raffle create Premio', '!raffle draw'],
    ia: ['!ia dame un dato curioso'],
    followage: ['!followage @usuario'],
};

function StatusPill({ isActive, onClick }: { isActive: boolean; onClick?: (e: React.MouseEvent) => void }) {
    const { t } = useTranslation(['commands']);
    const cls = `flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
        isActive ? 'bg-ds-ok/10 text-ds-ok' : 'bg-ds-bg text-ds-soft'
    } ${onClick ? (isActive ? 'hover:bg-ds-ok/20' : 'hover:bg-ds-raised') : ''}`;
    const content = isActive
        ? <><ToggleRight className="w-4 h-4" /><span className="hidden sm:inline">{t('commands:card.enabled')}</span></>
        : <><ToggleLeft className="w-4 h-4" /><span className="hidden sm:inline">{t('commands:card.disabled')}</span></>;
    return onClick ? <button onClick={onClick} className={cls}>{content}</button> : <div className={cls}>{content}</div>;
}

const codeChip = 'block text-sm font-mono bg-ds-surface px-3 py-2 rounded border border-ds-border text-ds-accent-text';
const subTitle = 'text-xs font-bold text-ds-soft uppercase tracking-wider mb-2';

interface CommandRowProps {
    command: Command;
    canToggle: boolean;
    onToggle: (commandName: string, currentStatus: boolean) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    kickStatus: KickStatus;
}

export default function CommandRow({ command, canToggle, onToggle, isExpanded, onToggleExpand, kickStatus }: CommandRowProps) {
    const categoryData = COMMAND_CATEGORIES[getCommandGroup(command.name)];

    const kickStatusLabel = kickStatus === 'coming-soon'
        ? 'Próximamente en Kick'
        : kickStatus === 'unavailable'
            ? 'No disponible en Kick'
            : null;
    const kickStatusTooltip = kickStatus === 'coming-soon'
        ? 'Kick ya soporta esto en su API — todavía no lo conectamos de nuestro lado.'
        : kickStatus === 'unavailable'
            ? 'La API pública de Kick no expone este dato todavía.'
            : undefined;

    return (
        <div className={`group ${kickStatus ? 'opacity-50' : ''}`} title={kickStatusTooltip}>
            {/* Fila principal */}
            <div
                className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-ds-raised cursor-pointer transition-colors"
                onClick={onToggleExpand}
            >
                {/* Comando */}
                <div className="md:col-span-3 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-ds-bg border border-ds-border text-ds-accent-text">
                        {categoryData.icon}
                    </div>
                    <div>
                        <span className="font-mono font-bold text-ds-text text-lg">!{command.name}</span>
                        <span className="md:hidden block text-xs text-ds-soft mt-1">{command.description}</span>
                    </div>
                </div>

                {/* Descripcion (solo desktop) */}
                <div className="hidden md:flex md:col-span-5 items-center">
                    <p className="text-sm text-ds-soft line-clamp-2">{command.description}</p>
                </div>

                {/* Aliases (solo desktop) */}
                <div className="hidden md:flex md:col-span-2 items-center">
                    {command.aliases.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {command.aliases.map((alias) => (
                                <span key={alias} className="px-2 py-0.5 bg-ds-bg border border-ds-border rounded text-xs font-mono text-ds-soft">!{alias}</span>
                            ))}
                        </div>
                    ) : (
                        <span className="text-xs text-ds-faint">-</span>
                    )}
                </div>

                {/* Estado */}
                <div className="md:col-span-2 flex items-center justify-between md:justify-center gap-2">
                    {kickStatusLabel ? (
                        <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold bg-ds-raised text-ds-soft cursor-not-allowed">
                            {kickStatusLabel}
                        </span>
                    ) : canToggle ? (
                        <StatusPill isActive={command.isActive} onClick={(e) => { e.stopPropagation(); onToggle(command.name, command.enabled); }} />
                    ) : (
                        <StatusPill isActive={command.isActive} />
                    )}
                </div>
            </div>

            {/* Panel expandido con ejemplos de uso */}
            {isExpanded && (
                <div className="px-6 py-4 bg-ds-bg border-t border-ds-border">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h4 className={subTitle}>Descripcion</h4>
                            <p className="text-sm text-ds-text">{command.description}</p>

                            {command.aliases.length > 0 && (
                                <div className="mt-3">
                                    <h4 className={subTitle}>Aliases</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {command.aliases.map((alias) => (
                                            <span key={alias} className="px-2 py-1 bg-ds-surface border border-ds-border rounded text-sm font-mono text-ds-text">!{alias}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <h4 className={subTitle}>Ejemplos de uso</h4>
                            <div className="space-y-2">
                                <code className={codeChip}>!{command.name}</code>
                                {(USAGE_EXAMPLES[command.name] ?? []).map((ex) => (
                                    <code key={ex} className={codeChip}>{ex}</code>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
