import { cardClass, inputClass, labelClass, sectionTitle, sectionDesc, Toggle } from './shared';
import type { ConfigProps } from './types';

type OverlayTabProps = ConfigProps;

export default function OverlayTab({ config, setConfig }: OverlayTabProps) {
    return (
        <div className="space-y-6">
            <div className={cardClass}>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <p className={sectionTitle}>🖥️ Burbuja de mensaje</p>
                        <p className={sectionDesc}>Muestra un globo con el username y el mensaje mientras se lee</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Toggle
                            checked={config.overlay.showBubble}
                            onChange={v => setConfig(c => ({ ...c, overlay: { ...c.overlay, showBubble: v } }))}
                        />
                        <span className="text-sm font-bold text-ds-text">
                            {config.overlay.showBubble ? 'Visible' : 'Solo audio'}
                        </span>
                    </div>
                </div>

                {config.overlay.showBubble && (
                    <div className="space-y-6">
                        {/* Posición */}
                        <div>
                            <label className={labelClass}>Posición en pantalla</label>
                            <div className="grid grid-cols-3 gap-2 w-64">
                                {(['top-left','top-center','top-right','bottom-left','bottom-center','bottom-right'] as const).map(pos => (
                                    <button
                                        key={pos}
                                        onClick={() => setConfig(c => ({ ...c, overlay: { ...c.overlay, position: pos } }))}
                                        className={`py-2 px-2 rounded-lg border text-xs font-bold transition-all ${
                                            config.overlay.position === pos
                                                ? 'border-ds-accent bg-ds-accent/10 text-ds-accent-text'
                                                : 'border-ds-border text-ds-soft hover:border-ds-faint'
                                        }`}
                                    >
                                        {pos.replace('-', ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Colores + tamaño */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className={labelClass}>Color de fondo</label>
                                <input
                                    value={config.overlay.backgroundColor}
                                    onChange={e => setConfig(c => ({ ...c, overlay: { ...c.overlay, backgroundColor: e.target.value } }))}
                                    className={inputClass}
                                    placeholder="rgba(0,0,0,0.75)"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Color de texto</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={config.overlay.textColor}
                                        onChange={e => setConfig(c => ({ ...c, overlay: { ...c.overlay, textColor: e.target.value } }))}
                                        className="h-[42px] w-12 rounded-lg border border-ds-border bg-transparent cursor-pointer p-0.5"
                                    />
                                    <input
                                        value={config.overlay.textColor}
                                        onChange={e => setConfig(c => ({ ...c, overlay: { ...c.overlay, textColor: e.target.value } }))}
                                        className={`${inputClass} font-mono`}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Tamaño de fuente (px)</label>
                                <input
                                    type="number"
                                    min={10}
                                    max={48}
                                    value={config.overlay.fontSize}
                                    onChange={e => setConfig(c => ({ ...c, overlay: { ...c.overlay, fontSize: parseInt(e.target.value) || 16 } }))}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Duración visible (ms)</label>
                                <input
                                    type="number"
                                    min={1000}
                                    max={30000}
                                    step={500}
                                    value={config.overlay.duration}
                                    onChange={e => setConfig(c => ({ ...c, overlay: { ...c.overlay, duration: parseInt(e.target.value) || 5000 } }))}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Preview */}
            {config.overlay.showBubble && (
                <div className={cardClass}>
                    <p className={sectionTitle}>👁️ Vista previa</p>
                    <div className="relative rounded-lg overflow-hidden bg-ds-input" style={{ paddingBottom: '30%', minHeight: 120 }}>
                        <div
                            className="absolute"
                            style={{
                                ...(config.overlay.position.includes('top') ? { top: 12 } : { bottom: 12 }),
                                ...(config.overlay.position.includes('left') ? { left: 12 } : config.overlay.position.includes('right') ? { right: 12 } : { left: '50%', transform: 'translateX(-50%)' }),
                                maxWidth: 280,
                            }}
                        >
                            <div className="rounded-lg px-4 py-3" style={{ backgroundColor: config.overlay.backgroundColor }}>
                                <p style={{ color: config.overlay.textColor, fontSize: Math.max(9, config.overlay.fontSize * 0.65), fontWeight: 700, margin: 0, fontFamily: 'Inter, sans-serif' }}>
                                    streamer
                                </p>
                                <p style={{ color: config.overlay.textColor, fontSize: Math.max(9, config.overlay.fontSize * 0.65), margin: '2px 0 0', fontFamily: 'Inter, sans-serif' }}>
                                    Hola, este es un mensaje de prueba
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
