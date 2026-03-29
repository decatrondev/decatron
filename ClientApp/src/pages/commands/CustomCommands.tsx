import { Lock, Plus, Pencil, Trash2, X, Save, Code, Power, PowerOff, Shield, Users, Star, Download, Upload, CheckSquare, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

interface CustomCommand {
    id: number;
    commandName: string;
    response: string;
    restriction: 'all' | 'mod' | 'vip' | 'sub';
    isActive: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

interface Toast {
    message: string;
    type: 'success' | 'error';
}

export default function CustomCommands() {
    const { t } = useTranslation('commands');
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const navigate = useNavigate();
    const [commands, setCommands] = useState<CustomCommand[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingCommand, setEditingCommand] = useState<CustomCommand | null>(null);
    const [newCommand, setNewCommand] = useState({
        commandName: '',
        response: '',
        restriction: 'all' as 'all' | 'mod' | 'vip' | 'sub',
        isActive: true
    });
    const [toast, setToast] = useState<Toast | null>(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [selectedCommands, setSelectedCommands] = useState<number[]>([]);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[] | null>(null);

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
            setNewCommand({ commandName: '', response: '', restriction: 'all', isActive: true });
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

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const openEditModal = (command: CustomCommand) => {
        setEditingCommand({ ...command });
        setShowEditModal(true);
    };

    const getRestrictionIcon = (restriction: string) => {
        switch (restriction) {
            case 'mod': return <Shield className="w-4 h-4" />;
            case 'vip': return <Star className="w-4 h-4" />;
            case 'sub': return <Users className="w-4 h-4" />;
            default: return <Users className="w-4 h-4" />;
        }
    };

    const getRestrictionLabel = (restriction: string) => {
        switch (restriction) {
            case 'mod': return t('customCommands.restrictions.mod');
            case 'vip': return t('customCommands.restrictions.vip');
            case 'sub': return t('customCommands.restrictions.sub');
            default: return t('customCommands.restrictions.all');
        }
    };

    const getRestrictionColor = (restriction: string) => {
        switch (restriction) {
            case 'mod': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
            case 'vip': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
            case 'sub': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
            default: return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300';
        }
    };

    const handleExportCommands = () => {
        if (commands.length === 0) {
            showToast(t('customCommands.messages.exportError'), 'error');
            return;
        }
        setShowExportModal(true);
        setSelectedCommands(commands.map(cmd => cmd.id));
    };

    const handleDownloadExport = () => {
        const commandsToExport = commands.filter(cmd => selectedCommands.includes(cmd.id));

        if (commandsToExport.length === 0) {
            showToast(t('customCommands.messages.exportError'), 'error');
            return;
        }

        const exportData = commandsToExport.map(cmd => ({
            commandName: cmd.commandName,
            response: cmd.response,
            restriction: cmd.restriction,
            isActive: cmd.isActive
        }));

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `custom-commands-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast(t('customCommands.messages.exportSuccess'), 'success');
        setShowExportModal(false);
        setSelectedCommands([]);
    };

    const toggleCommandSelection = (id: number) => {
        setSelectedCommands(prev =>
            prev.includes(id) ? prev.filter(cmdId => cmdId !== id) : [...prev, id]
        );
    };

    const toggleAllCommands = () => {
        if (selectedCommands.length === commands.length) {
            setSelectedCommands([]);
        } else {
            setSelectedCommands(commands.map(cmd => cmd.id));
        }
    };

    const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.name.endsWith('.json')) {
                showToast(t('customCommands.messages.importInvalidFile'), 'error');
                return;
            }
            setImportFile(file);
            await loadPreview(file);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        const file = e.dataTransfer.files[0];
        if (file) {
            if (!file.name.endsWith('.json')) {
                showToast(t('customCommands.messages.importInvalidFile'), 'error');
                return;
            }
            setImportFile(file);
            await loadPreview(file);
        }
    };

    const loadPreview = async (file: File) => {
        try {
            const fileContent = await file.text();
            const parsedData = JSON.parse(fileContent);

            if (!Array.isArray(parsedData)) {
                showToast(t('customCommands.messages.importInvalidFile'), 'error');
                setPreviewData(null);
                return;
            }

            setPreviewData(parsedData);
        } catch (err) {
            showToast(t('customCommands.messages.importInvalidFile'), 'error');
            setPreviewData(null);
        }
    };

    const handleImportCommands = async () => {
        if (!importFile) {
            showToast(t('customCommands.messages.importInvalidFile'), 'error');
            return;
        }

        try {
            const fileContent = await importFile.text();
            const importedCommands = JSON.parse(fileContent);

            if (!Array.isArray(importedCommands)) {
                showToast(t('customCommands.messages.importInvalidFile'), 'error');
                return;
            }

            let successCount = 0;
            let errorCount = 0;
            const errors: string[] = [];

            for (const cmd of importedCommands) {
                if (!cmd.commandName || !cmd.response) {
                    errorCount++;
                    errors.push(`Comando sin nombre o respuesta`);
                    continue;
                }

                // Validar si el comando ya existe
                const existingCommand = commands.find(
                    c => c.commandName.toLowerCase() === cmd.commandName.toLowerCase()
                );

                if (existingCommand) {
                    errorCount++;
                    errors.push(`"${cmd.commandName}" ya existe en el sistema`);
                    continue;
                }

                try {
                    await api.post('/customcommands', {
                        commandName: cmd.commandName,
                        response: cmd.response,
                        restriction: cmd.restriction || 'all',
                        isActive: cmd.isActive !== undefined ? cmd.isActive : true
                    });
                    successCount++;
                } catch (err: any) {
                    errorCount++;
                    const message = err.response?.data?.message || 'Error desconocido';
                    errors.push(`${cmd.commandName}: ${message}`);
                }
            }

            if (successCount > 0) {
                await loadCustomCommands();
            }

            if (errorCount === 0) {
                showToast(t('customCommands.messages.importSuccess', { count: successCount }), 'success');
            } else {
                showToast(t('customCommands.messages.importError'), 'error');
                console.error('Errores de importación:', errors);
            }

            setShowImportModal(false);
            setImportFile(null);
            setPreviewData(null);
        } catch (err) {
            showToast(t('customCommands.messages.importInvalidFile'), 'error');
            console.error('Import error:', err);
        }
    };

    if (permissionsLoading || loading) {
        return <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">{t('customCommands.loading')}</div>;
    }

    if (!hasMinimumLevel('commands')) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 max-w-md text-center">
                    <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-red-600 dark:text-red-400 mb-2">{t('customCommands.accessDenied.title')}</h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mb-6">
                        {t('customCommands.accessDenied.message')}
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                    >
                        {t('customCommands.accessDenied.backButton')}
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
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">{t('customCommands.header.title')}</h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">
                        {t('customCommands.header.subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-all"
                    >
                        <Upload className="w-5 h-5" />
                        {t('customCommands.header.importButton')}
                    </button>
                    <button
                        onClick={handleExportCommands}
                        disabled={commands.length === 0}
                        className="flex items-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all"
                    >
                        <Download className="w-5 h-5" />
                        {t('customCommands.header.exportButton')}
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        {t('customCommands.header.createButton')}
                    </button>
                </div>
            </div>

            {/* Permission Info */}
            {!canDelete && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <p className="text-blue-700 dark:text-blue-300 font-semibold">
                            {t('customCommands.permissionInfo.message')}
                        </p>
                    </div>
                </div>
            )}

            {/* Commands Table */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
                {commands.length === 0 ? (
                    <div className="text-center py-12">
                        <Code className="w-16 h-16 text-[#64748b] dark:text-[#94a3b8] mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                            {t('customCommands.empty.title')}
                        </h3>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mb-6">
                            {t('customCommands.empty.message')}
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                        >
                            {t('customCommands.empty.createButton')}
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-[#f8fafc] dark:bg-[#262626] border-b border-[#e2e8f0] dark:border-[#374151]">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                        {t('customCommands.table.headers.command')}
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                        {t('customCommands.table.headers.response')}
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                        {t('customCommands.table.headers.restriction')}
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                        {t('customCommands.table.headers.status')}
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                        {t('customCommands.table.headers.createdBy')}
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                        {t('customCommands.table.headers.actions')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                                {commands.map((cmd) => (
                                    <tr key={cmd.id} className="hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors">
                                        <td className="px-6 py-4">
                                            <code className="px-3 py-1 bg-[#f1f5f9] dark:bg-[#374151] rounded font-mono text-sm font-bold text-[#2563eb] dark:text-[#60a5fa]">
                                                {cmd.commandName}
                                            </code>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            <p className="text-[#1e293b] dark:text-[#f8fafc] truncate">
                                                {cmd.response}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${getRestrictionColor(cmd.restriction)}`}>
                                                {getRestrictionIcon(cmd.restriction)}
                                                {getRestrictionLabel(cmd.restriction)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {cmd.isActive ? (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                                    <Power className="w-3 h-3" />
                                                    {t('customCommands.table.statusBadges.active')}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300">
                                                    <PowerOff className="w-3 h-3" />
                                                    {t('customCommands.table.statusBadges.inactive')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-[#64748b] dark:text-[#94a3b8]">
                                            {cmd.createdBy}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEditModal(cmd)}
                                                    className="p-2 hover:bg-[#e2e8f0] dark:hover:bg-[#374151] rounded-lg transition-colors"
                                                    title={t('customCommands.table.actions.edit')}
                                                >
                                                    <Pencil className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                </button>
                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDeleteCommand(cmd.id, cmd.commandName)}
                                                        className="p-2 hover:bg-[#fee2e2] dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                        title={t('customCommands.table.actions.delete')}
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 max-w-2xl w-full mx-4 border border-[#e2e8f0] dark:border-[#374151] max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                {t('customCommands.createModal.title')}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewCommand({ commandName: '', response: '', restriction: 'all', isActive: true });
                                }}
                                className="p-2 hover:bg-[#f1f5f9] dark:hover:bg-[#374151] rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                    {t('customCommands.createModal.commandLabel')}
                                </label>
                                <input
                                    type="text"
                                    value={newCommand.commandName}
                                    onChange={(e) => setNewCommand({ ...newCommand, commandName: e.target.value })}
                                    placeholder={t('customCommands.createModal.commandPlaceholder')}
                                    className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc] font-mono"
                                />
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    {t('customCommands.createModal.commandHelper')}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                    {t('customCommands.createModal.responseLabel')}
                                </label>
                                <textarea
                                    value={newCommand.response}
                                    onChange={(e) => setNewCommand({ ...newCommand, response: e.target.value })}
                                    placeholder={t('customCommands.createModal.responsePlaceholder')}
                                    rows={4}
                                    className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc] resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                    {t('customCommands.createModal.restrictionLabel')}
                                </label>
                                <select
                                    value={newCommand.restriction}
                                    onChange={(e) => setNewCommand({ ...newCommand, restriction: e.target.value as 'all' | 'mod' | 'vip' | 'sub' })}
                                    className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc]"
                                >
                                    <option value="all">{t('customCommands.restrictions.all')}</option>
                                    <option value="sub">{t('customCommands.restrictions.sub')}</option>
                                    <option value="vip">{t('customCommands.restrictions.vip')}</option>
                                    <option value="mod">{t('customCommands.restrictions.mod')}</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={newCommand.isActive}
                                    onChange={(e) => setNewCommand({ ...newCommand, isActive: e.target.checked })}
                                    className="w-5 h-5 text-[#2563eb] bg-[#f8fafc] dark:bg-[#262626] border-[#e2e8f0] dark:border-[#374151] rounded focus:ring-2 focus:ring-[#2563eb]"
                                />
                                <label htmlFor="isActive" className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] cursor-pointer">
                                    {t('customCommands.createModal.statusActive')}
                                </label>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleCreateCommand}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                                >
                                    <Save className="w-5 h-5" />
                                    {t('customCommands.createModal.createButton')}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setNewCommand({ commandName: '', response: '', restriction: 'all', isActive: true });
                                    }}
                                    className="flex-1 px-4 py-3 bg-[#f1f5f9] dark:bg-[#374151] hover:bg-[#e2e8f0] dark:hover:bg-[#4b5563] text-[#1e293b] dark:text-[#f8fafc] font-bold rounded-lg transition-all"
                                >
                                    {t('customCommands.createModal.cancelButton')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editingCommand && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 max-w-2xl w-full mx-4 border border-[#e2e8f0] dark:border-[#374151] max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                {t('customCommands.editModal.title')}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowEditModal(false);
                                    setEditingCommand(null);
                                }}
                                className="p-2 hover:bg-[#f1f5f9] dark:hover:bg-[#374151] rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                    {t('customCommands.editModal.commandLabel')}
                                </label>
                                <input
                                    type="text"
                                    value={editingCommand.commandName}
                                    disabled
                                    className="w-full px-4 py-3 bg-[#e2e8f0] dark:bg-[#374151] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#64748b] dark:text-[#94a3b8] font-mono cursor-not-allowed"
                                />
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    {t('customCommands.editModal.commandHelper')}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                    {t('customCommands.editModal.responseLabel')}
                                </label>
                                <textarea
                                    value={editingCommand.response}
                                    onChange={(e) => setEditingCommand({ ...editingCommand, response: e.target.value })}
                                    placeholder={t('customCommands.createModal.responsePlaceholder')}
                                    rows={4}
                                    className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc] resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                    {t('customCommands.editModal.restrictionLabel')}
                                </label>
                                <select
                                    value={editingCommand.restriction}
                                    onChange={(e) => setEditingCommand({ ...editingCommand, restriction: e.target.value as 'all' | 'mod' | 'vip' | 'sub' })}
                                    className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc]"
                                >
                                    <option value="all">{t('customCommands.restrictions.all')}</option>
                                    <option value="sub">{t('customCommands.restrictions.sub')}</option>
                                    <option value="vip">{t('customCommands.restrictions.vip')}</option>
                                    <option value="mod">{t('customCommands.restrictions.mod')}</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="editIsActive"
                                    checked={editingCommand.isActive}
                                    onChange={(e) => setEditingCommand({ ...editingCommand, isActive: e.target.checked })}
                                    className="w-5 h-5 text-[#2563eb] bg-[#f8fafc] dark:bg-[#262626] border-[#e2e8f0] dark:border-[#374151] rounded focus:ring-2 focus:ring-[#2563eb]"
                                />
                                <label htmlFor="editIsActive" className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] cursor-pointer">
                                    {t('customCommands.editModal.statusLabel')}
                                </label>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleEditCommand}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                                >
                                    <Save className="w-5 h-5" />
                                    {t('customCommands.editModal.saveButton')}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setEditingCommand(null);
                                    }}
                                    className="flex-1 px-4 py-3 bg-[#f1f5f9] dark:bg-[#374151] hover:bg-[#e2e8f0] dark:hover:bg-[#4b5563] text-[#1e293b] dark:text-[#f8fafc] font-bold rounded-lg transition-all"
                                >
                                    {t('customCommands.editModal.cancelButton')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 max-w-3xl w-full mx-4 border border-[#e2e8f0] dark:border-[#374151] max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                    {t('customCommands.exportModal.title')}
                                </h2>
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    {t('customCommands.exportModal.message')}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowExportModal(false);
                                    setSelectedCommands([]);
                                }}
                                className="p-2 hover:bg-[#f1f5f9] dark:hover:bg-[#374151] rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-4 flex items-center justify-between p-3 bg-[#f8fafc] dark:bg-[#262626] rounded-lg">
                            <button
                                onClick={toggleAllCommands}
                                className="flex items-center gap-2 text-sm font-bold text-[#2563eb] dark:text-[#60a5fa] hover:underline"
                            >
                                {selectedCommands.length === commands.length ? (
                                    <>
                                        <CheckSquare className="w-4 h-4" />
                                        {t('customCommands.table.deselectAll')}
                                    </>
                                ) : (
                                    <>
                                        <Square className="w-4 h-4" />
                                        {t('customCommands.table.selectAll')}
                                    </>
                                )}
                            </button>
                            <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                {t('customCommands.exportModal.selectedCount', { count: selectedCommands.length })} {commands.length}
                            </span>
                        </div>

                        <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
                            {commands.map((cmd) => (
                                <div
                                    key={cmd.id}
                                    onClick={() => toggleCommandSelection(cmd.id)}
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                        selectedCommands.includes(cmd.id)
                                            ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] hover:bg-[#f8fafc] dark:hover:bg-[#262626]'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="pt-1">
                                            {selectedCommands.includes(cmd.id) ? (
                                                <CheckSquare className="w-5 h-5 text-[#2563eb]" />
                                            ) : (
                                                <Square className="w-5 h-5 text-[#64748b]" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <code className="px-2 py-1 bg-[#f1f5f9] dark:bg-[#374151] rounded font-mono text-sm font-bold text-[#2563eb] dark:text-[#60a5fa]">
                                                    {cmd.commandName}
                                                </code>
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${getRestrictionColor(cmd.restriction)}`}>
                                                    {getRestrictionIcon(cmd.restriction)}
                                                    {getRestrictionLabel(cmd.restriction)}
                                                </span>
                                                {cmd.isActive ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                                        <Power className="w-3 h-3" />
                                                        {t('customCommands.table.statusBadges.active')}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300">
                                                        <PowerOff className="w-3 h-3" />
                                                        {t('customCommands.table.statusBadges.inactive')}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] truncate">
                                                {cmd.response}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                            <button
                                onClick={handleDownloadExport}
                                disabled={selectedCommands.length === 0}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all"
                            >
                                <Download className="w-5 h-5" />
                                {t('customCommands.exportModal.exportButton')} ({selectedCommands.length})
                            </button>
                            <button
                                onClick={() => {
                                    setShowExportModal(false);
                                    setSelectedCommands([]);
                                }}
                                className="flex-1 px-4 py-3 bg-[#f1f5f9] dark:bg-[#374151] hover:bg-[#e2e8f0] dark:hover:bg-[#4b5563] text-[#1e293b] dark:text-[#f8fafc] font-bold rounded-lg transition-all"
                            >
                                {t('customCommands.exportModal.cancelButton')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 max-w-2xl w-full mx-4 border border-[#e2e8f0] dark:border-[#374151] max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                    {t('customCommands.importModal.title')}
                                </h2>
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    {t('customCommands.importModal.dropzoneText')}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowImportModal(false);
                                    setImportFile(null);
                                    setPreviewData(null);
                                }}
                                className="p-2 hover:bg-[#f1f5f9] dark:hover:bg-[#374151] rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                className="border-2 border-dashed border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] dark:hover:border-[#60a5fa] rounded-lg p-8 text-center transition-colors"
                            >
                                <Upload className="w-12 h-12 text-[#64748b] dark:text-[#94a3b8] mx-auto mb-4" />
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleImportFile}
                                    className="hidden"
                                    id="import-file"
                                />
                                <label
                                    htmlFor="import-file"
                                    className="inline-block px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer transition-all"
                                >
                                    {t('customCommands.importModal.dropzoneText')}
                                </label>
                                {importFile && (
                                    <p className="mt-4 text-sm text-[#1e293b] dark:text-[#f8fafc] font-semibold">
                                        {t('customCommands.importModal.fileSelected')} {importFile.name}
                                    </p>
                                )}
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-2">
                                    📋 Formato del archivo JSON:
                                </h4>
                                <pre className="text-xs bg-white dark:bg-[#1B1C1D] p-3 rounded border border-blue-200 dark:border-blue-800 overflow-x-auto text-[#1e293b] dark:text-[#e2e8f0] font-mono">
{`[
  {
    "commandName": "nombre",
    "response": "Respuesta del comando",
    "restriction": "all",
    "isActive": true
  }
]`}
                                </pre>
                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                                    <strong>restriction:</strong> "all", "sub", "vip", "mod" | <strong>isActive:</strong> true/false
                                </p>
                            </div>

                            {previewData && previewData.length > 0 && (
                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                                    <h4 className="text-sm font-bold text-green-900 dark:text-green-300 mb-3 flex items-center gap-2">
                                        {t('customCommands.importModal.previewTitle')} ({previewData.length})
                                    </h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {previewData.map((cmd, idx) => {
                                            const isDuplicate = commands.some(
                                                c => c.commandName.toLowerCase() === cmd.commandName?.toLowerCase()
                                            );
                                            const isInvalid = !cmd.commandName || !cmd.response;

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`p-3 rounded-lg border-2 ${
                                                        isInvalid
                                                            ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                                                            : isDuplicate
                                                            ? 'border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                                                            : 'border-green-200 dark:border-green-800 bg-white dark:bg-[#1B1C1D]'
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <code className="px-2 py-0.5 bg-[#f1f5f9] dark:bg-[#374151] rounded font-mono text-xs font-bold text-[#2563eb] dark:text-[#60a5fa] truncate">
                                                                    {cmd.commandName || '(sin nombre)'}
                                                                </code>
                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                                    cmd.restriction === 'mod' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                                                    cmd.restriction === 'vip' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                                                                    cmd.restriction === 'sub' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                                                    'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
                                                                }`}>
                                                                    {cmd.restriction || 'all'}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] truncate">
                                                                {cmd.response || '(sin respuesta)'}
                                                            </p>
                                                        </div>
                                                        {isInvalid && (
                                                            <span className="text-xs font-bold text-red-700 dark:text-red-300 whitespace-nowrap">
                                                                {t('customCommands.importModal.commandStatus.invalid')}
                                                            </span>
                                                        )}
                                                        {!isInvalid && isDuplicate && (
                                                            <span className="text-xs font-bold text-yellow-700 dark:text-yellow-300 whitespace-nowrap">
                                                                {t('customCommands.importModal.commandStatus.duplicate')}
                                                            </span>
                                                        )}
                                                        {!isInvalid && !isDuplicate && (
                                                            <span className="text-xs font-bold text-green-700 dark:text-green-300 whitespace-nowrap">
                                                                {t('customCommands.importModal.commandStatus.valid')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-green-700 dark:text-green-300 mt-3">
                                        {previewData.filter(cmd => !cmd.commandName || !cmd.response).length > 0 && (
                                            <span className="block mb-1">
                                                ❌ <strong>{previewData.filter(cmd => !cmd.commandName || !cmd.response).length}</strong> comando(s) inválido(s)
                                            </span>
                                        )}
                                        {previewData.filter(cmd => cmd.commandName && commands.some(c => c.commandName.toLowerCase() === cmd.commandName?.toLowerCase())).length > 0 && (
                                            <span className="block mb-1">
                                                ⚠️ <strong>{previewData.filter(cmd => cmd.commandName && commands.some(c => c.commandName.toLowerCase() === cmd.commandName?.toLowerCase())).length}</strong> comando(s) duplicado(s) (se omitirán)
                                            </span>
                                        )}
                                        ✓ <strong>{previewData.filter(cmd => cmd.commandName && cmd.response && !commands.some(c => c.commandName.toLowerCase() === cmd.commandName?.toLowerCase())).length}</strong> comando(s) listo(s) para importar
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleImportCommands}
                                    disabled={!importFile}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all"
                                >
                                    <Upload className="w-5 h-5" />
                                    {t('customCommands.importModal.importButton', { count: previewData?.length || 0 })}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowImportModal(false);
                                        setImportFile(null);
                                        setPreviewData(null);
                                    }}
                                    className="flex-1 px-4 py-3 bg-[#f1f5f9] dark:bg-[#374151] hover:bg-[#e2e8f0] dark:hover:bg-[#4b5563] text-[#1e293b] dark:text-[#f8fafc] font-bold rounded-lg transition-all"
                                >
                                    {t('customCommands.importModal.cancelButton')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
