import { ArrowLeft, CircleDot, Loader2, Play, Plus, Save, Ticket } from 'lucide-react';
import type { TierLimits } from '../hooks/useChannelResources';
import type { Tab, WheelSummary } from '../model';
import { FIELD } from '../ui';

/** Las pestañas sin nada que guardar en bloque: cada fila se resuelve o se edita sola. */
const SIN_GUARDAR: Tab[] = ['test', 'deliveries', 'history', 'wallets', 'media'];

/** Título, selector de rueda, crear, probar giro y guardar. */
export function WheelHeader({
    wheel, wheels, tab, saving, limits, onBack, onOpen, onCreate, onTestSpin, onSave, t,
}: {
    wheel: WheelSummary | null;
    wheels: WheelSummary[];
    tab: Tab;
    saving: boolean;
    limits: TierLimits | null;
    onBack: () => void;
    onOpen: (id: number) => void;
    onCreate: (mode: 'prizes' | 'raffle') => void;
    onTestSpin: () => void;
    onSave: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    const cupoLleno = !!(limits && limits.maxWheels >= 0 && limits.wheels >= limits.maxWheels);

    return (
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-3 bg-[#1B1C1D] rounded-xl border border-[#374151] hover:bg-[#262626] transition-colors"
                    aria-label={t('wheel.back')}
                >
                    <ArrowLeft className="w-5 h-5 text-[#94a3b8]" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                        <CircleDot className="w-6 h-6 text-[#E8B455]" />
                        {t('wheel.title')}
                    </h1>
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-0.5">{t('wheel.subtitle')}</p>
                </div>
            </div>

            {wheel && (
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Selector de rueda y creacion. Sin esto, un canal que ya tenia
                        una rueda no tenia NINGUNA forma de crear otra ni de cambiar
                        entre las suyas: el boton de crear vivia solo en el estado
                        vacio, asi que el modo Sorteo era inalcanzable. */}
                    {wheels.length > 1 && (
                        <select
                            value={wheel.id}
                            onChange={e => onOpen(Number(e.target.value))}
                            className={FIELD}
                            aria-label={t('wheel.pickWheel')}
                        >
                            {wheels.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    )}

                    {/* El tope del tier se muestra siempre, no solo al chocarse con
                        el: saber que te quedan 0 de 2 antes de intentarlo es la
                        diferencia entre un limite y una sorpresa. */}
                    {limits && (
                        <span className="text-xs text-[#64748b] dark:text-[#94a3b8] tabular-nums">
                            {limits.maxWheels < 0
                                ? t('wheel.quota.unlimited')
                                : t('wheel.quota.count', { used: limits.wheels, max: limits.maxWheels })}
                        </span>
                    )}

                    <button
                        onClick={() => onCreate('prizes')}
                        disabled={saving || cupoLleno}
                        className="px-4 py-2.5 bg-[#1B1C1D] border border-[#374151] hover:bg-[#262626] disabled:opacity-40 text-[#f8fafc] rounded-xl transition-colors flex items-center gap-2 font-bold"
                        title={cupoLleno ? t('wheel.quota.reached', { max: limits!.maxWheels }) : t('wheel.newWheel')}
                    >
                        <Plus className="w-4 h-4" />
                        {t('wheel.newWheel')}
                    </button>

                    <button
                        onClick={() => onCreate('raffle')}
                        disabled={saving || cupoLleno}
                        className="px-4 py-2.5 bg-[#1B1C1D] border border-[#374151] hover:bg-[#262626] disabled:opacity-40 text-[#f8fafc] rounded-xl transition-colors flex items-center gap-2 font-bold"
                        title={cupoLleno ? t('wheel.quota.reached', { max: limits!.maxWheels }) : t('wheel.empty.modeRaffleHelp')}
                    >
                        <Ticket className="w-4 h-4" />
                        {t('wheel.newRaffle')}
                    </button>

                    {/* Probar giro solo tiene sentido editando los gajos: es lo que
                        deja ver como quedo la rueda. En Creditos o en Topes no hay
                        nada que mirar en el overlay. */}
                    {tab === 'segments' && (
                        <button
                            onClick={onTestSpin}
                            className="px-5 py-2.5 bg-[#1B1C1D] border border-[#374151] hover:bg-[#262626] text-[#f8fafc] rounded-xl transition-colors flex items-center gap-2 font-bold"
                        >
                            <Play className="w-4 h-4" />
                            {t('wheel.testSpin')}
                        </button>
                    )}

                    {/* Entregas, Historial y Billeteras no tienen nada que guardar
                        en bloque. Antes el boton estaba en Entregas y, al caer por el
                        `else` final del despachador, guardaba los topes sin decirlo. */}
                    {!SIN_GUARDAR.includes(tab) && (
                        <button
                            onClick={onSave}
                            disabled={saving}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl transition-colors flex items-center gap-2 font-bold"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {t('wheel.save')}
                        </button>
                    )}
                </div>
            )}
        </header>
    );
}
