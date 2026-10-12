import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { sendLurk, type LurkChannelMode, type LurkState } from './lurk';

interface Props {
    channel: string;
    info: LurkState['channels'][string] | null;
}

// Punto de estado: verde = la pestaña real está abierta o la racha ya subió; ámbar = esperando turno o cerrada por tiempo; rojo = sin
// sesión de Twitch en el navegador (no cuenta nada); gris = nada abierto.
const DOT: Record<string, string> = { open: 'bg-ds-ok', done: 'bg-ds-ok', queued: 'bg-ds-warn', timeout: 'bg-ds-warn' };

/** Estado del modo lurk de una casilla y su ajuste propio (por defecto, apagado, solo racha o completo). */
export default function LurkChip({ channel, info }: Props) {
    const { t } = useTranslation('multiview');
    const status = info?.status ?? 'queued';
    const extra = [
        info?.streak ? `${t('lurk.panel.col.streak')} ${info.streak.have}/${info.streak.need}` : null,
        info?.health ? t(`lurk.health.${info.health}`) : null,
    ].filter(Boolean).join(' · ');
    const label = t(`lurk.status.${status}`) + (extra ? ` · ${extra}` : '');
    return (
        <label className="relative hidden h-8 items-center gap-1 rounded-md px-1.5 text-white/90 hover:bg-white/15 sm:flex" title={`${t('lurk.channelLabel')}: ${label}`}>
            <Eye className="h-4 w-4" aria-hidden />
            <span className={`h-2 w-2 rounded-full ${info?.health === 'nosession' || info?.health === 'stalled' ? 'bg-ds-danger' : DOT[status] ?? 'bg-[#52525b]'}`} aria-hidden />
            <span className="sr-only">{t('lurk.channelLabel')} ({label})</span>
            <select
                value={info?.mode ?? 'default'}
                onChange={e => sendLurk({ login: channel, channelMode: e.target.value as LurkChannelMode })}
                className="absolute inset-0 cursor-pointer opacity-0 [&>option]:bg-pub-raised [&>option]:text-white"
                aria-label={t('lurk.channelLabel')}
            >
                <option value="default">{t('lurk.channel.default')}</option>
                <option value="off">{t('lurk.channel.off')}</option>
                <option value="streak">{t('lurk.channel.streak')}</option>
                <option value="full">{t('lurk.channel.full')}</option>
            </select>
        </label>
    );
}
