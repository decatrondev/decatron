import { BarChart3, Clock, Flame, Eye, EyeOff } from 'lucide-react';
import type { WidgetsConfig, WidgetItemConfig } from '../../types';

interface WidgetsTabProps {
    widgetsConfig: WidgetsConfig;
    onWidgetsConfigChange: (updates: Partial<WidgetsConfig>) => void;
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

function WidgetEditor({ widget, onChange, label }: {
    widget: WidgetItemConfig;
    onChange: (updates: Partial<WidgetItemConfig>) => void;
    label: string;
}) {
    return (
        <div className="border border-[#e2e8f0] dark:border-[#374151] rounded-xl p-4 space-y-3 bg-white dark:bg-[#1B1C1D]">
            <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{label}</span>
                <button
                    onClick={() => onChange({ enabled: !widget.enabled })}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        widget.enabled
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] border border-[#e2e8f0] dark:border-[#374151]'
                    }`}
                >
                    {widget.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {widget.enabled ? 'Activo' : 'Inactivo'}
                </button>
            </div>

            {widget.enabled && (
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelClass}>Etiqueta</label>
                        <input type="text" value={widget.label} onChange={e => onChange({ label: e.target.value })} className={inputClass} />
                    </div>
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
                </div>
            )}
        </div>
    );
}

export function WidgetsTab({ widgetsConfig, onWidgetsConfigChange }: WidgetsTabProps) {
    const { stats, uptime, happyHour } = widgetsConfig;

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
                            <div>
                                <label className={labelClass}>Color fondo</label>
                                <input type="text" value={happyHour.backgroundColor} onChange={e => onWidgetsConfigChange({ happyHour: { ...happyHour, backgroundColor: e.target.value } })} placeholder="rgba(255,100,0,0.8)" className={inputClass + " font-mono text-xs"} />
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
        </div>
    );
}
