import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, AlertCircle, CheckCircle, Play } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import api from '../../../services/api';
import {
    FilterSwitch, fetchModerationFilters, saveModerationFilter, type FilterSeverity
} from './filterSwitch';

interface LinkSettings {
    allowedDomains: string[];
    allowSubscribers: boolean;
    allowVips: boolean;
    detectObfuscated: boolean;
    permitSeconds: number;
    permitSingleMessage: boolean;
}

interface TestResult {
    hasMatch: boolean;
    filter?: string;
    filterEnabled?: boolean;
    matchedWord?: string;
    actionNormal?: string;
}

const DEFAULT_SETTINGS: LinkSettings = {
    allowedDomains: [],
    allowSubscribers: false,
    allowVips: false,
    detectObfuscated: true,
    permitSeconds: 60,
    permitSingleMessage: false
};

const DEFAULT_MESSAGE = '🔗 $(user), no se permiten links sin permiso de un moderador. Strike $(strike)/5';

const PERMIT_DURATIONS = [
    { value: 30, label: '30 segundos' },
    { value: 60, label: '1 minuto' },
    { value: 120, label: '2 minutos' },
    { value: 300, label: '5 minutos' },
    { value: 600, label: '10 minutos' }
];

const ACTION_LABELS: Record<string, string> = {
    warning: 'Advertencia',
    delete: 'Borrar mensaje',
    timeout_30s: 'Timeout 30 s',
    timeout_1m: 'Timeout 1 min',
    timeout_5m: 'Timeout 5 min',
    timeout_10m: 'Timeout 10 min',
    timeout_30m: 'Timeout 30 min',
    timeout_1h: 'Timeout 1 hora',
    ban: 'Ban permanente'
};

