/**
 * Event Alerts Extension - Style Tab Component
 * Configuración de estilos visuales para las alertas
 */
import React from 'react';
import type { AlertStyleConfig, GlobalAlertsConfig } from '../../types/index';
import { DEFAULT_ALERT_STYLE } from '../../constants/defaults';

interface StyleTabProps {
    globalConfig: GlobalAlertsConfig;
    onGlobalConfigChange: (updates: Partial<GlobalAlertsConfig>) => void;
}

const FONT_FAMILIES = [
    { value: 'Inter, sans-serif', label: 'Inter' },
    { value: 'Arial, sans-serif', label: 'Arial' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: '"Segoe UI", sans-serif', label: 'Segoe UI' },
    { value: '"Roboto", sans-serif', label: 'Roboto' },
    { value: '"Montserrat", sans-serif', label: 'Montserrat' },
    { value: '"Oswald", sans-serif', label: 'Oswald' },
    { value: '"Press Start 2P", monospace', label: 'Press Start 2P' },
    { value: 'monospace', label: 'Monospace' },
];

export default function StyleTab({ globalConfig, onGlobalConfigChange }: StyleTabProps) {
    const style: AlertStyleConfig = globalConfig.defaultStyle ?? DEFAULT_ALERT_STYLE;
    const card = globalConfig.overlayElements.card;
    const media = globalConfig.overlayElements.media;
    const text = globalConfig.overlayElements.text;

    const update = (updates: Partial<AlertStyleConfig>) => {
        onGlobalConfigChange({ defaultStyle: { ...style, ...updates } });
    };

    const updateGradient = (field: 'color1' | 'color2' | 'angle', value: string | number) => {
        update({
            backgroundGradient: {
                ...style.backgroundGradient,
                [field]: value,
            },
        });
    };

    // Preview helpers
    const getBackgroundStyle = () => {
        if (style.backgroundType === 'transparent') return 'transparent';
        if (style.backgroundType === 'gradient') {
            return `linear-gradient(${style.backgroundGradient.angle}deg, ${style.backgroundGradient.color1}, ${style.backgroundGradient.color2})`;
        }
        if (style.backgroundType === 'image' && style.backgroundImage) {
            return `url('${style.backgroundImage}') center/cover no-repeat`;
        }
        return style.backgroundColor;
    };

    const getTextShadow = () => {
        switch (style.textShadow) {
            case 'normal': return '1px 1px 4px rgba(0,0,0,0.9)';
            case 'strong': return '2px 2px 8px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1)';
            case 'glow': return `0 0 12px ${style.textColor}, 0 0 24px ${style.textColor}80`;
            default: return 'none';
        }
    };

    // Escala para preview (mantiene aspect ratio del canvas)
    const canvasWidth = globalConfig.canvas.width;
    const canvasHeight = globalConfig.canvas.height;
    const previewMaxWidth = 500;
    const previewScale = previewMaxWidth / canvasWidth;
    const previewHeight = canvasHeight * previewScale;

    return (
        <div className="space-y-6">
            {/* Preview en vivo */}
            <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
                <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-4">
                    📺 Vista Previa en Vivo
                </label>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
                    Los cambios se reflejan en tiempo real. Así se verá en OBS.
                </p>

                {/* Canvas Preview */}
                <div
                    className="bg-black rounded-lg border border-[#374151] relative overflow-hidden mx-auto"
                    style={{ width: previewMaxWidth, height: previewHeight }}
                >
                    {/* CARD */}
                    {card.enabled && (
                        <div
                            className="absolute transition-all duration-300"
                            style={{
                                left: card.x * previewScale,
                                top: card.y * previewScale,
                                width: card.width * previewScale,
                                height: card.height * previewScale,
                                background: getBackgroundStyle(),
                                opacity: style.opacity / 100,
                                borderRadius: style.borderRadius * previewScale,
                                border: style.borderEnabled
                                    ? `${Math.max(1, style.borderWidth * previewScale)}px solid ${style.borderColor}`
                                    : 'none',
                                boxShadow: style.backgroundType !== 'transparent'
                                    ? '0 4px 16px rgba(0,0,0,0.5)'
                                    : 'none',
                            }}
                        />
                    )}

                    {/* MEDIA */}
                    {media.enabled && (
                        <div
                            className="absolute transition-all duration-300 bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center"
                            style={{
                                left: media.x * previewScale,
                                top: media.y * previewScale,
                                width: media.width * previewScale,
                                height: media.height * previewScale,
                                borderRadius: 4 * previewScale,
                            }}
                        >
                            <div className="text-center">
                                <div style={{ fontSize: Math.max(14, 28 * previewScale) }}>🖼️</div>
                                <div className="text-white font-bold" style={{ fontSize: Math.max(8, 12 * previewScale) }}>MEDIA</div>
                            </div>
                        </div>
                    )}

                    {/* TEXT */}
                    {text.enabled && (
                        <div
                            className="absolute transition-all duration-300 flex flex-col justify-center"
                            style={{
                                left: text.x * previewScale,
                                top: text.y * previewScale,
                                width: text.width * previewScale,
                                height: text.height * previewScale,
                                padding: Math.max(4, style.padding * previewScale * 0.5),
                                textAlign: style.textAlign,
                                alignItems: style.textAlign === 'center' ? 'center'
                                    : style.textAlign === 'right' ? 'flex-end'
                                    : 'flex-start',
                            }}
                        >
                            <div
                                style={{
                                    fontFamily: style.fontFamily,
                                    fontSize: Math.max(10, style.fontSize * previewScale),
                                    fontWeight: style.fontWeight,
                                    color: style.textColor,
                                    textShadow: getTextShadow(),
                                    lineHeight: 1.3,
                                }}
                            >
                                ❤️ ¡StreamFan99 te siguió!
                            </div>
                            <div
                                style={{
                                    fontFamily: style.fontFamily,
                                    fontSize: Math.max(8, (style.fontSize - 4) * previewScale),
                                    color: style.textColor,
                                    opacity: 0.7,
                                    marginTop: 4 * previewScale,
                                    textShadow: getTextShadow(),
                                }}
                            >
                                "¡Hola, me encanta tu stream!"
                            </div>
                        </div>
                    )}

                    {/* Canvas size label */}
                    <div className="absolute bottom-1 right-1 bg-black/70 px-2 py-1 rounded text-[10px] text-white font-mono">
                        {canvasWidth}×{canvasHeight}
                    </div>
                </div>
            </div>

            {/* Fondo */}
            <Section title="🎨 Fondo">
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block">Tipo de fondo</label>
                        <div className="grid grid-cols-4 gap-2 mt-2">
                            {(['color', 'gradient', 'image', 'transparent'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => update({ backgroundType: t })}
                                    className={`py-2.5 text-xs font-bold rounded-lg border-2 transition-all ${
                                        style.backgroundType === t
                                            ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white border-[#2563eb] shadow-lg'
                                            : 'text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#374151] hover:border-blue-400'
                                    }`}
                                >
                                    {t === 'gradient' ? 'Degradado' : t === 'transparent' ? 'Transparente' : t === 'color' ? 'Color' : 'Imagen'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {style.backgroundType === 'color' && (
                        <ColorField label="Color de fondo" value={style.backgroundColor} onChange={v => update({ backgroundColor: v })} />
                    )}

                    {style.backgroundType === 'gradient' && (
                        <div className="grid grid-cols-3 gap-4">
                            <ColorField label="Color 1" value={style.backgroundGradient.color1} onChange={v => updateGradient('color1', v)} />
                            <ColorField label="Color 2" value={style.backgroundGradient.color2} onChange={v => updateGradient('color2', v)} />
                            <div>
                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block">Ángulo (°)</label>
                                <input
                                    type="range"
                                    min={0}
                                    max={360}
                                    value={style.backgroundGradient.angle}
                                    onChange={e => updateGradient('angle', Number(e.target.value))}
                                    className="w-full accent-[#2563eb] mt-2"
                                />
                                <div className="text-center text-xs font-mono text-[#2563eb] mt-1">{style.backgroundGradient.angle}°</div>
                            </div>
                        </div>
                    )}

                    {style.backgroundType === 'image' && (
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block">URL de imagen de fondo</label>
                            <input
                                type="text"
                                value={style.backgroundImage}
                                onChange={e => update({ backgroundImage: e.target.value })}
                                placeholder="https://ejemplo.com/fondo.jpg"
                                className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm mt-2"
                            />
                        </div>
                    )}

                    <SliderField label="Opacidad" value={style.opacity} min={0} max={100} unit="%" onChange={v => update({ opacity: v })} />
                </div>
            </Section>

            {/* Borde y Forma */}
            <Section title="📦 Borde y Forma">
                <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-[#f8fafc] dark:bg-[#262626] rounded-lg">
                        <input
                            type="checkbox"
                            checked={style.borderEnabled}
                            onChange={e => update({ borderEnabled: e.target.checked })}
                            className="w-5 h-5 rounded text-[#2563eb]"
                        />
                        <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">Mostrar borde</span>
                    </label>

                    {style.borderEnabled && (
                        <div className="grid grid-cols-3 gap-4">
                            <ColorField label="Color de borde" value={style.borderColor} onChange={v => update({ borderColor: v })} />
                            <NumberField label="Grosor (px)" value={style.borderWidth} min={1} max={20} onChange={v => update({ borderWidth: v })} />
                            <NumberField label="Radio (px)" value={style.borderRadius} min={0} max={100} onChange={v => update({ borderRadius: v })} />
                        </div>
                    )}

                    {!style.borderEnabled && (
                        <NumberField label="Radio de esquinas (px)" value={style.borderRadius} min={0} max={100} onChange={v => update({ borderRadius: v })} />
                    )}

                    <NumberField label="Padding interno (px)" value={style.padding} min={0} max={100} onChange={v => update({ padding: v })} />
                </div>
            </Section>

            {/* Tipografía */}
            <Section title="✏️ Tipografía">
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block">Fuente</label>
                        <select
                            value={style.fontFamily}
                            onChange={e => update({ fontFamily: e.target.value })}
                            className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm mt-2"
                        >
                            {FONT_FAMILIES.map(f => (
                                <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block">Tamaño (px)</label>
                            <input
                                type="range"
                                min={12}
                                max={72}
                                value={style.fontSize}
                                onChange={e => update({ fontSize: Number(e.target.value) })}
                                className="w-full accent-[#2563eb] mt-2"
                            />
                            <div className="text-center text-xs font-mono text-[#2563eb] mt-1">{style.fontSize}px</div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block">Peso</label>
                            <select
                                value={style.fontWeight}
                                onChange={e => update({ fontWeight: e.target.value })}
                                className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm mt-2"
                            >
                                <option value="normal">Normal</option>
                                <option value="bold">Bold</option>
                                <option value="300">Light (300)</option>
                                <option value="500">Medium (500)</option>
                                <option value="700">Bold (700)</option>
                                <option value="900">Black (900)</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <ColorField label="Color de texto" value={style.textColor} onChange={v => update({ textColor: v })} />
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block">Sombra de texto</label>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {(['none', 'normal', 'strong', 'glow'] as const).map(shadow => (
                                    <button
                                        key={shadow}
                                        onClick={() => update({ textShadow: shadow })}
                                        className={`py-2 text-xs font-bold rounded-lg border-2 transition-all capitalize ${
                                            style.textShadow === shadow
                                                ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white border-[#2563eb]'
                                                : 'text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#374151] hover:border-blue-400'
                                        }`}
                                    >
                                        {shadow === 'none' ? 'Sin' : shadow === 'normal' ? 'Normal' : shadow === 'strong' ? 'Fuerte' : 'Glow'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block">Alineación</label>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            {(['left', 'center', 'right'] as const).map(align => (
                                <button
                                    key={align}
                                    onClick={() => update({ textAlign: align })}
                                    className={`py-2.5 text-xs font-bold rounded-lg border-2 transition-all ${
                                        style.textAlign === align
                                            ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white border-[#2563eb]'
                                            : 'text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#374151] hover:border-blue-400'
                                    }`}
                                >
                                    {align === 'left' ? '⬅️ Izquierda' : align === 'center' ? '↔️ Centro' : 'Derecha ➡️'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Section>

            {/* Media Object Fit */}
            <Section title="🖼️ Ajuste de Media">
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
                    Cómo se ajusta la imagen/video dentro de su contenedor
                </p>
                <div className="grid grid-cols-2 gap-3">
                    {(['contain', 'cover'] as const).map(fit => (
                        <button
                            key={fit}
                            onClick={() => update({ mediaObjectFit: fit })}
                            className={`py-3 text-sm font-bold rounded-lg border-2 transition-all ${
                                style.mediaObjectFit === fit
                                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-purple-500 shadow-lg'
                                    : 'text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#374151] hover:border-purple-400'
                            }`}
                        >
                            {fit === 'contain' ? '📐 Contener' : '🔲 Cubrir'}
                            <div className="text-[10px] opacity-70 mt-1">
                                {fit === 'contain' ? 'Muestra todo, puede dejar espacios' : 'Llena todo, puede recortar'}
                            </div>
                        </button>
                    ))}
                </div>
            </Section>
        </div>
    );
}

// ── HELPER COMPONENTS ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-4">
                {title}
            </label>
            {children}
        </div>
    );
}

const labelClass = "text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block";
const inputClass = "w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm";

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div>
            <label className={labelClass}>{label}</label>
            <div className="flex gap-2 mt-2">
                <input
                    type="color"
                    value={value.startsWith('#') ? value : '#ffffff'}
                    onChange={e => onChange(e.target.value)}
                    className="w-12 h-10 rounded-lg cursor-pointer border border-[#e2e8f0] dark:border-[#374151]"
                />
                <input
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="flex-1 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none font-mono text-xs"
                />
            </div>
        </div>
    );
}

function NumberField({ label, value, min, max, onChange }: {
    label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
    return (
        <div>
            <label className={labelClass}>{label}</label>
            <input
                type="number"
                value={value}
                min={min}
                max={max}
                onChange={e => onChange(Number(e.target.value))}
                className={`${inputClass} mt-2`}
            />
        </div>
    );
}

function SliderField({ label, value, min, max, unit, onChange }: {
    label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void;
}) {
    return (
        <div>
            <div className="flex justify-between mb-2">
                <label className={labelClass}>{label}</label>
                <span className="text-xs font-mono text-[#2563eb] font-bold">{value}{unit}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="w-full accent-[#2563eb]"
            />
        </div>
    );
}
