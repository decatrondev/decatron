/**
 * Timer Extension - Design System
 *
 * Sistema de diseño unificado basado en MicroCommands.
 * Elimina gradientes coloridos y usa paleta neutra profesional.
 */

// ============================================================================
// COLORES BASE
// ============================================================================

export const COLORS = {
    // Backgrounds
    bgPrimary: 'bg-white dark:bg-[#1B1C1D]',
    bgSecondary: 'bg-[#f8fafc] dark:bg-[#262626]',
    bgPage: 'bg-[#f8fafc] dark:bg-[#0f1419]',

    // Text
    textPrimary: 'text-[#1e293b] dark:text-[#f8fafc]',
    textSecondary: 'text-[#64748b] dark:text-[#94a3b8]',

    // Borders
    border: 'border-[#e2e8f0] dark:border-[#374151]',

    // Brand (solo azul principal)
    primary: 'bg-[#2563eb] hover:bg-blue-700',
    primaryText: 'text-[#2563eb]',

    // Status
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    warning: 'bg-yellow-500 text-white',
    info: 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
} as const;

// ============================================================================
// COMPONENTES REUTILIZABLES
// ============================================================================

export const COMPONENTS = {
    // Cards / Containers
    card: `${COLORS.bgPrimary} rounded-2xl border ${COLORS.border} p-6 shadow-lg`,
    cardHover: `${COLORS.bgPrimary} rounded-2xl border ${COLORS.border} p-6 shadow-lg hover:border-[#2563eb] transition-all`,

    // Buttons
    buttonPrimary: `px-4 py-3 ${COLORS.primary} text-white font-bold rounded-lg transition-all`,
    buttonSecondary: `px-4 py-3 ${COLORS.bgSecondary} ${COLORS.textSecondary} hover:bg-[#e2e8f0] dark:hover:bg-[#374151] font-bold rounded-lg transition-all`,

    // Inputs
    input: `w-full px-4 py-2 border ${COLORS.border} rounded-lg ${COLORS.bgPrimary} ${COLORS.textPrimary}`,
    select: `w-full px-4 py-2 border ${COLORS.border} rounded-lg ${COLORS.bgPrimary} ${COLORS.textPrimary}`,

    // Labels
    label: `text-sm font-bold ${COLORS.textPrimary}`,
    labelSecondary: `text-xs font-bold ${COLORS.textSecondary}`,

    // Info boxes (NO gradientes, simple y limpio)
    infoBox: `${COLORS.bgPrimary} border ${COLORS.border} rounded-lg p-4`,
    successBox: `bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4`,
    errorBox: `bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4`,
    warningBox: `bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4`
} as const;

// ============================================================================
// TABS
// ============================================================================

export const TAB_STYLES = {
    active: `px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all bg-[#2563eb] text-white shadow-lg`,
    inactive: `px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${COLORS.bgSecondary} ${COLORS.textSecondary} hover:bg-[#e2e8f0] dark:hover:bg-[#374151]`
} as const;

// ============================================================================
// TÍTULOS Y SECCIONES
// ============================================================================

export const HEADINGS = {
    h1: `text-3xl font-black ${COLORS.textPrimary}`,
    h2: `text-2xl font-black ${COLORS.textPrimary}`,
    h3: `text-lg font-black ${COLORS.textPrimary}`,
    h4: `text-sm font-bold ${COLORS.textPrimary}`,
    description: `text-sm ${COLORS.textSecondary}`
} as const;
