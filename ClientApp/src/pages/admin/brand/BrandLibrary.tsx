import { useRef, useState } from 'react';
import { Check, Loader2, Pencil, Trash2, Upload, X } from 'lucide-react';
import api from '../../../services/api';
import { BUILTIN_IMAGES } from '../../../brand/builtins';
import type { BrandAsset } from '../../../brand/types';

export const muted = 'text-xs text-[#64748b] dark:text-[#94a3b8]';
export const input = 'w-full px-2.5 py-1.5 rounded-lg bg-[#f8fafc] dark:bg-[#111214] border border-[#e2e8f0] dark:border-[#374151] text-sm text-[#1e293b] dark:text-[#f8fafc]';
export const label = 'block text-[11px] font-semibold uppercase tracking-wide text-[#64748b] dark:text-[#94a3b8] mb-1';

const checker = {
    backgroundImage: 'linear-gradient(45deg,#cbd5e1 25%,transparent 25%,transparent 75%,#cbd5e1 75%),linear-gradient(45deg,#cbd5e1 25%,transparent 25%,transparent 75%,#cbd5e1 75%)',
    backgroundSize: '12px 12px', backgroundPosition: '0 0,6px 6px', backgroundColor: '#f1f5f9',
};

export interface LibraryItem {
    ref: string;
    name: string;
    url: string;
    width: number;
    height: number;
    builtin: boolean;
    assetId?: number;
}

export function libraryItems(assets: BrandAsset[]): LibraryItem[] {
    return [
        ...assets.slice().reverse().map(a => ({ ref: `asset:${a.id}`, name: a.name, url: a.url, width: a.width, height: a.height, builtin: false, assetId: a.id })),
        ...Object.entries(BUILTIN_IMAGES).map(([k, v]) => ({ ref: `builtin:${k}`, name: v.name, url: v.url, width: v.width, height: v.height, builtin: true })),
    ];
}

/** Mide la imagen en el navegador (el backend no decodifica SVG ni ICO). */
function measure(file: File): Promise<{ width: number; height: number }> {
    return new Promise(resolve => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
        img.onerror = () => { resolve({ width: 0, height: 0 }); URL.revokeObjectURL(url); };
        img.src = url;
    });
}

export async function uploadBrandFiles(files: FileList | File[]): Promise<BrandAsset[]> {
    const out: BrandAsset[] = [];
    for (const file of Array.from(files)) {
        const { width, height } = await measure(file);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('name', file.name.replace(/\.[^.]+$/, ''));
        fd.append('width', String(width));
        fd.append('height', String(height));
        // El cliente `api` manda JSON por defecto: sin pisar el header, el multipart llega mal.
        const r = await api.post('/admin/brand/assets', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        out.push(r.data.asset);
    }
    return out;
}

export function UploadButton({ onUploaded, onError, compact }: { onUploaded: (a: BrandAsset[]) => void; onError: (m: string) => void; compact?: boolean }) {
    const ref = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const go = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setBusy(true);
        try { onUploaded(await uploadBrandFiles(files)); }
        catch (e: any) { onError(e?.response?.data?.message || e?.message || 'No se pudo subir'); }
        finally { setBusy(false); if (ref.current) ref.current.value = ''; }
    };
    return (
        <>
            <input ref={ref} type="file" multiple accept=".png,.webp,.jpg,.jpeg,.gif,.svg,.ico" className="hidden" onChange={e => go(e.target.files)} />
            <button
                type="button"
                onClick={() => ref.current?.click()}
                disabled={busy}
                className={`${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} rounded-lg bg-[#2563eb] hover:bg-blue-700 disabled:opacity-60 text-white font-semibold flex items-center gap-2`}
            >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}Subir imagen
            </button>
        </>
    );
}

function Thumb({ item, size = 'h-24' }: { item: LibraryItem; size?: string }) {
    return (
        <div className={`${size} w-full rounded-lg flex items-center justify-center overflow-hidden`} style={checker}>
            <img src={item.url} alt={item.name} className="w-[80%] h-[80%] object-contain" draggable={false} />
        </div>
    );
}

