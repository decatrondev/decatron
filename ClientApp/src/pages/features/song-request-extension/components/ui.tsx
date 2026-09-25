import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ColorWithAlphaField } from '../../timer-extension/components/common/ColorWithAlphaField';

// Piezas de formulario con el mismo estilo que /overlays/timer.

export const inputClass =
    'w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm 3xl:text-base focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40';
export const labelClass = 'block text-xs 3xl:text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-1 uppercase';

export function Card({ title, description, children, actions }: { title?: string; description?: string; children: ReactNode; actions?: ReactNode }) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-5 3xl:p-6 shadow-lg">
            {(title || actions) && (
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        {title && <h3 className="text-base 3xl:text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">{title}</h3>}
                        {description && <p className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8] mt-1">{description}</p>}
                    </div>
                    {actions}
                </div>
            )}
            {children}
        </div>
    );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
    return (
        <div>
            <label className={labelClass}>{label}</label>
            {children}
            {hint && <p className="text-xs 3xl:text-sm text-[#94a3b8] mt-1">{hint}</p>}
        </div>
    );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
    return (
        <label className="flex items-start gap-3 cursor-pointer select-none">
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={`mt-0.5 relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#2563eb]' : 'bg-[#cbd5e1] dark:bg-[#374151]'}`}
            >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span>
                <span className="block text-sm 3xl:text-base font-semibold text-[#1e293b] dark:text-[#f8fafc]">{label}</span>
                {hint && <span className="block text-xs 3xl:text-sm text-[#64748b] dark:text-[#94a3b8] mt-0.5">{hint}</span>}
            </span>
        </label>
    );
}

export function NumberInput({ value, onChange, min, max, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
    return (
        <input
            type="number"
            className={inputClass}
            value={Number.isFinite(value) ? value : 0}
            min={min}
            max={max}
            step={step}
            onChange={e => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n)) onChange(min !== undefined || max !== undefined ? Math.min(max ?? n, Math.max(min ?? n, n)) : n);
            }}
        />
    );
}

export function Slider({ value, onChange, min, max, step = 1, suffix = '' }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string }) {
    return (
        <div className="flex items-center gap-3">
            <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="flex-1 accent-[#2563eb]" />
            <span className="w-14 text-right font-mono text-xs 3xl:text-sm text-[#64748b] dark:text-[#94a3b8]">{value}{suffix}</span>
        </div>
    );
}

export function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
    return (
        <select className={inputClass} value={value} onChange={e => onChange(e.target.value as T)}>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    );
}

export function ColorField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
    return <ColorWithAlphaField label={label} value={value} onChange={onChange} hint={hint} />;
}

/** Botón que copia un texto y confirma. */
export function CopyButton({ text, label, doneLabel }: { text: string; label: string; doneLabel: string }) {
    const [done, setDone] = useState(false);
    const timer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(timer.current), []);
    return (
        <button
            type="button"
            onClick={async () => {
                try { await navigator.clipboard.writeText(text); } catch { /* sin permiso de portapapeles */ }
                setDone(true);
                window.clearTimeout(timer.current);
                timer.current = window.setTimeout(() => setDone(false), 1800);
            }}
            className="px-3 py-2 rounded-lg text-sm 3xl:text-base font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white transition-colors shrink-0"
        >
            {done ? doneLabel : label}
        </button>
    );
}

/** Escala un lienzo de tamaño fijo para que entre en el ancho disponible. */
export function ScaledCanvas({ width, height, children, maxScale = 1, background }: { width: number; height: number; children: ReactNode; maxScale?: number; background?: string }) {
    const host = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    useEffect(() => {
        if (!host.current) return;
        const ro = new ResizeObserver(entries => {
            const w = entries[0].contentRect.width;
            setScale(Math.min(maxScale, w / width));
        });
        ro.observe(host.current);
        return () => ro.disconnect();
    }, [width, maxScale]);
    return (
        <div ref={host} className="w-full">
            <div style={{ width: width * scale, height: height * scale, position: 'relative', overflow: 'hidden', background, margin: '0 auto' }}>
                <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', left: 0, top: 0 }}>
                    {children}
                </div>
            </div>
        </div>
    );
}

/** Fondo de tablero para ver bien un overlay con transparencias. */
export const CHECKER_BG = 'repeating-conic-gradient(#1f2937 0% 25%, #111827 0% 50%) 50% / 24px 24px';
