import { type Prize, type PrizeType, type SoundAlertOption, type WheelSummary } from '../model';

/// Los parametros con los que arranca cada tipo de premio. Un premio recien
/// elegido tiene que ser valido sin que el streamer toque nada mas: un gajo
/// guardado a medias es un premio que no se entrega.
export function defaultPrizeParams(tipo: PrizeType): Record<string, unknown> {
    switch (tipo) {
        case 'coins':          return { amount: 100 };
        case 'free_spin':      return { count: 1 };
        case 'gacha_pull':     return { count: 1, pull_type: 'coins' };
        case 'timer_time':     return { seconds: 60 };
        case 'timeout':        return { target: 'spinner', seconds: 30 };
        case 'sound_alert':    return { sound_alert_id: 0 };
        case 'manual_message': return { template: '' };
        default:               return {};
    }
}

export const PARAM_FIELD = 'px-2 py-2 bg-[#262626] border border-[#374151] rounded-lg text-[#f8fafc] text-sm focus:outline-none focus:border-blue-500';

/// Los parametros del premio del gajo, uno por tipo. Van en la misma fila que el
/// selector: el streamer ve el premio entero de un vistazo sin abrir nada.
export function PrizeParams({ prize, onChange, wheels, soundAlerts, t }: {
    prize: Prize;
    onChange: (params: Record<string, unknown>) => void;
    wheels: WheelSummary[];
    soundAlerts: SoundAlertOption[];
    t: any;
}) {
    const p = prize.params;
    const set = (cambios: Record<string, unknown>) => onChange({ ...p, ...cambios });

    switch (prize.type) {
        case 'coins':
            return (
                <input
                    type="number" min={1}
                    value={Number(p.amount ?? 100)}
                    onChange={e => set({ amount: Number(e.target.value) })}
                    className={`w-24 ${PARAM_FIELD}`}
                    aria-label={t('wheel.prizes.coinsAmount')}
                />
            );

        case 'free_spin':
            return (
                <>
                    <input
                        type="number" min={1} max={20}
                        value={Number(p.count ?? 1)}
                        onChange={e => set({ count: Number(e.target.value) })}
                        className={`w-20 ${PARAM_FIELD}`}
                        aria-label={t('wheel.prizes.spinCount')}
                    />
                    {/* Regalar giros de OTRA rueda del canal solo tiene sentido si hay
                        mas de una; con una sola el selector seria una linea muerta. */}
                    {wheels.length > 1 && (
                        <select
                            value={Number(p.wheel_id ?? 0)}
                            onChange={e => set({ wheel_id: Number(e.target.value) })}
                            className={PARAM_FIELD}
                            aria-label={t('wheel.prizes.spinWheel')}
                        >
                            <option value={0}>{t('wheel.prizes.spinSameWheel')}</option>
                            {wheels.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    )}
                </>
            );

        case 'gacha_pull':
            return (
                <>
                    <input
                        type="number" min={1} max={20}
                        value={Number(p.count ?? 1)}
                        onChange={e => set({ count: Number(e.target.value) })}
                        className={`w-20 ${PARAM_FIELD}`}
                        aria-label={t('wheel.prizes.pullCount')}
                    />
                    <select
                        value={String(p.pull_type ?? 'coins')}
                        onChange={e => set({ pull_type: e.target.value })}
                        className={PARAM_FIELD}
                        aria-label={t('wheel.prizes.pullType')}
                    >
                        <option value="coins">{t('wheel.prizes.pullCoins')}</option>
                        <option value="donation">{t('wheel.prizes.pullDonation')}</option>
                    </select>
                </>
            );

        case 'timer_time':
            return (
                <label className="flex items-center gap-2 text-xs text-[#94a3b8]">
                    <input
                        type="number" min={1}
                        value={Number(p.seconds ?? 60)}
                        onChange={e => set({ seconds: Number(e.target.value) })}
                        className={`w-24 ${PARAM_FIELD}`}
                        aria-label={t('wheel.prizes.seconds')}
                    />
                    {t('wheel.prizes.seconds')}
                </label>
            );

        case 'timeout':
            return (
                <>
                    <select
                        value={String(p.target ?? 'spinner')}
                        onChange={e => set({ target: e.target.value })}
                        className={PARAM_FIELD}
                        aria-label={t('wheel.prizes.timeoutTarget')}
                    >
                        <option value="spinner">{t('wheel.prizes.targetSpinner')}</option>
                        <option value="random_chatter">{t('wheel.prizes.targetRandom')}</option>
                    </select>
                    <label className="flex items-center gap-2 text-xs text-[#94a3b8]">
                        <input
                            type="number" min={1} max={1209600}
                            value={Number(p.seconds ?? 30)}
                            onChange={e => set({ seconds: Number(e.target.value) })}
                            className={`w-24 ${PARAM_FIELD}`}
                            aria-label={t('wheel.prizes.seconds')}
                        />
                        {t('wheel.prizes.seconds')}
                    </label>
                </>
            );

        case 'sound_alert':
            return soundAlerts.length === 0 ? (
                <span className="text-xs text-amber-300">{t('wheel.prizes.noSoundAlerts')}</span>
            ) : (
                <select
                    value={Number(p.sound_alert_id ?? 0)}
                    onChange={e => set({ sound_alert_id: Number(e.target.value) })}
                    className={`flex-1 min-w-[160px] ${PARAM_FIELD}`}
                    aria-label={t('wheel.prizes.soundAlert')}
                >
                    <option value={0}>{t('wheel.prizes.pickSoundAlert')}</option>
                    {soundAlerts.map(a => (
                        <option key={a.id} value={a.id}>
                            {a.title}{a.enabled ? '' : ` — ${t('wheel.prizes.alertOff')}`}
                        </option>
                    ))}
                </select>
            );

        case 'manual_message':
            return (
                <input
                    type="text"
                    value={String(p.template ?? '')}
                    onChange={e => set({ template: e.target.value })}
                    placeholder={t('wheel.prizes.templatePlaceholder')}
                    className={`flex-1 min-w-[160px] ${PARAM_FIELD}`}
                />
            );

        default:
            return null;
    }
}
