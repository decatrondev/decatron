import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../../../hooks/usePermissions';
import { Checkbox, Field, Input } from '../../../components/ds';
import { useToast } from '../../../components/dashboard/toast';
import {
    FilterSwitch, fetchModerationFilters, saveModerationFilter, type FilterSeverity, type ModerationFilterState
} from './filterSwitch';
import { ModerationPage, NumberField, PageLoading, SaveBar, Section, SeveritySelect, StatusText, hintCls, smallHintCls } from './parts';

type FieldDef =
    | { kind: 'number'; key: string; min: number; max: number; unit?: 'percent' | 'letters' | 'characters' | 'seconds'; help?: boolean }
    | { kind: 'check'; key: string };

interface SpamFilterDef {
    key: string;
    /** Mensaje por defecto del bot (texto de ejemplo en español, igual que el del backend: no se traduce) */
    defaultMessage: string;
    defaults: Record<string, number | boolean>;
    fields: FieldDef[];
    note?: boolean;
}

// Valores por defecto iguales a los del backend (SpamFilters.cs). Los textos (nombre, descripción, etiquetas, notas) están en i18n: moderation:spam.filters.<clave>
export const SPAM_FILTERS: SpamFilterDef[] = [
    {
        key: 'caps',
        defaultMessage: '🔠 $(user), baja las mayúsculas, por favor. Strike $(strike)/5',
        defaults: { minLetters: 15, maxPercent: 70 },
        fields: [
            { kind: 'number', key: 'maxPercent', min: 10, max: 100, unit: 'percent' },
            { kind: 'number', key: 'minLetters', min: 1, max: 200, unit: 'letters', help: true }
        ],
        note: true
    },
    {
        key: 'symbols',
        defaultMessage: '🔣 $(user), demasiados símbolos en tu mensaje. Strike $(strike)/5',
        defaults: { minLength: 10, maxPercent: 50 },
        fields: [
            { kind: 'number', key: 'maxPercent', min: 10, max: 100, unit: 'percent' },
            { kind: 'number', key: 'minLength', min: 1, max: 200, unit: 'characters' }
        ]
    },
    {
        key: 'emotes',
        defaultMessage: '😶 $(user), demasiados emotes en un mensaje. Strike $(strike)/5',
        defaults: { maxEmotes: 10, countEmoji: true },
        fields: [
            { kind: 'number', key: 'maxEmotes', min: 1, max: 100 },
            { kind: 'check', key: 'countEmoji' }
        ],
        note: true
    },
    {
        key: 'length',
        defaultMessage: '📏 $(user), tu mensaje es demasiado largo. Strike $(strike)/5',
        defaults: { maxLength: 300 },
        fields: [{ kind: 'number', key: 'maxLength', min: 20, max: 500, unit: 'characters' }]
    },
    {
        key: 'repetition',
        defaultMessage: '🔁 $(user), no repitas el mismo mensaje. Strike $(strike)/5',
        defaults: { maxRepeats: 3, windowSeconds: 30 },
        fields: [
            { kind: 'number', key: 'maxRepeats', min: 2, max: 20 },
            { kind: 'number', key: 'windowSeconds', min: 5, max: 300, unit: 'seconds' }
        ]
    },
    {
        key: 'copypasta',
        defaultMessage: '📋 $(user), nada de copypasta en este chat. Strike $(strike)/5',
        defaults: { minUsers: 5, windowSeconds: 60, minLength: 20 },
        fields: [
            { kind: 'number', key: 'minUsers', min: 2, max: 50 },
            { kind: 'number', key: 'windowSeconds', min: 5, max: 300, unit: 'seconds' },
            { kind: 'number', key: 'minLength', min: 5, max: 500, unit: 'characters', help: true }
        ],
        note: true
    },
    {
        key: 'zalgo',
        defaultMessage: '👾 $(user), ese tipo de texto no está permitido. Strike $(strike)/5',
        defaults: { maxCombiningMarks: 2, blockFancyText: false },
        fields: [
            { kind: 'number', key: 'maxCombiningMarks', min: 1, max: 10, help: true },
            { kind: 'check', key: 'blockFancyText' }
        ],
        note: true
    },
    {
        key: 'mentions',
        defaultMessage: '📣 $(user), demasiadas menciones en un mensaje. Strike $(strike)/5',
        defaults: { maxMentions: 5 },
        fields: [{ kind: 'number', key: 'maxMentions', min: 1, max: 50 }]
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
    const { t } = useTranslation('moderation');
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
            .catch(() => showNotice('error', t('common.loadFailed')));
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
            showNotice('error', t('common.toggleFailed'));
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
            showNotice(results.every(Boolean) ? 'success' : 'error', results.every(Boolean) ? t('common.saved') : t('spam.someFailed'));
        } catch {
            showNotice('error', t('common.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    if (!permissionsLoading && !hasMinimumLevel('moderation')) return null;

    return (
        <ModerationPage
            title={t('spam.title')}
            subtitle={t('spam.subtitle')}
            toast={toast}
        >
            {!drafts ? <PageLoading /> : (
                <div className="space-y-4">
                    {SPAM_FILTERS.map(def => {
                        const d = drafts[def.key];
                        return (
                            <Section
                                key={def.key}
                                title={t(`spam.filters.${def.key}.name`)}
                                hint={t(`spam.filters.${def.key}.description`)}
                                right={
                                    <div className="flex items-center gap-3 shrink-0">
                                        <StatusText on={d.enabled} onLabel={t('common.on')} offLabel={t('common.off')} hideSmall />
                                        <FilterSwitch on={d.enabled} onChange={(next) => toggle(def.key, next)} label={t('hub.activate', { name: t(`spam.filters.${def.key}.name`) })} />
                                    </div>
                                }
                            >
                                <div className={`space-y-4 ${d.enabled ? '' : 'opacity-60'}`}>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        {def.fields.filter(f => f.kind === 'number').map(f => f.kind === 'number' && (
                                            <Field key={f.key} label={t(`spam.filters.${def.key}.fields.${f.key}.label`)} hint={f.help ? t(`spam.filters.${def.key}.fields.${f.key}.help`) : undefined}>
                                                <NumberField
                                                    value={Number(d.settings[f.key])}
                                                    min={f.min}
                                                    max={f.max}
                                                    suffix={f.unit ? t(`spam.units.${f.unit}`) : undefined}
                                                    onChange={(v) => setField(def.key, f.key, v)}
                                                />
                                            </Field>
                                        ))}
                                        <Field label={t('common.severity')}>
                                            <SeveritySelect value={d.severity} onChange={(v) => update(def.key, { severity: v })} />
                                        </Field>
                                    </div>

                                    {def.fields.filter(f => f.kind === 'check').map(f => (
                                        <div key={f.key}>
                                            <Checkbox label={t(`spam.filters.${def.key}.fields.${f.key}.label`)} checked={Boolean(d.settings[f.key])} onChange={(e) => setField(def.key, f.key, e.target.checked)} />
                                        </div>
                                    ))}

                                    <Field label={t('common.chatMessage')}>
                                        <Input value={d.message} maxLength={500} onChange={(e) => update(def.key, { message: e.target.value })} placeholder={def.defaultMessage} />
                                    </Field>

                                    {def.note && <p className={smallHintCls}>{t(`spam.filters.${def.key}.note`)}</p>}
                                </div>
                            </Section>
                        );
                    })}

                    <SaveBar saving={saving} onClick={save} label={t('spam.saveLabel')} savingLabel={t('common.saving')} />
                    <p className={`${hintCls} text-xs text-center`}>
                        {t('spam.footer')}
                    </p>
                </div>
            )}
        </ModerationPage>
    );
}
