import { Power, PowerOff, Shield, Star, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/ds';

/** Restricción del comando: icono + nombre. «Todos» es neutra; el resto lleva el azul de la marca. */
export function RestrictionBadge({ restriction }: { restriction: string }) {
    const { t } = useTranslation('commands');
    const Icon = restriction === 'mod' ? Shield : restriction === 'vip' ? Star : Users;
    const label = restriction === 'mod' || restriction === 'vip' || restriction === 'sub'
        ? t(`customCommands.restrictions.${restriction}`)
        : t('customCommands.restrictions.all');
    return <Badge tone={restriction === 'all' || !restriction ? undefined : 'accent'}><Icon className="w-3 h-3" />{label}</Badge>;
}

/** Estado del comando: verde si está activo (es un estado), neutro si no. */
export function ActiveBadge({ isActive }: { isActive: boolean }) {
    const { t } = useTranslation('commands');
    return isActive
        ? <Badge tone="ok"><Power className="w-3 h-3" />{t('customCommands.table.statusBadges.active')}</Badge>
        : <Badge><PowerOff className="w-3 h-3" />{t('customCommands.table.statusBadges.inactive')}</Badge>;
}

export const commandCode = 'px-3 py-1 bg-ds-bg border border-ds-border rounded font-mono text-sm font-bold text-ds-accent-text';
