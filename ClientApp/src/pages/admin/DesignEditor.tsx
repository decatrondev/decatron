import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, RotateCcw, Save, Send, Undo2, History } from 'lucide-react';
import api from '../../services/api';
import {
    DsRoot, Button, Field, Input, Select, Tabs, Card, Badge, Alert, Table, Modal, Eyebrow,
} from '../../components/ds';
import {
    DS_COLORS, DS_SHAPE, DS_FONTS, resolveDesign,
    type DesignOverrides, type DsColors, type DsFontName, type DsTheme, type ResolvedDesign,
} from '../../components/ds/tokens';
import { contrastReport } from '../../design/contrast';
import { getPreview, refreshPublished, setPreview } from '../../design/runtime';

/**
 * Editor de valores de diseño (solo dueño). Plan: .dev/plans/SISTEMA_DE_DISENO_PLAN.md, Fase 4.
 * Lo que se guarda es solo lo que cambia respecto a los valores de fábrica (tokens.ts). Borrador → publicar → historial.
 * Solo afecta a lo que ya lee las variables de diseño (vistas públicas, docs, guía); el dashboard se migra por módulos.
 */

interface Version { id: number; status: string; note: string; authorLogin: string; createdAt: string; updatedAt: string; publishedAt: string | null; values: DesignOverrides }
interface ServerState { draft: Version | null; published: Version | null; history: Version[] }

const COLOR_LABELS: Record<keyof DsColors, string> = {
    bg: 'Fondo', surface: 'Superficie (tarjetas)', raised: 'Superficie elevada', input: 'Fondo de campos',
    border: 'Borde', borderSoft: 'Borde suave', text: 'Texto', soft: 'Texto de apoyo', faint: 'Texto tenue (placeholders)',
    accent: 'Azul de acción', accentHover: 'Azul de acción · hover', accentText: 'Azul para texto y enlaces', onAccent: 'Texto sobre el azul',
    ok: 'Estado correcto', warn: 'Aviso', danger: 'Error (texto)', dangerSolid: 'Botón de error', dangerHover: 'Botón de error · hover',
};
const MAIN_KEYS: (keyof DsColors)[] = ['bg', 'surface', 'raised', 'input', 'border', 'borderSoft', 'text', 'soft', 'faint', 'accent', 'accentText', 'onAccent', 'ok', 'warn', 'danger', 'dangerSolid'];
const ADV_KEYS: (keyof DsColors)[] = ['accentHover', 'dangerHover'];
const HEX = /^#[0-9a-fA-F]{6}$/;
const SIZES = ['sm', 'md', 'lg'] as const;
type SizeKey = typeof SIZES[number];

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o)) as T;
const isEmpty = (o: object | undefined) => !o || Object.keys(o).length === 0;
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/** Quita ramas vacías para guardar solo lo que cambió. */
function prune(o: DesignOverrides): DesignOverrides {
    const r = clone(o);
    if (r.colors) { (['dark', 'light'] as const).forEach(t => { if (isEmpty(r.colors![t])) delete r.colors![t]; }); if (isEmpty(r.colors)) delete r.colors; }
    if (r.shape?.sizes) { SIZES.forEach(k => { if (isEmpty(r.shape!.sizes![k])) delete r.shape!.sizes![k]; }); if (isEmpty(r.shape.sizes)) delete r.shape.sizes; }
    if (r.shape && isEmpty(r.shape)) delete r.shape;
    return r;
}

