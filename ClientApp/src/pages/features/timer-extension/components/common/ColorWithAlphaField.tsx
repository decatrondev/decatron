/**
 * Timer Extension - Selector de color con opacidad
 *
 * Nace de un problema concreto: el color de fondo de los widgets era un campo de texto
 * pelado donde habia que escribir "rgba(255,100,0,0.8)" a mano. El que no sabia que el
 * cuarto numero es la transparencia, no podia dejarlo transparente nunca.
 *
 * Por eso: rueda de color, opacidad en porcentaje, boton de "Sin fondo" y el valor
 * crudo visible para el que sí sabe lo que hace. Se sigue guardando como rgba(), asi
 * que lo ya configurado no se rompe.
 */

import { useState } from 'react';
import { Ban } from 'lucide-react';
import { parseColorWithAlpha, buildRgba } from '../../utils';

interface ColorWithAlphaFieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    /** Texto de ayuda debajo del control. */
    hint?: string;
}

const labelClass = "block text-xs font-bold text-ds-soft mb-1 uppercase";

export function ColorWithAlphaField({ label, value, onChange, hint }: ColorWithAlphaFieldProps) {
    const { hex, alpha } = parseColorWithAlpha(value);
    const [showRaw, setShowRaw] = useState(false);

    const isTransparent = alpha === 0;

    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <label className={labelClass + " mb-0"}>{label}</label>
                <button
                    type="button"
                    onClick={() => setShowRaw(!showRaw)}
                    className="text-[10px] text-ds-soft hover:text-ds-soft underline"
                >
                    {showRaw ? 'ocultar código' : 'ver código'}
                </button>
            </div>

            <div className="flex items-center gap-2">
                {/* Muestra del color real, sobre cuadriculado para que se note la transparencia */}
                <div
                    className="w-9 h-9 rounded-lg border border-ds-border flex-shrink-0 overflow-hidden"
                    style={{
                        backgroundImage:
                            'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)',
                        backgroundSize: '8px 8px',
                        backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
                    }}
                    title="Así se va a ver"
                >
                    <div className="w-full h-full" style={{ backgroundColor: buildRgba(hex, alpha) }} />
                </div>

                <input
                    type="color"
                    value={hex}
                    onChange={e => onChange(buildRgba(e.target.value, alpha === 0 ? 100 : alpha))}
                    className="w-9 h-9 rounded cursor-pointer border border-ds-border flex-shrink-0"
                    title="Elegir color"
                />

                <div className="flex-1 min-w-0">
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={alpha}
                        onChange={e => onChange(buildRgba(hex, Number(e.target.value)))}
                        className="w-full accent-ds-accent cursor-pointer"
                        title="Opacidad"
                    />
                    <div className="flex justify-between text-[10px] text-ds-soft leading-none">
                        <span>Transparente</span>
                        <span className="font-mono">{alpha}%</span>
                        <span>Sólido</span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => onChange(buildRgba(hex, 0))}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-all flex-shrink-0 ${
                        isTransparent
                            ? 'bg-ds-accent/20 text-ds-accent-text border-ds-accent/30'
                            : 'bg-ds-bg text-ds-soft border-ds-border hover:text-ds-text '
                    }`}
                    title="Dejar el fondo completamente transparente"
                >
                    <Ban className="w-3 h-3" />
                    Sin fondo
                </button>
            </div>

            {showRaw && (
                <input
                    type="text"
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    placeholder="rgba(255, 100, 0, 0.8)"
                    className="w-full mt-2 px-3 py-1.5 bg-ds-bg border border-ds-border rounded-lg text-xs font-mono text-ds-text focus:outline-none focus:ring-2 focus:ring-ds-accent/50"
                />
            )}

            {hint && <p className="text-[10px] text-ds-soft mt-1">{hint}</p>}
        </div>
    );
}

export default ColorWithAlphaField;
