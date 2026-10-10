import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RotateCcw, Siren } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import api from '../../../services/api';
import { Alert, Button, Checkbox, Field, Input, Select } from '../../../components/ds';
import { useToast } from '../../../components/dashboard/toast';
import {
    FilterSwitch, fetchModerationOverview, saveModerationFilter, type FilterSeverity, type ModerationPlatform
} from './filterSwitch';
import { Chip, ModerationPage, NumberField, PageLoading, SaveBar, Section, SeveritySelect, hintCls, smallHintCls } from './parts';

interface PanicSettings {
    durationMinutes: number;
    followersOnly: boolean;
    followersMinutes: number;
    emoteOnly: boolean;
    subscribersOnly: boolean;
    slowSeconds: number;
    shieldMode: boolean;
    announce: boolean;
    autoOnFollows: boolean;
    followsThreshold: number;
    autoOnNewAccounts: boolean;
    newAccountsThreshold: number;
    newAccountDays: number;
    autoWindowSeconds: number;
}

interface PanicState {
    active: boolean;
    endsAt?: string;
    triggeredBy?: string;
    reason?: string;
}

interface FilterDraft<T> {
    enabled: boolean;
    severity: FilterSeverity;
    settings: T;
    message: string;
}

const FOLLOW_AGES = [
    { value: 0, label: 'Cualquier seguidor' },
    { value: 10, label: '10 minutos' },
    { value: 30, label: '30 minutos' },
    { value: 60, label: '1 hora' },
    { value: 1440, label: '1 día' },
    { value: 10080, label: '1 semana' }
];
const SLOW_OPTIONS = [0, 5, 10, 30, 60, 120];

function minutesLeft(endsAt?: string) {
    if (!endsAt) return 0;
    return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 60000));
}

