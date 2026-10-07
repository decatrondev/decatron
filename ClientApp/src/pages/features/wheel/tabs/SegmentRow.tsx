import { ArrowDown, ArrowUp, ChevronDown, Copy, Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react';
import { type PrizeType, type Segment, type SoundAlertOption, type WheelSummary } from '../model';
import { FIELD } from '../ui';
import { defaultPrizeParams, PARAM_FIELD, PrizeParams, prizeSummary } from './PrizeParams';

/** Emojis a un clic para el icono del gajo; el campo admite cualquier texto corto. */
const ICON_SUGGESTIONS = ['🎁', '⭐', '💰', '🔥', '🎉', '🎲', '🔊', '💀'];

const SWATCH =
    'rounded-full bg-transparent cursor-pointer border border-[#374151] p-0 appearance-none ' +
    '[&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-full ' +
    '[&::-moz-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-full';

/**
 * Un gajo: una fila compacta (lo que importa de un vistazo) y, debajo, el detalle que se abre
 * con un clic. Antes todo iba en la misma fila — diez controles con el mismo peso visual — y
 * el nombre del gajo se perdia entre ellos.
 *
 * La fila lleva: color (tambien como franja a la izquierda), icono y nombre editables, el
 * premio en una linea, el peso, el porcentaje con su barra, ojo y abrir. El detalle lleva el
 * premio con sus parametros etiquetados, el stock, el aspecto (color e icono) y las acciones.
 */
export function SegmentRow({
    segment, color, percentage, open, canMoveUp, canMoveDown, canDuplicate,
    drag, onToggle, onChange, onRemove, onMoveUp, onMoveDown, onDuplicate, wheels, soundAlerts, t,
}: {
    segment: Segment;
    /** El color con que se dibuja el gajo: el suyo, o el de la paleta si no tiene (igual que la rueda). */
    color: string;
    percentage: number;
    open: boolean;
    canMoveUp: boolean;
    canMoveDown: boolean;
    canDuplicate: boolean;
    /** El asa para reordenar arrastrando. `disabled` mientras la lista esta filtrada. */
    drag: { onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void; disabled: boolean };
    onToggle: () => void;
    onChange: (changes: Partial<Segment>) => void;
    onRemove: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onDuplicate: () => void;
    wheels: WheelSummary[];
    soundAlerts: SoundAlertOption[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    const premio = prizeSummary(segment.prize, soundAlerts, wheels, t);
    const conStock = segment.stockTotal != null;

    const accion = 'px-3 py-1.5 rounded-lg text-sm font-medium border border-[#374151] bg-[#262626] hover:bg-[#2f2f2f] ' +
        'text-[#cbd5e1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5';

    return (
        <div className={segment.isEnabled ? '' : 'opacity-60'}>
            {/* ------------------------------------------------------------ la fila */}
            <div
                className="flex flex-wrap items-center gap-x-2.5 gap-y-2 pl-3 pr-3 py-2.5"
                // La franja del color del gajo: identidad de la fila sin gastar una columna.
                style={{ boxShadow: `inset 4px 0 0 ${color}` }}
            >
                {/* HTML5 nativo: en pantallas tactiles no hay arrastre, por eso subir y bajar
                    siguen en el detalle. */}
                <span
                    draggable={!drag.disabled}
                    onDragStart={drag.onDragStart}
                    onDragEnd={drag.onDragEnd}
                    title={drag.disabled ? t('wheel.segments.dragOff') : t('wheel.segments.drag')}
                    aria-hidden
                    className={`shrink-0 -mr-1 ${drag.disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
                >
                    <GripVertical className="w-4 h-4 text-[#64748b]" />
                </span>

                <input
                    type="color"
                    value={color}
                    onChange={e => onChange({ color: e.target.value })}
                    className={`w-7 h-7 shrink-0 ${SWATCH}`}
                    aria-label={t('wheel.segments.color')}
                />

                <div className="flex items-center gap-1.5 flex-1 basis-[6rem] min-w-0">
                    {segment.icon && <span className="text-lg leading-none shrink-0" aria-hidden>{segment.icon}</span>}
                    <input
                        type="text"
                        value={segment.label}
                        onChange={e => onChange({ label: e.target.value })}
                        placeholder={t('wheel.segments.labelPlaceholder')}
                        className="w-full min-w-0 px-2 py-1.5 bg-transparent border border-transparent hover:border-[#374151] focus:border-blue-500 focus:bg-[#262626] rounded-lg text-[#f8fafc] font-semibold focus:outline-none transition-colors"
                    />
                </div>

                {/* Ancho fijo: asi el premio de todas las filas empieza en la misma columna
                    (con `flex-1` se corria cuando una fila llevaba la marca de stock). Si no
                    cabe, la celda envuelve entera a la linea de abajo. */}
                <div className="flex items-center gap-2 w-full sm:w-[14rem] shrink-0 min-w-0">
                    <button
                        onClick={onToggle}
                        title={premio.text}
                        className={`flex-1 min-w-0 text-left px-2 py-1.5 rounded-lg hover:bg-[#262626] text-sm truncate transition-colors ${
                            premio.incomplete ? 'text-amber-300' : 'text-[#cbd5e1]'
                        }`}
                    >
                        {premio.text}
                    </button>
                    {conStock && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium border border-amber-500/40 bg-amber-500/10 text-amber-300 whitespace-nowrap shrink-0">
                            {segment.stockRemaining != null
                                ? t('wheel.stock.remaining', { n: segment.stockRemaining })
                                : t('wheel.stock.on')}
                        </span>
                    )}
                </div>

                <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={segment.weight}
                    onChange={e => onChange({ weight: Number(e.target.value) })}
                    className="w-14 px-2 py-1.5 bg-[#262626] border border-[#374151] rounded-lg text-[#f8fafc] text-sm focus:outline-none focus:border-blue-500"
                    aria-label={t('wheel.segments.weight')}
                    title={t('wheel.segments.weight')}
                />

                <div className="flex items-center gap-2 w-24 shrink-0" title={t('wheel.segments.percent')}>
                    <div className="flex-1 h-1.5 rounded-full bg-[#374151] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, percentage)}%`, background: color }} />
                    </div>
                    <span className="w-[3.25rem] text-right text-sm font-bold tabular-nums text-[#E8B455]">{percentage.toFixed(1)}%</span>
                </div>

                <div className="flex items-center gap-0.5 ml-auto">
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
                        onClick={onToggle}
                        className="p-2 hover:bg-[#262626] rounded-lg transition-colors"
                        aria-expanded={open}
                        aria-label={open ? t('wheel.segments.collapse') : t('wheel.segments.expand')}
                    >
                        <ChevronDown className={`w-4 h-4 text-[#94a3b8] transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {/* ---------------------------------------------------------- el detalle */}
            {open && (
                <div className="border-t border-[#374151] bg-[#161617] px-5 py-4 space-y-5">
                    <section className="space-y-3">
                        <h3 className="text-sm font-bold text-[#f8fafc]">{t('wheel.segments.groupPrize')}</h3>
                        <div className="flex flex-wrap items-end gap-3">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs text-[#94a3b8]">{t('wheel.prizes.type')}</span>
                                <select
                                    value={segment.prize.type}
                                    onChange={e => onChange({ prize: { type: e.target.value as PrizeType, params: defaultPrizeParams(e.target.value as PrizeType) } })}
                                    className={PARAM_FIELD}
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
                            </label>
                            <PrizeParams
                                prize={segment.prize}
                                onChange={params => onChange({ prize: { type: segment.prize.type, params } })}
                                wheels={wheels}
                                soundAlerts={soundAlerts}
                                t={t}
                            />
                        </div>
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                        {/* Stock. Detras de un interruptor porque la mayoria de los gajos son
                            ilimitados: cuatro campos vacios en cada gajo harian ilegible el
                            detalle por una funcion que casi nadie usa. */}
                        <section className="space-y-3">
                            <h3 className="text-sm font-bold text-[#f8fafc]">{t('wheel.segments.groupOdds')}</h3>
                            <p className="text-sm text-[#cbd5e1]">
                                {t('wheel.segments.oddsLine', { weight: segment.weight, percent: percentage.toFixed(1) })}
                            </p>

                            <button
                                onClick={() => onChange({
                                    stockTotal: segment.stockTotal == null ? 1 : null,
                                    stockPerViewer: segment.stockTotal == null ? segment.stockPerViewer : null,
                                })}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                    conStock
                                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                                        : 'bg-[#262626] border-[#374151] text-[#94a3b8] hover:text-[#cbd5e1]'
                                }`}
                            >
                                {conStock ? t('wheel.stock.on') : t('wheel.stock.off')}
                            </button>

                            {conStock && (
                                <div className="flex flex-wrap items-end gap-3">
                                    <label className="flex flex-col gap-1 text-xs text-[#94a3b8]">
                                        {t('wheel.stock.total')}
                                        <input
                                            type="number" min={1}
                                            value={segment.stockTotal ?? 1}
                                            onChange={e => onChange({ stockTotal: Math.max(1, Number(e.target.value) || 1) })}
                                            className={`${FIELD} w-24`}
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1 text-xs text-[#94a3b8]">
                                        {t('wheel.stock.perViewer')}
                                        <input
                                            type="number" min={1}
                                            value={segment.stockPerViewer ?? ''}
                                            placeholder={t('wheel.stock.noLimit')}
                                            onChange={e => onChange({ stockPerViewer: e.target.value ? Number(e.target.value) : null })}
                                            className={`${FIELD} w-24`}
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1 text-xs text-[#94a3b8]">
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
                                        <span className="pb-2 text-xs text-[#64748b]">
                                            {t('wheel.stock.remaining', { n: segment.stockRemaining })}
                                        </span>
                                    )}
                                </div>
                            )}
                        </section>

                        <section className="space-y-3">
                            <h3 className="text-sm font-bold text-[#f8fafc]">{t('wheel.segments.groupLook')}</h3>
                            <div className="flex flex-wrap items-end gap-3">
                                <label className="flex flex-col gap-1 text-xs text-[#94a3b8]">
                                    {t('wheel.segments.color')}
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={e => onChange({ color: e.target.value })}
                                        className={`w-14 h-9 rounded-lg ${SWATCH.replace('rounded-full', '')} [&::-webkit-color-swatch]:rounded-md`}
                                    />
                                </label>
                                <label className="flex flex-col gap-1 text-xs text-[#94a3b8]">
                                    {t('wheel.segments.icon')}
                                    <input
                                        type="text"
                                        maxLength={8}
                                        value={segment.icon ?? ''}
                                        onChange={e => onChange({ icon: e.target.value || null })}
                                        placeholder={t('wheel.segments.iconNone')}
                                        className={`${FIELD} w-28 text-center`}
                                    />
                                </label>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {ICON_SUGGESTIONS.map(e => (
                                    <button
                                        key={e}
                                        onClick={() => onChange({ icon: segment.icon === e ? null : e })}
                                        className={`w-8 h-8 rounded-lg text-base border transition-colors ${
                                            segment.icon === e ? 'border-blue-500 bg-blue-500/10' : 'border-[#374151] bg-[#262626] hover:bg-[#2f2f2f]'
                                        }`}
                                        aria-label={e}
                                    >
                                        {e}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-[#64748b]">{t('wheel.segments.iconHelp')}</p>
                        </section>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-4 border-t border-[#374151]">
                        <button onClick={onMoveUp} disabled={!canMoveUp} className={accion}>
                            <ArrowUp className="w-4 h-4" />{t('wheel.segments.moveUp')}
                        </button>
                        <button onClick={onMoveDown} disabled={!canMoveDown} className={accion}>
                            <ArrowDown className="w-4 h-4" />{t('wheel.segments.moveDown')}
                        </button>
                        <button onClick={onDuplicate} disabled={!canDuplicate} className={accion}>
                            <Copy className="w-4 h-4" />{t('wheel.segments.duplicate')}
                        </button>
                        <button
                            onClick={onRemove}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-300 transition-colors flex items-center gap-1.5 ml-auto"
                        >
                            <Trash2 className="w-4 h-4" />{t('wheel.segments.remove')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
