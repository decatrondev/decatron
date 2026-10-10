import { ChoiceButton } from './config';

// Estos strings deben coincidir EXACTO con los niveles del backend (GachaCommand.GetUserLevel/HasPermission)
export type Permission = 'everyone' | 'subscriber' | 'vip' | 'moderator' | 'lead_moderator' | 'broadcaster';

// Jerarquía ordenada de menor a mayor nivel — debe coincidir con el array del backend
export const PERMISSION_HIERARCHY: Permission[] = ['everyone', 'subscriber', 'vip', 'moderator', 'lead_moderator', 'broadcaster'];

export const PERMISSION_LABELS: Record<Permission, string> = {
    everyone: 'Todos',
    subscriber: 'Suscriptores',
    vip: 'VIPs',
    moderator: 'Moderadores',
    lead_moderator: 'Lead Moderators',
    broadcaster: 'Solo Streamer',
};

export const PERMISSION_DESC: Record<Permission, string> = {
    everyone: 'Cualquier usuario puede usarlo',
    subscriber: 'Solo suscriptores, VIPs, mods y superiores',
    vip: 'Solo VIPs, mods y superiores',
    moderator: 'Solo moderadores y superiores',
    lead_moderator: 'Solo lead moderators y el streamer',
    broadcaster: 'Solo el streamer',
};

/** Lista de niveles mínimos: marca el elegido y muestra quién más puede usar el comando. */
export default function PermissionPicker({ value, onChange }: { value: Permission; onChange: (p: Permission) => void }) {
    const selectedIndex = PERMISSION_HIERARCHY.indexOf(value);
    return (
        <div className="space-y-2">
            {PERMISSION_HIERARCHY.map((p, index) => {
                const isSelected = value === p;
                const isIncluded = index >= selectedIndex;
                return (
                    <ChoiceButton key={p} selected={isSelected} onClick={() => onChange(p)}>
                        <div className="flex items-center gap-3">
                            <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border ${isSelected ? 'bg-ds-accent text-white border-ds-accent' : 'bg-ds-raised border-ds-border text-ds-soft'}`}>
                                {index + 1}
                            </span>
                            <span className={`text-sm font-bold ${isSelected ? 'text-ds-accent-text' : 'text-ds-text'}`}>{PERMISSION_LABELS[p]}</span>
                        </div>
                        {isSelected
                            ? <span className="text-xs text-ds-soft">{PERMISSION_DESC[p]}</span>
                            : <span className={`text-xs ${isIncluded ? 'text-ds-ok' : 'text-ds-faint'}`}>{isIncluded ? '✓ puede usar' : '✗ no puede'}</span>}
                    </ChoiceButton>
                );
            })}
        </div>
    );
}