export default function RaidProtection() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();

    const [panic, setPanic] = useState<PanicSettings | null>(null);
    const [state, setState] = useState<PanicState>({ active: false });
    const [defaultPhrases, setDefaultPhrases] = useState<string[]>([]);
    const [age, setAge] = useState<FilterDraft<{ minDays: number; onlyDuringPanic: boolean }> | null>(null);
    const [bots, setBots] = useState<FilterDraft<{ phrases: string[] }> | null>(null);
    const [newPhrase, setNewPhrase] = useState('');
    const [saving, setSaving] = useState(false);
    const [switching, setSwitching] = useState(false);
    const [platform, setPlatform] = useState<ModerationPlatform>('twitch');
    const isKick = platform === 'kick';

    const { toast, showToast } = useToast(3500);
    const showNotice = (type: 'success' | 'error', text: string) => showToast(text, type);

    const load = async () => {
        const [panicRes, overview] = await Promise.all([api.get('/moderation/panic'), fetchModerationOverview()]);
        const filters = overview.filters;
        setPlatform(overview.platform);
        if (panicRes.data.success) {
            setPanic(panicRes.data.settings);
            setState(panicRes.data.state);
            setDefaultPhrases(panicRes.data.defaultBotPhrases);
        }
        const a = filters.find(f => f.key === 'account_age');
        setAge({
            enabled: a?.enabled ?? false,
            severity: a?.severity ?? 'leve',
            settings: { minDays: 7, onlyDuringPanic: false, ...(a?.settings as object) },
            message: a?.message ?? ''
        });
        const b = filters.find(f => f.key === 'bot_phrases');
        const savedPhrases = (b?.settings as { phrases?: string[] } | undefined)?.phrases;
        setBots({
            enabled: b?.enabled ?? false,
            severity: b?.severity ?? 'severo',
            settings: { phrases: savedPhrases ?? panicRes.data.defaultBotPhrases ?? [] },
            message: b?.message ?? ''
        });
    };

    useEffect(() => {
        if (permissionsLoading) return;
        if (!hasMinimumLevel('moderation')) {
            navigate('/dashboard');
            return;
        }
        load().catch(() => showNotice('error', 'No se pudo cargar la configuración'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    // Mientras el pánico está activo, refrescar el estado para ver cuándo se apaga
    useEffect(() => {
        if (!state.active) return;
        const id = setInterval(() => {
            api.get('/moderation/panic').then(res => res.data.success && setState(res.data.state)).catch(() => { });
        }, 15000);
        return () => clearInterval(id);
    }, [state.active]);

    const setP = (changes: Partial<PanicSettings>) => setPanic(p => (p ? { ...p, ...changes } : p));

    const togglePanic = async () => {
        setSwitching(true);
        try {
            const res = await api.post(`/moderation/panic/${state.active ? 'deactivate' : 'activate'}`);
            if (!res.data.success) throw new Error();
            const fresh = await api.get('/moderation/panic');
            setState(fresh.data.state);
            showNotice('success', res.data.active ? 'Modo pánico activado' : 'Modo pánico desactivado');
        } catch {
            showNotice('error', 'No se pudo cambiar el modo pánico');
        } finally {
            setSwitching(false);
        }
    };

    const toggleFilter = async (key: 'account_age' | 'bot_phrases', next: boolean) => {
        const apply = (enabled: boolean) => key === 'account_age'
            ? setAge(d => (d ? { ...d, enabled } : d))
            : setBots(d => (d ? { ...d, enabled } : d));
        apply(next);
        try {
            if (!(await saveModerationFilter(key, { enabled: next }))) throw new Error();
        } catch {
            apply(!next);
            showNotice('error', 'No se pudo cambiar el estado del filtro');
        }
    };

    const addPhrase = () => {
        const phrase = newPhrase.trim().toLowerCase();
        if (!bots || phrase.length === 0) return;
        if (phrase.replace(/[^\p{L}\p{N}]/gu, '').length < 8) {
            showNotice('error', 'La frase es muy corta: sin espacios ni signos necesita al menos 8 letras o números');
            return;
        }
        if (!bots.settings.phrases.includes(phrase))
            setBots({ ...bots, settings: { phrases: [...bots.settings.phrases, phrase] } });
        setNewPhrase('');
    };

    const save = async () => {
        if (!panic || !age || !bots) return;
        setSaving(true);
        try {
            // En Kick solo existen las frases de bots
            const [panicOk, ageOk, botsOk] = await Promise.all([
                isKick ? Promise.resolve(true) : api.put('/moderation/panic', panic).then(res => {
                    if (res.data.success) setPanic(res.data.settings);
                    return res.data.success === true;
                }),
                isKick ? Promise.resolve(true) : saveModerationFilter('account_age', { severity: age.severity, settings: age.settings, message: age.message }),
                saveModerationFilter('bot_phrases', { severity: bots.severity, settings: bots.settings, message: bots.message })
            ]);
            const ok = panicOk && ageOk && botsOk;
            showNotice(ok ? 'success' : 'error', ok ? 'Configuración guardada' : 'Algo no se pudo guardar');
        } catch {
            showNotice('error', 'No se pudo guardar');
        } finally {
            setSaving(false);
        }
    };

    if (!permissionsLoading && !hasMinimumLevel('moderation')) return null;

    const radioCard = (selected: boolean) => `flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${selected ? 'border-ds-accent bg-ds-accent/10' : 'border-ds-border bg-ds-bg hover:border-ds-accent'}`;

    return (
        <ModerationPage
            title="Raids de odio y bots"
            subtitle="Modo pánico para cerrar el chat en segundos, filtro de cuentas nuevas y frases de bots que venden viewers."
            toast={toast}
        >
            {!panic || !age || !bots ? <PageLoading /> : (
                <div className="space-y-6">
                    {isKick ? (
                        <Alert tone="info" title="Canal de Kick">
                            Aquí solo funciona el filtro de frases de bots. El modo pánico y el filtro de cuentas nuevas no están disponibles: la API de Kick no permite cambiar los modos del chat ni informa la antigüedad de las cuentas.
                        </Alert>
                    ) : (<>
                    {/* Estado del pánico */}
                    <div className={`rounded-lg border p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${state.active ? 'bg-ds-danger/10 border-ds-danger' : 'bg-ds-surface border-ds-border'}`}>
                        <div className="flex items-center gap-4 min-w-0">
                            <Siren className={`w-10 h-10 shrink-0 ${state.active ? 'text-ds-danger animate-pulse' : 'text-ds-soft'}`} />
                            <div className="min-w-0">
                                <p className={`text-xl font-black ${state.active ? 'text-ds-danger' : 'text-ds-text'}`}>
                                    {state.active ? 'Modo pánico ACTIVO' : 'Modo pánico apagado'}
                                </p>
                                <p className={hintCls}>
                                    {state.active
                                        ? `${state.reason ?? ''} · se apaga solo en ${minutesLeft(state.endsAt)} min`
                                        : 'También se activa con !panico en el chat y se apaga con !panico off.'}
                                </p>
                            </div>
                        </div>
                        <Button size="lg" variant={state.active ? 'primary' : 'danger'} onClick={togglePanic} loading={switching} disabled={switching} className="shrink-0">
                            {switching ? '…' : state.active ? 'Desactivar ahora' : 'Activar pánico'}
                        </Button>
                    </div>

                    {/* Qué hace el pánico */}
                    <Section title="Qué hace el pánico" hint="Al apagarse, el chat vuelve exactamente a como estaba antes.">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                            <label className={radioCard(!panic.shieldMode)}>
                                <input type="radio" name="panicMode" checked={!panic.shieldMode} onChange={() => setP({ shieldMode: false })} className="w-4 h-4 mt-1 accent-[var(--ds-accent)]" />
                                <span>
                                    <span className="block font-bold text-ds-text">Modos del chat</span>
                                    <span className={hintCls}>Eliges qué restricciones aplica el bot.</span>
                                </span>
                            </label>
                            <label className={radioCard(panic.shieldMode)}>
                                <input type="radio" name="panicMode" checked={panic.shieldMode} onChange={() => setP({ shieldMode: true })} className="w-4 h-4 mt-1 accent-[var(--ds-accent)]" />
                                <span>
                                    <span className="block font-bold text-ds-text">Shield Mode de Twitch</span>
                                    <span className={hintCls}>Aplica lo que configuraste en las herramientas de moderación de Twitch.</span>
                                </span>
                            </label>
                        </div>

                        {!panic.shieldMode && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                <div className="space-y-2">
                                    <Checkbox label="Solo seguidores" checked={panic.followersOnly} onChange={(e) => setP({ followersOnly: e.target.checked })} />
                                    <Select value={panic.followersMinutes} disabled={!panic.followersOnly} onChange={(e) => setP({ followersMinutes: Number(e.target.value) })}>
                                        {FOLLOW_AGES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </Select>
                                </div>
                                <Field label="Modo lento">
                                    <Select value={panic.slowSeconds} onChange={(e) => setP({ slowSeconds: Number(e.target.value) })}>
                                        {SLOW_OPTIONS.map(s => <option key={s} value={s}>{s === 0 ? 'Sin modo lento' : `${s} segundos`}</option>)}
                                    </Select>
                                </Field>
                                <div className="sm:pt-7"><Checkbox label="Solo emotes" checked={panic.emoteOnly} onChange={(e) => setP({ emoteOnly: e.target.checked })} /></div>
                                <div className="sm:pt-7"><Checkbox label="Solo suscriptores" checked={panic.subscribersOnly} onChange={(e) => setP({ subscribersOnly: e.target.checked })} /></div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Se apaga solo después de">
                                <NumberField value={panic.durationMinutes} min={1} max={120} suffix="minutos" onChange={(v) => setP({ durationMinutes: v })} />
                            </Field>
                            <div className="sm:pt-7"><Checkbox label="Avisar en el chat al activarse y al apagarse" checked={panic.announce} onChange={(e) => setP({ announce: e.target.checked })} /></div>
                        </div>
                    </Section>

                    {/* Disparo automático */}
                    <Section title="Activación automática" hint="Viene apagada. Si la activas, el bot enciende el pánico solo cuando detecta una oleada.">
                        <div className="space-y-5">
                            <div>
                                <div className="mb-3"><Checkbox label={<span className="font-semibold">Oleada de follows (bots de follows)</span>} checked={panic.autoOnFollows} onChange={(e) => setP({ autoOnFollows: e.target.checked })} /></div>
                                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${panic.autoOnFollows ? '' : 'opacity-50'}`}>
                                    <Field label="Follows"><NumberField value={panic.followsThreshold} min={3} max={1000} suffix="o más" onChange={(v) => setP({ followsThreshold: v })} /></Field>
                                    <Field label="Dentro de"><NumberField value={panic.autoWindowSeconds} min={10} max={600} suffix="segundos" onChange={(v) => setP({ autoWindowSeconds: v })} /></Field>
                                </div>
                            </div>
                            <div>
                                <div className="mb-3"><Checkbox label={<span className="font-semibold">Cuentas nuevas escribiendo a la vez (raid de odio)</span>} checked={panic.autoOnNewAccounts} onChange={(e) => setP({ autoOnNewAccounts: e.target.checked })} /></div>
                                <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${panic.autoOnNewAccounts ? '' : 'opacity-50'}`}>
                                    <Field label="Cuentas distintas"><NumberField value={panic.newAccountsThreshold} min={2} max={1000} suffix="o más" onChange={(v) => setP({ newAccountsThreshold: v })} /></Field>
                                    <Field label="Con menos de"><NumberField value={panic.newAccountDays} min={1} max={365} suffix="días de creadas" onChange={(v) => setP({ newAccountDays: v })} /></Field>
                                    <Field label="Dentro de"><NumberField value={panic.autoWindowSeconds} min={10} max={600} suffix="segundos" onChange={(v) => setP({ autoWindowSeconds: v })} /></Field>
                                </div>
                            </div>
                        </div>
                    </Section>
                    </>)}

                    <div className={`grid grid-cols-1 gap-6 ${isKick ? '' : 'lg:grid-cols-2'}`}>
                        {/* Cuentas nuevas (Kick no informa la antigüedad de las cuentas) */}
                        {!isKick && (
                        <Section
                            title="Cuentas nuevas"
                            hint="Sanciona a las cuentas recién creadas que escriben. Su mensaje siempre se borra."
                            right={<FilterSwitch on={age.enabled} onChange={(n) => toggleFilter('account_age', n)} label="Activar el filtro de cuentas nuevas" />}
                        >
                            <div className={`space-y-4 ${age.enabled ? '' : 'opacity-60'}`}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Cuentas con menos de">
                                        <NumberField value={age.settings.minDays} min={1} max={365} suffix="días" onChange={(v) => setAge({ ...age, settings: { ...age.settings, minDays: v } })} />
                                    </Field>
                                    <Field label="Severidad"><SeveritySelect value={age.severity} onChange={(v) => setAge({ ...age, severity: v })} /></Field>
                                </div>
                                <Checkbox
                                    label="Solo mientras el modo pánico está activo"
                                    checked={age.settings.onlyDuringPanic}
                                    onChange={(e) => setAge({ ...age, settings: { ...age.settings, onlyDuringPanic: e.target.checked } })}
                                />
                                <Field label="Mensaje en el chat">
                                    <Input maxLength={500} value={age.message} onChange={(e) => setAge({ ...age, message: e.target.value })} placeholder="🆕 $(user), tu cuenta es muy nueva para escribir en este chat." />
                                </Field>
                            </div>
                        </Section>
                        )}

                        {/* Frases de bots */}
                        <Section
                            title="Frases de bots"
                            hint="Spam de bots que venden viewers y seguidores. Se detecta aunque lo escriban separado o con signos."
                            right={<FilterSwitch on={bots.enabled} onChange={(n) => toggleFilter('bot_phrases', n)} label="Activar el filtro de frases de bots" />}
                        >
                            <div className={`space-y-4 ${bots.enabled ? '' : 'opacity-60'}`}>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Input value={newPhrase} onChange={(e) => setNewPhrase(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPhrase()} placeholder="best viewers on" />
                                    <Button variant="secondary" icon={<Plus />} onClick={addPhrase}>Agregar</Button>
                                </div>
                                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                                    {bots.settings.phrases.map(p => (
                                        <Chip key={p} removeLabel={`Quitar ${p}`} onRemove={() => setBots({ ...bots, settings: { phrases: bots.settings.phrases.filter(x => x !== p) } })}>{p}</Chip>
                                    ))}
                                </div>
                                <Button variant="ghost" size="sm" icon={<RotateCcw />} onClick={() => setBots({ ...bots, settings: { phrases: [...defaultPhrases] } })}>Volver a la lista base</Button>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Severidad"><SeveritySelect value={bots.severity} onChange={(v) => setBots({ ...bots, severity: v })} /></Field>
                                    <Field label="Mensaje en el chat">
                                        <Input maxLength={500} value={bots.message} onChange={(e) => setBots({ ...bots, message: e.target.value })} placeholder="🤖 $(user), nada de spam de bots en este chat." />
                                    </Field>
                                </div>
                            </div>
                        </Section>
                    </div>

                    <SaveBar saving={saving} onClick={save} label="Guardar configuración" savingLabel="Guardando…" />
                    <p className={`${smallHintCls} text-center`}>El botón de pánico y los interruptores se aplican al momento; el resto, al guardar.</p>
                </div>
            )}
        </ModerationPage>
    );
}
