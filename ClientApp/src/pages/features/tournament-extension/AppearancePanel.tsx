import React, { useEffect, useRef, useState } from 'react';
import { Palette, Loader2, Check, AlertTriangle, Trash2, ImagePlus, Moon, Sun } from 'lucide-react';
import api from '../../../services/api';
import { EditionPicker } from './shared';
import type { TournamentEdition } from './shared';
import { buildTokens, cssVars, DEFAULT_PRIMARY, DEFAULT_SECONDARY, type Appearance } from '../../tournament-public/theme';

// Pestaña "Apariencia" (rediseño de la vista publica, R0 — .dev/torneos/16-rediseno-publico.md):
// logo, portada, color principal y secundario, y fondo claro u oscuro. La pagina
// publica, "Mi inscripción" y el widget se pintan con esto. Vista previa en vivo.

const input =
    'w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm 4xl:text-base';
const label = 'text-xs 4xl:text-sm font-bold text-[#64748b] dark:text-[#94a3b8]';
const card = 'p-4 4xl:p-6 rounded-xl border border-[#e2e8f0] dark:border-[#374151] space-y-3';

// Colores de partida para quien no sabe cual elegir.
const PRESETS: { name: string; primary: string; secondary: string }[] = [
    { name: 'Azul eléctrico', primary: '#2F6BFF', secondary: '#18C8E8' },
    { name: 'Rojo arena', primary: '#E5243B', secondary: '#FFB020' },
    { name: 'Violeta', primary: '#7B3FF2', secondary: '#FF4FA3' },
    { name: 'Verde neón', primary: '#1DB954', secondary: '#C6F432' },
    { name: 'Naranja', primary: '#FF6A13', secondary: '#FFD23F' },
    { name: 'Turquesa', primary: '#00B3A4', secondary: '#7C5CFF' },
];

