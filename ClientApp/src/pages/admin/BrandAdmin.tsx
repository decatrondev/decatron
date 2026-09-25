import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, ExternalLink, Link2, Image as ImageIcon, LayoutGrid, Loader2, Minus, Moon, Plus, RefreshCw, RotateCcw, Save, Sun } from 'lucide-react';
import api from '../../services/api';
import { useBrand, resolveBrandRef } from '../../brand/BrandContext';
import { BRAND_SLOTS, SLOT_BY_KEY, defaultConfig, type SlotDef } from '../../brand/slots';
import type { BrandAsset, BrandData, BrandLayout, BrandSlotConfig, BrandTheme } from '../../brand/types';
import BrandCanvas from './brand/BrandCanvas';
import { normalizeConfig, propagate } from '../../brand/layout';
import BrandProps from './brand/BrandProps';
import { AssetPicker, BrandLibrary, label, muted } from './brand/BrandLibrary';

const card = 'rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-4 3xl:p-6 shadow-sm';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Completa una config guardada con las variantes que el lugar ganó después (y descarta las que ya no existen). */
function withAllVariants(slot: SlotDef, saved: BrandSlotConfig | undefined): BrandSlotConfig {
    const base = defaultConfig(slot);
    saved = normalizeConfig(saved);
    if (!saved) return base;
    const layouts: Record<string, BrandLayout> = {};
    for (const v of slot.variants) layouts[v.key] = saved.layouts?.[v.key] ? clone(saved.layouts[v.key]) : base.layouts[v.key];
    return { ...base, ...clone(saved), layouts };
}

/**
 * Admin → Logos de la marca (.dev/plans/BRAND_LOGOS_PLAN.md). Cada lugar donde aparece
 * Decatron se edita acá con su propia caja; guardar lo publica en vivo.
 */
