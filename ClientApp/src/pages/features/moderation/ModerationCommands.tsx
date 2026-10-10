import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const COMMANDS: { key: string; usage: string[]; description: string }[] = [
    { key: 'permit', usage: ['!permit @usuario'], description: 'Deja pasar los links de un usuario. La duración se configura en el filtro de links.' },
    { key: 'strikes', usage: ['!strikes @usuario'], description: 'Muestra en qué strike está un usuario y cuándo baja el próximo.' },
    { key: 'resetstrikes', usage: ['!resetstrikes @usuario'], description: 'Deja en 0 los strikes de un usuario.' },
    { key: 'words', usage: ['!addword palabra [leve|medio|severo]', '!delword palabra'], description: 'Agrega o quita palabras prohibidas desde el chat. Sin severidad, se agrega como leve.' },
    { key: 'links', usage: ['!addlink dominio', '!dellink dominio'], description: 'Agrega o quita dominios permitidos del filtro de links.' },
    { key: 'panic', usage: ['!panico', '!panico off'], description: 'Activa el modo pánico (o lo extiende si ya estaba) y lo apaga. Qué hace se configura en Raids y bots. También funcionan !pánico y !panic. No disponible en Kick.' },
    { key: 'nuke', usage: ['!nuke frase'], description: 'Sanciona a todos los que escribieron esa frase en los últimos segundos. No toca al streamer, los mods ni la whitelist.' }
];

const ROLE_OPTIONS: { value: Role; label: string }[] = [
    { value: 'moderator', label: 'Moderadores y superiores' },
    { value: 'lead_moderator', label: 'Lead Moderators y superiores' },
    { value: 'broadcaster', label: 'Solo el streamer' }
];

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
            .catch(() => showToast('No se pudo cargar la configuración', 'error'));
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
            showToast('Configuración guardada', 'success');
        } catch {
            showToast('No se pudo guardar', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!permissionsLoading && !hasMinimumLevel('moderation')) return null;

    const nuke = config?.nuke;

    return (
        <ModerationPage
            title="Comandos de moderación"
            subtitle="Elige quién puede usar cada comando. Quien tenga control total del canal en el dashboard cuenta como el streamer. Al resto el bot lo ignora."
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
                                hint={cmd.description}
                                right={<FilterSwitch on={setting.enabled} onChange={(next) => update(cmd.key, { enabled: next })} label={`Activar ${cmd.usage[0]}`} />}
                            >
                                <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${setting.enabled ? '' : 'opacity-50'}`}>
                                    <Field label="Quién puede usarlo">
                                        <Select value={setting.minRole} onChange={(e) => update(cmd.key, { minRole: e.target.value as Role })}>
                                            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                        </Select>
                                    </Field>

                                    {cmd.key === 'nuke' && nuke && (
                                        <>
                                            <Field label="Mira hacia atrás">
                                                <Select value={nuke.windowSeconds} onChange={(e) => update('nuke', { windowSeconds: Number(e.target.value) })}>
                                                    {NUKE_WINDOWS.map(s => <option key={s} value={s}>{duration(s)}</option>)}
                                                </Select>
                                            </Field>
                                            <Field label="Sanción">
                                                <Select
                                                    value={nuke.action === 'ban' ? 'ban' : String(nuke.timeoutSeconds)}
                                                    onChange={(e) => e.target.value === 'ban'
                                                        ? update('nuke', { action: 'ban' })
                                                        : update('nuke', { action: 'timeout', timeoutSeconds: Number(e.target.value) })}
                                                >
                                                    {NUKE_TIMEOUTS.map(s => <option key={s} value={s}>Timeout de {duration(s)}</option>)}
                                                    <option value="ban">Ban permanente</option>
                                                </Select>
                                            </Field>
                                        </>
                                    )}
                                </div>
                            </Section>
                        );
                    })}

                    <SaveBar saving={saving} onClick={save} label="Guardar configuración" savingLabel="Guardando…" />
                </div>
            )}
        </ModerationPage>
    );
}