/** Pestaña Biblioteca: todas las piezas de la marca, subir, renombrar y borrar. */
export function BrandLibrary({ assets, usage, onChanged, onError }: {
    assets: BrandAsset[];
    /** ref → nombres de los lugares que la usan */
    usage: Record<string, string[]>;
    onChanged: (assets: BrandAsset[]) => void;
    onError: (m: string) => void;
}) {
    const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const items = libraryItems(assets);

    const rename = async () => {
        if (!renaming) return;
        try {
            const r = await api.patch(`/admin/brand/assets/${renaming.id}`, { name: renaming.name });
            onChanged(assets.map(a => a.id === renaming.id ? r.data.asset : a));
            setRenaming(null);
        } catch (e: any) { onError(e?.response?.data?.message || e?.message || 'Error'); }
    };

    const remove = async (item: LibraryItem) => {
        const used = usage[item.ref] ?? [];
        const warn = used.length ? `\n\nLa usan: ${used.join(', ')}. Esos lugares volverán a su diseño original hasta que elijas otra imagen.` : '';
        if (!confirm(`¿Borrar "${item.name}"?${warn}`)) return;
        try {
            await api.delete(`/admin/brand/assets/${item.assetId}`);
            onChanged(assets.filter(a => a.id !== item.assetId));
        } catch (e: any) { onError(e?.response?.data?.message || e?.message || 'Error'); }
    };

    const onDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (!e.dataTransfer.files.length) return;
        try { onChanged([...assets, ...(await uploadBrandFiles(e.dataTransfer.files))]); }
        catch (err: any) { onError(err?.response?.data?.message || err?.message || 'No se pudo subir'); }
    };

    return (
        <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`rounded-2xl border-2 ${dragOver ? 'border-[#2563eb] border-dashed bg-[#2563eb]/5' : 'border-transparent'} transition-colors`}
        >
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <UploadButton onUploaded={a => onChanged([...assets, ...a])} onError={onError} />
                <span className={muted}>PNG, WebP, JPG, GIF, SVG o ICO hasta 5 MB. También puedes arrastrarlas acá. Las incorporadas son las que ya usa el sitio y no se pueden borrar.</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-8 gap-4">
                {items.map(item => (
                    <div key={item.ref} className="rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-3 flex flex-col gap-2">
                        <Thumb item={item} size="h-28 3xl:h-36" />
                        {renaming && renaming.id === item.assetId ? (
                            <div className="flex gap-1">
                                <input autoFocus className={input} value={renaming.name} onChange={e => setRenaming({ ...renaming, name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') setRenaming(null); }} />
                                <button onClick={rename} className="p-1.5 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#262626]" title="Guardar"><Check className="w-4 h-4 text-emerald-500" /></button>
                                <button onClick={() => setRenaming(null)} className="p-1.5 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#262626]" title="Cancelar"><X className="w-4 h-4" /></button>
                            </div>
                        ) : (
                            <div className="flex items-start gap-1">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc] truncate" title={item.name}>{item.name}</div>
                                    <div className={muted}>{item.width && item.height ? `${item.width} × ${item.height}` : 'Vectorial'}{item.builtin && ' · incorporada'}</div>
                                </div>
                                {!item.builtin && <>
                                    <button onClick={() => setRenaming({ id: item.assetId!, name: item.name })} className="p-1.5 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#262626]" title="Renombrar"><Pencil className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => remove(item)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500" title="Borrar"><Trash2 className="w-3.5 h-3.5" /></button>
                                </>}
                            </div>
                        )}
                        {(usage[item.ref]?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {usage[item.ref].map(n => <span key={n} className="text-[10px] px-1.5 py-0.5 rounded bg-[#2563eb]/10 text-[#2563eb]">{n}</span>)}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Ventana para elegir una pieza de la biblioteca (o subir una nueva en el momento). */
export function AssetPicker({ assets, current, onPick, onClose, onUploaded, onError }: {
    assets: BrandAsset[];
    current: string | null;
    onPick: (ref: string, item: LibraryItem) => void;
    onClose: () => void;
    onUploaded: (a: BrandAsset[]) => void;
    onError: (m: string) => void;
}) {
    const items = libraryItems(assets);
    return (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
            <div className="panel-scale w-full max-w-3xl 3xl:max-w-5xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] p-5" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">Elegir imagen</h3>
                    <div className="ml-auto flex items-center gap-2">
                        <UploadButton compact onError={onError} onUploaded={a => { onUploaded(a); if (a.length === 1) onPick(`asset:${a[0].id}`, libraryItems(a)[0]); }} />
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#262626]"><X className="w-4 h-4" /></button>
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 3xl:grid-cols-6 gap-3">
                    {items.map(item => (
                        <button
                            key={item.ref}
                            onClick={() => onPick(item.ref, item)}
                            className={`text-left rounded-xl border-2 p-2 transition-colors ${current === item.ref ? 'border-[#2563eb]' : 'border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb]/60'}`}
                        >
                            <Thumb item={item} />
                            <div className="mt-1.5 text-xs font-semibold text-[#1e293b] dark:text-[#f8fafc] truncate">{item.name}</div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