export default function BrandAdmin() {
    const navigate = useNavigate();
    const brand = useBrand();
    const [data, setData] = useState<BrandData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [tab, setTab] = useState<'slots' | 'library'>('slots');
    const [slotKey, setSlotKey] = useState(BRAND_SLOTS[0].key);
    const [draft, setDraft] = useState<BrandSlotConfig>(() => defaultConfig(BRAND_SLOTS[0]));
    const [variant, setVariant] = useState<string>(BRAND_SLOTS[0].variants[0]?.key ?? '');
    const [theme, setTheme] = useState<BrandTheme>(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    const [selected, setSelected] = useState<string | null>(null);
    /** "Aplicar a todas las pantallas": los cambios se replican en proporción en las demás variantes. */
    const [linked, setLinked] = useState(false);
    const [zoom, setZoom] = useState<number | 'fit'>('fit');
    const [saving, setSaving] = useState(false);
    const [faviconPicker, setFaviconPicker] = useState(false);
    const [canvasWidth, setCanvasWidth] = useState(800);

    const slot = SLOT_BY_KEY[slotKey];
    const saved = data?.slots[slotKey];
    const baseline = useMemo(() => withAllVariants(slot, saved), [slot, saved]);
    const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const r = await api.get('/admin/brand');
            setData({ assets: r.data.assets ?? [], slots: r.data.slots ?? {} });
        } catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Error'); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    // Al cambiar de lugar (o al llegar los datos) el borrador vuelve a lo guardado.
    useEffect(() => {
        setDraft(withAllVariants(slot, data?.slots[slotKey]));
        setSelected(null);
        if (!slot.variants.some(v => v.key === variant)) setVariant(slot.variants[0]?.key ?? '');
        if (!slot.themes.includes(theme)) setTheme(slot.themes[0]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slotKey, data]);

    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(null), 3500);
        return () => clearTimeout(t);
    }, [notice]);

    const resolve = useCallback((ref: string | null | undefined) => resolveBrandRef(data, ref), [data]);

    const usage = useMemo(() => {
        const out: Record<string, string[]> = {};
        const add = (ref: string | null | undefined, name: string) => { if (!ref) return; (out[ref] ??= []).includes(name) || out[ref].push(name); };
        for (const [key, cfg] of Object.entries(data?.slots ?? {})) {
            const name = SLOT_BY_KEY[key]?.name ?? key;
            add(cfg.favicon, name);
            for (const l of Object.values(normalizeConfig(cfg)?.layouts ?? {})) for (const e of l.elements) if (e.type === 'image') { add(e.ref, name); add(e.refDark, name); }
        }
        return out;
    }, [data]);

    const chooseSlot = (key: string) => {
        if (key === slotKey) return;
        if (dirty && !confirm('Hay cambios sin guardar en este lugar. ¿Descartarlos?')) return;
        setSlotKey(key);
    };

    const layout = draft.layouts[variant];
    const setLayout = useCallback((l: BrandLayout) => setDraft(d => {
        const before = d.layouts[variant];
        const layouts = { ...d.layouts, [variant]: l };
        if (linked && before) {
            for (const v of slot.variants) if (v.key !== variant && d.layouts[v.key]) layouts[v.key] = propagate(before, l, d.layouts[v.key]);
        }
        return { ...d, layouts };
    }), [variant, linked, slot]);

    const save = async () => {
        setSaving(true); setError(null);
        try {
            await api.put(`/admin/brand/slots/${slotKey}`, draft);
            setData(d => d ? { ...d, slots: { ...d.slots, [slotKey]: clone(draft) } } : d);
            await brand.reload();
            setNotice('Guardado. Ya se ve así en el sitio.');
        } catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Error al guardar'); }
        finally { setSaving(false); }
    };

    const reset = async () => {
        if (!confirm(`¿Volver "${slot.name}" al diseño original del código? Se borra lo que configuraste acá.`)) return;
        setSaving(true); setError(null);
        try {
            await api.delete(`/admin/brand/slots/${slotKey}`);
            setData(d => { if (!d) return d; const s = { ...d.slots }; delete s[slotKey]; return { ...d, slots: s }; });
            await brand.reload();
            setNotice('Restablecido al diseño original.');
        } catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Error'); }
        finally { setSaving(false); }
    };

    const copyTo = (target: string) => {
        if (!layout) return;
        setDraft(d => {
            const layouts = { ...d.layouts };
            for (const v of slot.variants) if (v.key !== variant && (target === '*' || v.key === target)) layouts[v.key] = clone(layout);
            return { ...d, layouts };
        });
        setNotice(target === '*' ? 'Copiado a todas las pantallas (falta guardar).' : 'Copiado (falta guardar).');
    };

    const setAssets = (assets: BrandAsset[]) => { setData(d => d ? { ...d, assets } : d); brand.reload(); };
    const addAssets = (added: BrandAsset[]) => { setData(d => d ? { ...d, assets: [...d.assets, ...added] } : d); brand.reload(); };

    // Zoom "ajustar": que la caja entre en el ancho del lienzo sin pasarse de 4×.
    const fitZoom = layout ? Math.max(0.1, Math.min(4, (canvasWidth - 140) / Math.max(layout.width, 1), Math.max(320, window.innerHeight * 0.4) / Math.max(layout.height, 1))) : 1;
    const effZoom = zoom === 'fit' ? Math.round(fitZoom * 100) / 100 : zoom;
    const observer = useRef<ResizeObserver | null>(null);
    const canvasRef = useCallback((el: HTMLDivElement | null) => {
        observer.current?.disconnect();
        observer.current = null;
        if (!el) return;
        observer.current = new ResizeObserver(() => setCanvasWidth(el.clientWidth));
        observer.current.observe(el);
        setCanvasWidth(el.clientWidth);
    }, []);

    const groups = useMemo(() => {
        const g: Record<string, SlotDef[]> = {};
        for (const s of BRAND_SLOTS) (g[s.group] ??= []).push(s);
        return Object.entries(g);
    }, []);

    const faviconRef = draft.favicon ?? 'builtin:favicon';
    const faviconImg = resolve(faviconRef);

    return (
        <div className="space-y-5 3xl:space-y-6">
            <div className="panel-scale flex flex-wrap items-center gap-3">
                <button onClick={() => navigate('/admin')} className="p-2 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#262626]"><ArrowLeft className="w-5 h-5" /></button>
                <ImageIcon className="w-6 h-6 text-[#2563eb]" />
                <div>
                    <h1 className="text-2xl 3xl:text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Logos de la marca</h1>
                    <p className={muted}>Cómo se ve Decatron en cada lugar del sitio. Guardar lo publica al instante, sin build ni reinicio.</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <div className="flex rounded-lg border border-[#e2e8f0] dark:border-[#374151] overflow-hidden text-sm font-semibold">
                        <button onClick={() => setTab('slots')} className={`px-3 py-1.5 flex items-center gap-1.5 ${tab === 'slots' ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8]'}`}><LayoutGrid className="w-4 h-4" />Lugares</button>
                        <button onClick={() => setTab('library')} className={`px-3 py-1.5 flex items-center gap-1.5 ${tab === 'library' ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8]'}`}><ImageIcon className="w-4 h-4" />Biblioteca</button>
                    </div>
                    <button onClick={load} className="p-2 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#262626]" title="Recargar"><RefreshCw className="w-4 h-4" /></button>
                </div>
            </div>

            {error && <div className="rounded-lg bg-red-500/10 border border-red-500/40 text-red-500 text-sm px-4 py-2">{error}</div>}
            {notice && <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-sm px-4 py-2">{notice}</div>}

            {loading || !data ? <Loader2 className="w-6 h-6 animate-spin" /> : tab === 'library' ? (
                <div className={card + ' panel-scale'}><BrandLibrary assets={data.assets} usage={usage} onChanged={setAssets} onError={setError} /></div>
            ) : (
                <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_340px] 3xl:grid-cols-[290px_minmax(0,1fr)_420px] 4xl:grid-cols-[360px_minmax(0,1fr)_540px] 5xl:grid-cols-[460px_minmax(0,1fr)_700px]">
                    {/* Lugares */}
                    <div className={card + ' space-y-4 self-start'}><div className="panel-scale space-y-4">
                        {groups.map(([group, slots]) => (
                            <div key={group}>
                                <div className={label}>{group}</div>
                                <div className="space-y-1">
                                    {slots.map(s => {
                                        const custom = !!data.slots[s.key];
                                        const active = s.key === slotKey;
                                        return (
                                            <button key={s.key} onClick={() => chooseSlot(s.key)} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-[#2563eb]/10 text-[#2563eb] font-semibold' : 'text-[#1e293b] dark:text-[#f8fafc] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'}`}>
                                                <span className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active && dirty ? 'bg-[#f59e0b]' : custom ? 'bg-emerald-500' : 'bg-[#cbd5e1] dark:bg-[#4b5563]'}`} title={active && dirty ? 'Sin guardar' : custom ? 'Personalizado' : 'Diseño original'} />
                                                    <span className="truncate">{s.name}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        <p className={muted}><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />personalizado · <span className="inline-block w-2 h-2 rounded-full bg-[#cbd5e1] dark:bg-[#4b5563] mr-1" />original · <span className="inline-block w-2 h-2 rounded-full bg-[#f59e0b] mr-1" />sin guardar</p>
                    </div></div>

                    {/* Lienzo */}
                    <div className="space-y-4 min-w-0">
                        <div className={card + ' space-y-4'}>
                            <div className="panel-scale flex flex-wrap items-start gap-3">
                                <div className="min-w-0">
                                    <h2 className="text-lg 3xl:text-xl font-bold text-[#1e293b] dark:text-[#f8fafc]">{slot.name}</h2>
                                    <p className={muted}>{slot.description}</p>
                                    <p className={muted + ' mt-1'}>{saved ? 'Personalizado: el sitio usa lo guardado acá.' : 'Sin personalizar: el sitio usa el diseño original del código.'}</p>
                                </div>
                                <div className="ml-auto flex flex-wrap items-center gap-2">
                                    {slot.previewUrl && <a href={slot.previewUrl} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-sm font-semibold flex items-center gap-1.5 hover:border-[#2563eb] text-[#1e293b] dark:text-[#f8fafc]"><ExternalLink className="w-4 h-4" />Ver en el sitio</a>}
                                    {saved && <button onClick={reset} disabled={saving} className="px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-sm font-semibold flex items-center gap-1.5 hover:border-red-500 hover:text-red-500 text-[#1e293b] dark:text-[#f8fafc]"><RotateCcw className="w-4 h-4" />Restablecer</button>}
                                    {dirty && <button onClick={() => setDraft(baseline)} className="px-3 py-2 rounded-lg text-sm font-semibold text-[#64748b] hover:text-[#1e293b] dark:hover:text-white">Descartar</button>}
                                    <button onClick={save} disabled={saving || (!dirty && !!saved)} className="px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2">
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Guardar y publicar
                                    </button>
                                </div>
                            </div>

                            {slot.kind === 'favicon' ? (
                                <div className="panel-scale flex flex-wrap items-center gap-6">
                                    <button onClick={() => setFaviconPicker(true)} className="flex items-center gap-3 p-3 rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb]">
                                        {faviconImg && <img src={faviconImg.url} alt="" className="w-16 h-16 object-contain" />}
                                        <span className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">{faviconImg?.name ?? 'Elegir imagen'}<span className={'block font-normal ' + muted}>Cuadrada, idealmente 512 × 512</span></span>
                                    </button>
                                    <div className="space-y-2">
                                        <div className={label}>Así se ve en la pestaña</div>
                                        {(['light', 'dark'] as const).map(t => (
                                            <div key={t} className={`flex items-center gap-2 w-60 px-3 py-2 rounded-t-lg ${t === 'light' ? 'bg-[#e2e8f0] text-[#1e293b]' : 'bg-[#35363a] text-white'}`}>
                                                {faviconImg && <img src={faviconImg.url} alt="" className="w-4 h-4 object-contain" />}
                                                <span className="text-xs truncate">Decatron — Bot para Twitch…</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="space-y-2">
                                        <div className={label}>Acceso directo en el celular</div>
                                        {faviconImg && <img src={faviconImg.url} alt="" className="w-[60px] h-[60px] rounded-[14px] object-cover shadow" />}
                                    </div>
                                </div>
                            ) : layout && (
                                <>
                                    <div className="panel-scale flex flex-wrap items-center gap-2">
                                        <div className="flex flex-wrap rounded-lg border border-[#e2e8f0] dark:border-[#374151] overflow-hidden text-xs 3xl:text-sm font-semibold">
                                            {slot.variants.map(v => (
                                                <button key={v.key} onClick={() => { setVariant(v.key); setSelected(null); }} className={`px-3 py-1.5 ${variant === v.key ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'}`}>
                                                    {v.label}{v.minWidth !== undefined && <span className="opacity-70 font-normal"> ≥{v.minWidth}</span>}
                                                </button>
                                            ))}
                                        </div>
                                        {slot.themes.length > 1 && (
                                            <div className="flex rounded-lg border border-[#e2e8f0] dark:border-[#374151] overflow-hidden text-xs 3xl:text-sm font-semibold">
                                                <button onClick={() => setTheme('light')} className={`px-3 py-1.5 flex items-center gap-1 ${theme === 'light' ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8]'}`}><Sun className="w-3.5 h-3.5" />Claro</button>
                                                <button onClick={() => setTheme('dark')} className={`px-3 py-1.5 flex items-center gap-1 ${theme === 'dark' ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8]'}`}><Moon className="w-3.5 h-3.5" />Oscuro</button>
                                            </div>
                                        )}
                                        {slot.variants.length > 1 && (
                                            <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs 3xl:text-sm font-semibold cursor-pointer ${linked ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#2563eb]' : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8]'}`} title="Lo que cambies acá se aplica a todas las pantallas, en proporción a sus medidas">
                                                <input type="checkbox" checked={linked} onChange={e => setLinked(e.target.checked)} className="sr-only" />
                                                <Link2 className="w-3.5 h-3.5" />Aplicar a todas las pantallas
                                            </label>
                                        )}
                                        <div className="ml-auto flex items-center gap-1">
                                            <button onClick={() => setZoom(Math.max(0.1, Math.round((effZoom - 0.25) * 100) / 100))} className="p-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc]" title="Alejar"><Minus className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => setZoom(1)} className={`px-2 py-1 rounded-lg border text-xs font-mono ${zoom === 1 ? 'border-[#2563eb] text-[#2563eb]' : 'border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc]'}`} title="Tamaño real">{Math.round(effZoom * 100)}%</button>
                                            <button onClick={() => setZoom(Math.min(8, Math.round((effZoom + 0.25) * 100) / 100))} className="p-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc]" title="Acercar"><Plus className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => setZoom('fit')} className={`px-2 py-1 rounded-lg border text-xs font-semibold ${zoom === 'fit' ? 'border-[#2563eb] text-[#2563eb]' : 'border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc]'}`}>Ajustar</button>
                                        </div>
                                    </div>

                                    <div ref={canvasRef}>
                                        <BrandCanvas
                                            layout={layout}
                                            onChange={setLayout}
                                            theme={theme}
                                            background={slot.background[theme] ?? '#ffffff'}
                                            zoom={effZoom}
                                            selected={selected}
                                            onSelect={setSelected}
                                            resolve={resolve}
                                        />
                                    </div>
                                    {linked && <p className="panel-scale text-xs rounded-lg px-3 py-2 bg-[#2563eb]/10 text-[#2563eb]">Editando todas las pantallas a la vez: las medidas cambian en proporción a las de cada una (si acá algo crece ×1.5, en las demás también crece ×1.5 sobre su propio tamaño). Imágenes, textos, colores y elementos nuevos o quitados se copian igual. Desactívalo para ajustar una sola.</p>}
                                    <p className={muted + ' panel-scale'}>Arrastra cualquier elemento para moverlo (se pegan a los bordes y al centro; Shift para soltarlos libres). Las esquinas cambian el tamaño y el cuadrado naranja cambia la caja. Con una parte elegida, las flechas la mueven de a 1 px (Shift: 10).</p>

                                    {slot.variants.length > 1 && (
                                        <div className="panel-scale flex flex-wrap items-center gap-2 pt-1">
                                            <Copy className="w-4 h-4 text-[#64748b]" />
                                            <span className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8]">Copiar esta pantalla a:</span>
                                            <button onClick={() => copyTo('*')} className="text-xs font-semibold px-2 py-1 rounded-lg border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] text-[#1e293b] dark:text-[#f8fafc]">Todas</button>
                                            {slot.variants.filter(v => v.key !== variant).map(v => (
                                                <button key={v.key} onClick={() => copyTo(v.key)} className="text-xs px-2 py-1 rounded-lg border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] text-[#1e293b] dark:text-[#f8fafc]">{v.label}</button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Propiedades */}
                    {slot.kind === 'mark' && layout && (
                        <div className={card + ' self-start lg:col-span-2 xl:col-span-1'}><div className="panel-scale">
                            <BrandProps
                                layout={layout}
                                onChange={setLayout}
                                theme={theme}
                                bothThemes={slot.themes.length > 1}
                                selected={selected}
                                onSelect={setSelected}
                                assets={data.assets}
                                onAssetsAdded={addAssets}
                                onError={setError}
                                resolve={resolve}
                            />
                        </div></div>
                    )}
                </div>
            )}

            {faviconPicker && data && (
                <AssetPicker
                    assets={data.assets}
                    current={faviconRef}
                    onPick={ref => { setDraft(d => ({ ...d, favicon: ref })); setFaviconPicker(false); }}
                    onClose={() => setFaviconPicker(false)}
                    onUploaded={addAssets}
                    onError={setError}
                />
            )}
        </div>
    );
}
