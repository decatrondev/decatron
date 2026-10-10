import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { dsVars, type DsTheme, type ResolvedDesign } from './tokens';
import { getActiveDesign } from '../../design/runtime';
import './ds.css';

// Librería de componentes de Decatron. Los estilos viven en ds.css y leen variables (tokens.ts).
// NINGUNA página debe escribir a mano clases de botón, campo, tarjeta, etiqueta o aviso: se usan estos componentes.
// `force` solo se usa en la guía de estilo para mostrar un estado (hover, foco…) sin interacción real.

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');
export type DsForce = 'hover' | 'focus' | 'active';
const forceCls = (f?: DsForce) => f ? `is-${f}` : undefined;

export function DsRoot({ theme, children, className, ambient = false, design }: { theme: DsTheme; children: ReactNode; className?: string; ambient?: boolean; design?: ResolvedDesign }) {
    return (
        <div className={cx('ds-root', theme === 'dark' && 'dark', className)} style={dsVars(theme, design ?? getActiveDesign())} data-ds-theme={theme}>
            {ambient && <div className="ds-ambient" aria-hidden />}
            <div style={{ position: 'relative' }}>{children}</div>
        </div>
    );
}

// ── Botón ──────────────────────────────────────────────────
export interface DsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean; block?: boolean; icon?: ReactNode; force?: DsForce;
}
export function Button({ variant = 'primary', size = 'md', loading, block, icon, force, className, children, disabled, ...rest }: DsButtonProps) {
    return (
        <button
            {...rest}
            disabled={disabled}
            aria-busy={loading || undefined}
            className={cx('ds-btn', `ds-btn--${variant}`, size !== 'md' && `ds-btn--${size}`, block && 'ds-btn--block', forceCls(force), className)}
        >
            {loading ? <span className="ds-spinner" aria-hidden /> : icon}
            {children}
        </button>
    );
}
export function IconButton({ label, icon, variant = 'ghost', size = 'md', ...rest }: Omit<DsButtonProps, 'children' | 'icon'> & { label: string; icon: ReactNode }) {
    return <Button {...rest} variant={variant} size={size} aria-label={label} title={label} className={cx('ds-icon-btn', rest.className)}>{icon}</Button>;
}

// ── Campos ─────────────────────────────────────────────────
export function Field({ label, hint, error, children }: { label?: string; hint?: ReactNode; error?: ReactNode; children: ReactNode }) {
    return (
        <label className="ds-field">
            {label && <span className="ds-label">{label}</span>}
            {children}
            {(error || hint) && <span className={cx('ds-hint', error && 'ds-hint--error')}>{error || hint}</span>}
        </label>
    );
}
export function Input({ error, force, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { error?: boolean; force?: DsForce }) {
    return <input {...rest} className={cx('ds-input', error && 'is-error', forceCls(force), className)} />;
}
export function Textarea({ error, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
    return <textarea {...rest} className={cx('ds-input', error && 'is-error', className)} />;
}
export function Select({ error, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
    return <select {...rest} className={cx('ds-input', error && 'is-error', className)}>{children}</select>;
}
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange?: (v: boolean) => void; label?: string; disabled?: boolean }) {
    return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className="ds-switch" onClick={() => onChange?.(!checked)} />;
}
export function Checkbox({ label, radio, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; radio?: boolean }) {
    return <label className={cx('ds-check', radio && 'ds-check--radio')}><input type={radio ? 'radio' : 'checkbox'} {...rest} /><span aria-hidden /><span>{label}</span></label>;
}

// ── Navegación ─────────────────────────────────────────────
export function Tabs({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
    return (
        <div role="tablist" className="ds-tabs">
            {items.map(i => <button key={i.id} role="tab" aria-selected={value === i.id} className="ds-tab" onClick={() => onChange(i.id)}>{i.label}</button>)}
        </div>
    );
}
export function Segmented({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
    return (
        <div className="ds-seg" role="group">
            {items.map(i => <button key={i.id} aria-pressed={value === i.id} onClick={() => onChange(i.id)}>{i.label}</button>)}
        </div>
    );
}

// ── Contenido ──────────────────────────────────────────────
export function Card({ variant, interactive, force, className, children }: { variant?: 'raised'; interactive?: boolean; force?: DsForce; className?: string; children: ReactNode }) {
    return <div className={cx('ds-card', variant === 'raised' && 'ds-card--raised', interactive && 'ds-card--interactive', forceCls(force), className)}>{children}</div>;
}
export function Badge({ tone, children }: { tone?: 'accent' | 'ok' | 'warn' | 'danger'; children: ReactNode }) {
    return <span className={cx('ds-badge', tone && `ds-badge--${tone}`)}>{children}</span>;
}
const ALERT_ICON = { info: Info, ok: CheckCircle2, warn: AlertTriangle, danger: XCircle } as const;
export function Alert({ tone = 'info', title, children }: { tone?: 'info' | 'ok' | 'warn' | 'danger'; title?: string; children?: ReactNode }) {
    const Icon = ALERT_ICON[tone];
    return (
        <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('ds-alert', `ds-alert--${tone}`)}>
            <Icon aria-hidden />
            <div>{title && <div className="ds-alert-title">{title}</div>}{children && <div className="ds-alert-body">{children}</div>}</div>
        </div>
    );
}
export function Progress({ value }: { value: number }) {
    return <div className="ds-progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${value}%` }} /></div>;
}
export function Spinner() { return <span className="ds-spinner" role="status" aria-label="Cargando" />; }
export function Eyebrow({ children }: { children: ReactNode }) { return <p className="ds-eyebrow">{children}</p>; }
export function Table({ head, rows, align }: { head: ReactNode[]; rows: ReactNode[][]; align?: ('left' | 'right' | 'center')[] }) {
    const a = (j: number) => align?.[j] ? { textAlign: align[j] } as const : undefined;
    return (
        <div className="ds-table-wrap">
            <table className="ds-table">
                <thead><tr>{head.map((h, j) => <th key={j} scope="col" style={a(j)}>{h}</th>)}</tr></thead>
                <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={a(j)}>{c}</td>)}</tr>)}</tbody>
            </table>
        </div>
    );
}
export function Modal({ title, children, actions, size = 'md', onClose }: { title: string; children: ReactNode; actions?: ReactNode; size?: 'md' | 'lg' | 'xl'; onClose?: () => void }) {
    return <div className={cx('ds-modal', size !== 'md' && `ds-modal--${size}`)} role="dialog" aria-modal="true" aria-label={title}>{onClose && <button type="button" className="ds-modal-close" aria-label="Cerrar" onClick={onClose}><X aria-hidden /></button>}<h3 className="ds-modal-title">{title}</h3><div className="ds-card-text">{children}</div>{actions && <div className="ds-modal-actions">{actions}</div>}</div>;
}
export function Toast({ tone = 'ok', children }: { tone?: 'ok' | 'danger' | 'info'; children: ReactNode }) {
    const Icon = tone === 'ok' ? CheckCircle2 : tone === 'danger' ? XCircle : Info;
    const color = tone === 'ok' ? 'var(--ds-ok)' : tone === 'danger' ? 'var(--ds-danger)' : 'var(--ds-accent-text)';
    return <div role="status" className="ds-toast"><Icon style={{ color }} aria-hidden />{children}</div>;
}
export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
    return <div className="ds-empty">{icon}<p className="ds-card-title">{title}</p>{children && <p className="ds-card-text">{children}</p>}{action && <div style={{ marginTop: 16 }}>{action}</div>}</div>;
}

/** Estado local para las demos de la guía. */
export function useDemo<T>(initial: T) { return useState<T>(initial); }
