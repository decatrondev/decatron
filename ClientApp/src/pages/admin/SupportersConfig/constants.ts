import type { PageConfig, TierConfig, DurationUnit, TierId, TierDuration, DiscountCode, TabType } from './types';

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: PageConfig = {
    enabled: true,
    title: 'Apoya a Decatron',
    tagline: 'Ayuda a mantener el bot gratuito para todos',
    description: 'Decatron es completamente gratuito. Si quieres apoyar el desarrollo y los costos del servidor, puedes hacerlo desde aquí. Como agradecimiento, recibes beneficios exclusivos en el bot.',
    monthlyGoal: 50,
    monthlyRaised: 0,
    showProgressBar: true,
    showSupportersWall: true,
    showFoundersSection: true,
    heroFrom: '#2563eb',
    heroTo: '#7c3aed',
};

export const DEFAULT_TIERS: TierConfig[] = [
    {
        id: 'supporter',
        name: 'Supporter',
        badgeEmoji: '⚡',
        color: '#3b82f6',
        monthlyPrice: 5,
        permanentPrice: null,
        benefits: [
            '50 comandos personalizados',
            '10 variantes por alerta',
            '2 overlays por tipo',
            'AI Commands',
            'Analytics 90 días',
            'Timer history 90 días',
            'Badge ⚡ en la página pública',
        ],
        highlighted: false,
    },
    {
        id: 'premium',
        name: 'Premium',
        badgeEmoji: '💎',
        color: '#8b5cf6',
        monthlyPrice: 15,
        permanentPrice: null,
        benefits: [
            '100 comandos personalizados',
            '15 variantes por alerta',
            '4 overlays por tipo',
            'AI Commands',
            'Analytics 365 días + exportar CSV',
            'Timer history 365 días + backups',
            'Badge 💎 en la página pública',
        ],
        highlighted: true,
    },
    {
        id: 'fundador',
        name: 'Fundador',
        badgeEmoji: '🌟',
        color: '#f59e0b',
        monthlyPrice: 25,
        permanentPrice: 100,
        benefits: [
            'Comandos, variantes y overlays ilimitados',
            'Analytics y timer history ilimitados',
            'Sugerencias con prioridad en el roadmap',
            'Sección especial de Fundadores',
            'Badge 🌟 FUNDADOR exclusivo',
        ],
        highlighted: false,
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const TIER_LABELS: Record<string, string> = {
    supporter: '⚡ Supporter',
    premium: '💎 Premium',
    fundador: '🌟 Fundador',
    free: 'Free',
};

export function fmtDate(str: string) {
    return new Date(str).toLocaleDateString('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}

// ─── Style constants ──────────────────────────────────────────────────────────

export const CARD = 'bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg';
export const INPUT = 'w-full px-4 py-2.5 border border-[#e2e8f0] dark:border-[#374151] rounded-xl bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-sm';
export const LABEL = 'text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]';

// ─── Duration constants ──────────────────────────────────────────────────────

export const DURATION_UNITS: { value: DurationUnit; label: string }[] = [
    { value: 'minutes', label: 'Minutos' },
    { value: 'hours', label: 'Horas' },
    { value: 'days', label: 'Días' },
    { value: 'weeks', label: 'Semanas' },
    { value: 'months', label: 'Meses' },
    { value: 'years', label: 'Años' },
];

export const UNIT_MS: Record<DurationUnit, number> = {
    minutes: 60_000,
    hours: 3_600_000,
    days: 86_400_000,
    weeks: 7 * 86_400_000,
    months: 30 * 86_400_000,
    years: 365 * 86_400_000,
};

export const TIER_OPTIONS: { id: TierId; label: string; color: string }[] = [
    { id: 'supporter', label: '⚡ Supporter', color: '#3b82f6' },
    { id: 'premium',   label: '💎 Premium',   color: '#8b5cf6' },
    { id: 'fundador',  label: '🌟 Fundador',  color: '#f59e0b' },
];

export const DEFAULT_TIER_DURATIONS: Record<TierId, TierDuration> = {
    supporter: { isPermanent: false, duration: 30, unit: 'days' },
    premium:   { isPermanent: false, duration: 30, unit: 'days' },
    fundador:  { isPermanent: false, duration: 30, unit: 'days' },
};

export const EMPTY_CODE: Omit<DiscountCode, 'id' | 'usedCount' | 'createdAt'> = {
    code: '',
    discountType: 'percent',
    discountValue: 10,
    appliesTo: 'all',
    maxUses: null,
    expiresAt: null,
    active: true,
};

export const TABS: { id: TabType; label: string; icon: string }[] = [
    { id: 'general', label: 'General', icon: '🌐' },
    { id: 'tiers', label: 'Tiers', icon: '🏆' },
    { id: 'supporters', label: 'Supporters', icon: '👥' },
    { id: 'codes', label: 'Códigos', icon: '🎟️' },
    { id: 'testing', label: 'Gestión manual', icon: '⚙️' },
    { id: 'appearance', label: 'Apariencia', icon: '🎨' },
    { id: 'cupos', label: 'Cupos Spotify', icon: '🎵' },
];
