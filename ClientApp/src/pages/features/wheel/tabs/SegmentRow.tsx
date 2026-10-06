import { Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react';
import { type PrizeType, type Segment, type SoundAlertOption, type WheelSummary } from '../model';
import { FIELD } from '../ui';
import { defaultPrizeParams, PrizeParams } from './PrizeParams';

export function SegmentRow({ segment, percentage, onChange, onRemove, onMoveUp, onMoveDown, wheels, soundAlerts, t }: {
    segment: Segment;
    percentage: number;
    onChange: (changes: Partial<Segment>) => void;
    onRemove: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    wheels: WheelSummary[];
    soundAlerts: SoundAlertOption[];
    t: any;
}) {
    return (
        <div className={`px-5 py-4 flex flex-wrap items-center gap-3 ${segment.isEnabled ? '' : 'opacity-50'}`}>
            <div className="flex flex-col">
                <button onClick={onMoveUp} className="text-[#64748b] hover:text-[#f8fafc] leading-none" aria-label={t('wheel.segments.moveUp')}>▴</button>
                <GripVertical className="w-4 h-4 text-[#374151]" />
                <button onClick={onMoveDown} className="text-[#64748b] hover:text-[#f8fafc] leading-none" aria-label={t('wheel.segments.moveDown')}>▾</button>
            </div>

            <input
                type="color"
                value={segment.color || '#E8B455'}
                onChange={e => onChange({ color: e.target.value })}
                className="w-9 h-9 rounded-lg bg-transparent border border-[#374151] cursor-pointer"
                aria-label={t('wheel.segments.color')}
            />

            <input
                type="text"
                value={segment.label}
                onChange={e => onChange({ label: e.target.value })}
                placeholder={t('wheel.segments.labelPlaceholder')}
                // Con tope: en un monitor grande la etiqueta se comia todo el ancho
                // sobrante y empujaba peso, premio y parametros tan lejos que dejaba
                // de leerse que esos campos son de esta fila.
                className="flex-1 min-w-[160px] max-w-[28rem] px-3 py-2 bg-[#262626] border border-[#374151] rounded-lg text-[#f8fafc] text-sm focus:outline-none focus:border-blue-500"
            />

            <label className="flex items-center gap-2 text-xs text-[#94a3b8]">
                {t('wheel.segments.weight')}
                <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={segment.weight}
                    onChange={e => onChange({ weight: Number(e.target.value) })}
                    className="w-20 px-2 py-2 bg-[#262626] border border-[#374151] rounded-lg text-[#f8fafc] text-sm focus:outline-none focus:border-blue-500"
                />
            </label>

            <span className="w-16 text-right text-sm font-bold tabular-nums text-[#E8B455]">
                {percentage.toFixed(1)}%
            </span>

            <select
                value={segment.prize.type}
                onChange={e => onChange({ prize: { type: e.target.value as PrizeType, params: defaultPrizeParams(e.target.value as PrizeType) } })}
                className="px-2 py-2 bg-[#262626] border border-[#374151] rounded-lg text-[#f8fafc] text-sm focus:outline-none focus:border-blue-500"
            >
                <option value="nothing">{t('wheel.prizes.nothing')}</option>
                <option value="coins">{t('wheel.prizes.coins')}</option>
                <option value="free_spin">{t('wheel.prizes.freeSpin')}</option>
                <option value="gacha_pull">{t('wheel.prizes.gachaPull')}</option>
                <option value="timer_time">{t('wheel.prizes.timerTime')}</option>
                <option value="timeout">{t('wheel.prizes.timeout')}</option>
                <option value="sound_alert">{t('wheel.prizes.soundAlert')}</option>
                <option value="manual_message">{t('wheel.prizes.manualMessage')}</option>
            </select>

            <PrizeParams
                prize={segment.prize}
                onChange={params => onChange({ prize: { type: segment.prize.type, params } })}
                wheels={wheels}
                soundAlerts={soundAlerts}
                t={t}
            />

            {/* Apagar y borrar van juntos y pegados al extremo derecho: cuando la fila
                envuelve en una columna angosta, dos iconos sueltos empezando una linea
                nueva parecen un error de maquetacion. */}
            <div className="flex items-center gap-1 ml-auto">
                <button
                    onClick={() => onChange({ isEnabled: !segment.isEnabled })}
                    className="p-2 hover:bg-[#262626] rounded-lg transition-colors"
                    aria-label={segment.isEnabled ? t('wheel.segments.disable') : t('wheel.segments.enable')}
                >
                    {segment.isEnabled
                        ? <Eye className="w-4 h-4 text-[#94a3b8]" />
                        : <EyeOff className="w-4 h-4 text-[#64748b]" />}
                </button>

                <button
                    onClick={onRemove}
                    className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                    aria-label={t('wheel.segments.remove')}
                >
                    <Trash2 className="w-4 h-4 text-red-400" />
                </button>
            </div>

            {/* Stock. Va en su propia linea y detras de un interruptor porque la
                mayoria de los gajos son ilimitados: cuatro campos vacios en cada fila
                harian ilegible la lista entera por una funcion que casi nadie usa. */}
            <div className="basis-full flex flex-wrap items-center gap-2 pl-1 pt-1">
                <button
                    onClick={() => onChange({
                        stockTotal: segment.stockTotal == null ? 1 : null,
                        stockPerViewer: segment.stockTotal == null ? segment.stockPerViewer : null,
                    })}
                    className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        segment.stockTotal == null
                            ? 'bg-[#262626] border-[#374151] text-[#64748b] hover:text-[#94a3b8]'
                            : 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                    }`}
                >
                    {segment.stockTotal == null ? t('wheel.stock.off') : t('wheel.stock.on')}
                </button>

                {segment.stockTotal != null && (
                    <>
                        <label className="text-xs text-[#94a3b8] flex items-center gap-1.5">
                            {t('wheel.stock.total')}
                            <input
                                type="number" min={1}
                                value={segment.stockTotal}
                                onChange={e => onChange({ stockTotal: Math.max(1, Number(e.target.value) || 1) })}
                                className={`${FIELD} w-20`}
                            />
                        </label>

                        <label className="text-xs text-[#94a3b8] flex items-center gap-1.5">
                            {t('wheel.stock.perViewer')}
                            <input
                                type="number" min={1}
                                value={segment.stockPerViewer ?? ''}
                                placeholder={t('wheel.stock.noLimit')}
                                onChange={e => onChange({ stockPerViewer: e.target.value ? Number(e.target.value) : null })}
                                className={`${FIELD} w-20`}
                            />
                        </label>

                        <label className="text-xs text-[#94a3b8] flex items-center gap-1.5">
                            {t('wheel.stock.window')}
                            <select
                                value={segment.stockWindow}
                                onChange={e => onChange({ stockWindow: e.target.value })}
                                className={FIELD}
                            >
                                <option value="ever">{t('wheel.stock.wEver')}</option>
                                <option value="stream">{t('wheel.stock.wStream')}</option>
                                <option value="day">{t('wheel.stock.wDay')}</option>
                            </select>
                        </label>

                        {segment.stockRemaining != null && (
                            <span className="text-xs text-[#64748b]">
                                {t('wheel.stock.remaining', { n: segment.stockRemaining })}
                            </span>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
