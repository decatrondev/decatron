import { BarChart3, Clock, Flame, Eye, EyeOff, CalendarClock } from 'lucide-react';
import type { WidgetsConfig, WidgetItemConfig } from '../../types';
import { ColorWithAlphaField } from '../common/ColorWithAlphaField';
import { renderAccumulatedTime, TIME_UNIT_ORDER } from '../../utils';
import type { TimeUnit } from '../../utils';

interface WidgetsTabProps {
    widgetsConfig: WidgetsConfig;
    onWidgetsConfigChange: (updates: Partial<WidgetsConfig>) => void;
    /** Zona horaria del canal: los meses y años se cuentan por calendario. */
    timeZone?: string;
}

const FONT_OPTIONS = [
    'Inter', 'Arial', 'Roboto', 'Montserrat', 'Oswald', 'Poppins',
    'Bebas Neue', 'Press Start 2P', 'Orbitron', 'Bangers', 'monospace'
];

const TEXT_SHADOWS = [
    { value: 'none', label: 'Sin sombra' },
    { value: 'normal', label: 'Normal' },
    { value: 'strong', label: 'Fuerte' },
    { value: 'glow', label: 'Glow' },
];

const inputClass = "w-full px-3 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/50 placeholder-[#94a3b8]";
const labelClass = "block text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-1 uppercase";
const selectClass = "w-full px-3 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-[#1e293b] dark:text-[#f8fafc] [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]";