function flatten(d: ResolvedDesign): Record<string, string> {
    const f: Record<string, string> = {};
    (['dark', 'light'] as const).forEach(t => (Object.keys(DS_COLORS[t]) as (keyof DsColors)[]).forEach(k => { f[`${t === 'dark' ? 'Oscuro' : 'Claro'} · ${COLOR_LABELS[k]}`] = d.colors[t][k]; }));
    const s = d.shape;
    Object.assign(f, {
        'Forma · Radio': `${s.radius} px`, 'Forma · Radio de tarjetas': `${s.radiusLg} px`, 'Forma · Peso de letra': String(s.weight), 'Forma · Grosor de borde': `${s.border} px`,
        'Forma · Tipografía': s.fontUi, 'Ambiente · Cuadrícula': String(s.gridOpacity), 'Ambiente · Resplandor': String(s.glowOpacity),
    });
    SIZES.forEach(k => { f[`Tamaño ${k.toUpperCase()} · Altura`] = `${s.sizes[k].height} px`; f[`Tamaño ${k.toUpperCase()} · Relleno`] = `${s.sizes[k].padX} px`; f[`Tamaño ${k.toUpperCase()} · Letra`] = `${s.sizes[k].font} px`; });
    return f;
}
function diffLines(from: ResolvedDesign, to: ResolvedDesign): [string, string, string][] {
    const a = flatten(from), b = flatten(to);
    return Object.keys(b).filter(k => a[k] !== b[k]).map(k => [k, a[k], b[k]]);
}

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
    const [text, setText] = useState(String(value));
    useEffect(() => setText(String(value)), [value]);
    return (
        <Field label={label} hint={`${min}–${max}`}>
            <Input type="number" value={text} min={min} max={max} step={step} onChange={e => {
                setText(e.target.value);
                const n = Number(e.target.value);
                if (e.target.value !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(n);
            }} />
        </Field>
    );
}

function ColorRow({ theme, k, value, factory, overridden, derived, onChange, onReset }: {
    theme: DsTheme; k: keyof DsColors; value: string; factory: string; overridden: boolean; derived: boolean; onChange: (v: string) => void; onReset: () => void;
}) {
    const [text, setText] = useState(value);
    useEffect(() => setText(value), [value]);
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '36px minmax(0,1fr) 110px 32px', gap: 10, alignItems: 'center' }}>
            <input type="color" aria-label={`${COLOR_LABELS[k]} (${theme})`} value={value} onChange={e => onChange(e.target.value)}
                style={{ width: 36, height: 32, padding: 0, border: '1px solid var(--ds-border)', borderRadius: 'var(--ds-radius)', background: 'none', cursor: 'pointer' }} />
            <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{COLOR_LABELS[k]}{overridden && <span style={{ color: 'var(--ds-accent-text)' }}> ●</span>}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ds-soft)', fontFamily: 'var(--ds-font-mono)' }}>{derived ? 'se deriva del azul de acción' : `fábrica ${factory}`}</p>
            </div>
            <Input value={text} aria-label={`${COLOR_LABELS[k]} hex`} spellCheck={false} onChange={e => { setText(e.target.value); if (HEX.test(e.target.value)) onChange(e.target.value.toLowerCase()); }} error={!HEX.test(text)} />
            <button type="button" title="Volver al valor de fábrica" aria-label="Volver al valor de fábrica" disabled={!overridden} onClick={onReset}
                style={{ background: 'none', border: 0, color: overridden ? 'var(--ds-soft)' : 'var(--ds-border)', cursor: overridden ? 'pointer' : 'default', padding: 4 }}><Undo2 size={16} /></button>
        </div>
    );
}

/** Muestra compacta de componentes con los valores en edición. */
function Sample({ theme, design }: { theme: DsTheme; design: ResolvedDesign }) {
    return (
        <DsRoot theme={theme} design={design} ambient>
            <div style={{ padding: 20, display: 'grid', gap: 14 }}>
                <div>
                    <Eyebrow>{theme === 'dark' ? 'oscuro' : 'claro'}</Eyebrow>
                    <p className="ds-h2">Tu bot, en cada chat</p>
                    <p className="ds-card-text" style={{ margin: '6px 0 0' }}>Texto de apoyo con <a href="#!" onClick={e => e.preventDefault()} style={{ color: 'var(--ds-accent-text)' }}>un enlace</a> y un <span style={{ color: 'var(--ds-faint)' }}>texto tenue</span>.</p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <Button>Principal</Button><Button variant="secondary">Secundario</Button><Button variant="ghost">Fantasma</Button><Button variant="danger">Eliminar</Button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <Button size="sm">SM</Button><Button size="md">MD</Button><Button size="lg">LG</Button>
                </div>
                <Input placeholder="Campo de texto" readOnly />
                <Card><p className="ds-card-title">Tarjeta</p><p className="ds-card-text">Contenido de ejemplo.</p><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Badge>neutra</Badge><Badge tone="accent">azul</Badge><Badge tone="ok">ok</Badge><Badge tone="warn">aviso</Badge><Badge tone="danger">error</Badge></div></Card>
                <Alert tone="info" title="Información">Aviso con borde completo tenue.</Alert>
                <Alert tone="warn" title="Atención">Aviso de advertencia.</Alert>
            </div>
        </DsRoot>
    );
}

