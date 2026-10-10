import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { Alert, Badge, Button, Select } from '../../../components/ds';
import PageHeader from '../../../components/dashboard/PageHeader';
import { LoadingText } from '../../../components/dashboard/Notices';
import { ToastHost, type ToastState } from '../../../components/dashboard/toast';
import type { FilterSeverity } from './filterSwitch';

// Piezas comunes de las páginas de Moderación: marco con «Volver», secciones, estado del filtro, chips,
// números con tope y selector de severidad. Todo lee las variables del sistema de diseño.

export const labelCls = 'block text-sm font-semibold mb-2 text-ds-text';
export const hintCls = 'text-sm text-ds-soft';
export const smallHintCls = 'text-xs text-ds-soft';

/** Marco de cada página: «Volver a Moderación», cabecera, avisos emergentes y contenido con el ancho del panel. */
export function ModerationPage({ title, subtitle, actions, toast, wide, children }: {
    title: string; subtitle?: ReactNode; actions?: ReactNode; toast: ToastState | null; wide?: boolean; children: ReactNode;
}) {
    const navigate = useNavigate();
    return (
        <div className={`panel-scale ${wide ? 'max-w-7xl' : 'max-w-6xl'} mx-auto space-y-6`}>
            <ToastHost toast={toast} />
            <div>
                <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={() => navigate('/moderation')} className="mb-4">Volver a Moderación</Button>
                <PageHeader title={title} subtitle={subtitle} actions={actions} />
            </div>
            {children}
        </div>
    );
}

export const PageLoading = () => <LoadingText>Cargando…</LoadingText>;

/** Tarjeta con título (y texto de apoyo) y, opcionalmente, algo a la derecha (interruptor, botones). */
export function Section({ title, hint, right, children, className = '' }: {
    title: ReactNode; hint?: ReactNode; right?: ReactNode; children?: ReactNode; className?: string;
}) {
    return (
        <div className={`bg-ds-surface rounded-lg border border-ds-border p-6 ${className}`}>
            <div className={`flex items-start justify-between gap-4 ${children ? 'mb-4' : ''}`}>
                <div className="min-w-0">
                    <h2 className="text-xl font-black text-ds-text">{title}</h2>
                    {hint && <p className={`${hintCls} mt-1`}>{hint}</p>}
                </div>
                {right}
            </div>
            {children}
        </div>
    );
}

/** «Filtro activo / apagado» junto al interruptor (el interruptor lo pone quien llama). */
export function StatusText({ on, onLabel = 'Filtro activo', offLabel = 'Filtro apagado', hideSmall }: { on: boolean; onLabel?: string; offLabel?: string; hideSmall?: boolean }) {
    return <span className={`text-sm font-bold whitespace-nowrap ${on ? 'text-ds-ok' : 'text-ds-soft'} ${hideSmall ? 'hidden sm:inline' : ''}`}>{on ? onLabel : offLabel}</span>;
}

/** Aviso de «el filtro está apagado». */
export const OffNotice = ({ children }: { children: ReactNode }) => <Alert tone="warn">{children}</Alert>;

/** Etiqueta con X para quitar (dominios, usuarios, frases). */
export function Chip({ children, onRemove, removeLabel }: { children: ReactNode; onRemove: () => void; removeLabel: string }) {
    return (
        <span className="inline-flex items-center gap-2 px-3 py-1 bg-ds-bg border border-ds-border rounded-lg">
            <span className="text-sm font-mono text-ds-text">{children}</span>
            <button type="button" onClick={onRemove} aria-label={removeLabel} className="text-ds-soft hover:text-ds-danger transition-colors"><X className="w-3 h-3" /></button>
        </span>
    );
}

/** Número con tope mínimo y máximo y una unidad al lado. */
export function NumberField({ value, min, max, suffix, onChange }: { value: number; min: number; max: number; suffix?: string; onChange: (v: number) => void }) {
    return (
        <div className="flex items-center gap-2">
            <input
                type="number"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
                className="ds-input"
            />
            {suffix && <span className={`${hintCls} whitespace-nowrap`}>{suffix}</span>}
        </div>
    );
}

/** Selector de severidad con las tres opciones del backend; `long` usa los textos largos. */
export function SeveritySelect({ value, onChange, long }: { value: FilterSeverity; onChange: (v: FilterSeverity) => void; long?: boolean }) {
    return (
        <Select value={value} onChange={(e) => onChange(e.target.value as FilterSeverity)}>
            <option value="leve">{long ? 'Leve (escalamiento normal de strikes)' : 'Leve (escalamiento)'}</option>
            <option value="medio">{long ? 'Medio (strike + timeout de 10 min como mínimo)' : 'Medio (timeout 10 min mín.)'}</option>
            <option value="severo">{long ? 'Severo (ban directo)' : 'Severo (ban directo)'}</option>
        </Select>
    );
}

/** Etiqueta de severidad: leve neutra, medio ámbar, severo rojo (son estados). */
export function SeverityBadge({ severity }: { severity: string }) {
    return <Badge tone={severity === 'severo' ? 'danger' : severity === 'medio' ? 'warn' : undefined}>{severity.toUpperCase()}</Badge>;
}

/** Botón ancho de guardar al pie de la página. */
export function SaveBar({ saving, onClick, label, savingLabel }: { saving: boolean; onClick: () => void; label: string; savingLabel: string }) {
    return <Button size="lg" block loading={saving} disabled={saving} onClick={onClick}>{saving ? savingLabel : label}</Button>;
}

/** Resultado de «Probar un mensaje»: rojo si coincide, verde si pasa. */
export function TestResultBox({ match, children }: { match: boolean; children: ReactNode }) {
    return (
        <div className={`p-4 rounded-lg border ${match ? 'bg-ds-danger/10 border-ds-danger/40' : 'bg-ds-ok/10 border-ds-ok/40'}`}>{children}</div>
    );
}
