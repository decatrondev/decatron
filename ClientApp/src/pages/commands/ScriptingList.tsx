import { Plus, Pencil, Trash2, Power, PowerOff, FileCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { Button, Badge, Empty, Table } from '../../components/ds';
import PageHeader from '../../components/dashboard/PageHeader';
import { AccessDenied, LoadingText, PermissionNotice } from '../../components/dashboard/Notices';
import { ToastHost, useToast } from '../../components/dashboard/toast';

interface Script {
    id: number;
    commandName: string;
    scriptContent: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export default function ScriptingList() {
    const { t } = useTranslation('commands');
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const navigate = useNavigate();
    const [scripts, setScripts] = useState<Script[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast, showToast } = useToast();

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

    if (permissionsLoading || loading) {
        return <LoadingText>{t('scripting.loading')}</LoadingText>;
    }

    if (!hasMinimumLevel('commands')) {
        return (
            <AccessDenied
                title={t('scripting.accessDenied.title')}
                message={t('scripting.accessDenied.message')}
                backLabel={t('scripting.accessDenied.backButton')}
                onBack={() => navigate('/dashboard')}
            />
        );
    }

    const createScript = () => navigate('/commands/scripting/new');

    return (
        <div className="panel-scale space-y-6">
            <ToastHost toast={toast} />

            <PageHeader
                title={t('scripting.header.title')}
                subtitle={t('scripting.header.subtitle')}
                actions={<Button icon={<Plus />} onClick={createScript}>{t('scripting.header.createButton')}</Button>}
            />

            {!canDelete && <PermissionNotice>{t('scripting.permissionInfo.message')}</PermissionNotice>}

            {scripts.length === 0 ? (
                <Empty
                    icon={<FileCode />}
                    title={t('scripting.empty.title')}
                    action={<Button onClick={createScript}>{t('scripting.empty.createButton')}</Button>}
                >
                    {t('scripting.empty.message')}
                </Empty>
            ) : (
                <Table
                    align={['left', 'left', 'left', 'left', 'right']}
                    head={[
                        t('scripting.table.headers.command'),
                        t('scripting.table.headers.content'),
                        t('scripting.table.headers.status'),
                        t('scripting.table.headers.lastUpdate'),
                        t('scripting.table.headers.actions'),
                    ]}
                    rows={scripts.map((script) => [
                        <code key="c" className="px-3 py-1 bg-ds-bg border border-ds-border rounded font-mono text-sm font-bold text-ds-accent-text">{script.commandName}</code>,
                        <p key="s" className="text-ds-text truncate max-w-xs font-mono text-xs">{script.scriptContent.substring(0, 50)}...</p>,
                        script.isActive
                            ? <Badge key="b" tone="ok"><Power className="w-3 h-3" />{t('scripting.table.statusBadges.active')}</Badge>
                            : <Badge key="b"><PowerOff className="w-3 h-3" />{t('scripting.table.statusBadges.inactive')}</Badge>,
                        <span key="d" className="text-ds-soft text-sm">{new Date(script.updatedAt).toLocaleString('es-ES')}</span>,
                        <div key="a" className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" aria-label={t('scripting.table.actions.edit')} title={t('scripting.table.actions.edit')}
                                onClick={() => navigate(`/commands/scripting/edit/${script.id}`)}><Pencil /></Button>
                            {canDelete && (
                                <Button variant="ghost" size="sm" aria-label={t('scripting.table.actions.delete')} title={t('scripting.table.actions.delete')}
                                    onClick={() => handleDeleteScript(script.id, script.commandName)}><Trash2 style={{ color: 'var(--ds-danger)' }} /></Button>
                            )}
                        </div>,
                    ])}
                />
            )}
        </div>
    );
}