/** "https://www.YouTube.com/watch?v=x" → "youtube.com"; null si no parece un dominio. Igual que el backend. */
function normalizeDomain(value: string): string | null {
    let d = value.trim().toLowerCase();
    const scheme = d.indexOf('://');
    if (scheme >= 0) d = d.slice(scheme + 3);
    d = d.split(/[/?#:]/)[0];
    if (d.startsWith('*.')) d = d.slice(2);
    if (d.startsWith('www.')) d = d.slice(4);
    d = d.replace(/^\.+|\.+$/g, '');
    return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d) ? d : null;
}

const card = 'bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg';
const input = 'w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc]';
const title = 'text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-1';
const hint = 'text-sm text-[#64748b] dark:text-[#94a3b8]';
const text = 'text-[#1e293b] dark:text-[#f8fafc]';

export default function LinksFilter() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();

    const [loading, setLoading] = useState(true);
    const [enabled, setEnabled] = useState(false);
    const [severity, setSeverity] = useState<FilterSeverity>('leve');
    const [settings, setSettings] = useState<LinkSettings>(DEFAULT_SETTINGS);
    const [message, setMessage] = useState('');
    const [newDomain, setNewDomain] = useState('');
    const [domainError, setDomainError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [togglingSaving, setTogglingSaving] = useState(false);
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [testMessage, setTestMessage] = useState('');
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        if (permissionsLoading) return;
        if (!hasMinimumLevel('moderation')) {
            navigate('/dashboard');
            return;
        }
        fetchModerationFilters()
            .then(filters => {
                const links = filters.find(f => f.key === 'links');
                if (links) {
                    setEnabled(links.enabled);
                    setSeverity(links.severity);
                    setSettings({ ...DEFAULT_SETTINGS, ...(links.settings as Partial<LinkSettings>) });
                    setMessage(links.message ?? '');
                }
            })
            .catch(() => showNotice('error', 'No se pudo cargar la configuración'))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    const showNotice = (type: 'success' | 'error', text: string) => {
        setNotice({ type, text });
        setTimeout(() => setNotice(null), 3000);
    };

    const toggle = async (next: boolean) => {
        setEnabled(next);
        setTogglingSaving(true);
        try {
            if (!(await saveModerationFilter('links', { enabled: next }))) throw new Error();
        } catch {
            setEnabled(!next);
            showNotice('error', 'No se pudo cambiar el estado del filtro');
        } finally {
            setTogglingSaving(false);
        }
    };

    const addDomain = () => {
        if (!newDomain.trim()) return;
        const domain = normalizeDomain(newDomain);
        if (!domain) {
            setDomainError('Eso no parece un dominio. Ejemplo: youtube.com');
            return;
        }
        setDomainError(null);
        if (!settings.allowedDomains.includes(domain)) {
            setSettings({ ...settings, allowedDomains: [...settings.allowedDomains, domain] });
        }
        setNewDomain('');
    };

    const removeDomain = (domain: string) =>
        setSettings({ ...settings, allowedDomains: settings.allowedDomains.filter(d => d !== domain) });

    const save = async () => {
        setSaving(true);
        try {
            const ok = await saveModerationFilter('links', { severity, settings: { ...settings }, message });
            showNotice(ok ? 'success' : 'error', ok ? 'Configuración guardada' : 'No se pudo guardar');
        } catch {
            showNotice('error', 'No se pudo guardar');
        } finally {
            setSaving(false);
        }
    };

    const runTest = async () => {
        if (!testMessage.trim()) return;
        setTesting(true);
        try {
            const res = await api.post('/moderation/test-message', { message: testMessage });
            if (res.data.success) setTestResult(res.data);
        } catch {
            showNotice('error', 'No se pudo analizar el mensaje');
        } finally {
            setTesting(false);
        }
    };

    if (!permissionsLoading && !hasMinimumLevel('moderation')) return null;

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#1B1C1D] p-6">
            <div className="max-w-5xl mx-auto mb-6">
                <button
                    onClick={() => navigate('/moderation')}
                    className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#3b82f6] mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver a Moderación
                </button>

                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Filtro de links</h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">
                            Con el filtro activo no pasa ningún link, salvo los dominios que permitas aquí o quien tenga un <code>!permit</code>.
                        </p>
                    </div>
                    {!loading && (
                        <div className="flex items-center gap-3">
                            <span className={`text-sm font-bold whitespace-nowrap ${enabled ? 'text-green-600 dark:text-green-400' : 'text-[#64748b] dark:text-[#94a3b8]'}`}>
                                {enabled ? 'Filtro activo' : 'Filtro apagado'}
                            </span>
                            <FilterSwitch on={enabled} disabled={togglingSaving} onChange={toggle} label="Activar el filtro de links" />
                        </div>
                    )}
                </div>
            </div>

            {notice && (
                <div className="max-w-5xl mx-auto mb-6">
                    <div className={`flex items-center gap-2 p-4 rounded-lg ${notice.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                        {notice.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="font-semibold">{notice.text}</span>
                    </div>
                </div>
            )}

            {!loading && !enabled && (
                <div className="max-w-5xl mx-auto mb-6">
                    <div className="flex items-center gap-2 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span className="font-semibold">El filtro está apagado: hoy los links pasan sin control.</span>
                    </div>
                </div>
            )}

            {loading ? (
                <p className="max-w-5xl mx-auto text-center py-12 text-[#64748b] dark:text-[#94a3b8]">Cargando…</p>
            ) : (
                <div className="max-w-5xl mx-auto space-y-6">
                    {/* Dominios permitidos */}
                    <div className={card}>
                        <h2 className={title}>Dominios permitidos</h2>
                        <p className={`${hint} mb-4`}>
                            Incluye sus subdominios: permitir <code>youtube.com</code> también deja pasar <code>m.youtube.com</code>.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                value={newDomain}
                                onChange={(e) => { setNewDomain(e.target.value); setDomainError(null); }}
                                onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                                placeholder="youtube.com"
                                className={input}
                            />
                            <button
                                onClick={addDomain}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Agregar
                            </button>
                        </div>
                        {domainError && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{domainError}</p>}
                        <div className="flex flex-wrap gap-2 mt-4">
                            {settings.allowedDomains.length === 0 ? (
                                <p className={hint}>Ningún dominio permitido: con el filtro activo se bloquean todos los links.</p>
                            ) : settings.allowedDomains.map(domain => (
                                <div key={domain} className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-800 rounded-lg">
                                    <span className={`text-sm font-mono ${text}`}>{domain}</span>
                                    <button
                                        onClick={() => removeDomain(domain)}
                                        aria-label={`Quitar ${domain}`}
                                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Quién puede */}
                        <div className={card}>
                            <h2 className={title}>Quién puede enviar links</h2>
                            <p className={`${hint} mb-4`}>
                                El streamer, los Lead Moderators, los moderadores, la whitelist y quien tenga control total del canal siempre pueden.
                            </p>
                            <label className="flex items-center gap-3 cursor-pointer mb-3">
                                <input
                                    type="checkbox"
                                    checked={settings.allowSubscribers}
                                    onChange={(e) => setSettings({ ...settings, allowSubscribers: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <span className={text}>Suscriptores</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.allowVips}
                                    onChange={(e) => setSettings({ ...settings, allowVips: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <span className={text}>VIPs</span>
                            </label>
                        </div>

                        {/* Detección */}
                        <div className={card}>
                            <h2 className={title}>Links disfrazados</h2>
                            <p className={`${hint} mb-4`}>
                                Los spammers escriben el link separado para que no lo detecten.
                            </p>
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.detectObfuscated}
                                    onChange={(e) => setSettings({ ...settings, detectObfuscated: e.target.checked })}
                                    className="w-4 h-4 mt-1"
                                />
                                <span className={text}>
                                    Detectar <code>pagina . com</code>, <code>pagina(dot)com</code>, <code>pagina[.]com</code> y <code>pagina punto com</code>
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* !permit */}
                    <div className={card}>
                        <h2 className={title}>Comando !permit</h2>
                        <p className={`${hint} mb-4`}>
                            <code>!permit @usuario</code> deja pasar sus links. Lo pueden usar los moderadores, los Lead Moderators, el streamer y quien tenga control total del canal.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={`block text-sm font-semibold mb-2 ${text}`}>Duración</label>
                                <select
                                    value={settings.permitSeconds}
                                    onChange={(e) => setSettings({ ...settings, permitSeconds: Number(e.target.value) })}
                                    className={input}
                                >
                                    {PERMIT_DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <span className={`block text-sm font-semibold mb-2 ${text}`}>Qué permite</span>
                                <label className="flex items-center gap-2 cursor-pointer mb-2">
                                    <input
                                        type="radio"
                                        name="permitMode"
                                        checked={!settings.permitSingleMessage}
                                        onChange={() => setSettings({ ...settings, permitSingleMessage: false })}
                                        className="w-4 h-4"
                                    />
                                    <span className={text}>Todos los links durante ese tiempo</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="permitMode"
                                        checked={settings.permitSingleMessage}
                                        onChange={() => setSettings({ ...settings, permitSingleMessage: true })}
                                        className="w-4 h-4"
                                    />
                                    <span className={text}>Un solo mensaje con link</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Sanción */}
                    <div className={card}>
                        <h2 className={title}>Sanción</h2>
                        <p className={`${hint} mb-4`}>
                            Un link bloqueado siempre se borra, aunque al strike le toque solo una advertencia. La escala de strikes, su expiración y la whitelist son las mismas de Palabras prohibidas.
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className={`block text-sm font-semibold mb-2 ${text}`}>Severidad</label>
                                <select value={severity} onChange={(e) => setSeverity(e.target.value as FilterSeverity)} className={input}>
                                    <option value="leve">Leve (escalamiento normal de strikes)</option>
                                    <option value="medio">Medio (strike + timeout de 10 min como mínimo)</option>
                                    <option value="severo">Severo (ban directo)</option>
                                </select>
                            </div>
                            <div>
                                <label className={`block text-sm font-semibold mb-2 ${text}`}>Mensaje en el chat</label>
                                <input
                                    type="text"
                                    value={message}
                                    maxLength={500}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder={DEFAULT_MESSAGE}
                                    className={`${input} text-sm`}
                                />
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    Vacío = el mensaje de arriba. Variables: $(user), $(strike), $(word) (el dominio).
                                </p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={save}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#2563eb] hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all shadow-lg"
                    >
                        <Save className="w-5 h-5" />
                        {saving ? 'Guardando…' : 'Guardar configuración'}
                    </button>

                    {/* Probar */}
                    <div className={card}>
                        <h2 className={title}>Probar un mensaje</h2>
                        <p className={`${hint} mb-4`}>Usa la configuración guardada; si cambiaste algo, guarda antes de probar.</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                value={testMessage}
                                onChange={(e) => setTestMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && runTest()}
                                placeholder="mira mi canal en pagina . com"
                                className={input}
                            />
                            <button
                                onClick={runTest}
                                disabled={testing}
                                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                            >
                                <Play className="w-4 h-4" />
                                {testing ? 'Analizando…' : 'Analizar'}
                            </button>
                        </div>
                        {testResult && (
                            <div className={`mt-4 p-4 rounded-lg border-2 ${testResult.hasMatch
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800'
                                : 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800'}`}>
                                {testResult.hasMatch ? (
                                    <div className="space-y-1">
                                        <p className="font-bold text-red-700 dark:text-red-400">
                                            {testResult.filter === 'links' ? `Link bloqueado: ${testResult.matchedWord}` : `Palabra prohibida: ${testResult.matchedWord}`}
                                        </p>
                                        <p className={`text-sm ${text}`}>
                                            Acción para un viewer sin strikes: {ACTION_LABELS[testResult.actionNormal ?? ''] ?? testResult.actionNormal}
                                        </p>
                                        {testResult.filterEnabled === false && (
                                            <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                                                Ese filtro está apagado: hoy este mensaje pasaría sin sanción.
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="font-bold text-green-700 dark:text-green-400">El mensaje pasa: no tiene links bloqueados ni palabras prohibidas.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
