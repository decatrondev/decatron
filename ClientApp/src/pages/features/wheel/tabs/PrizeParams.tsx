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

/// El nombre del tipo de premio, para el selector y para el resumen de la fila.
const PRIZE_LABEL_KEY: Record<PrizeType, string> = {
    nothing: 'nothing', coins: 'coins', free_spin: 'freeSpin', gacha_pull: 'gachaPull',
    timer_time: 'timerTime', timeout: 'timeout', sound_alert: 'soundAlert', manual_message: 'manualMessage',
};

/// El premio en una linea legible ("Coins · 100", "Timeout · 60 s · Al que giro"), que es lo que
/// la fila compacta muestra en vez de cuatro campos sueltos. `incomplete` marca el unico caso en
/// que el premio no se puede entregar tal como esta: una alerta de sonido sin elegir (o que ya no
/// existe), que se guardaria sin error y no sonaria nunca.
export function prizeSummary(
    prize: Prize, soundAlerts: SoundAlertOption[], wheels: WheelSummary[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any,
): { text: string; incomplete: boolean } {
    const p = prize.params;
    const nombre = t(`wheel.prizes.${PRIZE_LABEL_KEY[prize.type] ?? 'nothing'}`);
    const seg = (n: unknown) => t('wheel.segments.secondsShort', { n: Number(n) });

    switch (prize.type) {
        case 'coins':
            return { text: `${nombre} · ${Number(p.amount ?? 0)}`, incomplete: false };
        case 'free_spin': {
            const otra = Number(p.wheel_id ?? 0) ? wheels.find(w => w.id === Number(p.wheel_id)) : null;
            return { text: `${nombre} · ${Number(p.count ?? 1)}${otra ? ` · ${otra.name}` : ''}`, incomplete: false };
        }
        case 'gacha_pull':
            return { text: `${nombre} · ${Number(p.count ?? 1)}`, incomplete: false };
        case 'timer_time':
            return { text: `${nombre} · ${seg(p.seconds ?? 0)}`, incomplete: false };
        case 'timeout':
            return {
                text: `${nombre} · ${seg(p.seconds ?? 0)} · ${t(p.target === 'random_chatter' ? 'wheel.prizes.targetRandom' : 'wheel.prizes.targetSpinner')}`,
                incomplete: false,
            };
        case 'sound_alert': {
            const alerta = soundAlerts.find(a => a.id === Number(p.sound_alert_id ?? 0));
            return alerta
                ? { text: `${nombre} · ${alerta.title}`, incomplete: false }
                : { text: `${nombre} · ${t('wheel.segments.pickOne')}`, incomplete: true };
        }
        case 'manual_message': {
            const msg = String(p.template ?? '').trim();
            return { text: msg ? `${nombre} · ${msg}` : nombre, incomplete: false };
        }
        default:
            return { text: nombre, incomplete: false };
    }
}

/// Un campo con su etiqueta. Antes los parametros eran campos sueltos con un `aria-label`
/// invisible: el streamer veia un "60" sin saber de que. Ahora cada uno dice lo que es.
function F({ label, grow, children }: { label: string; grow?: boolean; children: React.ReactNode }) {
    return (
        <label className={`flex flex-col gap-1 min-w-0 ${grow ? 'flex-1 min-w-[12rem]' : ''}`}>
            <span className="text-xs text-[#94a3b8]">{label}</span>
            {children}
        </label>
    );
}

/// Los parametros del premio del gajo, uno por tipo. Viven en el detalle de la fila.
export function PrizeParams({ prize, onChange, wheels, soundAlerts, t }: {
    prize: Prize;
    onChange: (params: Record<string, unknown>) => void;
    wheels: WheelSummary[];
    soundAlerts: SoundAlertOption[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    const p = prize.params;
    const set = (cambios: Record<string, unknown>) => onChange({ ...p, ...cambios });
    const wrap = (children: React.ReactNode) => <div className="flex flex-wrap items-end gap-3">{children}</div>;

    switch (prize.type) {
        case 'coins':
            return wrap(
                <F label={t('wheel.prizes.coinsAmount')}>
                    <input
                        type="number" min={1}
                        value={Number(p.amount ?? 100)}
                        onChange={e => set({ amount: Number(e.target.value) })}
                        className={`w-28 ${PARAM_FIELD}`}
                    />
                </F>,
            );

        case 'free_spin':
            return wrap(
                <>
                    <F label={t('wheel.prizes.spinCount')}>
                        <input
                            type="number" min={1} max={20}
                            value={Number(p.count ?? 1)}
                            onChange={e => set({ count: Number(e.target.value) })}
                            className={`w-24 ${PARAM_FIELD}`}
                        />
                    </F>
                    {/* Regalar giros de OTRA rueda del canal solo tiene sentido si hay
                        mas de una; con una sola el selector seria una linea muerta. */}
                    {wheels.length > 1 && (
                        <F label={t('wheel.prizes.spinWheel')}>
                            <select
                                value={Number(p.wheel_id ?? 0)}
                                onChange={e => set({ wheel_id: Number(e.target.value) })}
                                className={PARAM_FIELD}
                            >
                                <option value={0}>{t('wheel.prizes.spinSameWheel')}</option>
                                {wheels.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </F>
                    )}
                </>,
            );

        case 'gacha_pull':
            return wrap(
                <>
                    <F label={t('wheel.prizes.pullCount')}>
                        <input
                            type="number" min={1} max={20}
                            value={Number(p.count ?? 1)}
                            onChange={e => set({ count: Number(e.target.value) })}
                            className={`w-24 ${PARAM_FIELD}`}
                        />
                    </F>
                    <F label={t('wheel.prizes.pullType')}>
                        <select
                            value={String(p.pull_type ?? 'coins')}
                            onChange={e => set({ pull_type: e.target.value })}
                            className={PARAM_FIELD}
                        >
                            <option value="coins">{t('wheel.prizes.pullCoins')}</option>
                            <option value="donation">{t('wheel.prizes.pullDonation')}</option>
                        </select>
                    </F>
                </>,
            );

        case 'timer_time':
            return wrap(
                <F label={t('wheel.prizes.seconds')}>
                    <input
                        type="number" min={1}
                        value={Number(p.seconds ?? 60)}
                        onChange={e => set({ seconds: Number(e.target.value) })}
                        className={`w-28 ${PARAM_FIELD}`}
                    />
                </F>,
            );

        case 'timeout':
            return wrap(
                <>
                    <F label={t('wheel.prizes.timeoutTarget')}>
                        <select
                            value={String(p.target ?? 'spinner')}
                            onChange={e => set({ target: e.target.value })}
                            className={PARAM_FIELD}
                        >
                            <option value="spinner">{t('wheel.prizes.targetSpinner')}</option>
                            <option value="random_chatter">{t('wheel.prizes.targetRandom')}</option>
                        </select>
                    </F>
                    <F label={t('wheel.prizes.seconds')}>
                        <input
                            type="number" min={1} max={1209600}
                            value={Number(p.seconds ?? 30)}
                            onChange={e => set({ seconds: Number(e.target.value) })}
                            className={`w-28 ${PARAM_FIELD}`}
                        />
                    </F>
                </>,
            );

        case 'sound_alert':
            return soundAlerts.length === 0 ? (
                <p className="text-sm text-amber-300">{t('wheel.prizes.noSoundAlerts')}</p>
            ) : wrap(
                <F label={t('wheel.prizes.soundAlert')} grow>
                    <select
                        value={Number(p.sound_alert_id ?? 0)}
                        onChange={e => set({ sound_alert_id: Number(e.target.value) })}
                        className={PARAM_FIELD}
                    >
                        <option value={0}>{t('wheel.prizes.pickSoundAlert')}</option>
                        {soundAlerts.map(a => (
                            <option key={a.id} value={a.id}>
                                {a.title}{a.enabled ? '' : ` — ${t('wheel.prizes.alertOff')}`}
                            </option>
                        ))}
                    </select>
                </F>,
            );

        case 'manual_message':
            return wrap(
                <F label={t('wheel.prizes.template')} grow>
                    <input
                        type="text"
                        value={String(p.template ?? '')}
                        onChange={e => set({ template: e.target.value })}
                        placeholder={t('wheel.prizes.templatePlaceholder')}
                        className={PARAM_FIELD}
                    />
                </F>,
            );

        default:
            return null;
    }
}
