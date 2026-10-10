import { Lock, CheckCircle } from 'lucide-react';
import type { AccountTier } from './types';

export function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-center gap-4 px-5 4xl:px-7 py-3 4xl:py-4">
            <span className="text-sm 4xl:text-base text-ds-soft">{label}</span>
            <span className="text-sm 4xl:text-base text-ds-text font-mono text-right break-all">{value}</span>
        </div>
    );
}

/** Grupo de ajustes: titulo, explicacion y filas separadas por lineas finas. */
export function SettingsGroup({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section>
            <div className="flex items-end justify-between gap-4 mb-3 px-1">
                <div className="min-w-0">
                    <h2 className="text-lg md:text-xl 4xl:text-2xl font-extrabold text-ds-text">{title}</h2>
                    {description && <p className="text-sm 4xl:text-base text-ds-soft mt-0.5 max-w-3xl">{description}</p>}
                </div>
                {action}
            </div>
            <div className="bg-ds-surface rounded-lg border border-ds-border divide-y divide-ds-border overflow-hidden">
                {children}
            </div>
        </section>
    );
}

/** Una fila: que es y que hace a la izquierda, el control a la derecha. */
export function SettingsRow({ icon, title, description, children }: { icon?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 4xl:px-7 py-4 4xl:py-5">
            <div className="flex items-center gap-3 4xl:gap-4 min-w-0">
                {icon && <div className="flex-shrink-0">{icon}</div>}
                <div className="min-w-0">
                    <div className="font-bold text-base 4xl:text-lg text-ds-text truncate">{title}</div>
                    {description && <div className="text-sm 4xl:text-base text-ds-soft">{description}</div>}
                </div>
            </div>
            {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
        </div>
    );
}

export function ReadOnlyNotice({ text }: { text: string }) {
    return (
        <div className="px-5 4xl:px-7 py-3 bg-ds-raised text-sm 4xl:text-base text-ds-accent-text flex items-center gap-2">
            <Lock className="w-4 h-4 flex-shrink-0" /> {text}
        </div>
    );
}

export function Linked({ children }: { children: React.ReactNode }) {
    return (
        <span className="text-ds-ok inline-flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> {children}
        </span>
    );
}

/** Icono de plataforma para las filas (color de la marca). */
export function PlatformIcon({ color, children }: { color: string; children: React.ReactNode }) {
    return (
        <div className="w-10 h-10 4xl:w-12 4xl:h-12 rounded-lg flex items-center justify-center bg-ds-bg border border-ds-border" style={{ color }}>
            {children}
        </div>
    );
}

/** Ficha de la cabecera: encendida si la plataforma esta vinculada, gris si no. */
export function PlatformTile({
    name,
    color,
    on,
    statusText,
    onClick,
    children,
}: {
    name: string;
    color: string;
    on: boolean;
    statusText: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            title={`${name}: ${statusText}`}
            aria-label={`${name}: ${statusText}`}
            className={`relative w-11 h-11 4xl:w-14 4xl:h-14 rounded-lg flex items-center justify-center bg-ds-bg transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-accent ${
                on ? 'border border-ds-border' : 'border border-dashed border-ds-border text-ds-soft'
            }`}
            style={on ? { color } : undefined}
        >
            {children}
            {on && (
                <span className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full bg-ds-ok border-2 border-ds-surface flex items-center justify-center">
                    <CheckCircle className="w-2.5 h-2.5 text-white" />
                </span>
            )}
        </button>
    );
}

const TIER_NEUTRAL = 'bg-ds-bg text-ds-soft border border-ds-border';
const TIER_BRAND = 'bg-ds-accent text-white';
const TIER_CONFIG: Record<string, { label: string; color: string; description: string }> = {
    free:      { label: 'Free',      color: TIER_NEUTRAL, description: 'Plan gratuito' },
    supporter: { label: '⚡ Supporter', color: TIER_BRAND, description: 'Gracias por apoyar el proyecto' },
    premium:   { label: '💎 Premium',  color: TIER_BRAND, description: 'Acceso completo a todas las funciones' },
    fundador:  { label: '🌟 Fundador', color: TIER_BRAND, description: 'Apoyo fundador — gracias por estar desde el principio' },
    admin:     { label: 'Admin',     color: TIER_BRAND, description: 'Acceso total de administrador' },
};

export function TierBadge({ tier }: { tier: AccountTier }) {
    // Un tier desconocido se muestra tal cual, nunca como 'free'. Caer a gratuito hacía que
    // una compra real pareciera no haber pasado: el tier estaba activo y la pantalla decía
    // que no. Es mejor un badge con un nombre raro que un badge que miente.
    const config = TIER_CONFIG[tier.tier] ?? {
        label: tier.tier,
        color: TIER_NEUTRAL,
        description: 'Plan activo',
    };
    const startDate = tier.tierStartedAt ? new Date(tier.tierStartedAt).toLocaleDateString('es-ES') : null;
    const expiresDate = tier.tierExpiresAt ? new Date(tier.tierExpiresAt).toLocaleDateString('es-ES') : null;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <span className={`px-4 py-2 ${config.color} font-bold rounded-lg text-sm`}>
                    {config.label}
                </span>
                <span className="text-sm text-ds-soft">{config.description}</span>
            </div>
            {startDate && (
                <div className="text-xs text-ds-soft">
                    Activo desde: {startDate}
                    {expiresDate && <span className="ml-3">· Expira: {expiresDate}</span>}
                </div>
            )}
        </div>
    );
}

/** Plan en chico para la cabecera. */
export function TierPill({ tier }: { tier: AccountTier }) {
    const config = TIER_CONFIG[tier.tier] ?? { label: tier.tier, color: TIER_NEUTRAL, description: '' };
    return <span className={`px-2.5 py-0.5 ${config.color} font-bold rounded-md text-xs 4xl:text-sm`}>{config.label}</span>;
}
// Botones de acción de las filas de plataforma (vincular / desvincular).
export const linkButton = 'ds-btn ds-btn--secondary';
export const unlinkButton = 'ds-btn ds-btn--danger';
