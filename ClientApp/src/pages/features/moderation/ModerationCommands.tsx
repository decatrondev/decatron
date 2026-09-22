import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import api from '../../../services/api';
import { FilterSwitch } from './filterSwitch';

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
    { key: 'panic', usage: ['!panico', '!panico off'], description: 'Activa el modo pánico (o lo extiende si ya estaba) y lo apaga. Qué hace se configura en Raids y bots. También funcionan !pánico y !panic.' },
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

const card = 'bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg';
const select = 'w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc]';
const text = 'text-[#1e293b] dark:text-[#f8fafc]';
const hint = 'text-sm text-[#64748b] dark:text-[#94a3b8]';

export default function ModerationCommands() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();

    const [config, setConfig] = useState<CommandsConfig | null>(null);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (permissionsLoading) return;
        if (!hasMinimumLevel('moderation')) {
            navigate('/dashboard');
            return;
        }
        api.get('/moderation/commands')
            .then(res => res.data.success && setConfig(res.data.commands))
            .catch(() => showNotice('error', 'No se pudo cargar la configuración'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    const showNotice = (type: 'success' | 'error', text: string) => {
        setNotice({ type, text });
        setTimeout(() => setNotice(null), 3000);
    };

    const update = (key: string, changes: Partial<CommandSetting>) =>
        setConfig(c => (c ? { ...c, [key]: { ...c[key], ...changes } } : c));

    const save = async () => {
        if (!config) return;
        setSaving(true);
        try {
            const res = await api.put('/moderation/commands', config);
            if (!res.data.success) throw new Error();
            setConfig(res.data.commands);
            showNotice('success', 'Configuración guardada');
        } catch {
            showNotice('error', 'No se pudo guardar');
        } finally {
            setSaving(false);
        }
    };

    if (!permissionsLoading && !hasMinimumLevel('moderation')) return null;

    const nuke = config?.nuke;

    return (
        <div className="panel-scale bg-[#f8fafc] dark:bg-[#1B1C1D] p-4 sm:p-6">
            <div className="max-w-6xl mx-auto mb-6">
                <button
                    onClick={() => navigate('/moderation')}
                    className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#3b82f6] mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver a Moderación
                </button>
                <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Comandos de moderación</h1>
                <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">
                    Elige quién puede usar cada comando. Quien tenga control total del canal en el dashboard cuenta como el streamer. Al resto el bot lo ignora.
                </p>
            </div>

            {notice && (
                <div className="max-w-6xl mx-auto mb-6">
                    <div className={`flex items-center gap-2 p-4 rounded-lg ${notice.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                        {notice.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="font-semibold">{notice.text}</span>
                    </div>
                </div>
            )}

            {!config ? (
                <p className="max-w-6xl mx-auto text-center py-12 text-[#64748b] dark:text-[#94a3b8]">Cargando…</p>
            ) : (
                <div className="max-w-6xl mx-auto space-y-4">
                    {COMMANDS.map(cmd => {
                        const setting = config[cmd.key];
                        if (!setting) return null;
                        return (
                            <div key={cmd.key} className={card}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {cmd.usage.map(u => (
                                                <code key={u} className="px-2 py-1 rounded bg-[#f1f5f9] dark:bg-[#262626] text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{u}</code>
                                            ))}
                                        </div>
                                        <p className={hint}>{cmd.description}</p>
                                    </div>
                                    <FilterSwitch
                                        on={setting.enabled}
                                        onChange={(next) => update(cmd.key, { enabled: next })}
                                        label={`Activar ${cmd.usage[0]}`}
                                    />
                                </div>

                                <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 ${setting.enabled ? '' : 'opacity-50'}`}>
                                    <div>
                                        <label className={`block text-sm font-semibold mb-2 ${text}`}>Quién puede usarlo</label>
                                        <select
                                            value={setting.minRole}
                                            onChange={(e) => update(cmd.key, { minRole: e.target.value as Role })}
                                            className={select}
                                        >
                                            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                        </select>
                                    </div>

                                    {cmd.key === 'nuke' && nuke && (
                                        <>
                                            <div>
                                                <label className={`block text-sm font-semibold mb-2 ${text}`}>Mira hacia atrás</label>
                                                <select
                                                    value={nuke.windowSeconds}
                                                    onChange={(e) => update('nuke', { windowSeconds: Number(e.target.value) })}
                                                    className={select}
                                                >
                                                    {NUKE_WINDOWS.map(s => <option key={s} value={s}>{duration(s)}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className={`block text-sm font-semibold mb-2 ${text}`}>Sanción</label>
                                                <select
                                                    value={nuke.action === 'ban' ? 'ban' : String(nuke.timeoutSeconds)}
                                                    onChange={(e) => e.target.value === 'ban'
                                                        ? update('nuke', { action: 'ban' })
                                                        : update('nuke', { action: 'timeout', timeoutSeconds: Number(e.target.value) })}
                                                    className={select}
                                                >
                                                    {NUKE_TIMEOUTS.map(s => <option key={s} value={s}>Timeout de {duration(s)}</option>)}
                                                    <option value="ban">Ban permanente</option>
                                                </select>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    <button
                        onClick={save}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#2563eb] hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all shadow-lg"
                    >
                        <Save className="w-5 h-5" />
                        {saving ? 'Guardando…' : 'Guardar configuración'}
                    </button>
                </div>
            )}
        </div>
    );
}