export default function AppearancePanel({
    edition,
    editions,
    onSelectEdition,
}: {
    edition: TournamentEdition | null;
    editions: TournamentEdition[];
    onSelectEdition: (id: number) => void;
}) {
    const [appearance, setAppearance] = useState<Appearance | null>(null);
    const [primary, setPrimary] = useState(DEFAULT_PRIMARY);
    const [secondary, setSecondary] = useState(DEFAULT_SECONDARY);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const base = edition ? `/admin/tournament/editions/${edition.id}/appearance` : '';

    const apply = (a: Appearance) => {
        setAppearance(a);
        setPrimary(a.primaryColor || DEFAULT_PRIMARY);
        setSecondary(a.secondaryColor || DEFAULT_SECONDARY);
        setTheme(a.theme === 'light' ? 'light' : 'dark');
    };

    useEffect(() => {
        setAppearance(null);
        if (!edition) return;
        api.get(base).then((res) => apply(res.data.appearance)).catch(() => setAppearance({}));
    }, [edition?.id]);

    if (!edition) return <EditionPicker editions={editions} onSelectEdition={onSelectEdition} />;
    if (!appearance) return <Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" />;

    const dirty =
        primary.toUpperCase() !== (appearance.primaryColor || DEFAULT_PRIMARY).toUpperCase() ||
        secondary.toUpperCase() !== (appearance.secondaryColor || DEFAULT_SECONDARY).toUpperCase() ||
        theme !== (appearance.theme === 'light' ? 'light' : 'dark');

    const save = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await api.put(base, { primaryColor: primary, secondaryColor: secondary, theme });
            apply(res.data.appearance);
            setMessage({ ok: true, text: 'Apariencia guardada.' });
        } catch (err: any) {
            setMessage({ ok: false, text: err?.response?.data?.message || 'No se pudo guardar' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4 4xl:space-y-6">
            <div>
                <h2 className="text-lg 4xl:text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Palette className="w-5 h-5 text-[#2563eb]" /> Apariencia — {edition.name}
                </h2>
                <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                    Tu marca en la página del torneo, en el panel de los jugadores y en el widget para OBS.
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] 4xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)] gap-4 4xl:gap-6 items-start">
                <div className="space-y-4 4xl:space-y-6">
                    <ImageSlot title="Logo" hint="Cuadrado, con fondo transparente si puedes. Hasta 10 MB." kind="logo" base={base} url={appearance.logoUrl} onChanged={apply} />
                    <ImageSlot
                        title="Portada"
                        hint="Va de fondo en la cabecera. Horizontal, ideal 1920 × 600 o más grande."
                        kind="banner"
                        base={base}
                        url={appearance.bannerUrl}
                        onChanged={apply}
                    />

                    <section className={card}>
                        <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc] 4xl:text-lg">Colores</h3>
                        <div className="flex flex-wrap gap-2">
                            {PRESETS.map((p) => (
                                <button
                                    key={p.name}
                                    type="button"
                                    title={p.name}
                                    onClick={() => {
                                        setPrimary(p.primary);
                                        setSecondary(p.secondary);
                                    }}
                                    className="w-9 h-9 4xl:w-11 4xl:h-11 rounded-lg overflow-hidden border border-[#e2e8f0] dark:border-[#374151] flex"
                                >
                                    <span className="flex-1" style={{ background: p.primary }} />
                                    <span className="w-1/3" style={{ background: p.secondary }} />
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <ColorField label="Principal" value={primary} onChange={setPrimary} />
                            <ColorField label="Secundario" value={secondary} onChange={setSecondary} />
                        </div>
                        <div>
                            <span className={label}>Fondo</span>
                            <div className="mt-1 grid grid-cols-2 gap-2">
                                {(['dark', 'light'] as const).map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setTheme(t)}
                                        className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-bold ${
                                            theme === t
                                                ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#2563eb]'
                                                : 'border-[#e2e8f0] dark:border-[#374151] text-[#475569] dark:text-[#94a3b8]'
                                        }`}
                                    >
                                        {t === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                                        {t === 'dark' ? 'Oscuro' : 'Claro'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <button
                                type="button"
                                onClick={save}
                                disabled={saving || !dirty}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-sm font-bold hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Guardar colores y fondo
                            </button>
                            {message && (
                                <p className={`text-sm flex items-center gap-1 ${message.ok ? 'text-[#16a34a]' : 'text-red-600 dark:text-red-400'}`}>
                                    {message.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                    {message.text}
                                </p>
                            )}
                        </div>
                    </section>
                </div>

                <section className="space-y-2 xl:sticky xl:top-4">
                    <p className={label}>Vista previa</p>
                    <Preview
                        name={edition.name}
                        appearance={{ ...appearance, primaryColor: primary, secondaryColor: secondary, theme }}
                        isFortnite={edition.game === 'fortnite'}
                    />
                </section>
            </div>
        </div>
    );
}

function ColorField({ label: text, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    const [draft, setDraft] = useState(value);
    useEffect(() => setDraft(value), [value]);
    return (
        <div>
            <span className={label}>{text}</span>
            <div className="mt-1 flex items-center gap-2">
                <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent" />
                <input
                    value={draft}
                    onChange={(e) => {
                        setDraft(e.target.value);
                        if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value.toUpperCase());
                    }}
                    maxLength={7}
                    className={input + ' mt-0 font-mono uppercase'}
                />
            </div>
        </div>
    );
}

/** Subir, pegar (Ctrl+V con el foco en el recuadro) o arrastrar el logo o la portada. */
function ImageSlot({
    title,
    hint,
    kind,
    base,
    url,
    onChanged,
}: {
    title: string;
    hint: string;
    kind: 'logo' | 'banner';
    base: string;
    url?: string | null;
    onChanged: (a: Appearance) => void;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const upload = async (file: File | null | undefined) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('Eso no es una imagen: usa PNG, JPG o WEBP');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const form = new FormData();
            form.append('file', file);
            const res = await api.post(`${base}/${kind}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
            onChanged(res.data.appearance);
        } catch (err: any) {
            setError(err?.response?.data?.message || 'No se pudo subir la imagen');
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        setBusy(true);
        setError('');
        try {
            const res = await api.delete(`${base}/${kind}`);
            onChanged(res.data.appearance);
        } catch (err: any) {
            setError(err?.response?.data?.message || 'No se pudo quitar la imagen');
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className={card}>
            <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc] 4xl:text-lg">{title}</h3>
                {url && (
                    <button type="button" onClick={remove} disabled={busy} className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 hover:underline">
                        <Trash2 className="w-3.5 h-3.5" /> Quitar
                    </button>
                )}
            </div>
            <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
                onPaste={(e) => {
                    const f = Array.from(e.clipboardData.items).find((i) => i.kind === 'file' && i.type.startsWith('image/'))?.getAsFile();
                    if (f) {
                        e.preventDefault();
                        upload(f);
                    }
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    upload(e.dataTransfer.files?.[0]);
                }}
                className={`relative flex items-center justify-center rounded-lg border-2 border-dashed cursor-pointer overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#2563eb] ${
                    kind === 'logo' ? 'h-32 4xl:h-40' : 'h-36 4xl:h-48'
                } ${dragging ? 'border-[#2563eb] bg-[#2563eb]/5' : 'border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb]/60'}`}
            >
                {url ? (
                    <img src={url} alt={title} className={kind === 'logo' ? 'max-h-full max-w-full object-contain p-2' : 'w-full h-full object-cover'} />
                ) : (
                    <span className="flex flex-col items-center gap-1 text-[#64748b] dark:text-[#94a3b8] text-xs 4xl:text-sm text-center px-3">
                        <ImagePlus className="w-6 h-6" />
                        Toca para elegir, arrástrala o pégala con Ctrl+V
                    </span>
                )}
                {busy && (
                    <span className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-white" />
                    </span>
                )}
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            </div>
            <p className="text-[11px] 4xl:text-xs text-[#64748b] dark:text-[#94a3b8]">{hint}</p>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </section>
    );
}

/**
 * Vista previa de la cabecera y la clasificacion con la apariencia elegida. Es una
 * version reducida del diseño de la pagina publica (R1), con datos de ejemplo.
 */
function Preview({ name, appearance, isFortnite }: { name: string; appearance: Appearance; isFortnite: boolean }) {
    const t = buildTokens(appearance);
    const rows = [
        { team: 'Los Invictos', pts: 186 },
        { team: 'Vanguardia', pts: 141 },
        { team: 'Fénix Gaming', pts: 97 },
        { team: 'Nómadas', pts: 58 },
    ];
    const max = rows[0].pts;

    return (
        <div style={{ ...cssVars(t), background: 'var(--t-bg)', color: 'var(--t-ink)' }} className="rounded-xl overflow-hidden font-barlow border border-[#e2e8f0] dark:border-[#374151]">
            <div className="relative h-40 4xl:h-56 overflow-hidden" style={{ background: `linear-gradient(120deg, ${t.primary}, ${t.secondary})` }}>
                {appearance.bannerUrl && <img src={appearance.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${t.bg} 4%, transparent 70%)` }} />
                <div className="absolute left-4 right-4 bottom-3 flex items-end gap-3">
                    {appearance.logoUrl ? (
                        <img src={appearance.logoUrl} alt="" className="w-14 h-14 4xl:w-20 4xl:h-20 object-contain rounded-lg" style={{ background: 'var(--t-surface)' }} />
                    ) : (
                        <span
                            className="w-14 h-14 4xl:w-20 4xl:h-20 rounded-lg flex items-center justify-center font-scoreboard font-black text-2xl"
                            style={{ background: 'var(--t-primary)', color: 'var(--t-on-primary)' }}
                        >
                            {name.slice(0, 1).toUpperCase()}
                        </span>
                    )}
                    <div className="min-w-0">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-sm" style={{ background: 'var(--t-live)', color: '#fff' }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-white" /> En vivo
                        </span>
                        <p className="font-scoreboard font-black text-3xl 4xl:text-5xl leading-none mt-1 truncate">{name}</p>
                        <p className="text-xs 4xl:text-sm" style={{ color: 'var(--t-muted)' }}>
                            {isFortnite ? 'Partida 3 de 6' : 'Cuartos de final'}
                        </p>
                    </div>
                </div>
            </div>
            <div className="p-4 space-y-1.5">
                {rows.map((r, i) => (
                    <div key={r.team} className="flex items-center gap-3">
                        <span className="w-6 text-right font-scoreboard font-black text-lg" style={{ color: i === 0 ? 'var(--t-gold)' : 'var(--t-muted)' }}>
                            {i + 1}
                        </span>
                        <div className="relative flex-1 h-9 4xl:h-11 rounded-sm overflow-hidden" style={{ background: 'var(--t-surface-raised)' }}>
                            <div
                                className="absolute inset-y-0 left-0"
                                style={{
                                    width: `${(r.pts / max) * 100}%`,
                                    background: i === 0 ? 'var(--t-primary)' : `color-mix(in srgb, var(--t-primary) ${70 - i * 12}%, var(--t-surface-raised))`,
                                    clipPath: 'polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)',
                                }}
                            />
                            <span className="relative h-full flex items-center px-3 font-semibold text-sm 4xl:text-base" style={{ color: i === 0 ? 'var(--t-on-primary)' : 'var(--t-ink)' }}>
                                {r.team}
                            </span>
                        </div>
                        <span className="w-12 text-right font-scoreboard font-black text-xl 4xl:text-2xl">{r.pts}</span>
                    </div>
                ))}
                <div className="pt-3 flex gap-2">
                    <span className="px-4 py-2 rounded-sm text-sm font-bold" style={{ background: 'var(--t-primary)', color: 'var(--t-on-primary)' }}>
                        Inscribirme
                    </span>
                    <span className="px-4 py-2 rounded-sm text-sm font-bold border" style={{ borderColor: 'var(--t-secondary)', color: 'var(--t-ink)' }}>
                        Ver normas
                    </span>
                </div>
            </div>
        </div>
    );
}