function WidgetEditor({ widget, onChange, label, hideLabelField = false, hideEnableToggle = false }: {
    widget: WidgetItemConfig;
    onChange: (updates: Partial<WidgetItemConfig>) => void;
    label: string;
    /** El tiempo acumulado no usa "Etiqueta": su texto sale de la plantilla. */
    hideLabelField?: boolean;
    hideEnableToggle?: boolean;
}) {
    return (
        <div className="border border-[#e2e8f0] dark:border-[#374151] rounded-xl p-4 space-y-3 bg-white dark:bg-[#1B1C1D]">
            <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{label}</span>
                {!hideEnableToggle && <button
                    onClick={() => onChange({ enabled: !widget.enabled })}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        widget.enabled
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] border border-[#e2e8f0] dark:border-[#374151]'
                    }`}
                >
                    {widget.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {widget.enabled ? 'Activo' : 'Inactivo'}
                </button>}
            </div>

            {widget.enabled && (
                <div className="grid grid-cols-2 gap-3">
                    {!hideLabelField && <div>
                        <label className={labelClass}>Etiqueta</label>
                        <input type="text" value={widget.label} onChange={e => onChange({ label: e.target.value })} className={inputClass} />
                    </div>}
                    <div>
                        <label className={labelClass}>Color</label>
                        <div className="flex gap-2">
                            <input type="color" value={widget.textColor} onChange={e => onChange({ textColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer border border-[#e2e8f0] dark:border-[#374151]" />
                            <input type="text" value={widget.textColor} onChange={e => onChange({ textColor: e.target.value })} className={inputClass + " font-mono text-xs"} />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Posicion X</label>
                        <input type="number" value={widget.position.x} onChange={e => onChange({ position: { ...widget.position, x: Number(e.target.value) } })} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Posicion Y</label>
                        <input type="number" value={widget.position.y} onChange={e => onChange({ position: { ...widget.position, y: Number(e.target.value) } })} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Tamaño</label>
                        <input type="number" value={widget.fontSize} onChange={e => onChange({ fontSize: Number(e.target.value) })} min={8} max={80} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Fuente</label>
                        <select value={widget.fontFamily} onChange={e => onChange({ fontFamily: e.target.value })} className={selectClass}>
                            {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Peso</label>
                        <select value={widget.fontWeight} onChange={e => onChange({ fontWeight: e.target.value })} className={selectClass}>
                            <option value="normal">Normal</option>
                            <option value="bold">Bold</option>
                            <option value="300">Light</option>
                            <option value="600">Semibold</option>
                            <option value="900">Black</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Sombra</label>
                        <select value={widget.textShadow} onChange={e => onChange({ textShadow: e.target.value as any })} className={selectClass}>
                            {TEXT_SHADOWS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                    <div className="col-span-2">
                        <ColorWithAlphaField
                            label="Color de fondo"
                            value={widget.backgroundColor ?? 'rgba(0, 0, 0, 0)'}
                            onChange={v => onChange({ backgroundColor: v })}
                            hint="Dejalo en Sin fondo si solo querés el texto sobre tu stream."
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Redondeo</label>
                        <input type="number" value={widget.borderRadius ?? 8} onChange={e => onChange({ borderRadius: Number(e.target.value) })} min={0} max={50} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Relleno</label>
                        <input type="number" value={widget.padding ?? 0} onChange={e => onChange({ padding: Number(e.target.value) })} min={0} max={40} className={inputClass} />
                    </div>
                </div>
            )}
        </div>
    );
}

const UNIT_LABELS: Record<TimeUnit, string> = {
    years: 'Años',
    months: 'Meses',
    weeks: 'Semanas',
    days: 'Días',
    hours: 'Horas',
    minutes: 'Minutos',
    seconds: 'Segundos',
};

export function WidgetsTab({ widgetsConfig, onWidgetsConfigChange, timeZone }: WidgetsTabProps) {
    const { stats, uptime, happyHour, accumulatedTime } = widgetsConfig;

    const updateAccumulated = (updates: Partial<typeof accumulatedTime>) =>
        onWidgetsConfigChange({ accumulatedTime: { ...accumulatedTime, ...updates } });

    // Ejemplo en vivo, con los mismos números de un subathon real (20 días de reloj de
    // pared contra 5 de timer activo), para que se vea la diferencia entre las fuentes
    // sin esperar a que el subathon crezca.
    const accumulatedSample = renderAccumulatedTime(
        { ...accumulatedTime, timeZone },
        {
            wallclockSeconds: 20 * 86400 + 3600,
            activeSeconds: 5 * 86400 + 9 * 3600 + 53 * 60,
            customSeconds: (365 + 128) * 86400 + 5 * 3600
        }
    );

    const updateStatsWidget = (key: keyof typeof stats.widgets, updates: Partial<WidgetItemConfig>) => {
        onWidgetsConfigChange({
            stats: {
                ...stats,
                widgets: {
                    ...stats.widgets,
                    [key]: { ...stats.widgets[key], ...updates }
                }
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Stats Widgets */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-[#2563eb]" />
                        <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">Stats en Vivo</h3>
                    </div>
                    <button
                        onClick={() => onWidgetsConfigChange({ stats: { ...stats, enabled: !stats.enabled } })}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            stats.enabled
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] border border-[#e2e8f0] dark:border-[#374151]'
                        }`}
                    >
                        {stats.enabled ? 'Activado' : 'Desactivado'}
                    </button>
                </div>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Muestra contadores en vivo de subs, bits, tips y mas en el overlay.</p>

                {stats.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <WidgetEditor widget={stats.widgets.subsToday} onChange={u => updateStatsWidget('subsToday', u)} label="Subs Hoy" />
                        <WidgetEditor widget={stats.widgets.totalSubs} onChange={u => updateStatsWidget('totalSubs', u)} label="Total Subs" />
                        <WidgetEditor widget={stats.widgets.bitsToday} onChange={u => updateStatsWidget('bitsToday', u)} label="Bits Hoy" />
                        <WidgetEditor widget={stats.widgets.tipsToday} onChange={u => updateStatsWidget('tipsToday', u)} label="Tips Hoy" />
                        <WidgetEditor widget={stats.widgets.totalRevenue} onChange={u => updateStatsWidget('totalRevenue', u)} label="Recaudado" />
                        <WidgetEditor widget={stats.widgets.eventCount} onChange={u => updateStatsWidget('eventCount', u)} label="Eventos" />
                    </div>
                )}
            </div>

            <hr className="border-[#e2e8f0] dark:border-[#374151]" />

            {/* Uptime Widget */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-green-500" />
                        <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">Uptime (EN VIVO)</h3>
                    </div>
                    <button
                        onClick={() => onWidgetsConfigChange({ uptime: { ...uptime, enabled: !uptime.enabled } })}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            uptime.enabled
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] border border-[#e2e8f0] dark:border-[#374151]'
                        }`}
                    >
                        {uptime.enabled ? 'Activado' : 'Desactivado'}
                    </button>
                </div>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Muestra cuanto tiempo lleva corriendo el timer (ej: EN VIVO 153:08:53).</p>

                {uptime.enabled && (
                    <WidgetEditor widget={uptime} onChange={u => onWidgetsConfigChange({ uptime: { ...uptime, ...u } })} label="Uptime" />
                )}
            </div>

            <hr className="border-[#e2e8f0] dark:border-[#374151]" />

            {/* Happy Hour Indicator */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-orange-500" />
                        <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">Indicador Happy Hour</h3>
                    </div>
                    <button
                        onClick={() => onWidgetsConfigChange({ happyHour: { ...happyHour, enabled: !happyHour.enabled } })}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            happyHour.enabled
                                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                : 'bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] border border-[#e2e8f0] dark:border-[#374151]'
                        }`}
                    >
                        {happyHour.enabled ? 'Activado' : 'Desactivado'}
                    </button>
                </div>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Muestra un indicador visual cuando Happy Hour esta activo (ej: HAPPY HOUR x2 | Termina en 39:57).</p>

                {happyHour.enabled && (
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3">
                        <p className="text-xs text-orange-600 dark:text-orange-400">
                            <strong>Ojo:</strong> en tu overlay real este cartel aparece <strong>solo mientras haya un Happy Hour corriendo</strong>. Si lo configurás y no lo ves, no está roto: no hay ninguno activo. Para verlo y acomodarlo ahora mismo, usá el botón <strong>🔥 Simular Happy Hour</strong> de la vista previa.
                        </p>
                    </div>
                )}

                {happyHour.enabled && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelClass}>Etiqueta</label>
                                <input type="text" value={happyHour.label} onChange={e => onWidgetsConfigChange({ happyHour: { ...happyHour, label: e.target.value } })} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Color texto</label>
                                <div className="flex gap-2">
                                    <input type="color" value={happyHour.textColor} onChange={e => onWidgetsConfigChange({ happyHour: { ...happyHour, textColor: e.target.value } })} className="w-8 h-8 rounded cursor-pointer border border-[#e2e8f0] dark:border-[#374151]" />
                                    <input type="text" value={happyHour.textColor} onChange={e => onWidgetsConfigChange({ happyHour: { ...happyHour, textColor: e.target.value } })} className={inputClass + " font-mono text-xs"} />
                                </div>
                            </div>
                            <div className="col-span-2">
                                <ColorWithAlphaField
                                    label="Color de fondo"
                                    value={happyHour.backgroundColor}
                                    onChange={v => onWidgetsConfigChange({ happyHour: { ...happyHour, backgroundColor: v } })}
                                    hint="Movés la barra a la izquierda del todo (o tocás Sin fondo) para dejarlo transparente."
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Tamaño fuente</label>
                                <input type="number" value={happyHour.fontSize} onChange={e => onWidgetsConfigChange({ happyHour: { ...happyHour, fontSize: Number(e.target.value) } })} min={8} max={60} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Posicion X</label>
                                <input type="number" value={happyHour.position.x} onChange={e => onWidgetsConfigChange({ happyHour: { ...happyHour, position: { ...happyHour.position, x: Number(e.target.value) } } })} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Posicion Y</label>
                                <input type="number" value={happyHour.position.y} onChange={e => onWidgetsConfigChange({ happyHour: { ...happyHour, position: { ...happyHour.position, y: Number(e.target.value) } } })} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Border Radius</label>
                                <input type="number" value={happyHour.borderRadius} onChange={e => onWidgetsConfigChange({ happyHour: { ...happyHour, borderRadius: Number(e.target.value) } })} min={0} max={50} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Padding</label>
                                <input type="number" value={happyHour.padding} onChange={e => onWidgetsConfigChange({ happyHour: { ...happyHour, padding: Number(e.target.value) } })} min={0} max={40} className={inputClass} />
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer py-2">
                                <input type="checkbox" checked={happyHour.showMultiplier} onChange={e => onWidgetsConfigChange({ happyHour: { ...happyHour, showMultiplier: e.target.checked } })} className="w-4 h-4 rounded border-[#e2e8f0] dark:border-[#374151] text-[#2563eb] focus:ring-[#2563eb]" />
                                <span className="text-sm text-[#1e293b] dark:text-[#f8fafc]">Mostrar multiplicador (x2)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer py-2">
                                <input type="checkbox" checked={happyHour.showCountdown} onChange={e => onWidgetsConfigChange({ happyHour: { ...happyHour, showCountdown: e.target.checked } })} className="w-4 h-4 rounded border-[#e2e8f0] dark:border-[#374151] text-[#2563eb] focus:ring-[#2563eb]" />
                                <span className="text-sm text-[#1e293b] dark:text-[#f8fafc]">Mostrar countdown</span>
                            </label>
                        </div>
                    </div>
                )}
            </div>

            <hr className="border-[#e2e8f0] dark:border-[#374151]" />

            {/* Tiempo acumulado */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CalendarClock className="w-5 h-5 text-purple-500" />
                        <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">Tiempo acumulado</h3>
                    </div>
                    <button
                        onClick={() => updateAccumulated({ enabled: !accumulatedTime.enabled })}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            accumulatedTime.enabled
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                : 'bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] border border-[#e2e8f0] dark:border-[#374151]'
                        }`}
                    >
                        {accumulatedTime.enabled ? 'Activado' : 'Desactivado'}
                    </button>
                </div>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                    Cuánto lleva corriendo tu timer, escrito en palabras (ej: 1 año, 4 meses, 2 semanas) en vez de un contador gigante tipo 11928:45:03. No cuenta el tiempo que el timer estuvo pausado, e incluye el tiempo base acumulado si migraste desde otra herramienta.
                </p>

                {accumulatedTime.enabled && (
                    <div className="space-y-4">
                        {/* Ejemplo en vivo */}
                        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                            <p className="text-[10px] font-bold text-purple-500 uppercase mb-1">Así se vería ahora mismo</p>
                            <p className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] break-words">
                                {accumulatedSample || '—'}
                            </p>
                            <p className="text-[10px] text-[#94a3b8] mt-1">
                                Ejemplo con los números de un subathon real: 20 días desde que arrancó, de los cuales el timer estuvo corriendo 5. En el overlay van los tuyos.
                            </p>
                        </div>

                        {/* Qué se cuenta */}
                        <div>
                            <label className={labelClass}>Qué contar</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                {[
                                    { value: 'wallclock' as const, titulo: 'Desde que arrancó', detalle: 'Cuántos días lleva el subathon, corriendo de corrido aunque el timer esté pausado. Es lo que pregunta el chat.' },
                                    { value: 'active' as const, titulo: 'Timer en marcha', detalle: 'Solo el tiempo que el timer estuvo corriendo, sin contar las pausas. El mismo número que el "Transcurrido".' },
                                    { value: 'customDate' as const, titulo: 'Desde una fecha', detalle: 'Vos elegís el día de arranque. Sirve si reseteaste el timer sin querer o venís de otra herramienta.' },
                                ].map(op => (
                                    <button
                                        key={op.value}
                                        onClick={() => updateAccumulated({ source: op.value })}
                                        className={`text-left p-3 rounded-xl border transition-all ${
                                            accumulatedTime.source === op.value
                                                ? 'bg-purple-500/20 border-purple-500/40'
                                                : 'bg-[#f8fafc] dark:bg-[#374151]/50 border-[#e2e8f0] dark:border-[#374151] hover:border-purple-500/30'
                                        }`}
                                    >
                                        <p className={`text-xs font-bold mb-1 ${accumulatedTime.source === op.value ? 'text-purple-500' : 'text-[#1e293b] dark:text-[#f8fafc]'}`}>{op.titulo}</p>
                                        <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8] leading-snug">{op.detalle}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {accumulatedTime.source === 'customDate' && (
                            <div>
                                <label className={labelClass}>Fecha y hora de arranque</label>
                                <input
                                    type="datetime-local"
                                    value={accumulatedTime.customDate || ''}
                                    onChange={e => updateAccumulated({ customDate: e.target.value })}
                                    className={inputClass}
                                />
                                <p className="text-[10px] text-[#94a3b8] mt-1">
                                    Se lee en la zona horaria de tu canal{timeZone ? ` (${timeZone})` : ''}, no en la de quien mire el overlay. Si la dejás vacía, se usa el tiempo del timer en marcha.
                                </p>
                            </div>
                        )}

                        {/* Unidades */}
                        <div>
                            <label className={labelClass}>Unidades que querés mostrar</label>
                            <div className="flex flex-wrap gap-2">
                                {TIME_UNIT_ORDER.map(unit => (
                                    <button
                                        key={unit}
                                        onClick={() => updateAccumulated({ units: { ...accumulatedTime.units, [unit]: !accumulatedTime.units[unit] } })}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                            accumulatedTime.units[unit]
                                                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                                                : 'bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] border-[#e2e8f0] dark:border-[#374151]'
                                        }`}
                                    >
                                        {UNIT_LABELS[unit]}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-[#94a3b8] mt-1">
                                Se llenan de mayor a menor: si apagás Semanas, esos días pasan a contarse como días sueltos (17 días en vez de 2 semanas y 3 días).
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelClass}>Texto</label>
                                <input
                                    type="text"
                                    value={accumulatedTime.template}
                                    onChange={e => updateAccumulated({ template: e.target.value })}
                                    placeholder="{tiempo}"
                                    className={inputClass}
                                />
                                <p className="text-[10px] text-[#94a3b8] mt-1">
                                    Escribí lo que quieras y poné <span className="font-mono">{'{tiempo}'}</span> donde va la cuenta.
                                    También podés usar <span className="font-mono">{'{calendario}'}</span> (desde que arrancó) y <span className="font-mono">{'{activo}'}</span> (timer en marcha) para mostrar las dos juntas.
                                </p>
                            </div>
                            <div>
                                <label className={labelClass}>Máximo de unidades</label>
                                <select
                                    value={accumulatedTime.maxUnits}
                                    onChange={e => updateAccumulated({ maxUnits: Number(e.target.value) })}
                                    className={selectClass}
                                >
                                    <option value={1}>Solo la más grande</option>
                                    <option value={2}>2</option>
                                    <option value={3}>3</option>
                                    <option value={4}>4</option>
                                    <option value={0}>Todas</option>
                                </select>
                                <p className="text-[10px] text-[#94a3b8] mt-1">Entran siempre las más grandes del momento.</p>
                            </div>
                            <div>
                                <label className={labelClass}>Formato</label>
                                <select value={accumulatedTime.format} onChange={e => updateAccumulated({ format: e.target.value as 'long' | 'short' })} className={selectClass}>
                                    <option value="long">Largo (1 año, 4 meses)</option>
                                    <option value="short">Corto (1a 4mes)</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Idioma</label>
                                <select value={accumulatedTime.language} onChange={e => updateAccumulated({ language: e.target.value as 'es' | 'en' })} className={selectClass}>
                                    <option value="es">Español</option>
                                    <option value="en">Inglés</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Separador</label>
                                <input type="text" value={accumulatedTime.separator} onChange={e => updateAccumulated({ separator: e.target.value })} placeholder=", " className={inputClass + " font-mono text-xs"} />
                            </div>
                            <div className="flex items-end">
                                <label className="flex items-center gap-2 cursor-pointer py-2">
                                    <input type="checkbox" checked={accumulatedTime.hideZeroUnits} onChange={e => updateAccumulated({ hideZeroUnits: e.target.checked })} className="w-4 h-4 rounded border-[#e2e8f0] dark:border-[#374151] text-[#2563eb] focus:ring-[#2563eb]" />
                                    <span className="text-sm text-[#1e293b] dark:text-[#f8fafc]">Ocultar unidades en cero</span>
                                </label>
                            </div>
                        </div>

                        {/* Apariencia, igual que los demas widgets */}
                        <WidgetEditor
                            widget={accumulatedTime}
                            onChange={u => updateAccumulated(u)}
                            label="Apariencia y posición"
                            hideLabelField
                            hideEnableToggle
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
