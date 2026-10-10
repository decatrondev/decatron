import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../../hooks/usePermissions';
import { Checkbox, Field, Input } from '../../../components/ds';
import { useToast } from '../../../components/dashboard/toast';
import {
    FilterSwitch, fetchModerationFilters, saveModerationFilter, type FilterSeverity, type ModerationFilterState
} from './filterSwitch';
import { ModerationPage, NumberField, PageLoading, SaveBar, Section, SeveritySelect, StatusText, hintCls, smallHintCls } from './parts';

type FieldDef =
    | { kind: 'number'; key: string; label: string; min: number; max: number; suffix?: string; help?: string }
    | { kind: 'check'; key: string; label: string };

interface SpamFilterDef {
    key: string;
    name: string;
    description: string;
    defaultMessage: string;
    defaults: Record<string, number | boolean>;
    fields: FieldDef[];
    note?: string;
}

// Valores por defecto iguales a los del backend (SpamFilters.cs)
export const SPAM_FILTERS: SpamFilterDef[] = [
    {
        key: 'caps', name: 'Mayúsculas',
        description: 'Mensajes escritos casi todo en mayúsculas.',
        defaultMessage: '🔠 $(user), baja las mayúsculas, por favor. Strike $(strike)/5',
        defaults: { minLetters: 15, maxPercent: 70 },
        fields: [
            { kind: 'number', key: 'maxPercent', label: 'Máximo de mayúsculas', min: 10, max: 100, suffix: '%' },
            { kind: 'number', key: 'minLetters', label: 'Solo en mensajes con al menos', min: 1, max: 200, suffix: 'letras', help: 'Así un "GG" o un "XD" no cuentan.' }
        ],
        note: 'Los emotes de Twitch no cuentan como mayúsculas. Los de 7TV, BTTV y FFZ sí, porque llegan como texto.'
    },
    {
        key: 'symbols', name: 'Símbolos',
        description: 'Mensajes llenos de signos o arte ASCII (▀▄█).',
        defaultMessage: '🔣 $(user), demasiados símbolos en tu mensaje. Strike $(strike)/5',
        defaults: { minLength: 10, maxPercent: 50 },
        fields: [
            { kind: 'number', key: 'maxPercent', label: 'Máximo de símbolos', min: 10, max: 100, suffix: '%' },
            { kind: 'number', key: 'minLength', label: 'Solo en mensajes con al menos', min: 1, max: 200, suffix: 'caracteres' }
        ]
    },
    {
        key: 'emotes', name: 'Emotes',
        description: 'Demasiados emotes en un solo mensaje.',
        defaultMessage: '😶 $(user), demasiados emotes en un mensaje. Strike $(strike)/5',
        defaults: { maxEmotes: 10, countEmoji: true },
        fields: [
            { kind: 'number', key: 'maxEmotes', label: 'Máximo de emotes', min: 1, max: 100 },
            { kind: 'check', key: 'countEmoji', label: 'Contar también los emojis (😂🔥)' }
        ],
        note: 'Cuenta los emotes de Twitch. Los de 7TV, BTTV y FFZ no se pueden contar.'
    },
    {
        key: 'length', name: 'Mensajes largos',
        description: 'Mensajes que pasan de cierto largo.',
        defaultMessage: '📏 $(user), tu mensaje es demasiado largo. Strike $(strike)/5',
        defaults: { maxLength: 300 },
        fields: [{ kind: 'number', key: 'maxLength', label: 'Largo máximo', min: 20, max: 500, suffix: 'caracteres' }]
    },
    {
        key: 'repetition', name: 'Mensajes repetidos',
        description: 'El mismo usuario enviando el mismo mensaje varias veces.',
        defaultMessage: '🔁 $(user), no repitas el mismo mensaje. Strike $(strike)/5',
        defaults: { maxRepeats: 3, windowSeconds: 30 },
        fields: [
            { kind: 'number', key: 'maxRepeats', label: 'Se sanciona a la repetición número', min: 2, max: 20 },
            { kind: 'number', key: 'windowSeconds', label: 'Dentro de', min: 5, max: 300, suffix: 'segundos' }
        ]
    },
    {
        key: 'copypasta', name: 'Copypasta',
        description: 'Muchos usuarios distintos pegando el mismo texto.',
        defaultMessage: '📋 $(user), nada de copypasta en este chat. Strike $(strike)/5',
        defaults: { minUsers: 5, windowSeconds: 60, minLength: 20 },
        fields: [
            { kind: 'number', key: 'minUsers', label: 'A partir de cuántos usuarios', min: 2, max: 50 },
            { kind: 'number', key: 'windowSeconds', label: 'Dentro de', min: 5, max: 300, suffix: 'segundos' },
            { kind: 'number', key: 'minLength', label: 'Solo textos de al menos', min: 5, max: 500, suffix: 'caracteres', help: 'Así un "GG" o un emote que repite todo el chat no cuenta.' }
        ],
        note: 'Se sanciona a partir del usuario que alcanza el número; los anteriores no.'
    },
    {
        key: 'zalgo', name: 'Zalgo y texto raro',
        description: 'Texto zalgo (letras con marcas encima y debajo que tapan el chat).',
        defaultMessage: '👾 $(user), ese tipo de texto no está permitido. Strike $(strike)/5',
        defaults: { maxCombiningMarks: 2, blockFancyText: false },
        fields: [
            { kind: 'number', key: 'maxCombiningMarks', label: 'Marcas seguidas permitidas', min: 1, max: 10, help: 'Idiomas como el vietnamita usan 1 o 2.' },
            { kind: 'check', key: 'blockFancyText', label: 'Bloquear también letras de fantasía (𝓱𝓸𝓵𝓪, ｈｏｌａ, ⓗⓞⓛⓐ)' }
        ],
        note: 'El texto zalgo siempre se borra, aunque al strike le toque solo una advertencia.'
    },
    {
        key: 'mentions', name: 'Menciones',
        description: 'Demasiadas @menciones a distintos usuarios en un mensaje.',
        defaultMessage: '📣 $(user), demasiadas menciones en un mensaje. Strike $(strike)/5',
        defaults: { maxMentions: 5 },
        fields: [{ kind: 'number', key: 'maxMentions', label: 'Máximo de menciones', min: 1, max: 50 }]
    }
];

