import { Lock, Plus, Pencil, Trash2, X, Save, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import GameAutocomplete, { type GameOption } from '../../components/GameAutocomplete';

interface MicroCommand {
    id: number;
    shortCommand: string;
    categoryName: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

interface Toast {
    message: string;
    type: 'success' | 'error';
}

export default function MicroCommands() {
    const { t } = useTranslation('commands');
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const navigate = useNavigate();
    const [commands, setCommands] = useState<MicroCommand[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingCommand, setEditingCommand] = useState<MicroCommand | null>(null);
    const [newCommand, setNewCommand] = useState({ command: '', category: '' });
    const [selectedGame, setSelectedGame] = useState<GameOption | null>(null);
    const [selectedEditGame, setSelectedEditGame] = useState<GameOption | null>(null);
    const [toast, setToast] = useState<Toast | null>(null);
    const [channel, setChannel] = useState('');

    const canDelete = hasMinimumLevel('moderation');

    useEffect(() => {
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

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const openEditModal = (command: MicroCommand) => {
        setEditingCommand({ ...command });
        setSelectedEditGame(null); // Reset game selection when opening edit modal
        setShowEditModal(true);
    };

    if (permissionsLoading || loading) {
        return <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">{t('microCommands.loading')}</div>;
    }

    if (!hasMinimumLevel('commands')) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 max-w-md text-center">
                    <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-red-600 dark:text-red-400 mb-2">{t('microCommands.accessDenied.title')}</h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mb-6">
                        {t('microCommands.accessDenied.message')}
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                    >
                        {t('microCommands.accessDenied.backButton')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg ${
                    toast.type === 'success'
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">{t('microCommands.header.title')}</h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">
                        {t('microCommands.header.subtitle', { channel })}
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                >
                    <Plus className="w-5 h-5" />
                    {t('microCommands.header.createButton')}
                </button>
            </div>

            {/* Permission Info */}
            {!canDelete && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <p className="text-blue-700 dark:text-blue-300 font-semibold">
                            {t('microCommands.permissionInfo.message')}
                        </p>
                    </div>
                </div>
            )}

            {/* Commands Table */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
                {commands.length === 0 ? (
                    <div className="text-center py-12">
                        <Zap className="w-16 h-16 text-[#64748b] dark:text-[#94a3b8] mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                            {t('microCommands.empty.title')}
                        </h3>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mb-6">
                            {t('microCommands.empty.message')}
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                        >
                            {t('microCommands.empty.createButton')}
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-[#f8fafc] dark:bg-[#262626] border-b border-[#e2e8f0] dark:border-[#374151]">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                        {t('microCommands.table.headers.command')}
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                        {t('microCommands.table.headers.category')}
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                        {t('microCommands.table.headers.createdBy')}
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                        {t('microCommands.table.headers.createdAt')}
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                        {t('microCommands.table.headers.actions')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                                {commands.map((cmd) => (
                                    <tr key={cmd.id} className="hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors">
                                        <td className="px-6 py-4">
                                            <code className="px-3 py-1 bg-[#f1f5f9] dark:bg-[#374151] rounded font-mono text-sm font-bold text-[#2563eb] dark:text-[#60a5fa]">
                                                {cmd.shortCommand}
                                            </code>
                                        </td>
                                        <td className="px-6 py-4 text-[#1e293b] dark:text-[#f8fafc] font-semibold">
                                            {cmd.categoryName}
                                        </td>
                                        <td className="px-6 py-4 text-[#64748b] dark:text-[#94a3b8]">
                                            {cmd.createdBy}
                                        </td>
                                        <td className="px-6 py-4 text-[#64748b] dark:text-[#94a3b8]">
                                            {new Date(cmd.createdAt).toLocaleDateString('es-ES')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEditModal(cmd)}
                                                    className="p-2 hover:bg-[#e2e8f0] dark:hover:bg-[#374151] rounded-lg transition-colors"
                                                    title={t('microCommands.table.actions.edit')}
                                                >
                                                    <Pencil className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                </button>
                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDeleteCommand(cmd.id, cmd.shortCommand)}
                                                        className="p-2 hover:bg-[#fee2e2] dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                        title={t('microCommands.table.actions.delete')}
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 max-w-md w-full mx-4 border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                {t('microCommands.createModal.title')}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewCommand({ command: '', category: '' });
                                    setSelectedGame(null);
                                }}
                                className="p-2 hover:bg-[#f1f5f9] dark:hover:bg-[#374151] rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                    {t('microCommands.createModal.commandLabel')}
                                </label>
                                <input
                                    type="text"
                                    value={newCommand.command}
                                    onChange={(e) => setNewCommand({ ...newCommand, command: e.target.value })}
                                    placeholder={t('microCommands.createModal.commandPlaceholder')}
                                    className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc]"
                                />
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    {t('microCommands.createModal.commandHelper')}
                                </p>
                            </div>

                            <div>
                                <GameAutocomplete
                                    value={selectedGame}
                                    onChange={setSelectedGame}
                                    placeholder={t('microCommands.createModal.gamePlaceholder')}
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleCreateCommand}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                                >
                                    <Save className="w-5 h-5" />
                                    {t('microCommands.createModal.createButton')}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setNewCommand({ command: '', category: '' });
                                        setSelectedGame(null);
                                    }}
                                    className="flex-1 px-4 py-3 bg-[#f1f5f9] dark:bg-[#374151] hover:bg-[#e2e8f0] dark:hover:bg-[#4b5563] text-[#1e293b] dark:text-[#f8fafc] font-bold rounded-lg transition-all"
                                >
                                    {t('microCommands.createModal.cancelButton')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editingCommand && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 max-w-md w-full mx-4 border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                {t('microCommands.editModal.title')}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowEditModal(false);
                                    setEditingCommand(null);
                                    setSelectedEditGame(null);
                                }}
                                className="p-2 hover:bg-[#f1f5f9] dark:hover:bg-[#374151] rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                    {t('microCommands.editModal.commandLabel')}
                                </label>
                                <input
                                    type="text"
                                    value={editingCommand.shortCommand}
                                    disabled
                                    className="w-full px-4 py-3 bg-[#e2e8f0] dark:bg-[#374151] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#64748b] dark:text-[#94a3b8] cursor-not-allowed"
                                />
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    {t('microCommands.editModal.commandHelper')}
                                </p>
                            </div>

                            <div>
                                <GameAutocomplete
                                    value={selectedEditGame}
                                    onChange={setSelectedEditGame}
                                    placeholder={t('microCommands.editModal.gamePlaceholder')}
                                />
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    {t('microCommands.editModal.currentLabel')} <span className="font-semibold">{editingCommand.categoryName}</span>
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleEditCommand}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                                >
                                    <Save className="w-5 h-5" />
                                    {t('microCommands.editModal.saveButton')}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setEditingCommand(null);
                                        setSelectedEditGame(null);
                                    }}
                                    className="flex-1 px-4 py-3 bg-[#f1f5f9] dark:bg-[#374151] hover:bg-[#e2e8f0] dark:hover:bg-[#4b5563] text-[#1e293b] dark:text-[#f8fafc] font-bold rounded-lg transition-all"
                                >
                                    {t('microCommands.editModal.cancelButton')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
