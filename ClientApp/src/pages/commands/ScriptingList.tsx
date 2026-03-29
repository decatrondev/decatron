import { Lock, Plus, Pencil, Trash2, Power, PowerOff, FileCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

interface Script {
    id: number;
    commandName: string;
    scriptContent: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

interface Toast {
    message: string;
    type: 'success' | 'error' | 'info';
}

export default function ScriptingList() {
    const { t } = useTranslation('commands');
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const navigate = useNavigate();
    const [scripts, setScripts] = useState<Script[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<Toast | null>(null);

    const canDelete = hasMinimumLevel('moderation');

    useEffect(() => {
        if (!permissionsLoading && hasMinimumLevel('commands')) {
            loadScripts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    const loadScripts = async () => {
        try {
            setLoading(true);
            const res = await api.get('/scripts');
            setScripts(res.data);
        } catch (err) {
            console.error('Error loading scripts:', err);
            showToast(t('scripting.messages.loadError'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteScript = async (id: number, commandName: string) => {
        if (!canDelete) {
            showToast(t('scripting.messages.deleteNoPermission'), 'error');
            return;
        }

        if (!confirm(t('scripting.messages.deleteConfirm', { command: commandName }))) {
            return;
        }

        try {
            await api.delete(`/scripts/${id}`);
            showToast(t('scripting.messages.deleteSuccess'), 'success');
            await loadScripts();
        } catch (err: any) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message || t('scripting.messages.deleteError');
            showToast(message, 'error');
        }
    };

    const showToast = (message: string, type: 'success' | 'error' | 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    if (permissionsLoading || loading) {
        return <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">{t('scripting.loading')}</div>;
    }

    if (!hasMinimumLevel('commands')) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 max-w-md text-center">
                    <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-red-600 dark:text-red-400 mb-2">{t('scripting.accessDenied.title')}</h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mb-6">
                        {t('scripting.accessDenied.message')}
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                    >
                        {t('scripting.accessDenied.backButton')}
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
                        : toast.type === 'error'
                        ? 'bg-red-500 text-white'
                        : 'bg-blue-500 text-white'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">{t('scripting.header.title')}</h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">
                        {t('scripting.header.subtitle')}
                    </p>
                </div>
                <button
                    onClick={() => navigate('/commands/scripting/new')}
                    className="flex items-center gap-2 px-4 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-xl"
                >
                    <Plus className="w-5 h-5" />
                    {t('scripting.header.createButton')}
                </button>
            </div>

            {/* Permission Info */}
            {!canDelete && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <p className="text-blue-700 dark:text-blue-300 font-semibold">
                            {t('scripting.permissionInfo.message')}
                        </p>
                    </div>
                </div>
            )}

            {/* Scripts Table */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden shadow-lg">
                {scripts.length === 0 ? (
                    <div className="text-center py-12">
                        <FileCode className="w-16 h-16 text-[#64748b] dark:text-[#94a3b8] mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                            {t('scripting.empty.title')}
                        </h3>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mb-6">
                            {t('scripting.empty.message')}
                        </p>
                        <button
                            onClick={() => navigate('/commands/scripting/new')}
                            className="px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                        >
                            {t('scripting.empty.createButton')}
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-[#f8fafc] dark:bg-[#262626] border-b border-[#e2e8f0] dark:border-[#374151]">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                        {t('scripting.table.headers.command')}
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                        {t('scripting.table.headers.content')}
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                        {t('scripting.table.headers.status')}
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                        {t('scripting.table.headers.lastUpdate')}
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                        {t('scripting.table.headers.actions')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                                {scripts.map((script) => (
                                    <tr key={script.id} className="hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors">
                                        <td className="px-6 py-4">
                                            <code className="px-3 py-1 bg-[#f1f5f9] dark:bg-[#374151] rounded font-mono text-sm font-bold text-[#2563eb] dark:text-[#60a5fa]">
                                                {script.commandName}
                                            </code>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            <p className="text-[#1e293b] dark:text-[#f8fafc] truncate font-mono text-xs">
                                                {script.scriptContent.substring(0, 50)}...
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            {script.isActive ? (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                                    <Power className="w-3 h-3" />
                                                    {t('scripting.table.statusBadges.active')}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300">
                                                    <PowerOff className="w-3 h-3" />
                                                    {t('scripting.table.statusBadges.inactive')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-[#64748b] dark:text-[#94a3b8] text-sm">
                                            {new Date(script.updatedAt).toLocaleString('es-ES')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/commands/scripting/edit/${script.id}`)}
                                                    className="p-2 hover:bg-[#e2e8f0] dark:hover:bg-[#374151] rounded-lg transition-colors"
                                                    title={t('scripting.table.actions.edit')}
                                                >
                                                    <Pencil className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                </button>
                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDeleteScript(script.id, script.commandName)}
                                                        className="p-2 hover:bg-[#fee2e2] dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                        title={t('scripting.table.actions.delete')}
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
        </div>
    );
}