interface Draft {
    enabled: boolean;
    severity: FilterSeverity;
    settings: Record<string, number | boolean>;
    message: string;
}

export default function SpamFilters() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const { toast, showToast } = useToast();

    const [drafts, setDrafts] = useState<Record<string, Draft> | null>(null);
    const [saving, setSaving] = useState(false);
    const showNotice = (type: 'success' | 'error', text: string) => showToast(text, type);

    useEffect(() => {
        if (permissionsLoading) return;
        if (!hasMinimumLevel('moderation')) {
            navigate('/dashboard');
            return;
        }
        fetchModerationFilters()
            .then((filters: ModerationFilterState[]) => {
                const next: Record<string, Draft> = {};
                for (const def of SPAM_FILTERS) {
                    const saved = filters.find(f => f.key === def.key);
                    next[def.key] = {
                        enabled: saved?.enabled ?? false,
                        severity: saved?.severity ?? 'leve',
                        settings: { ...def.defaults, ...(saved?.settings as Record<string, number | boolean> | undefined) },
                        message: saved?.message ?? ''
                    };
                }
                setDrafts(next);
            })
            .catch(() => showNotice('error', 'No se pudo cargar la configuración'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    const update = (key: string, changes: Partial<Draft>) =>
        setDrafts(d => (d ? { ...d, [key]: { ...d[key], ...changes } } : d));

    const setField = (key: string, field: string, value: number | boolean) =>
        setDrafts(d => (d ? { ...d, [key]: { ...d[key], settings: { ...d[key].settings, [field]: value } } } : d));

    // El interruptor se guarda al momento, como en las demás páginas
    const toggle = async (key: string, next: boolean) => {
        update(key, { enabled: next });
        try {
            if (!(await saveModerationFilter(key, { enabled: next }))) throw new Error();
        } catch {
            update(key, { enabled: !next });
            showNotice('error', 'No se pudo cambiar el estado del filtro');
        }
    };

    const save = async () => {
        if (!drafts) return;
        setSaving(true);
        try {
            const results = await Promise.all(SPAM_FILTERS.map(def => {
                const d = drafts[def.key];
                return saveModerationFilter(def.key, { severity: d.severity, settings: d.settings, message: d.message });
            }));
            showNotice(results.every(Boolean) ? 'success' : 'error', results.every(Boolean) ? 'Configuración guardada' : 'Algunos filtros no se pudieron guardar');
        } catch {
            showNotice('error', 'No se pudo guardar');
        } finally {
            setSaving(false);
        }
    };

    if (!permissionsLoading && !hasMinimumLevel('moderation')) return null;

    return (
        <ModerationPage
            title="Filtros de spam"
            subtitle="Cada filtro viene apagado y se activa por separado. Usan la misma escala de strikes y whitelist que Palabras prohibidas."
            toast={toast}
        >
            {!drafts ? <PageLoading /> : (
                <div className="space-y-4">
                    {SPAM_FILTERS.map(def => {
                        const d = drafts[def.key];
                        return (
                            <Section
                                key={def.key}
                                title={def.name}
                                hint={def.description}
                                right={
                                    <div className="flex items-center gap-3 shrink-0">
                                        <StatusText on={d.enabled} onLabel="Activo" offLabel="Apagado" hideSmall />
                                        <FilterSwitch on={d.enabled} onChange={(next) => toggle(def.key, next)} label={`Activar ${def.name}`} />
                                    </div>
                                }
                            >
                                <div className={`space-y-4 ${d.enabled ? '' : 'opacity-60'}`}>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        {def.fields.filter(f => f.kind === 'number').map(f => f.kind === 'number' && (
                                            <Field key={f.key} label={f.label} hint={f.help}>
                                                <NumberField
                                                    value={Number(d.settings[f.key])}
                                                    min={f.min}
                                                    max={f.max}
                                                    suffix={f.suffix}
                                                    onChange={(v) => setField(def.key, f.key, v)}
                                                />
                                            </Field>
                                        ))}
                                        <Field label="Severidad">
                                            <SeveritySelect value={d.severity} onChange={(v) => update(def.key, { severity: v })} />
                                        </Field>
                                    </div>

                                    {def.fields.filter(f => f.kind === 'check').map(f => (
                                        <div key={f.key}>
                                            <Checkbox label={f.label} checked={Boolean(d.settings[f.key])} onChange={(e) => setField(def.key, f.key, e.target.checked)} />
                                        </div>
                                    ))}

                                    <Field label="Mensaje en el chat">
                                        <Input value={d.message} maxLength={500} onChange={(e) => update(def.key, { message: e.target.value })} placeholder={def.defaultMessage} />
                                    </Field>

                                    {def.note && <p className={smallHintCls}>{def.note}</p>}
                                </div>
                            </Section>
                        );
                    })}

                    <SaveBar saving={saving} onClick={save} label="Guardar umbrales y mensajes" savingLabel="Guardando…" />
                    <p className={`${hintCls} text-xs text-center`}>
                        Los interruptores se guardan al momento. Mensaje vacío = el mensaje de ejemplo. Variables: $(user), $(strike), $(word).
                    </p>
                </div>
            )}
        </ModerationPage>
    );
}