export default function DesignEditor({ onClose }: { onClose: () => void }) {
    const [server, setServer] = useState<ServerState | null>(null);
    const [ov, setOv] = useState<DesignOverrides>({});
    const [tab, setTab] = useState('dark');
    const [advanced, setAdvanced] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
    const [modal, setModal] = useState<'publish' | 'reset' | null>(null);
    const [note, setNote] = useState('');
    const [previewOn, setPreviewOn] = useState(!!getPreview());

    const load = useCallback(async () => {
        const r = await api.get('/admin/design');
        const s: ServerState = { draft: r.data.draft, published: r.data.published, history: r.data.history ?? [] };
        setServer(s);
        setOv(clone(s.draft?.values ?? s.published?.values ?? {}));
        setNote(s.draft?.note ?? '');
    }, []);
    useEffect(() => { load().catch(() => setMsg({ tone: 'danger', text: 'No se pudo cargar el editor.' })); }, [load]);

    const base: DesignOverrides = server?.draft?.values ?? server?.published?.values ?? {};
    const dirty = JSON.stringify(prune(ov)) !== JSON.stringify(prune(base));
    const design = useMemo(() => resolveDesign(ov), [ov]);
    const publishedDesign = useMemo(() => resolveDesign(server?.published?.values), [server]);
    const report = useMemo(() => contrastReport(design), [design]);
    const failing = report.filter(r => !r.ok);
    const changes = useMemo(() => diffLines(publishedDesign, design), [publishedDesign, design]);
    const hasEdits = !isEmpty(prune(ov));

    // Si la vista previa del sitio está activa, sigue lo que se edita.
    useEffect(() => { if (previewOn) setPreview(prune(ov)); }, [ov, previewOn]);

    const setColor = (t: DsTheme, k: keyof DsColors, v: string) => setOv(o => {
        const n = clone(o); n.colors ??= {}; n.colors[t] ??= {};
        if (v.toLowerCase() === DS_COLORS[t][k].toLowerCase()) delete n.colors[t]![k]; else n.colors[t]![k] = v;
        return n;
    });
    const resetColor = (t: DsTheme, k: keyof DsColors) => setOv(o => { const n = clone(o); if (n.colors?.[t]) delete n.colors[t]![k]; return n; });
    const setShape = (k: 'radius' | 'radiusLg' | 'weight' | 'border' | 'gridOpacity' | 'glowOpacity', v: number) => setOv(o => {
        const n = clone(o); n.shape ??= {};
        if (v === DS_SHAPE[k]) delete n.shape[k]; else n.shape[k] = v;
        return n;
    });
    const setFont = (v: DsFontName) => setOv(o => { const n = clone(o); n.shape ??= {}; if (v === DS_SHAPE.fontUi) delete n.shape.fontUi; else n.shape.fontUi = v; return n; });
    const setSize = (s: SizeKey, k: 'height' | 'padX' | 'font', v: number) => setOv(o => {
        const n = clone(o); n.shape ??= {}; n.shape.sizes ??= {}; n.shape.sizes[s] ??= {};
        if (v === DS_SHAPE.sizes[s][k]) delete n.shape.sizes[s]![k]; else n.shape.sizes[s]![k] = v;
        return n;
    });

    const run = async (name: string, fn: () => Promise<void>) => {
        setBusy(name); setMsg(null);
        try { await fn(); }
        catch (e: unknown) {
            const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setMsg({ tone: 'danger', text: m ?? 'Algo salió mal. Inténtalo de nuevo.' });
        } finally { setBusy(null); }
    };

    const saveDraft = () => run('draft', async () => {
        await api.put('/admin/design/draft', { values: prune(ov), note });
        await load(); setMsg({ tone: 'ok', text: 'Borrador guardado. Todavía no se ve en el sitio.' });
    });
    const discard = () => run('discard', async () => {
        await api.delete('/admin/design/draft'); await load(); setMsg({ tone: 'ok', text: 'Borrador descartado.' });
    });
    const publish = () => run('publish', async () => {
        await api.put('/admin/design/draft', { values: prune(ov), note });
        await api.post('/admin/design/publish', { note });
        await refreshPublished(); await load(); setModal(null);
        setMsg({ tone: 'ok', text: 'Publicado. El sitio ya usa estos valores (quien tenga el sitio abierto lo verá al recargar).' });
    });
    const reset = () => run('reset', async () => {
        await api.post('/admin/design/reset');
        await refreshPublished(); await load(); setModal(null);
        setMsg({ tone: 'ok', text: 'Valores de fábrica restablecidos.' });
    });
    const restore = (id: number) => run('restore', async () => {
        await api.post(`/admin/design/versions/${id}/restore`); await load();
        setMsg({ tone: 'ok', text: 'Versión cargada en el borrador. Revísala y publícala si la quieres.' });
    });
    const togglePreview = () => {
        if (previewOn) { setPreview(null); setPreviewOn(false); }
        else { setPreview(prune(ov)); setPreviewOn(true); window.open('/', '_blank'); }
    };

    if (!server) return <p style={{ padding: 32 }}>{msg?.text ?? '...'}</p>;

    const themeTab = tab === 'dark' || tab === 'light';
    const t = tab as DsTheme;

    return (
        <div style={{ padding: '24px 32px 80px', maxWidth: 1400, margin: '0 auto' }}>
            <header style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
                <div>
                    <Eyebrow>sistema de diseño · editor</Eyebrow>
                    <h1 className="ds-h1">Editar valores</h1>
                    <p className="ds-card-text" style={{ marginTop: 8, maxWidth: 680 }}>
                        Lo que cambies aquí se ve en las vistas públicas, la documentación y la guía una vez que lo publiques. El dashboard se irá sumando a medida que se migre cada módulo.
                        Los overlays y la página de tips de cada streamer no se tocan.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Badge tone={server.published ? 'accent' : undefined}>{server.published ? `publicado v${server.published.id}` : 'valores de fábrica'}</Badge>
                    {server.draft && <Badge tone="warn">borrador</Badge>}
                    {dirty && <Badge tone="warn">sin guardar</Badge>}
                </div>
            </header>

            {msg && <div style={{ marginBottom: 16 }}><Alert tone={msg.tone === 'ok' ? 'ok' : 'danger'}>{msg.text}</Alert></div>}
            {failing.length > 0 && <div style={{ marginBottom: 16 }}><Alert tone="warn" title={`${failing.length} par(es) de texto sin contraste suficiente`}>No podrás publicar hasta corregirlos. Mira «Contraste» abajo.</Alert></div>}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                <Button icon={<Save />} onClick={saveDraft} loading={busy === 'draft'} disabled={!dirty || !!busy}>Guardar borrador</Button>
                <Button icon={<Send />} variant="secondary" onClick={() => setModal('publish')} disabled={!hasEdits || failing.length > 0 || !!busy || (!dirty && !server.draft)}>Publicar…</Button>
                <Button icon={previewOn ? <EyeOff /> : <Eye />} variant="secondary" onClick={togglePreview}>{previewOn ? 'Salir de la vista previa' : 'Ver el sitio con este borrador'}</Button>
                {server.draft && <Button variant="ghost" onClick={discard} loading={busy === 'discard'} disabled={!!busy}>Descartar borrador</Button>}
                <Button icon={<RotateCcw />} variant="ghost" onClick={() => setModal('reset')} disabled={!!busy || (!server.published && !server.draft)}>Restablecer a fábrica</Button>
                <Button variant="ghost" onClick={onClose}>Volver a la guía</Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 32, alignItems: 'start' }} className="design-editor-grid">
                <div style={{ display: 'grid', gap: 20 }}>
                    <Tabs value={tab} onChange={setTab} items={[{ id: 'dark', label: 'Oscuro' }, { id: 'light', label: 'Claro' }, { id: 'shape', label: 'Forma' }, { id: 'contrast', label: `Contraste${failing.length ? ` (${failing.length})` : ''}` }, { id: 'history', label: 'Historial' }]} />

                    {themeTab && (
                        <Card>
                            <div style={{ display: 'grid', gap: 12 }}>
                                {MAIN_KEYS.map(k => (
                                    <ColorRow key={k} theme={t} k={k} value={design.colors[t][k]} factory={DS_COLORS[t][k]} overridden={!!ov.colors?.[t]?.[k]} derived={false}
                                        onChange={v => setColor(t, k, v)} onReset={() => resetColor(t, k)} />
                                ))}
                                <button type="button" onClick={() => setAdvanced(a => !a)} style={{ background: 'none', border: 0, color: 'var(--ds-accent-text)', cursor: 'pointer', textAlign: 'left', padding: 0, font: '600 14px var(--ds-font-ui)' }}>
                                    {advanced ? '▾' : '▸'} Avanzado: colores de hover
                                </button>
                                {advanced && ADV_KEYS.map(k => (
                                    <ColorRow key={k} theme={t} k={k} value={design.colors[t][k]} factory={DS_COLORS[t][k]} overridden={!!ov.colors?.[t]?.[k]}
                                        derived={!ov.colors?.[t]?.[k] && !!ov.colors?.[t]?.[k === 'accentHover' ? 'accent' : 'dangerSolid']}
                                        onChange={v => setColor(t, k, v)} onReset={() => resetColor(t, k)} />
                                ))}
                            </div>
                        </Card>
                    )}

                    {tab === 'shape' && (
                        <Card>
                            <div style={{ display: 'grid', gap: 16 }}>
                                <p className="ds-card-title" style={{ margin: 0 }}>Forma</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                                    <NumberField label="Radio (px)" value={design.shape.radius} min={0} max={16} onChange={v => setShape('radius', v)} />
                                    <NumberField label="Radio de tarjetas (px)" value={design.shape.radiusLg} min={0} max={24} onChange={v => setShape('radiusLg', v)} />
                                    <NumberField label="Peso de letra" value={design.shape.weight} min={400} max={900} step={100} onChange={v => setShape('weight', v)} />
                                    <NumberField label="Grosor de borde (px)" value={design.shape.border} min={1} max={2} onChange={v => setShape('border', v)} />
                                </div>
                                <p className="ds-card-title" style={{ margin: 0 }}>Los tres tamaños de control</p>
                                {SIZES.map(s => (
                                    <div key={s} style={{ display: 'grid', gridTemplateColumns: '40px repeat(3, minmax(0, 1fr))', gap: 12, alignItems: 'end' }}>
                                        <p className="ds-eyebrow" style={{ margin: '0 0 10px' }}>{s}</p>
                                        <NumberField label="Altura" value={design.shape.sizes[s].height} min={24} max={64} onChange={v => setSize(s, 'height', v)} />
                                        <NumberField label="Relleno" value={design.shape.sizes[s].padX} min={6} max={40} onChange={v => setSize(s, 'padX', v)} />
                                        <NumberField label="Letra" value={design.shape.sizes[s].font} min={11} max={20} onChange={v => setSize(s, 'font', v)} />
                                    </div>
                                ))}
                                <p className="ds-card-title" style={{ margin: 0 }}>Tipografía y ambiente</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                                    <Field label="Tipografía de la interfaz" hint="Solo las que el sitio ya carga">
                                        <Select value={design.shape.fontUi} onChange={e => setFont(e.target.value as DsFontName)}>
                                            {(Object.keys(DS_FONTS) as DsFontName[]).map(f => <option key={f} value={f}>{f === 'system-ui' ? 'Del sistema' : f}</option>)}
                                        </Select>
                                    </Field>
                                    <NumberField label="Cuadrícula (opacidad)" value={design.shape.gridOpacity} min={0} max={0.3} step={0.01} onChange={v => setShape('gridOpacity', v)} />
                                    <NumberField label="Resplandor (opacidad)" value={design.shape.glowOpacity} min={0} max={0.8} step={0.01} onChange={v => setShape('glowOpacity', v)} />
                                </div>
                            </div>
                        </Card>
                    )}

                    {tab === 'contrast' && (
                        <Table head={['Tema', 'Par', 'Contraste', 'AA']} rows={report.map(r => [
                            r.theme === 'dark' ? 'Oscuro' : 'Claro', r.label, r.ratio.toFixed(2),
                            r.ok ? <Badge tone="ok">cumple</Badge> : <Badge tone="danger">no cumple</Badge>,
                        ])} />
                    )}

                    {tab === 'history' && (
                        <div style={{ display: 'grid', gap: 10 }}>
                            {[server.published, ...server.history].filter((v): v is Version => !!v).map(v => (
                                <Card key={v.id}>
                                    <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div>
                                            <p className="ds-card-title" style={{ margin: 0 }}><History size={14} style={{ verticalAlign: -2 }} /> v{v.id} {v.status === 'published' && <Badge tone="accent">publicada</Badge>}</p>
                                            <p className="ds-card-text" style={{ margin: '4px 0 0' }}>{fmtDate(v.publishedAt ?? v.updatedAt)} · {v.authorLogin || '—'}{v.note ? ` · ${v.note}` : ''}</p>
                                        </div>
                                        <Button size="sm" variant="secondary" onClick={() => restore(v.id)} disabled={!!busy}>Cargar en el borrador</Button>
                                    </div>
                                </Card>
                            ))}
                            {!server.published && server.history.length === 0 && <p className="ds-card-text">Todavía no hay versiones publicadas.</p>}
                        </div>
                    )}
                </div>

                <div style={{ display: 'grid', gap: 16, position: 'sticky', top: 16 }}>
                    <p className="ds-card-text" style={{ margin: 0 }}>Vista previa en vivo (con lo que estás editando)</p>
                    <div style={{ border: '1px solid var(--ds-border)', borderRadius: 'var(--ds-radius-lg)', overflow: 'hidden' }}><Sample theme="dark" design={design} /></div>
                    <div style={{ border: '1px solid var(--ds-border)', borderRadius: 'var(--ds-radius-lg)', overflow: 'hidden' }}><Sample theme="light" design={design} /></div>
                </div>
            </div>

            {modal === 'publish' && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 100 }}>
                    <Modal title="Publicar estos valores"
                        actions={<><Button variant="ghost" onClick={() => setModal(null)} disabled={busy === 'publish'}>Cancelar</Button><Button icon={<Send />} onClick={publish} loading={busy === 'publish'}>Publicar ahora</Button></>}>
                        <p style={{ margin: '0 0 12px' }}>Se verán en todo el sitio que ya lee estas variables. Podrás volver a cualquier versión desde el historial.</p>
                        {changes.length === 0
                            ? <p style={{ margin: '0 0 12px' }}>No hay cambios respecto a lo publicado.</p>
                            : <div style={{ maxHeight: 220, overflow: 'auto', margin: '0 0 12px', fontFamily: 'var(--ds-font-mono)', fontSize: 12, display: 'grid', gap: 4 }}>
                                {changes.map(([k, a, b]) => <div key={k}>{k}: <span style={{ color: 'var(--ds-soft)' }}>{a}</span> → <strong>{b}</strong></div>)}
                            </div>}
                        <Field label="Nota (opcional)"><Input value={note} maxLength={200} onChange={e => setNote(e.target.value)} placeholder="Qué cambia y por qué" /></Field>
                    </Modal>
                </div>
            )}
            {modal === 'reset' && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 100 }}>
                    <Modal title="Restablecer a valores de fábrica"
                        actions={<><Button variant="ghost" onClick={() => setModal(null)} disabled={busy === 'reset'}>Cancelar</Button><Button variant="danger" onClick={reset} loading={busy === 'reset'}>Restablecer</Button></>}>
                        El sitio vuelve a los valores que vienen en el código y se descarta el borrador. La versión publicada queda en el historial.
                    </Modal>
                </div>
            )}
        </div>
    );
}

