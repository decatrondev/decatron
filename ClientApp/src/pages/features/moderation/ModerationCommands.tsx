import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../../../hooks/usePermissions';
import api from '../../../services/api';
import { Field, Select } from '../../../components/ds';
import { useToast } from '../../../components/dashboard/toast';
import { FilterSwitch } from './filterSwitch';
import { ModerationPage, PageLoading, SaveBar, Section } from './parts';

type Role = 'moderator' | 'lead_moderator' | 'broadcaster';

interface CommandSetting {
    enabled: boolean;
    minRole: Role;
    windowSeconds: number;
    action: 'timeout' | 'ban';
    timeoutSeconds: number;
}

type CommandsConfig = Record<string, CommandSetting>;

const COMMANDS: { key: string; usage: string[] }[] = [
    { key: 'permit', usage: ['!permit @usuario'] },
    { key: 'strikes', usage: ['!strikes @usuario'] },
    { key: 'resetstrikes', usage: ['!resetstrikes @usuario'] },
    { key: 'words', usage: ['!addword palabra [leve|medio|severo]', '!delword palabra'] },
    { key: 'links', usage: ['!addlink dominio', '!dellink dominio'] },
    { key: 'panic', usage: ['!panico', '!panico off'] },
    { key: 'nuke', usage: ['!nuke frase'] }
];

const ROLE_VALUES: Role[] = ['moderator', 'lead_moderator', 'broadcaster'];

const NUKE_WINDOWS = [15, 30, 60, 120, 300];
const NUKE_TIMEOUTS = [60, 300, 600, 1800, 3600, 86400];

function duration(seconds: number) {
    if (seconds >= 3600 && seconds % 3600 === 0) return `${seconds / 3600} h`;
    if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} min`;
    return `${seconds} s`;
}

export default function ModerationCommands() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const { t } = useTranslation('moderation');
    const { toast, showToast } = useToast();

    const [config, setConfig] = useState<CommandsConfig | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (permissionsLoading) return;
        if (!hasMinimumLevel('moderation')) {
            navigate('/dashboard');
            return;
        }
        api.get('/moderation/commands')
            .then(res => res.data.success && setConfig(res.data.commands))
            .catch(() => showToast(t('common.loadFailed'), 'error'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    const update = (key: string, changes: Partial<CommandSetting>) =>
        setConfig(c => (c ? { ...c, [key]: { ...c[key], ...changes } } : c));

    const save = async () => {
        if (!config) return;
        setSaving(true);
        try {
            const res = await api.put('/moderation/commands', config);
            if (!res.data.success) throw new Error();
            setConfig(res.data.commands);
            showToast(t('common.saved'), 'success');
        } catch {
            showToast(t('common.saveFailed'), 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!permissionsLoading && !hasMinimumLevel('moderation')) return null;

    const nuke = config?.nuke;

    return (
        <ModerationPage
            title={t('commands.title')}
            subtitle={t('commands.subtitle')}
            toast={toast}
        >
            {!config ? <PageLoading /> : (
                <div className="space-y-4">
                    {COMMANDS.map(cmd => {
                        const setting = config[cmd.key];
                        if (!setting) return null;
                        return (
                            <Section
                                key={cmd.key}
                                title={
                                    <span className="flex flex-wrap gap-2">
                                        {cmd.usage.map(u => <code key={u} className="px-2 py-1 rounded bg-ds-bg border border-ds-border text-sm font-bold text-ds-text">{u}</code>)}
                                    </span>
                                }
                                hint={t(`commands.items.${cmd.key}`)}
                                right={<FilterSwitch on={setting.enabled} onChange={(next) => update(cmd.key, { enabled: next })} label={t('hub.activate', { name: cmd.usage[0] })} />}
                            >
                                <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${setting.enabled ? '' : 'opacity-50'}`}>
                                    <Field label={t('commands.whoCanUse')}>
                                        <Select value={setting.minRole} onChange={(e) => update(cmd.key, { minRole: e.target.value as Role })}>
                                            {ROLE_VALUES.map(r => <option key={r} value={r}>{t(`commands.roles.${r}`)}</option>)}
                                        </Select>
                                    </Field>

                                    {cmd.key === 'nuke' && nuke && (
                                        <>
                                            <Field label={t('commands.lookBack')}>
                                                <Select value={nuke.windowSeconds} onChange={(e) => update('nuke', { windowSeconds: Number(e.target.value) })}>
                                                    {NUKE_WINDOWS.map(s => <option key={s} value={s}>{duration(s)}</option>)}
                                                </Select>
                                            </Field>
                                            <Field label={t('commands.sanction')}>
                                                <Select
                                                    value={nuke.action === 'ban' ? 'ban' : String(nuke.timeoutSeconds)}
                                                    onChange={(e) => e.target.value === 'ban'
                                                        ? update('nuke', { action: 'ban' })
                                                        : update('nuke', { action: 'timeout', timeoutSeconds: Number(e.target.value) })}
                                                >
                                                    {NUKE_TIMEOUTS.map(s => <option key={s} value={s}>{t('commands.timeoutOf', { time: duration(s) })}</option>)}
                                                    <option value="ban">{t('commands.permanentBan')}</option>
                                                </Select>
                                            </Field>
                                        </>
                                    )}
                                </div>
                            </Section>
                        );
                    })}

                    <SaveBar saving={saving} onClick={save} label={t('common.saveSettings')} savingLabel={t('common.saving')} />
                </div>
            )}
        </ModerationPage>
    );
}
