import { useState, type ReactNode } from 'react';
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, ArrowDown, ArrowUp, Copy, Eye, EyeOff, ImageIcon, Layers, Maximize2, Plus, Scan, Trash2, Type, X } from 'lucide-react';
import { FONT_STACKS } from '../../../brand/builtins';
import { newElement, newId } from '../../../brand/layout';
import type { BrandAsset, BrandElement, BrandFont, BrandLayout, BrandTheme, ResolvedImage } from '../../../brand/types';
import { AssetPicker, input, label, muted } from './BrandLibrary';
import { elementLabel } from './BrandCanvas';

interface Props {
    layout: BrandLayout;
    onChange: (l: BrandLayout) => void;
    theme: BrandTheme;
    /** El lugar tiene claro y oscuro (si no, solo se edita una imagen/un color). */
    bothThemes: boolean;
    selected: string | null;
    onSelect: (id: string | null) => void;
    assets: BrandAsset[];
    onAssetsAdded: (a: BrandAsset[]) => void;
    onError: (m: string) => void;
    resolve: (ref: string | null | undefined) => ResolvedImage | null;
}

const FONTS: { key: BrandFont; label: string }[] = [
    { key: 'display', label: 'Chakra Petch (títulos)' },
    { key: 'sans', label: 'Inter / sistema' },
    { key: 'mono', label: 'JetBrains Mono' },
];

const WEIGHTS = [400, 500, 600, 700, 800, 900];
const txt = 'text-[#1e293b] dark:text-[#f8fafc]';
const outlineBtn = `text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] flex items-center gap-1 ${txt}`;
const iconBtn = `p-1.5 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#262626] disabled:opacity-30 ${txt}`;

function Num({ l, value, onChange, min = -9999, step = 1 }: { l: string; value: number; onChange: (n: number) => void; min?: number; step?: number }) {
    return (
        <label className="block">
            <span className={label}>{l}</span>
            <input type="number" step={step} min={min} className={input} value={Number.isFinite(value) ? value : 0}
                onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(Math.max(min, n)); }} />
        </label>
    );
}

function Section({ title, icon, right, children }: { title: string; icon: ReactNode; right?: ReactNode; children: ReactNode }) {
    return (
        <div className="rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-3 3xl:p-4 space-y-3">
            <div className="flex items-center gap-2">
                {icon}
                <span className={`text-sm font-bold ${txt}`}>{title}</span>
                {right && <div className="ml-auto flex items-center gap-1">{right}</div>}
            </div>
            {children}
        </div>
    );
}

function VisibleToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
    return (
        <button type="button" onClick={e => { e.stopPropagation(); onToggle(); }} className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${visible ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-[#94a3b8]/15 text-[#64748b]'}`} title={visible ? 'Ocultar' : 'Mostrar'}>
            {visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
    );
}

function AlignRow({ onAlign }: { onAlign: (axis: 'x' | 'y', where: 'start' | 'center' | 'end') => void }) {
    const b = `p-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#374151] ${txt} hover:border-[#2563eb] hover:text-[#2563eb]`;
    return (
        <div>
            <span className={label}>Alinear en la caja</span>
            <div className="flex gap-1">
                <button type="button" className={b} title="Izquierda" onClick={() => onAlign('x', 'start')}><AlignStartVertical className="w-4 h-4" /></button>
                <button type="button" className={b} title="Centro horizontal" onClick={() => onAlign('x', 'center')}><AlignCenterVertical className="w-4 h-4" /></button>
                <button type="button" className={b} title="Derecha" onClick={() => onAlign('x', 'end')}><AlignEndVertical className="w-4 h-4" /></button>
                <span className="w-2" />
                <button type="button" className={b} title="Arriba" onClick={() => onAlign('y', 'start')}><AlignStartHorizontal className="w-4 h-4" /></button>
                <button type="button" className={b} title="Centro vertical" onClick={() => onAlign('y', 'center')}><AlignCenterHorizontal className="w-4 h-4" /></button>
                <button type="button" className={b} title="Abajo" onClick={() => onAlign('y', 'end')}><AlignEndHorizontal className="w-4 h-4" /></button>
            </div>
        </div>
    );
}

function ColorField({ l, value, onChange }: { l: string; value: string; onChange: (v: string) => void }) {
    return (
        <label className="block">
            <span className={label}>{l}</span>
            <div className="flex gap-2">
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#2563eb'} onChange={e => onChange(e.target.value)} className="w-10 h-9 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-transparent cursor-pointer" />
                <input className={input} value={value} onChange={e => onChange(e.target.value)} />
            </div>
        </label>
    );
}

/** Mide el texto con la misma fuente para que el cuadro quede justo. */
function measureText(t: BrandElement): { w: number; h: number } {
    const c = document.createElement('canvas').getContext('2d');
    if (!c) return { w: t.w, h: t.h };
    c.font = `${t.italic ? 'italic ' : ''}${t.weight} ${t.size}px ${FONT_STACKS[t.font]}`;
    const s = t.uppercase ? t.text.toUpperCase() : t.text;
    const w = c.measureText(s).width + Math.max(0, s.length - 1) * t.letterSpacing;
    return { w: Math.ceil(w) + 2, h: Math.ceil(t.size * 1.25) };
}

export default function BrandProps({ layout, onChange, theme, bothThemes, selected, onSelect, assets, onAssetsAdded, onError, resolve }: Props) {
    const [picker, setPicker] = useState<'light' | 'dark' | null>(null);
    const els = layout.elements;
    const index = els.findIndex(e => e.id === selected);
    const el = index >= 0 ? els[index] : null;

    const setEl = (id: string, p: Partial<BrandElement>) => onChange({ ...layout, elements: els.map(e => e.id === id ? { ...e, ...p } : e) });

    const add = (type: BrandElement['type']) => {
        // Nace centrado en la caja, a una altura que tenga sentido para ella.
        const h = Math.max(8, Math.round(layout.height * (type === 'text' ? 0.6 : 0.8)));
        const w = type === 'text' ? Math.round(h * 4) : h;
        const next = newElement(type, {
            x: Math.round((layout.width - w) / 2), y: Math.round((layout.height - h) / 2), w, h,
            size: Math.max(8, Math.round(h * 0.8)),
            ref: type === 'image' ? 'builtin:mascot' : null,
        });
        onChange({ ...layout, elements: [...els, next] });
        onSelect(next.id);
    };

    const remove = (id: string) => {
        onChange({ ...layout, elements: els.filter(e => e.id !== id) });
        if (selected === id) onSelect(null);
    };

    const duplicate = (e: BrandElement) => {
        const copy = { ...e, id: newId(), x: e.x + 8, y: e.y + 8 };
        const i = els.findIndex(x => x.id === e.id);
        onChange({ ...layout, elements: [...els.slice(0, i + 1), copy, ...els.slice(i + 1)] });
        onSelect(copy.id);
    };

    /** dir = 1 sube una capa (queda más encima). */
    const move = (id: string, dir: 1 | -1) => {
        const i = els.findIndex(e => e.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= els.length) return;
        const next = els.slice();
        [next[i], next[j]] = [next[j], next[i]];
        onChange({ ...layout, elements: next });
    };

    const align = (id: string) => (axis: 'x' | 'y', where: 'start' | 'center' | 'end') => {
        const p = els.find(e => e.id === id)!;
        const total = axis === 'x' ? layout.width : layout.height;
        const size = axis === 'x' ? p.w : p.h;
        setEl(id, { [axis]: where === 'start' ? 0 : where === 'center' ? Math.round((total - size) / 2) : total - size });
    };

    /** Encoge la caja al borde de lo visible y mueve los elementos a la esquina. */
    const fitBox = () => {
        const vis = els.filter(e => e.visible);
        if (!vis.length) return;
        const minX = Math.min(...vis.map(e => e.x));
        const minY = Math.min(...vis.map(e => e.y));
        const maxX = Math.max(...vis.map(e => e.x + e.w));
        const maxY = Math.max(...vis.map(e => e.y + e.h));
        onChange({ ...layout, width: maxX - minX, height: maxY - minY, elements: els.map(e => ({ ...e, x: e.x - minX, y: e.y - minY })) });
    };

    const onPick = (ref: string, item: { width: number; height: number }) => {
        if (!el) return;
        if (picker === 'dark') setEl(el.id, { refDark: ref });
        else {
            // Imagen nueva: se ajusta a la altura actual respetando su proporción.
            const p: Partial<BrandElement> = { ref };
            if (el.keepAspect && item.width > 0 && item.height > 0) p.w = Math.max(1, Math.round(el.h * item.width / item.height));
            setEl(el.id, p);
        }
        setPicker(null);
    };

    /** Texto ↔ imagen conservando posición y tamaño. */
    const setType = (type: BrandElement['type']) => {
        if (!el || el.type === type) return;
        const p: Partial<BrandElement> = { type };
        if (type === 'image') {
            p.ref = el.ref ?? 'builtin:mascot';
            // El cuadro de un texto suele ser ancho: se lleva a la proporción de la imagen.
            const img = resolve(p.ref);
            if (el.keepAspect && img && img.width > 0 && img.height > 0) p.w = Math.max(1, Math.round(el.h * img.width / img.height));
        }
        if (type === 'text' && !el.text) p.text = 'Decatron';
        setEl(el.id, p);
    };

    const light = el ? resolve(el.ref) : null;
    const dark = el?.refDark ? resolve(el.refDark) : null;

    return (
        <div className="space-y-3">
            <Section title="Caja" icon={<Scan className="w-4 h-4 text-[#f59e0b]" />} right={<VisibleToggle visible={layout.visible} onToggle={() => onChange({ ...layout, visible: !layout.visible })} />}>
                {!layout.visible && <p className={muted}>En este tamaño de pantalla no se muestra nada.</p>}
                <div className="grid grid-cols-2 gap-2">
                    <Num l="Ancho (px)" value={layout.width} min={1} onChange={v => onChange({ ...layout, width: v })} />
                    <Num l="Alto (px)" value={layout.height} min={1} onChange={v => onChange({ ...layout, height: v })} />
                </div>
                <button type="button" onClick={fitBox} className={outlineBtn}><Maximize2 className="w-3.5 h-3.5" />Ajustar al contenido</button>
            </Section>

            <Section title="Elementos" icon={<Layers className="w-4 h-4 text-[#2563eb]" />}
                right={<>
                    <button type="button" onClick={() => add('image')} className={outlineBtn} title="Agregar imagen"><Plus className="w-3.5 h-3.5" /><ImageIcon className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => add('text')} className={outlineBtn} title="Agregar texto"><Plus className="w-3.5 h-3.5" /><Type className="w-3.5 h-3.5" /></button>
                </>}
            >
                {els.length === 0 && <p className={muted}>La caja está vacía. Agrega una imagen o un texto.</p>}
                <div className="space-y-1">
                    {/* De arriba hacia abajo = de la capa de encima a la de abajo */}
                    {els.map((e, i) => ({ e, i })).reverse().map(({ e, i }) => {
                        const img = e.type === 'image' ? resolve(e.ref) : null;
                        return (
                            <div key={e.id} onClick={() => onSelect(e.id)} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer border ${selected === e.id ? 'border-[#2563eb] bg-[#2563eb]/5' : 'border-transparent hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'}`}>
                                {img ? <img src={img.url} alt="" className="w-6 h-6 object-contain flex-shrink-0" /> : e.type === 'image' ? <ImageIcon className="w-5 h-5 text-[#94a3b8] flex-shrink-0" /> : <Type className="w-5 h-5 text-[#2563eb] flex-shrink-0" />}
                                <span className={`text-xs flex-1 min-w-0 truncate ${e.visible ? txt : 'text-[#94a3b8] line-through'}`}>{elementLabel(e, i)}</span>
                                <button type="button" className={iconBtn} disabled={i === els.length - 1} onClick={ev => { ev.stopPropagation(); move(e.id, 1); }} title="Subir (más encima)"><ArrowUp className="w-3.5 h-3.5" /></button>
                                <button type="button" className={iconBtn} disabled={i === 0} onClick={ev => { ev.stopPropagation(); move(e.id, -1); }} title="Bajar (más abajo)"><ArrowDown className="w-3.5 h-3.5" /></button>
                                <VisibleToggle visible={e.visible} onToggle={() => setEl(e.id, { visible: !e.visible })} />
                                <button type="button" className={iconBtn} onClick={ev => { ev.stopPropagation(); duplicate(e); }} title="Duplicar"><Copy className="w-3.5 h-3.5" /></button>
                                <button type="button" className={`${iconBtn} !text-red-500`} onClick={ev => { ev.stopPropagation(); remove(e.id); }} title="Quitar"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        );
                    })}
                </div>
            </Section>

            {el && (
                <Section title={elementLabel(el, index)} icon={el.type === 'image' ? <ImageIcon className="w-4 h-4 text-[#2563eb]" /> : <Type className="w-4 h-4 text-[#2563eb]" />}>
                    <div className="flex rounded-lg border border-[#e2e8f0] dark:border-[#374151] overflow-hidden text-xs font-semibold w-fit">
                        <button type="button" onClick={() => setType('image')} className={`px-3 py-1.5 flex items-center gap-1 ${el.type === 'image' ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8]'}`}><ImageIcon className="w-3.5 h-3.5" />Imagen</button>
                        <button type="button" onClick={() => setType('text')} className={`px-3 py-1.5 flex items-center gap-1 ${el.type === 'text' ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8]'}`}><Type className="w-3.5 h-3.5" />Texto</button>
                    </div>

                    {el.type === 'image' ? (
                        <>
                            <button type="button" onClick={() => setPicker('light')} className="w-full flex items-center gap-2 p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] text-left">
                                {light ? <img src={light.url} alt="" className="w-10 h-10 object-contain" /> : <ImageIcon className="w-10 h-10 text-[#94a3b8]" />}
                                <span className={`text-xs truncate ${txt}`}>{light?.name ?? 'Elegir imagen…'}{bothThemes && <span className={'block ' + muted}>Tema claro{!el.refDark && ' y oscuro'}</span>}</span>
                            </button>
                            {bothThemes && (
                                <div className="flex gap-2 items-center">
                                    <button type="button" onClick={() => setPicker('dark')} className={`flex-1 min-w-0 flex items-center gap-2 p-2 rounded-lg border hover:border-[#2563eb] text-left ${theme === 'dark' ? 'border-[#2563eb]/50' : 'border-[#e2e8f0] dark:border-[#374151]'}`}>
                                        {dark ? <img src={dark.url} alt="" className="w-10 h-10 object-contain rounded bg-[#1B1C1D]" /> : <ImageIcon className="w-10 h-10 text-[#94a3b8]" />}
                                        <span className={`text-xs truncate ${txt}`}>{dark?.name ?? 'Otra imagen para oscuro…'}<span className={'block ' + muted}>Opcional</span></span>
                                    </button>
                                    {el.refDark && <button type="button" onClick={() => setEl(el.id, { refDark: null })} className={iconBtn} title="Usar la misma en oscuro"><X className="w-4 h-4" /></button>}
                                </div>
                            )}
                            <div className="flex flex-wrap gap-3 items-center">
                                <label className={`text-xs flex items-center gap-1.5 cursor-pointer ${txt}`}>
                                    <input type="checkbox" checked={el.keepAspect} onChange={e => setEl(el.id, { keepAspect: e.target.checked })} />Mantener proporción
                                </label>
                                {light && light.width > 0 && (
                                    <button type="button" onClick={() => setEl(el.id, { w: Math.max(1, Math.round(el.h * light.width / light.height)) })} className="text-xs font-semibold text-[#2563eb] hover:underline">Corregir proporción</button>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <label className="block"><span className={label}>Texto</span><input className={input} value={el.text} onChange={e => setEl(el.id, { text: e.target.value })} /></label>
                            <div className="grid grid-cols-2 gap-2">
                                <label className="block col-span-2"><span className={label}>Fuente</span>
                                    <select className={input} value={el.font} onChange={e => setEl(el.id, { font: e.target.value as BrandFont })}>
                                        {FONTS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                                    </select>
                                </label>
                                <label className="block"><span className={label}>Grosor</span>
                                    <select className={input} value={el.weight} onChange={e => setEl(el.id, { weight: Number(e.target.value) })}>
                                        {WEIGHTS.map(w => <option key={w} value={w}>{w}</option>)}
                                    </select>
                                </label>
                                <Num l="Tamaño (px)" value={el.size} min={6} onChange={v => setEl(el.id, { size: v })} />
                                <Num l="Espaciado" value={el.letterSpacing} step={0.5} onChange={v => setEl(el.id, { letterSpacing: v })} />
                                <label className="block"><span className={label}>Alineación</span>
                                    <select className={input} value={el.align} onChange={e => setEl(el.id, { align: e.target.value as BrandElement['align'] })}>
                                        <option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option>
                                    </select>
                                </label>
                            </div>
                            <div className={`grid ${bothThemes ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                                {bothThemes && <ColorField l="Color (claro)" value={el.color} onChange={v => setEl(el.id, { color: v })} />}
                                <ColorField l={bothThemes ? 'Color (oscuro)' : 'Color'} value={el.colorDark} onChange={v => setEl(el.id, bothThemes ? { colorDark: v } : { colorDark: v, color: v })} />
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <label className={`text-xs flex items-center gap-1.5 cursor-pointer ${txt}`}><input type="checkbox" checked={el.italic} onChange={e => setEl(el.id, { italic: e.target.checked })} />Cursiva</label>
                                <label className={`text-xs flex items-center gap-1.5 cursor-pointer ${txt}`}><input type="checkbox" checked={el.uppercase} onChange={e => setEl(el.id, { uppercase: e.target.checked })} />Mayúsculas</label>
                                <button type="button" onClick={() => setEl(el.id, measureText(el))} className="text-xs font-semibold text-[#2563eb] hover:underline">Ajustar cuadro al texto</button>
                            </div>
                        </>
                    )}

                    <div className="grid grid-cols-4 gap-2">
                        <Num l="X" value={el.x} onChange={v => setEl(el.id, { x: v })} />
                        <Num l="Y" value={el.y} onChange={v => setEl(el.id, { y: v })} />
                        <Num l="Ancho" value={el.w} min={1} onChange={v => setEl(el.id, el.type === 'image' && el.keepAspect && el.w > 0 ? { w: v, h: Math.max(1, Math.round(v * el.h / el.w)) } : { w: v })} />
                        <Num l="Alto" value={el.h} min={1} onChange={v => setEl(el.id, el.type === 'image' && el.keepAspect && el.h > 0 ? { h: v, w: Math.max(1, Math.round(v * el.w / el.h)) } : { h: v })} />
                    </div>
                    <AlignRow onAlign={align(el.id)} />
                </Section>
            )}
            {!el && els.length > 0 && <p className={muted}>Elige un elemento en el lienzo o en la lista para editarlo.</p>}

            {picker && el && (
                <AssetPicker
                    assets={assets}
                    current={picker === 'dark' ? el.refDark : el.ref}
                    onPick={onPick}
                    onClose={() => setPicker(null)}
                    onUploaded={onAssetsAdded}
                    onError={onError}
                />
            )}
        </div>
    );
}
