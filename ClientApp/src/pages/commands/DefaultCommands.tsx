import { ChevronLeft, ChevronRight, Search, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../../hooks/usePermissions';
import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { KICK_COMING_SOON, KICK_UNAVAILABLE } from '../../config/defaultCommandsCatalog';
import { Alert, Button, Input } from '../../components/ds';
import PageHeader from '../../components/dashboard/PageHeader';
import { AccessDenied, PermissionNotice } from '../../components/dashboard/Notices';
import { parseJwtClaims } from '../../utils/jwt';
import CommandRow, { type Command } from './default/CommandRow';

const ITEMS_PER_PAGE = 8;

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
    const isKickSession = useMemo(() => {
        const claims = parseJwtClaims(localStorage.getItem('token'));
        return (claims.AuthProvider || 'twitch') === 'kick';
    }, []);

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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ds-accent"></div>
            </div>
        );
    }

    if (!hasMinimumLevel('commands')) {
        return (
            <AccessDenied
                title={t('commands:accessDenied.title')}
                message={t('commands:accessDenied.message')}
                backLabel={t('commands:accessDenied.backButton')}
                onBack={() => navigate('/dashboard')}
            />
        );
    }

    const canToggle = hasMinimumLevel('control_total');

    return (
        <div className="panel-scale space-y-6">
            <PageHeader
                title={<span className="flex items-center gap-3"><Terminal className="w-8 h-8 text-ds-accent-text" />{t('commands:header.title')}</span>}
                subtitle={t('commands:header.subtitle')}
                actions={
                    <div className="bg-ds-raised border border-ds-border px-4 py-2 rounded-lg">
                        <span className="text-2xl font-black text-ds-accent-text">{commands.length}</span>
                        <span className="text-sm text-ds-soft ml-2">comandos</span>
                    </div>
                }
            />

            {!botEnabled && (
                <Alert tone="warn">{t('commands:botDisabledWarning.message')}</Alert>
            )}

            {!canToggle && <PermissionNotice>{t('commands:permissionInfo.message')}</PermissionNotice>}

            {/* Barra de búsqueda */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ds-soft pointer-events-none" />
                <Input
                    type="text"
                    placeholder="Buscar comando..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: 44 }}
                />
            </div>

            {/* Lista de comandos */}
            <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
                <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3 bg-ds-bg border-b border-ds-border text-xs font-bold text-ds-soft uppercase tracking-wider">
                    <div className="col-span-3">Comando</div>
                    <div className="col-span-5">Descripcion</div>
                    <div className="col-span-2">Aliases</div>
                    <div className="col-span-2 text-center">Estado</div>
                </div>

                <div className="divide-y divide-ds-border">
                    {paginatedCommands.length === 0 ? (
                        <div className="px-6 py-12 text-center text-ds-soft">
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
                                kickStatus={
                                    isKickSession
                                        ? KICK_COMING_SOON.has(cmd.name)
                                            ? 'coming-soon'
                                            : KICK_UNAVAILABLE.has(cmd.name)
                                                ? 'unavailable'
                                                : null
                                        : null
                                }
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Paginacion */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-2">
                    <p className="text-sm text-ds-soft">
                        Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredCommands.length)} de {filteredCommands.length}
                    </p>

                    <div className="flex items-center gap-2">
                        <Button variant="secondary" aria-label="Anterior" icon={<ChevronLeft />}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} />

                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <Button key={page} variant={currentPage === page ? 'primary' : 'ghost'} onClick={() => setCurrentPage(page)}
                                    aria-current={currentPage === page ? 'page' : undefined} style={{ minWidth: 40, paddingLeft: 0, paddingRight: 0 }}>
                                    {page}
                                </Button>
                            ))}
                        </div>

                        <Button variant="secondary" aria-label="Siguiente" icon={<ChevronRight />}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} />
                    </div>
                </div>
            )}
        </div>
    );
}
