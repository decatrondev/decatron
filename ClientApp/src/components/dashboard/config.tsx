import type { ReactNode } from 'react';
import { AlertCircle, ChevronLeft, Save } from 'lucide-react';
import { Alert, Button, Field, Switch, Textarea } from '../ds';

// Piezas de las pantallas de configuración de un comando (Watchtime, Ruleta…): cabecera con guardar, tarjetas de
// ajustes, filas con interruptor, deslizadores, campos de mensaje con vista previa. Todo lee las variables del diseño.

export const labelCls = 'text-xs font-semibold text-ds-soft uppercase tracking-wide';
export const hintCls = 'text-xs text-ds-faint';

/** Cabecera: volver, icono, título, subtítulo y las acciones de la derecha. */
export function ConfigHeader({ onBack, icon, title, subtitle, actions }: { onBack: () => void; icon: ReactNode; title: string; subtitle: ReactNode; actions?: ReactNode }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
                <Button variant="ghost" size="sm" aria-label="Volver" onClick={onBack} icon={<ChevronLeft />} />
                <div className="p-2 bg-ds-raised border border-ds-border rounded-lg text-ds-accent-text [&>svg]:w-6 [&>svg]:h-6">{icon}</div>
                <div className="min-w-0">
                    <h1 className="text-2xl font-black text-ds-text">{title}</h1>
                    <p className="text-sm text-ds-soft">{subtitle}</p>
                </div>
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
    );
}

/** «Activo / Inactivo» con interruptor, para la cabecera. */
export function EnabledSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="flex items-center gap-3 px-4 py-2 bg-ds-surface rounded-lg border border-ds-border">
            <span className="text-sm font-semibold text-ds-soft">{enabled ? 'Activo' : 'Inactivo'}</span>
            <Switch checked={enabled} onChange={onChange} label={enabled ? 'Activo' : 'Inactivo'} />
        </div>
    );
}

export function SaveButton({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
    return <Button icon={<Save />} onClick={onClick} loading={saving} disabled={saving}>{saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar'}</Button>;
}

export function ConfigError({ children }: { children: ReactNode }) {
    return <Alert tone="danger">{children}</Alert>;
}

/** Tarjeta de ajustes con título e icono. */
export function ConfigCard({ icon, title, hint, className = '', children }: { icon: ReactNode; title: string; hint?: ReactNode; className?: string; children: ReactNode }) {
    return (
        <div className={`bg-ds-surface rounded-lg p-6 border border-ds-border ${className}`}>
            <div className={`flex items-center gap-2 ${hint ? 'mb-1' : 'mb-4'}`}>
                <span className="text-ds-accent-text [&>svg]:w-5 [&>svg]:h-5">{icon}</span>
                <h2 className="font-black text-ds-text">{title}</h2>
            </div>
            {hint && <p className={`${hintCls} mb-4`}>{hint}</p>}
            {children}
        </div>
    );
}

export const ConfigDivider = () => <div className="border-t border-ds-border" />;

/** Fila «título + descripción … interruptor». */
export function ToggleRow({ title, description, checked, onChange }: { title: ReactNode; description?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div>
                <p className="text-sm font-semibold text-ds-text">{title}</p>
                {description && <p className={hintCls}>{description}</p>}
            </div>
            <Switch checked={checked} onChange={onChange} label={typeof title === 'string' ? title : undefined} />
        </div>
    );
}

/** Deslizador con su valor a la derecha del título. */
export function SliderField({ label, display, value, min, max, onChange, hint }: {
    label: string; display: ReactNode; value: number; min: number; max: number; onChange: (v: number) => void; hint?: ReactNode;
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <label className={labelCls}>{label}</label>
                <span className="text-sm font-bold text-ds-accent-text">{display}</span>
            </div>
            <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} className="ds-range"
                style={{ '--ds-range-pct': `${max > min ? ((value - min) / (max - min)) * 100 : 0}%` } as React.CSSProperties} />
            {hint && <p className={`${hintCls} mt-1`}>{hint}</p>}
        </div>
    );
}

/** Opción elegible de una lista (nivel de permiso, formato…). */
export function ChoiceButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            onClick={onClick}
            aria-pressed={selected}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
                selected ? 'bg-ds-accent/10 border-ds-accent' : 'bg-ds-bg border-ds-border hover:border-ds-accent'
            }`}
        >
            {children}
        </button>
    );
}

export function VariableChips({ vars }: { vars: string[] }) {
    return (
        <div className="flex flex-wrap gap-1 mb-4">
            {vars.map(v => <code key={v} className="px-2 py-0.5 bg-ds-bg border border-ds-border rounded text-xs text-ds-accent-text font-mono">{v}</code>)}
        </div>
    );
}

export function PreviewBox({ label = 'Vista previa:', children }: { label?: string; children: ReactNode }) {
    return (
        <div className="mt-2 p-2 bg-ds-bg rounded-lg border border-ds-border">
            <p className="text-xs text-ds-soft font-semibold mb-1">{label}</p>
            <p className="text-xs text-ds-text">{children}</p>
        </div>
    );
}

/** Texto monoespaciado de varias líneas (mensajes del bot). */
export function MessageTextarea(props: React.ComponentProps<typeof Textarea>) {
    return <Textarea rows={3} {...props} className={`font-mono resize-none ${props.className ?? ''}`} />;
}

/** Mensaje del bot con título, interruptor opcional, vista previa opcional y nota. */
export function MessageField({ label, value, onChange, disabled, toggle, preview, note, className }: {
    label: string; value: string; onChange: (v: string) => void; disabled?: boolean;
    toggle?: { checked: boolean; onChange: (v: boolean) => void };
    preview?: ReactNode; note?: ReactNode; className?: string;
}) {
    return (
        <div className={className}>
            <div className="flex items-center justify-between mb-1">
                <label className={labelCls}>{label}</label>
                {toggle && <Switch checked={toggle.checked} onChange={toggle.onChange} label={label} />}
            </div>
            <Field><MessageTextarea value={value} onChange={e => onChange(e.target.value)} disabled={disabled} /></Field>
            {preview && <PreviewBox>{preview}</PreviewBox>}
            {note && <div className="mt-2 flex items-start gap-1.5"><AlertCircle className="w-3 h-3 text-ds-faint mt-0.5 shrink-0" /><p className={hintCls}>{note}</p></div>}
        </div>
    );
}
