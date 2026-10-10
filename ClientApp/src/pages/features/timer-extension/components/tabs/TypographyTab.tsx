/**
 * Timer Extension - Typography Tab Component
 *
 * Configuración de fuentes, colores y posiciones.
 * Diseño profesional y minimalista.
 */

import { Type, Move, Palette } from 'lucide-react';
import type { StyleConfig } from '../../types';

interface TypographyTabProps {
    styleConfig: StyleConfig;
    onStyleConfigChange: (updates: Partial<StyleConfig>) => void;
}

export const TypographyTab: React.FC<TypographyTabProps> = ({
    styleConfig,
    onStyleConfigChange
}) => {
    
    return (
        <div className="space-y-6">
            <div className="bg-ds-bg border border-ds-border rounded-lg p-4">
                <p className="text-sm text-ds-soft">
                    ℹ️ Personaliza la tipografía, colores y la ubicación exacta de cada elemento de texto en el overlay.
                </p>
            </div>

            {/* Estilo General */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <h3 className="text-sm font-bold text-ds-text mb-6 flex items-center gap-2 border-b border-ds-border pb-2">
                    <Palette className="w-4 h-4 text-ds-soft" /> Estilo General
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Fuente */}
                    <div>
                        <label className="text-xs font-bold text-ds-soft block mb-2">Familia de Fuente (Google Fonts)</label>
                        <select
                            value={styleConfig.fontFamily}
                            onChange={(e) => onStyleConfigChange({ fontFamily: e.target.value })}
                            className="ds-input w-full"
                        >
                            <optgroup label="Sans Serif">
                                <option value="Inter">Inter</option>
                                <option value="Roboto">Roboto</option>
                                <option value="Open Sans">Open Sans</option>
                                <option value="Montserrat">Montserrat</option>
                                <option value="Poppins">Poppins</option>
                                <option value="Lato">Lato</option>
                                <option value="Raleway">Raleway</option>
                                <option value="Ubuntu">Ubuntu</option>
                            </optgroup>
                            <optgroup label="Serif">
                                <option value="Merriweather">Merriweather</option>
                                <option value="Playfair Display">Playfair Display</option>
                            </optgroup>
                            <optgroup label="Display / Modern">
                                <option value="Oswald">Oswald</option>
                                <option value="Bebas Neue">Bebas Neue</option>
                            </optgroup>
                            <optgroup label="Monospace">
                                <option value="monospace">Monospace</option>
                                <option value="Fira Code">Fira Code</option>
                            </optgroup>
                        </select>
                    </div>

                    {/* Peso */}
                    <div>
                        <label className="text-xs font-bold text-ds-soft block mb-2">Grosor (Peso)</label>
                        <select
                            value={styleConfig.fontWeight || '700'}
                            onChange={(e) => onStyleConfigChange({ fontWeight: e.target.value })}
                            className="ds-input w-full"
                        >
                            <option value="100">Thin (100)</option>
                            <option value="300">Light (300)</option>
                            <option value="400">Regular (400)</option>
                            <option value="500">Medium (500)</option>
                            <option value="600">Semi Bold (600)</option>
                            <option value="700">Bold (700)</option>
                            <option value="800">Extra Bold (800)</option>
                            <option value="900">Black (900)</option>
                        </select>
                    </div>

                    {/* Color */}
                    <div>
                        <label className="text-xs font-bold text-ds-soft block mb-2">Color de Texto</label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={styleConfig.textColor}
                                onChange={(e) => onStyleConfigChange({ textColor: e.target.value })}
                                className="w-10 h-9 rounded border border-ds-border cursor-pointer p-0"
                            />
                            <input
                                type="text"
                                value={styleConfig.textColor}
                                onChange={(e) => onStyleConfigChange({ textColor: e.target.value })}
                                className="ds-input flex-1 font-mono"
                            />
                        </div>
                    </div>

                    {/* Sombra */}
                    <div>
                        <label className="text-xs font-bold text-ds-soft block mb-2">Sombra</label>
                        <select
                            value={styleConfig.textShadow}
                            onChange={(e) => onStyleConfigChange({ textShadow: e.target.value as any })}
                            className="ds-input w-full"
                        >
                            <option value="none">Sin sombra</option>
                            <option value="normal">Normal</option>
                            <option value="strong">Fuerte</option>
                            <option value="glow">Brillo (Glow)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Tamaños */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <h3 className="text-sm font-bold text-ds-text mb-6 flex items-center gap-2 border-b border-ds-border pb-2">
                    <Type className="w-4 h-4 text-ds-soft" /> Tamaños de Fuente (px)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Título */}
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-xs font-bold text-ds-soft">Título</label>
                            <span className="text-xs font-mono text-ds-soft">{styleConfig.titleFontSize}px</span>
                        </div>
                        <input
                            type="range"
                            min="12"
                            max="100"
                            value={styleConfig.titleFontSize}
                            onChange={(e) => onStyleConfigChange({ titleFontSize: Number(e.target.value) })}
                            className="w-full h-1.5 bg-ds-raised rounded-lg appearance-none cursor-pointer accent-ds-accent"
                        />
                    </div>

                    {/* Tiempo */}
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-xs font-bold text-ds-soft">Tiempo (Reloj)</label>
                            <span className="text-xs font-mono text-ds-soft">{styleConfig.timeFontSize}px</span>
                        </div>
                        <input
                            type="range"
                            min="12"
                            max="150"
                            value={styleConfig.timeFontSize}
                            onChange={(e) => onStyleConfigChange({ timeFontSize: Number(e.target.value) })}
                            className="w-full h-1.5 bg-ds-raised rounded-lg appearance-none cursor-pointer accent-ds-accent"
                        />
                    </div>

                    {/* Tiempo Transcurrido */}
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-xs font-bold text-ds-soft">Transcurrido (+Tiempo)</label>
                            <span className="text-xs font-mono text-ds-soft">{styleConfig.elapsedTimeFontSize || 14}px</span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="100"
                            value={styleConfig.elapsedTimeFontSize || 14}
                            onChange={(e) => onStyleConfigChange({ elapsedTimeFontSize: Number(e.target.value) })}
                            className="w-full h-1.5 bg-ds-raised rounded-lg appearance-none cursor-pointer accent-ds-accent"
                        />
                    </div>

                    {/* Porcentaje */}
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-xs font-bold text-ds-soft">Porcentaje</label>
                            <span className="text-xs font-mono text-ds-soft">{styleConfig.percentageFontSize}px</span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="80"
                            value={styleConfig.percentageFontSize}
                            onChange={(e) => onStyleConfigChange({ percentageFontSize: Number(e.target.value) })}
                            className="w-full h-1.5 bg-ds-raised rounded-lg appearance-none cursor-pointer accent-ds-accent"
                        />
                    </div>
                </div>
            </div>

            {/* Posiciones */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <h3 className="text-sm font-bold text-ds-text mb-6 flex items-center gap-2 border-b border-ds-border pb-2">
                    <Move className="w-4 h-4 text-ds-soft" /> Coordenadas (Posición X, Y)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Título */}
                    <div>
                        <label className="text-xs font-bold text-ds-soft block mb-2">Título</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="X"
                                value={styleConfig.titlePosition.x}
                                onChange={(e) => onStyleConfigChange({ titlePosition: { ...styleConfig.titlePosition, x: Number(e.target.value) } })}
                                className="ds-input w-full"
                            />
                            <input
                                type="number"
                                placeholder="Y"
                                value={styleConfig.titlePosition.y}
                                onChange={(e) => onStyleConfigChange({ titlePosition: { ...styleConfig.titlePosition, y: Number(e.target.value) } })}
                                className="ds-input w-full"
                            />
                        </div>
                    </div>

                    {/* Tiempo */}
                    <div>
                        <label className="text-xs font-bold text-ds-soft block mb-2">Tiempo</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="X"
                                value={styleConfig.timePosition.x}
                                onChange={(e) => onStyleConfigChange({ timePosition: { ...styleConfig.timePosition, x: Number(e.target.value) } })}
                                className="ds-input w-full"
                            />
                            <input
                                type="number"
                                placeholder="Y"
                                value={styleConfig.timePosition.y}
                                onChange={(e) => onStyleConfigChange({ timePosition: { ...styleConfig.timePosition, y: Number(e.target.value) } })}
                                className="ds-input w-full"
                            />
                        </div>
                    </div>

                    {/* Tiempo Transcurrido */}
                    <div>
                        <label className="text-xs font-bold text-ds-soft block mb-2">Transcurrido (+)</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="X"
                                value={styleConfig.elapsedTimePosition?.x || 500}
                                onChange={(e) => onStyleConfigChange({ elapsedTimePosition: { ...(styleConfig.elapsedTimePosition || { x: 500, y: 160 }), x: Number(e.target.value) } })}
                                className="ds-input w-full"
                            />
                            <input
                                type="number"
                                placeholder="Y"
                                value={styleConfig.elapsedTimePosition?.y || 160}
                                onChange={(e) => onStyleConfigChange({ elapsedTimePosition: { ...(styleConfig.elapsedTimePosition || { x: 500, y: 160 }), y: Number(e.target.value) } })}
                                className="ds-input w-full"
                            />
                        </div>
                    </div>

                    {/* Porcentaje */}
                    <div>
                        <label className="text-xs font-bold text-ds-soft block mb-2">Porcentaje</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="X"
                                value={styleConfig.percentagePosition.x}
                                onChange={(e) => onStyleConfigChange({ percentagePosition: { ...styleConfig.percentagePosition, x: Number(e.target.value) } })}
                                className="ds-input w-full"
                            />
                            <input
                                type="number"
                                placeholder="Y"
                                value={styleConfig.percentagePosition.y}
                                onChange={(e) => onStyleConfigChange({ percentagePosition: { ...styleConfig.percentagePosition, y: Number(e.target.value) } })}
                                className="ds-input w-full"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TypographyTab;
