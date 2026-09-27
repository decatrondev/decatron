// Tipos del formato por puntos de Fortnite (.dev/torneos/15-fortnite.md F2).
// Backend: TournamentFortniteAdminController (api/admin/tournament/editions/{id}/fortnite).

export interface PlacementRange {
    from: number;
    to: number;
    points: number;
}

export interface FortniteConfig {
    placementPoints: PlacementRange[];
    pointsPerElimination: number;
    tiebreakers: string[];
    maxPlayersPerLobby: number;
    fillSolosRandomly: boolean;
    matchPointThreshold: number | null;
    proofMode: string;
    reportWindowMinutes: number;
    missingReportZero: boolean;
}

export const PROOF_MODE_LABELS: Record<string, { label: string; help: string }> = {
    always: { label: 'Captura obligatoria', help: 'Cada jugador sube su captura de la pantalla final; sin captura no se cuenta el reporte.' },
    on_conflict: { label: 'Captura solo si hay algo raro', help: 'Se reporta sin captura; se pide cuando el sistema marca una alerta en el equipo.' },
    staff_only: { label: 'Carga el organizador', help: 'Los jugadores no reportan: tú cargas los resultados de cada partida con tu justificante.' },
};

export const RESULT_FLAG_LABELS: Record<string, string> = {
    no_report: 'Sin reporte',
    placement_mismatch: 'Puestos distintos',
    missing_member_reports: 'Faltan reportes de jugadores',
    duplicate_placement: 'Puesto repetido',
    placement_out_of_range: 'Puesto fuera de rango',
    screenshot_needed: 'Falta captura',
    too_many_eliminations: 'Más eliminaciones que jugadores',
};

export const RESULT_STATUS_LABELS: Record<string, string> = {
    approved: 'Aprobado',
    rejected: 'Rechazado (0 pts)',
    no_report: 'Sin reporte (0 pts)',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
    approve: 'Aprobó lo reportado',
    staff_load: 'Cargó el resultado',
    correct: 'Corrigió el resultado',
    reject: 'Rechazó el resultado',
    reopen: 'Reabrió la revisión',
    no_report: 'Sin reporte al cerrar',
};

export interface PointsPreset {
    id: string;
    name: string;
    description: string;
    placementPoints: PlacementRange[];
    pointsPerElimination: number;
}

export interface FortniteTeam {
    id: number;
    name: string;
    joinCode: string | null;
    members: { displayName: string; status: string }[];
    playing: boolean;
}

export interface FortniteGroup {
    id: number;
    name: string;
    isFinal: boolean;
    qualifyCount: number | null;
    teamIds: number[];
}

export interface FortniteSession {
    id: number;
    name: string;
    groupId: number | null;
    scheduledAt: string | null;
    status: string;
    games: { id: number; gameNumber: number; status: string }[];
}

export interface FortniteFormat {
    teamSize: number;
    teamsPerLobby: number;
    config: FortniteConfig;
    presets: PointsPreset[];
    teams: FortniteTeam[];
    approvedWithoutTeam: number;
    groups: FortniteGroup[];
    sessions: FortniteSession[];
}

export const TIEBREAKER_LABELS: Record<string, string> = {
    wins: 'Más victorias',
    eliminations: 'Más eliminaciones',
    avg_placement: 'Mejor puesto promedio',
    last_game_placement: 'Mejor puesto en la última partida',
};

export const SESSION_STATUS_LABELS: Record<string, string> = {
    scheduled: 'Programada',
    check_in: 'Check-in abierto',
    in_progress: 'En juego',
    finished: 'Terminada',
};

export function pointsFor(config: Pick<FortniteConfig, 'placementPoints' | 'pointsPerElimination'>, placement: number, eliminations: number): number {
    const range = config.placementPoints.find((r) => placement >= r.from && placement <= r.to);
    return (range?.points ?? 0) + Math.max(0, eliminations) * config.pointsPerElimination;
}

export const inputClass =
    'w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm 4xl:text-base';
export const labelClass = 'text-xs 4xl:text-sm font-bold text-[#64748b] dark:text-[#94a3b8]';
export const cardClass = 'p-4 4xl:p-6 rounded-xl border border-[#e2e8f0] dark:border-[#374151] space-y-3 4xl:space-y-4';
export const primaryButton =
    'flex items-center justify-center gap-1.5 px-3 py-2 4xl:px-4 4xl:py-2.5 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-sm 4xl:text-base font-bold hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-50';
export const secondaryButton =
    'flex items-center justify-center gap-1.5 px-3 py-2 4xl:px-4 4xl:py-2.5 rounded-lg bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] text-[#475569] dark:text-[#94a3b8] text-sm 4xl:text-base font-bold hover:bg-[#e2e8f0] dark:hover:bg-[#374151] disabled:opacity-50';
