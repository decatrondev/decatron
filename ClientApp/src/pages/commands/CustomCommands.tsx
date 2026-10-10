import { Plus, Code, Download, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { Button, Empty } from '../../components/ds';
import PageHeader from '../../components/dashboard/PageHeader';
import { AccessDenied, LoadingText, PermissionNotice } from '../../components/dashboard/Notices';
import { ToastHost, useToast } from '../../components/dashboard/toast';
import CommandsTable from './custom/CommandsTable';
import CommandFormModal from './custom/CommandFormModal';
import ExportModal from './custom/ExportModal';
import ImportModal from './custom/ImportModal';
import { EMPTY_COMMAND, type CustomCommand, type NewCommand } from './custom/types';

export default function CustomCommands() {
    const { t } = useTranslation('commands');
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const navigate = useNavigate();
    const [commands, setCommands] = useState<CustomCommand[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingCommand, setEditingCommand] = useState<CustomCommand | null>(null);
    const [newCommand, setNewCommand] = useState<NewCommand>(EMPTY_COMMAND);
    const { toast, showToast } = useToast();
    const [showExportModal, setShowExportModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    const canDelete = hasMinimumLevel('moderation');

    useEffect(() => {
        if (!permissionsLoading && hasMinimumLevel('commands')) {
            loadCustomCommands();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    const loadCustomCommands = async () => {
        try {
            setLoading(true);
            const res = await api.get('/customcommands');
            setCommands(res.data);
        } catch (err) {
            console.error('Error loading custom commands:', err);
            showToast(t('customCommands.messages.loadError'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCommand = async () => {
        if (!newCommand.commandName || !newCommand.response) {
            showToast(t('customCommands.messages.fieldsRequired'), 'error');
            return;
        }

        try {
            await api.post('/customcommands', newCommand);
            showToast(t('customCommands.messages.createSuccess'), 'success');
            setShowCreateModal(false);
            setNewCommand(EMPTY_COMMAND);
            await loadCustomCommands();
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message || t('customCommands.messages.createError');
            showToast(message, 'error');
        }
    };

    const handleEditCommand = async () => {
        if (!editingCommand) return;

        try {
            await api.put(`/customcommands/${editingCommand.id}`, {
                response: editingCommand.response,
                restriction: editingCommand.restriction,
                isActive: editingCommand.isActive
            });
            showToast(t('customCommands.messages.updateSuccess'), 'success');
            setShowEditModal(false);
            setEditingCommand(null);
            await loadCustomCommands();
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message || t('customCommands.messages.updateError');
            showToast(message, 'error');
        }
    };

    const handleDeleteCommand = async (id: number, commandName: string) => {
        if (!canDelete) {
            showToast(t('customCommands.messages.deleteNoPermission'), 'error');
            return;
        }

        if (!confirm(t('customCommands.messages.deleteConfirm', { command: commandName }))) {
            return;
        }

        try {
            await api.delete(`/customcommands/${id}`);
            showToast(t('customCommands.messages.deleteSuccess'), 'success');
            await loadCustomCommands();
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message || t('customCommands.messages.deleteError');
            showToast(message, 'error');
        }
    };

    const handleExportCommands = () => {
        if (commands.length === 0) {
            showToast(t('customCommands.messages.exportError'), 'error');
            return;
        }
        setShowExportModal(true);
    };

    if (permissionsLoading || loading) {
        return <LoadingText>{t('customCommands.loading')}</LoadingText>;
    }

    if (!hasMinimumLevel('commands')) {
        return (
            <AccessDenied
                title={t('customCommands.accessDenied.title')}
                message={t('customCommands.accessDenied.message')}
                backLabel={t('customCommands.accessDenied.backButton')}
                onBack={() => navigate('/dashboard')}
            />
        );
    }

    const closeCreate = () => { setShowCreateModal(false); setNewCommand(EMPTY_COMMAND); };
    const closeEdit = () => { setShowEditModal(false); setEditingCommand(null); };

    return (
        <div className="panel-scale space-y-6">
            <ToastHost toast={toast} />

            <PageHeader
                title={t('customCommands.header.title')}
                subtitle={t('customCommands.header.subtitle')}
                actions={<>
                    <Button variant="secondary" icon={<Upload />} onClick={() => setShowImportModal(true)}>{t('customCommands.header.importButton')}</Button>
                    <Button variant="secondary" icon={<Download />} onClick={handleExportCommands} disabled={commands.length === 0}>{t('customCommands.header.exportButton')}</Button>
                    <Button icon={<Plus />} onClick={() => setShowCreateModal(true)}>{t('customCommands.header.createButton')}</Button>
                </>}
            />

            {!canDelete && <PermissionNotice>{t('customCommands.permissionInfo.message')}</PermissionNotice>}

            {commands.length === 0 ? (
                <Empty
                    icon={<Code />}
                    title={t('customCommands.empty.title')}
                    action={<Button onClick={() => setShowCreateModal(true)}>{t('customCommands.empty.createButton')}</Button>}
                >
                    {t('customCommands.empty.message')}
                </Empty>
            ) : (
                <CommandsTable
                    commands={commands}
                    canDelete={canDelete}
                    onEdit={(cmd) => { setEditingCommand({ ...cmd }); setShowEditModal(true); }}
                    onDelete={handleDeleteCommand}
                />
            )}

            {showCreateModal && (
                <CommandFormModal mode="create" values={newCommand} onChange={setNewCommand} onSave={handleCreateCommand} onClose={closeCreate} />
            )}

            {showEditModal && editingCommand && (
                <CommandFormModal mode="edit" values={editingCommand} onChange={(v) => setEditingCommand({ ...editingCommand, ...v })} onSave={handleEditCommand} onClose={closeEdit} />
            )}

            {showExportModal && (
                <ExportModal commands={commands} onClose={() => setShowExportModal(false)} showToast={showToast} />
            )}

            {showImportModal && (
                <ImportModal commands={commands} onClose={() => setShowImportModal(false)} onImported={loadCustomCommands} showToast={showToast} />
            )}
        </div>
    );
}
