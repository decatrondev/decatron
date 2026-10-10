import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Plus } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import api from '../../../services/api';
import { Button, Checkbox, Field, Input, Select } from '../../../components/ds';
import { useToast } from '../../../components/dashboard/toast';
import {
    FilterSwitch, fetchModerationFilters, saveModerationFilter, type FilterSeverity
} from './filterSwitch';
import { Chip, ModerationPage, OffNotice, PageLoading, SaveBar, Section, SeveritySelect, StatusText, TestResultBox, hintCls } from './parts';

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

export default function LinksFilter() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const { toast, showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [enabled, setEnabled] = useState(false);
    const [severity, setSeverity] = useState<FilterSeverity>('leve');
    const [settings, setSettings] = useState<LinkSettings>(DEFAULT_SETTINGS);
    const [message, setMessage] = useState('');
    const [newDomain, setNewDomain] = useState('');
    const [domainError, setDomainError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [togglingSaving, setTogglingSaving] = useState(false);
    const showNotice = (type: 'success' | 'error', text: string) => showToast(text, type);

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
            const res = await api.post('/moderation/test-message', { message: testMessage, filter: 'links' });
            if (res.data.success) setTestResult(res.data);
        } catch {
            showNotice('error', 'No se pudo analizar el mensaje');
        } finally {
            setTesting(false);
        }
    };

    if (!permissionsLoading && !hasMinimumLevel('moderation')) return null;

    return (
        <ModerationPage
            title="Filtro de links"
            subtitle={<>Con el filtro activo no pasa ningún link, salvo los dominios que permitas aquí o quien tenga un <code>!permit</code>.</>}
            toast={toast}
            actions={!loading && (
                <div className="flex items-center gap-3">
                    <StatusText on={enabled} />
                    <FilterSwitch on={enabled} disabled={togglingSaving} onChange={toggle} label="Activar el filtro de links" />
                </div>
            )}
        >
            {!loading && !enabled && <OffNotice>El filtro está apagado: hoy los links pasan sin control.</OffNotice>}

            {loading ? <PageLoading /> : (
                <div className="space-y-6">
                    <Section
                        title="Dominios permitidos"
                        hint={<>Incluye sus subdominios: permitir <code>youtube.com</code> también deja pasar <code>m.youtube.com</code>.</>}
                    >
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                                value={newDomain}
                                onChange={(e) => { setNewDomain(e.target.value); setDomainError(null); }}
                                onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                                placeholder="youtube.com"
                                error={!!domainError}
                            />
                            <Button variant="secondary" icon={<Plus />} onClick={addDomain}>Agregar</Button>
                        </div>
                        {domainError && <p className="text-sm text-ds-danger mt-2">{domainError}</p>}
                        <div className="flex flex-wrap gap-2 mt-4">
                            {settings.allowedDomains.length === 0 ? (
                                <p className={hintCls}>Ningún dominio permitido: con el filtro activo se bloquean todos los links.</p>
                            ) : settings.allowedDomains.map(domain => (
                                <Chip key={domain} onRemove={() => removeDomain(domain)} removeLabel={`Quitar ${domain}`}>{domain}</Chip>
                            ))}
                        </div>
                    </Section>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Section
                            title="Quién puede enviar links"
                            hint="El streamer, los Lead Moderators, los moderadores, la whitelist y quien tenga control total del canal siempre pueden."
                        >
                            <div className="space-y-3">
                                <Checkbox label="Suscriptores" checked={settings.allowSubscribers} onChange={(e) => setSettings({ ...settings, allowSubscribers: e.target.checked })} />
                                <div><Checkbox label="VIPs" checked={settings.allowVips} onChange={(e) => setSettings({ ...settings, allowVips: e.target.checked })} /></div>
                            </div>
                        </Section>

                        <Section title="Links disfrazados" hint="Los spammers escriben el link separado para que no lo detecten.">
                            <Checkbox
                                label={<>Detectar <code>pagina . com</code>, <code>pagina(dot)com</code>, <code>pagina[.]com</code> y <code>pagina punto com</code></>}
                                checked={settings.detectObfuscated}
                                onChange={(e) => setSettings({ ...settings, detectObfuscated: e.target.checked })}
                            />
                        </Section>
                    </div>

                    <Section
                        title="Comando !permit"
                        hint={<><code>!permit @usuario</code> deja pasar sus links. Lo pueden usar los moderadores, los Lead Moderators, el streamer y quien tenga control total del canal.</>}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Duración">
                                <Select value={settings.permitSeconds} onChange={(e) => setSettings({ ...settings, permitSeconds: Number(e.target.value) })}>
                                    {PERMIT_DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                </Select>
                            </Field>
                            <div>
                                <span className="ds-label block mb-2">Qué permite</span>
                                <div className="space-y-2">
                                    <Checkbox radio name="permitMode" label="Todos los links durante ese tiempo" checked={!settings.permitSingleMessage} onChange={() => setSettings({ ...settings, permitSingleMessage: false })} />
                                    <div><Checkbox radio name="permitMode" label="Un solo mensaje con link" checked={settings.permitSingleMessage} onChange={() => setSettings({ ...settings, permitSingleMessage: true })} /></div>
                                </div>
                            </div>
                        </div>
                    </Section>

                    <Section
                        title="Sanción"
                        hint="Un link bloqueado siempre se borra, aunque al strike le toque solo una advertencia. La escala de strikes, su expiración y la whitelist son las mismas de Palabras prohibidas."
                    >
                        <div className="space-y-4">
                            <Field label="Severidad"><SeveritySelect long value={severity} onChange={setSeverity} /></Field>
                            <Field label="Mensaje en el chat" hint="Vacío = el mensaje de arriba. Variables: $(user), $(strike), $(word) (el dominio).">
                                <Input value={message} maxLength={500} onChange={(e) => setMessage(e.target.value)} placeholder={DEFAULT_MESSAGE} />
                            </Field>
                        </div>
                    </Section>

                    <SaveBar saving={saving} onClick={save} label="Guardar configuración" savingLabel="Guardando…" />

                    <Section title="Probar un mensaje" hint="Usa la configuración guardada; si cambiaste algo, guarda antes de probar.">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                                value={testMessage}
                                onChange={(e) => setTestMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && runTest()}
                                placeholder="mira mi canal en pagina . com"
                            />
                            <Button onClick={runTest} loading={testing} disabled={testing} icon={<Play />}>{testing ? 'Analizando…' : 'Analizar'}</Button>
                        </div>
                        {testResult && (
                            <div className="mt-4">
                                <TestResultBox match={testResult.hasMatch}>
                                    {testResult.hasMatch ? (
                                        <div className="space-y-1">
                                            <p className="font-bold text-ds-danger">Link bloqueado: {testResult.matchedWord}</p>
                                            <p className="text-sm text-ds-text">
                                                Acción para un viewer sin strikes: {ACTION_LABELS[testResult.actionNormal ?? ''] ?? testResult.actionNormal}
                                            </p>
                                            {testResult.filterEnabled === false && (
                                                <p className="text-sm font-semibold text-ds-warn">Ese filtro está apagado: hoy este mensaje pasaría sin sanción.</p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="font-bold text-ds-ok">El mensaje pasa: no tiene links bloqueados.</p>
                                    )}
                                </TestResultBox>
                            </div>
                        )}
                    </Section>
                </div>
            )}
        </ModerationPage>
    );
}
