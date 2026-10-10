import { Plus, Pencil, Trash2, Save, Zap, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import GameAutocomplete, { type GameOption } from '../../components/GameAutocomplete';
import { Button, Empty, Field, Input, Table } from '../../components/ds';
import PageHeader from '../../components/dashboard/PageHeader';
import ModalShell from '../../components/dashboard/ModalShell';
import { AccessDenied, LoadingText, PermissionNotice } from '../../components/dashboard/Notices';
import { ToastHost, useToast } from '../../components/dashboard/toast';
import { parseJwtClaims } from '../../utils/jwt';

interface MicroCommand {
    id: number;
    shortCommand: string;
    categoryName: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export default function MicroCommands() {
    const { t } = useTranslation('commands');
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const navigate = useNavigate();
    const [commands, setCommands] = useState<MicroCommand[]>([]);
    const [loading, setLoading] = useState(true);
    // Los micro comandos son, en el fondo, atajos para GameUtils.UpdateCategoryAsync
    // (ver CommandService.cs:775 — TODOS pasan por el mismo handler que cambia la
    // categoria del stream) — misma API que !game, que Kick ya soporta pero que
    // todavia no conectamos de nuestro lado. Es una sola feature, no comandos
    // individuales, asi que se opaca la pagina entera en vez de item por item
    // como en Default Commands. Ver plan, seccion 8.17/8.18.
    const isKickSession = useMemo(() => {
        const claims = parseJwtClaims(localStorage.getItem('token'));
        return (claims.AuthProvider || 'twitch') === 'kick';
    }, []);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingCommand, setEditingCommand] = useState<MicroCommand | null>(null);
    const [newCommand, setNewCommand] = useState({ command: '', category: '' });
    const [selectedGame, setSelectedGame] = useState<GameOption | null>(null);
    const [selectedEditGame, setSelectedEditGame] = useState<GameOption | null>(null);
    const { toast, showToast } = useToast();
    const [channel, setChannel] = useState('');

    const canDelete = hasMinimumLevel('moderation');

    useEffect(() => {
        if (isKickSession) {
            setLoading(false);
            return;
        }
        if (!permissionsLoading && hasMinimumLevel('commands')) {
            loadMicroCommands();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    const loadMicroCommands = async () => {
        try {
            setLoading(true);
            const res = await api.get('/commands/microcommands');
            if (res.data.success) {
                setCommands(res.data.microCommands);
                setChannel(res.data.channel);
            }
        } catch (err) {
            console.error('Error loading micro commands:', err);
            showToast(t('microCommands.messages.loadError'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCommand = async () => {
        if (!newCommand.command || !selectedGame) {
            showToast(t('microCommands.messages.fieldsRequired'), 'error');
            return;
        }

        try {
            const res = await api.post('/commands/microcommands', {
                command: newCommand.command,
                category: selectedGame.name
            });

            if (res.data.success) {
                showToast(res.data.message, 'success');
                setShowCreateModal(false);
                setNewCommand({ command: '', category: '' });
                setSelectedGame(null);
                await loadMicroCommands();
            }
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message || t('microCommands.messages.createError');
            showToast(message, 'error');
        }
    };

    const handleEditCommand = async () => {
        if (!editingCommand) return;

        // Use selected game if available, otherwise use manual input
        const categoryName = selectedEditGame ? selectedEditGame.name : editingCommand.categoryName;

        try {
            const res = await api.put(`/commands/microcommands/${editingCommand.id}`, {
                category: categoryName
            });

            if (res.data.success) {
                showToast(res.data.message, 'success');
                setShowEditModal(false);
                setEditingCommand(null);
                setSelectedEditGame(null);
                await loadMicroCommands();
            }
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message || t('microCommands.messages.updateError');
            showToast(message, 'error');
        }
    };

    const handleDeleteCommand = async (id: number, commandName: string) => {
        if (!canDelete) {
            showToast(t('microCommands.messages.deleteNoPermission'), 'error');
            return;
        }

        if (!confirm(t('microCommands.messages.deleteConfirm', { command: commandName }))) {
            return;
        }

        try {
            const res = await api.delete(`/commands/microcommands/${id}`);

            if (res.data.success) {
                showToast(res.data.message, 'success');
                await loadMicroCommands();
            }
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message || t('microCommands.messages.deleteError');
            showToast(message, 'error');
        }
    };

    const openEditModal = (command: MicroCommand) => {
        setEditingCommand({ ...command });
        setSelectedEditGame(null); // Reset game selection when opening edit modal
        setShowEditModal(true);
    };

    if (permissionsLoading || loading) {
        return <LoadingText>{t('microCommands.loading')}</LoadingText>;
    }

    if (!hasMinimumLevel('commands')) {
        return (
            <AccessDenied
                title={t('microCommands.accessDenied.title')}
                message={t('microCommands.accessDenied.message')}
                backLabel={t('microCommands.accessDenied.backButton')}
                onBack={() => navigate('/dashboard')}
            />
        );
    }

    if (isKickSession) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-ds-surface border border-ds-border rounded-lg p-8 max-w-md text-center">
                    <Clock className="w-16 h-16 text-ds-accent-text mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-ds-text mb-2">
                        {t('microCommands.header.title')} — Próximamente en Kick
                    </h2>
                    <p className="text-ds-soft">
                        Kick ya soporta cambiar la categoría del stream por API, pero todavía no lo conectamos de nuestro lado. Vas a poder crear micro comandos acá apenas esté listo.
                    </p>
                </div>
            </div>
        );
    }

    const closeCreate = () => {
        setShowCreateModal(false);
        setNewCommand({ command: '', category: '' });
        setSelectedGame(null);
    };
    const closeEdit = () => {
        setShowEditModal(false);
        setEditingCommand(null);
        setSelectedEditGame(null);
    };

    return (
        <div className="panel-scale space-y-6">
            <ToastHost toast={toast} />

            <PageHeader
                title={t('microCommands.header.title')}
                subtitle={t('microCommands.header.subtitle', { channel })}
                actions={<Button icon={<Plus />} onClick={() => setShowCreateModal(true)}>{t('microCommands.header.createButton')}</Button>}
            />

            {!canDelete && <PermissionNotice>{t('microCommands.permissionInfo.message')}</PermissionNotice>}

            {commands.length === 0 ? (
                <Empty
                    icon={<Zap />}
                    title={t('microCommands.empty.title')}
                    action={<Button onClick={() => setShowCreateModal(true)}>{t('microCommands.empty.createButton')}</Button>}
                >
                    {t('microCommands.empty.message')}
                </Empty>
            ) : (
                <Table
                    align={['left', 'left', 'left', 'left', 'right']}
                    head={[
                        t('microCommands.table.headers.command'),
                        t('microCommands.table.headers.category'),
                        t('microCommands.table.headers.createdBy'),
                        t('microCommands.table.headers.createdAt'),
                        t('microCommands.table.headers.actions'),
                    ]}
                    rows={commands.map((cmd) => [
                        <code key="c" className="px-3 py-1 bg-ds-bg border border-ds-border rounded font-mono text-sm font-bold text-ds-accent-text">{cmd.shortCommand}</code>,
                        <span key="g" className="text-ds-text font-semibold">{cmd.categoryName}</span>,
                        <span key="u" className="text-ds-soft">{cmd.createdBy}</span>,
                        <span key="d" className="text-ds-soft">{new Date(cmd.createdAt).toLocaleDateString('es-ES')}</span>,
                        <div key="a" className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" aria-label={t('microCommands.table.actions.edit')} title={t('microCommands.table.actions.edit')}
                                onClick={() => openEditModal(cmd)}><Pencil /></Button>
                            {canDelete && (
                                <Button variant="ghost" size="sm" aria-label={t('microCommands.table.actions.delete')} title={t('microCommands.table.actions.delete')}
                                    onClick={() => handleDeleteCommand(cmd.id, cmd.shortCommand)}><Trash2 style={{ color: 'var(--ds-danger)' }} /></Button>
                            )}
                        </div>,
                    ])}
                />
            )}

            {showCreateModal && (
                <ModalShell
                    title={t('microCommands.createModal.title')}
                    onClose={closeCreate}
                    actions={<>
                        <Button variant="secondary" onClick={closeCreate}>{t('microCommands.createModal.cancelButton')}</Button>
                        <Button icon={<Save />} onClick={handleCreateCommand}>{t('microCommands.createModal.createButton')}</Button>
                    </>}
                >
                    <div className="space-y-4 mt-4">
                        <Field label={t('microCommands.createModal.commandLabel')} hint={t('microCommands.createModal.commandHelper')}>
                            <Input
                                type="text"
                                value={newCommand.command}
                                onChange={(e) => setNewCommand({ ...newCommand, command: e.target.value })}
                                placeholder={t('microCommands.createModal.commandPlaceholder')}
                            />
                        </Field>
                        <GameAutocomplete
                            value={selectedGame}
                            onChange={setSelectedGame}
                            placeholder={t('microCommands.createModal.gamePlaceholder')}
                        />
                    </div>
                </ModalShell>
            )}

            {showEditModal && editingCommand && (
                <ModalShell
                    title={t('microCommands.editModal.title')}
                    onClose={closeEdit}
                    actions={<>
                        <Button variant="secondary" onClick={closeEdit}>{t('microCommands.editModal.cancelButton')}</Button>
                        <Button icon={<Save />} onClick={handleEditCommand}>{t('microCommands.editModal.saveButton')}</Button>
                    </>}
                >
                    <div className="space-y-4 mt-4">
                        <Field label={t('microCommands.editModal.commandLabel')} hint={t('microCommands.editModal.commandHelper')}>
                            <Input type="text" value={editingCommand.shortCommand} disabled />
                        </Field>
                        <div>
                            <GameAutocomplete
                                value={selectedEditGame}
                                onChange={setSelectedEditGame}
                                placeholder={t('microCommands.editModal.gamePlaceholder')}
                            />
                            <p className="text-xs text-ds-soft mt-1">
                                {t('microCommands.editModal.currentLabel')} <span className="font-semibold">{editingCommand.categoryName}</span>
                            </p>
                        </div>
                    </div>
                </ModalShell>
            )}
        </div>
    );
}
