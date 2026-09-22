import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import {
    FilterSwitch, fetchModerationFilters, saveModerationFilter, type FilterSeverity, type ModerationFilterState
} from './filterSwitch';

type Field =
    | { kind: 'number'; key: string; label: string; min: number; max: number; suffix?: string; help?: string }
    | { kind: 'check'; key: string; label: string };

interface SpamFilterDef {
    key: string;
    name: string;
    description: string;
    defaultMessage: string;
    defaults: Record<string, number | boolean>;
    fields: Field[];
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

const card = 'bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg';
const input = 'w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc]';
const text = 'text-[#1e293b] dark:text-[#f8fafc]';
const hint = 'text-sm text-[#64748b] dark:text-[#94a3b8]';

export default function SpamFilters() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();

    const [drafts, setDrafts] = useState<Record<string, Draft> | null>(null);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

    const showNotice = (type: 'success' | 'error', text: string) => {
        setNotice({ type, text });
        setTimeout(() => setNotice(null), 3000);
    };

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
        <div className="panel-scale bg-[#f8fafc] dark:bg-[#1B1C1D] p-4 sm:p-6">
            <div className="max-w-6xl mx-auto mb-6">
                <button
                    onClick={() => navigate('/moderation')}
                    className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#3b82f6] mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver a Moderación
                </button>
                <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Filtros de spam</h1>
                <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">
                    Cada filtro viene apagado y se activa por separado. Usan la misma escala de strikes y whitelist que Palabras prohibidas.
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

            {!drafts ? (
                <p className="max-w-6xl mx-auto text-center py-12 text-[#64748b] dark:text-[#94a3b8]">Cargando…</p>
            ) : (
                <div className="max-w-6xl mx-auto space-y-4">
                    {SPAM_FILTERS.map(def => {
                        const d = drafts[def.key];
                        return (
                            <div key={def.key} className={card}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">{def.name}</h2>
                                        <p className={hint}>{def.description}</p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className={`text-sm font-bold hidden sm:inline ${d.enabled ? 'text-green-600 dark:text-green-400' : 'text-[#64748b] dark:text-[#94a3b8]'}`}>
                                            {d.enabled ? 'Activo' : 'Apagado'}
                                        </span>
                                        <FilterSwitch on={d.enabled} onChange={(next) => toggle(def.key, next)} label={`Activar ${def.name}`} />
                                    </div>
                                </div>

                                <div className={`mt-4 space-y-4 ${d.enabled ? '' : 'opacity-60'}`}>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        {def.fields.filter(f => f.kind === 'number').map(f => f.kind === 'number' && (
                                            <div key={f.key}>
                                                <label className={`block text-sm font-semibold mb-2 ${text}`}>{f.label}</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min={f.min}
                                                        max={f.max}
                                                        value={Number(d.settings[f.key])}
                                                        onChange={(e) => setField(def.key, f.key, Math.min(f.max, Math.max(f.min, Number(e.target.value) || f.min)))}
                                                        className={input}
                                                    />
                                                    {f.suffix && <span className={`${hint} whitespace-nowrap`}>{f.suffix}</span>}
                                                </div>
                                                {f.help && <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{f.help}</p>}
                                            </div>
                                        ))}
                                        <div>
                                            <label className={`block text-sm font-semibold mb-2 ${text}`}>Severidad</label>
                                            <select value={d.severity} onChange={(e) => update(def.key, { severity: e.target.value as FilterSeverity })} className={input}>
                                                <option value="leve">Leve (escalamiento)</option>
                                                <option value="medio">Medio (timeout 10 min mín.)</option>
                                                <option value="severo">Severo (ban directo)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {def.fields.filter(f => f.kind === 'check').map(f => (
                                        <label key={f.key} className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(d.settings[f.key])}
                                                onChange={(e) => setField(def.key, f.key, e.target.checked)}
                                                className="w-4 h-4"
                                            />
                                            <span className={text}>{f.label}</span>
                                        </label>
                                    ))}

                                    <div>
                                        <label className={`block text-sm font-semibold mb-2 ${text}`}>Mensaje en el chat</label>
                                        <input
                                            type="text"
                                            value={d.message}
                                            maxLength={500}
                                            onChange={(e) => update(def.key, { message: e.target.value })}
                                            placeholder={def.defaultMessage}
                                            className={`${input} text-sm`}
                                        />
                                    </div>

                                    {def.note && <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{def.note}</p>}
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
                        {saving ? 'Guardando…' : 'Guardar umbrales y mensajes'}
                    </button>
                    <p className="text-xs text-center text-[#64748b] dark:text-[#94a3b8]">
                        Los interruptores se guardan al momento. Mensaje vacío = el mensaje de ejemplo. Variables: $(user), $(strike), $(word).
                    </p>
                </div>
            )}
        </div>
    );
}
