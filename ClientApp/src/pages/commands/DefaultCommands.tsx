import { Lock, Zap, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, Search, Terminal, Clock, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../../hooks/usePermissions';
import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';

interface Command {
    name: string;
    aliases: string[];
    description: string;
    enabled: boolean;
    isActive: boolean;
    usageExamples?: string[];
}

const ITEMS_PER_PAGE = 8;

// Categorías de comandos para mejor organización
const COMMAND_CATEGORIES: Record<string, { icon: React.ReactNode; color: string; commands: string[] }> = {
    stream: {
        icon: <Zap className="w-4 h-4" />,
        color: 'text-purple-500',
        commands: ['title', 't', 'game', 'g']
    },
    timer: {
        icon: <Clock className="w-4 h-4" />,
        color: 'text-blue-500',
        commands: ['dstart', 'dpause', 'dplay', 'dreset', 'dstop', 'dtimer']
    },
    community: {
        icon: <Users className="w-4 h-4" />,
        color: 'text-green-500',
        commands: ['so', 'raffle', 'join', 'hola', 'followage', 'ia']
    }
};

function getCommandCategory(commandName: string): string {
    for (const [category, data] of Object.entries(COMMAND_CATEGORIES)) {
        if (data.commands.includes(commandName)) {
            return category;
        }
    }
    return 'community';
}

export default function DefaultCommands() {
    const { t } = useTranslation(['commands', 'common']);
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const navigate = useNavigate();
    const [commands, setCommands] = useState<Command[]>([]);
    const [botEnabled, setBotEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCommand, setExpandedCommand] = useState<string | null>(null);

    useEffect(() => {
        if (!permissionsLoading && hasMinimumLevel('commands')) {
            loadCommands();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    const loadCommands = async () => {
        try {
            setLoading(true);
            const res = await api.get('/commands/default');
            if (res.data.success) {
                setCommands(res.data.commands);
                setBotEnabled(res.data.botEnabled);
            }
        } catch (err) {
            console.error('Error loading commands:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleCommand = async (commandName: string, currentStatus: boolean) => {
        try {
            const res = await api.post(`/commands/${commandName}/toggle`, {
                enabled: !currentStatus
            });

            if (res.data.success) {
                setCommands(prev => prev.map(cmd =>
                    cmd.name === commandName
                        ? { ...cmd, enabled: !currentStatus, isActive: botEnabled && !currentStatus }
                        : cmd
                ));
            }
        } catch (err) {
            console.error(`Error toggling command ${commandName}:`, err);
        }
    };

    // Filtrar comandos por búsqueda
    const filteredCommands = useMemo(() => {
        if (!searchTerm.trim()) return commands;
        const term = searchTerm.toLowerCase();
        return commands.filter(cmd =>
            cmd.name.toLowerCase().includes(term) ||
            cmd.description.toLowerCase().includes(term) ||
            cmd.aliases.some(alias => alias.toLowerCase().includes(term))
        );
    }, [commands, searchTerm]);

    // Paginación
    const totalPages = Math.ceil(filteredCommands.length / ITEMS_PER_PAGE);
    const paginatedCommands = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredCommands.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredCommands, currentPage]);

    // Reset page cuando cambia la búsqueda
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    if (permissionsLoading || loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2563eb]"></div>
            </div>
        );
    }

    if (!hasMinimumLevel('commands')) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 max-w-md text-center">
                    <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-red-600 dark:text-red-400 mb-2">{t('commands:accessDenied.title')}</h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mb-6">
                        {t('commands:accessDenied.message')}
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                    >
                        {t('commands:accessDenied.backButton')}
                    </button>
                </div>
            </div>
        );
    }

    const canToggle = hasMinimumLevel('control_total');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-3">
                        <Terminal className="w-8 h-8 text-[#2563eb]" />
                        {t('commands:header.title')}
                    </h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">
                        {t('commands:header.subtitle')}
                    </p>
                </div>

                {/* Contador de comandos */}
                <div className="flex items-center gap-4">
                    <div className="bg-[#2563eb]/10 dark:bg-[#2563eb]/20 px-4 py-2 rounded-xl">
                        <span className="text-2xl font-black text-[#2563eb]">{commands.length}</span>
                        <span className="text-sm text-[#64748b] dark:text-[#94a3b8] ml-2">comandos</span>
                    </div>
                </div>
            </div>

            {/* Alertas */}
            {!botEnabled && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                        <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        <p className="text-yellow-700 dark:text-yellow-300 font-semibold">
                            {t('commands:botDisabledWarning.message')}
                        </p>
                    </div>
                </div>
            )}

            {!canToggle && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <p className="text-blue-700 dark:text-blue-300 font-semibold">
                            {t('commands:permissionInfo.message')}
                        </p>
                    </div>
                </div>
            )}

            {/* Barra de búsqueda */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                <input
                    type="text"
                    placeholder="Buscar comando..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
                />
            </div>

            {/* Lista de comandos */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
                {/* Header de la tabla */}
                <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-4 bg-[#f8fafc] dark:bg-[#262626] border-b border-[#e2e8f0] dark:border-[#374151] text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                    <div className="col-span-3">Comando</div>
                    <div className="col-span-5">Descripcion</div>
                    <div className="col-span-2">Aliases</div>
                    <div className="col-span-2 text-center">Estado</div>
                </div>

                {/* Filas de comandos */}
                <div className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                    {paginatedCommands.length === 0 ? (
                        <div className="px-6 py-12 text-center text-[#64748b] dark:text-[#94a3b8]">
                            No se encontraron comandos
                        </div>
                    ) : (
                        paginatedCommands.map((cmd) => (
                            <CommandRow
                                key={cmd.name}
                                command={cmd}
                                canToggle={canToggle}
                                onToggle={toggleCommand}
                                isExpanded={expandedCommand === cmd.name}
                                onToggleExpand={() => setExpandedCommand(
                                    expandedCommand === cmd.name ? null : cmd.name
                                )}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Paginacion */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-2">
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                        Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredCommands.length)} de {filteredCommands.length}
                    </p>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>

                        {/* Numeros de pagina */}
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-10 h-10 rounded-lg font-bold transition-colors ${
                                        currentPage === page
                                            ? 'bg-[#2563eb] text-white'
                                            : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#262626]'
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

interface CommandRowProps {
    command: Command;
    canToggle: boolean;
    onToggle: (commandName: string, currentStatus: boolean) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
}

function CommandRow({ command, canToggle, onToggle, isExpanded, onToggleExpand }: CommandRowProps) {
    const { t } = useTranslation(['commands']);
    const category = getCommandCategory(command.name);
    const categoryData = COMMAND_CATEGORIES[category];

    return (
        <div className="group">
            {/* Fila principal */}
            <div
                className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-[#f8fafc] dark:hover:bg-[#262626]/50 cursor-pointer transition-colors"
                onClick={onToggleExpand}
            >
                {/* Comando */}
                <div className="md:col-span-3 flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-[#f8fafc] dark:bg-[#262626] ${categoryData.color}`}>
                        {categoryData.icon}
                    </div>
                    <div>
                        <span className="font-mono font-bold text-[#1e293b] dark:text-[#f8fafc] text-lg">
                            !{command.name}
                        </span>
                        <span className="md:hidden block text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                            {command.description}
                        </span>
                    </div>
                </div>

                {/* Descripcion (solo desktop) */}
                <div className="hidden md:flex md:col-span-5 items-center">
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8] line-clamp-2">
                        {command.description}
                    </p>
                </div>

                {/* Aliases (solo desktop) */}
                <div className="hidden md:flex md:col-span-2 items-center">
                    {command.aliases.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {command.aliases.map((alias) => (
                                <span
                                    key={alias}
                                    className="px-2 py-0.5 bg-[#f1f5f9] dark:bg-[#374151] rounded text-xs font-mono text-[#64748b] dark:text-[#94a3b8]"
                                >
                                    !{alias}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <span className="text-xs text-[#94a3b8] dark:text-[#64748b]">-</span>
                    )}
                </div>

                {/* Estado */}
                <div className="md:col-span-2 flex items-center justify-between md:justify-center gap-2">
                    {canToggle ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle(command.name, command.enabled);
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                                command.isActive
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {command.isActive ? (
                                <>
                                    <ToggleRight className="w-4 h-4" />
                                    <span className="hidden sm:inline">{t('commands:card.enabled')}</span>
                                </>
                            ) : (
                                <>
                                    <ToggleLeft className="w-4 h-4" />
                                    <span className="hidden sm:inline">{t('commands:card.disabled')}</span>
                                </>
                            )}
                        </button>
                    ) : (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${
                            command.isActive
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}>
                            {command.isActive ? (
                                <>
                                    <ToggleRight className="w-4 h-4" />
                                    <span className="hidden sm:inline">{t('commands:card.enabled')}</span>
                                </>
                            ) : (
                                <>
                                    <ToggleLeft className="w-4 h-4" />
                                    <span className="hidden sm:inline">{t('commands:card.disabled')}</span>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Panel expandido con ejemplos de uso */}
            {isExpanded && (
                <div className="px-6 py-4 bg-[#f8fafc] dark:bg-[#262626]/50 border-t border-[#e2e8f0] dark:border-[#374151]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Informacion del comando */}
                        <div>
                            <h4 className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-2">
                                Descripcion
                            </h4>
                            <p className="text-sm text-[#1e293b] dark:text-[#f8fafc]">
                                {command.description}
                            </p>

                            {command.aliases.length > 0 && (
                                <div className="mt-3">
                                    <h4 className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-2">
                                        Aliases
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {command.aliases.map((alias) => (
                                            <span
                                                key={alias}
                                                className="px-2 py-1 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded text-sm font-mono text-[#1e293b] dark:text-[#f8fafc]"
                                            >
                                                !{alias}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Ejemplos de uso */}
                        <div>
                            <h4 className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-2">
                                Ejemplos de uso
                            </h4>
                            <div className="space-y-2">
                                <code className="block text-sm font-mono bg-white dark:bg-[#1B1C1D] px-3 py-2 rounded border border-[#e2e8f0] dark:border-[#374151] text-[#2563eb] dark:text-[#60a5fa]">
                                    !{command.name}
                                </code>
                                {command.name === 'title' && (
                                    <code className="block text-sm font-mono bg-white dark:bg-[#1B1C1D] px-3 py-2 rounded border border-[#e2e8f0] dark:border-[#374151] text-[#2563eb] dark:text-[#60a5fa]">
                                        !title Mi nuevo titulo de stream
                                    </code>
                                )}
                                {command.name === 'game' && (
                                    <code className="block text-sm font-mono bg-white dark:bg-[#1B1C1D] px-3 py-2 rounded border border-[#e2e8f0] dark:border-[#374151] text-[#2563eb] dark:text-[#60a5fa]">
                                        !game Just Chatting
                                    </code>
                                )}
                                {command.name === 'dstart' && (
                                    <code className="block text-sm font-mono bg-white dark:bg-[#1B1C1D] px-3 py-2 rounded border border-[#e2e8f0] dark:border-[#374151] text-[#2563eb] dark:text-[#60a5fa]">
                                        !dstart 5m
                                    </code>
                                )}
                                {command.name === 'dtimer' && (
                                    <>
                                        <code className="block text-sm font-mono bg-white dark:bg-[#1B1C1D] px-3 py-2 rounded border border-[#e2e8f0] dark:border-[#374151] text-[#2563eb] dark:text-[#60a5fa]">
                                            !dtimer add 1h
                                        </code>
                                        <code className="block text-sm font-mono bg-white dark:bg-[#1B1C1D] px-3 py-2 rounded border border-[#e2e8f0] dark:border-[#374151] text-[#2563eb] dark:text-[#60a5fa]">
                                            !dtimer remove 30s
                                        </code>
                                    </>
                                )}
                                {command.name === 'so' && (
                                    <code className="block text-sm font-mono bg-white dark:bg-[#1B1C1D] px-3 py-2 rounded border border-[#e2e8f0] dark:border-[#374151] text-[#2563eb] dark:text-[#60a5fa]">
                                        !so @username
                                    </code>
                                )}
                                {command.name === 'raffle' && (
                                    <>
                                        <code className="block text-sm font-mono bg-white dark:bg-[#1B1C1D] px-3 py-2 rounded border border-[#e2e8f0] dark:border-[#374151] text-[#2563eb] dark:text-[#60a5fa]">
                                            !raffle create Premio
                                        </code>
                                        <code className="block text-sm font-mono bg-white dark:bg-[#1B1C1D] px-3 py-2 rounded border border-[#e2e8f0] dark:border-[#374151] text-[#2563eb] dark:text-[#60a5fa]">
                                            !raffle draw
                                        </code>
                                    </>
                                )}
                                {command.name === 'ia' && (
                                    <code className="block text-sm font-mono bg-white dark:bg-[#1B1C1D] px-3 py-2 rounded border border-[#e2e8f0] dark:border-[#374151] text-[#2563eb] dark:text-[#60a5fa]">
                                        !ia dame un dato curioso
                                    </code>
                                )}
                                {command.name === 'followage' && (
                                    <code className="block text-sm font-mono bg-white dark:bg-[#1B1C1D] px-3 py-2 rounded border border-[#e2e8f0] dark:border-[#374151] text-[#2563eb] dark:text-[#60a5fa]">
                                        !followage @usuario
                                    </code>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
