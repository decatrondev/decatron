/**
 * Timer Extension - ProgressBar Tab Component
 *
 * Configuración de la barra de progreso.
 * Diseño minimalista, colapsable y grid 2-columnas.
 */

import { useState } from 'react';
import {
    ArrowRight, ArrowUp, RefreshCw,
    Palette, Film, MousePointer2,
    Layout, Circle, ArrowLeft, ArrowDown, ChevronDown, ChevronUp, Box
} from 'lucide-react';
import MediaInputWithSelector from '../../../../../components/timer/MediaInputWithSelector';
import type { ProgressBarConfig } from '../../types';

interface ProgressBarTabProps {
    progressBarConfig: ProgressBarConfig;
    onProgressBarConfigChange: (updates: Partial<ProgressBarConfig>) => void;
}

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
        />
        <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-faint rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all border-ds-border peer-checked:bg-ds-accent"></div>
    </label>
);

export const ProgressBarTab: React.FC<ProgressBarTabProps> = ({
    progressBarConfig,
    onProgressBarConfigChange
}) => {
    // Estados para secciones colapsables
    const [expandedSections, setExpandedSections] = useState({
        style: true,
        indicator: false,
        border: false
    });

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const getOrientationOptions = () => {
        switch (progressBarConfig.type) {
            case 'horizontal':
                return [
                    { value: 'left-to-right', label: 'Izquierda → Derecha', icon: <ArrowRight className="w-4 h-4" /> },
                    { value: 'right-to-left', label: 'Derecha → Izquierda', icon: <ArrowLeft className="w-4 h-4" /> }
                ];
            case 'vertical':
                return [
                    { value: 'bottom-to-top', label: 'Abajo → Arriba', icon: <ArrowUp className="w-4 h-4" /> },
                    { value: 'top-to-bottom', label: 'Arriba → Abajo', icon: <ArrowDown className="w-4 h-4" /> }
                ];
            case 'circular':
                return [
                    { value: 'clockwise', label: 'Horario', icon: <RefreshCw className="w-4 h-4" /> },
                    { value: 'counterclockwise', label: 'Anti-horario', icon: <RefreshCw className="w-4 h-4 -scale-x-100" /> }
                ];
            default:
                return [];
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-ds-bg border border-ds-border rounded-lg p-4">
                <p className="text-sm text-ds-soft">
                    ℹ️ Personaliza la apariencia y comportamiento de la barra de progreso del timer.
                </p>
            </div>

            {/* Estructura Principal (Tipo, Orientación, Tamaño) */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <h3 className="text-sm font-bold text-ds-text mb-6 border-b border-ds-border pb-2">
                    📐 Estructura y Dimensiones
                </h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
                    {/* Columna Izquierda: Tipo y Orientación */}
                    <div className="space-y-6">
                        {/* Tipo de Barra */}
                        <div>
                            <label className="text-xs font-bold text-ds-soft block mb-2">Tipo de Barra</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: 'horizontal', label: 'Horizontal', icon: <Layout className="w-4 h-4 rotate-90" /> },
                                    { value: 'vertical', label: 'Vertical', icon: <Layout className="w-4 h-4" /> },
                                    { value: 'circular', label: 'Circular', icon: <Circle className="w-4 h-4" /> }
                                ].map((type) => (
                                    <button
                                        key={type.value}
                                        onClick={() => onProgressBarConfigChange({ 
                                            type: type.value as any,
                                            orientation: type.value === 'horizontal' ? 'left-to-right' : type.value === 'vertical' ? 'bottom-to-top' : 'clockwise',
                                            size: type.value === 'horizontal' ? { width: 900, height: 40 } : type.value === 'vertical' ? { width: 40, height: 260 } : { width: 260, height: 260 },
                                            position: type.value === 'horizontal' ? { x: 50, y: 150 } : type.value === 'vertical' ? { x: 50, y: 20 } : { x: 370, y: 20 }
                                        })}
                                        className={`flex flex-col items-center justify-center gap-1 p-3 rounded-lg text-xs font-bold transition-all border ${
                                            progressBarConfig.type === type.value
                                                ? 'bg-ds-accent text-ds-on-accent border-ds-accent'
                                                : 'bg-ds-surface text-ds-soft border-ds-border hover:border-ds-faint'
                                        }`}
                                    >
                                        {type.icon}
                                        <span>{type.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Orientación */}
                        <div>
                            <label className="text-xs font-bold text-ds-soft block mb-2">Dirección</label>
                            <div className="grid grid-cols-2 gap-2">
                                {getOrientationOptions().map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => onProgressBarConfigChange({ orientation: opt.value as any })}
                                        className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-xs font-bold transition-all border ${
                                            progressBarConfig.orientation === opt.value
                                                ? 'bg-ds-accent text-ds-on-accent border-ds-accent'
                                                : 'bg-ds-surface text-ds-soft border-ds-border hover:border-ds-faint'
                                        }`}
                                    >
                                        {opt.icon} {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Columna Derecha: Dimensiones y Posición */}
                    <div className="space-y-6">
                        <div>
                            <label className="text-xs font-bold text-ds-soft block mb-2">Dimensiones (Ancho x Alto)</label>
                            <div className="flex gap-2 items-center">
                                <div className="flex-1 relative">
                                    <input
                                        type="number"
                                        value={progressBarConfig.size.width}
                                        onChange={(e) => onProgressBarConfigChange({ size: { ...progressBarConfig.size, width: Number(e.target.value) } })}
                                        className="w-full pl-3 pr-8 py-2 border border-ds-border rounded-lg bg-ds-surface text-sm"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs text-ds-soft">W</span>
                                </div>
                                <span className="text-ds-soft">×</span>
                                <div className="flex-1 relative">
                                    <input
                                        type="number"
                                        value={progressBarConfig.size.height}
                                        onChange={(e) => onProgressBarConfigChange({ size: { ...progressBarConfig.size, height: Number(e.target.value) } })}
                                        className="w-full pl-3 pr-8 py-2 border border-ds-border rounded-lg bg-ds-surface text-sm"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs text-ds-soft">H</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-ds-soft block mb-2">Posición (X , Y)</label>
                            <div className="flex gap-2 items-center">
                                <div className="flex-1 relative">
                                    <input
                                        type="number"
                                        value={progressBarConfig.position.x}
                                        onChange={(e) => onProgressBarConfigChange({ position: { ...progressBarConfig.position, x: Number(e.target.value) } })}
                                        className="w-full pl-3 pr-8 py-2 border border-ds-border rounded-lg bg-ds-surface text-sm"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs text-ds-soft">X</span>
                                </div>
                                <span className="text-ds-soft">,</span>
                                <div className="flex-1 relative">
                                    <input
                                        type="number"
                                        value={progressBarConfig.position.y}
                                        onChange={(e) => onProgressBarConfigChange({ position: { ...progressBarConfig.position, y: Number(e.target.value) } })}
                                        className="w-full pl-3 pr-8 py-2 border border-ds-border rounded-lg bg-ds-surface text-sm"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs text-ds-soft">Y</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCIÓN ESTILO (Fondo y Relleno) */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <button
                    onClick={() => toggleSection('style')}
                    className="w-full flex items-center justify-between group"
                >
                    <h3 className="text-sm font-bold text-ds-text flex items-center gap-2">
                        <Palette className="w-4 h-4 text-ds-accent-text" /> Estilo Visual
                    </h3>
                    {expandedSections.style ? <ChevronUp className="w-4 h-4 text-ds-soft" /> : <ChevronDown className="w-4 h-4 text-ds-soft" />}
                </button>

                {expandedSections.style && (
                    <div className="mt-6 animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            
                            {/* Columna Izquierda: Fondo */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-ds-soft uppercase tracking-wide border-b border-ds-border pb-2">Fondo (Background)</h4>
                                
                                <div className="flex flex-wrap gap-2">
                                    {['color', 'gradient', 'image'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => onProgressBarConfigChange({ backgroundType: type as any })}
                                            className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${
                                                progressBarConfig.backgroundType === type
                                                    ? 'bg-ds-accent/10 text-ds-accent-text border-ds-accent '
                                                    : 'bg-transparent text-ds-soft border-transparent hover:bg-ds-surface '
                                            }`}
                                        >
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </button>
                                    ))}
                                </div>

                                {progressBarConfig.backgroundType === 'color' && (
                                    <div className="flex items-center gap-3 p-3 bg-ds-surface rounded-lg">
                                        <input
                                            type="color"
                                            value={progressBarConfig.backgroundColor}
                                            onChange={(e) => onProgressBarConfigChange({ backgroundColor: e.target.value })}
                                            className="w-8 h-8 rounded border border-ds-border cursor-pointer p-0"
                                        />
                                        <div className="flex-1">
                                            <span className="text-xs font-mono text-ds-soft block">HEX Color</span>
                                            <span className="text-sm font-bold text-ds-soft">{progressBarConfig.backgroundColor}</span>
                                        </div>
                                    </div>
                                )}
                                
                                {progressBarConfig.backgroundType === 'gradient' && (
                                    <div className="space-y-3 p-3 bg-ds-surface rounded-lg">
                                        <div className="flex items-center justify-between gap-2">
                                            <input type="color" value={progressBarConfig.backgroundGradient.color1} onChange={(e) => onProgressBarConfigChange({ backgroundGradient: { ...progressBarConfig.backgroundGradient, color1: e.target.value } })} className="w-8 h-8 rounded border cursor-pointer p-0" />
                                            <span className="text-ds-soft text-xs">→</span>
                                            <input type="color" value={progressBarConfig.backgroundGradient.color2} onChange={(e) => onProgressBarConfigChange({ backgroundGradient: { ...progressBarConfig.backgroundGradient, color2: e.target.value } })} className="w-8 h-8 rounded border cursor-pointer p-0" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-ds-soft block mb-1">Ángulo ({progressBarConfig.backgroundGradient.angle}°)</label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="360"
                                                value={progressBarConfig.backgroundGradient.angle}
                                                onChange={(e) => onProgressBarConfigChange({ backgroundGradient: { ...progressBarConfig.backgroundGradient, angle: Number(e.target.value) } })}
                                                className="w-full h-1.5 bg-ds-raised rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                )}

                                {(progressBarConfig.backgroundType === 'image' || progressBarConfig.backgroundType === 'gif') && (
                                    <MediaInputWithSelector
                                        value={progressBarConfig.backgroundImage}
                                        onChange={(value) => onProgressBarConfigChange({ backgroundImage: value })}
                                        label=""
                                        placeholder="URL de fondo..."
                                        allowedTypes={['image', 'gif']}
                                    />
                                )}
                            </div>

                            {/* Columna Derecha: Relleno */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-ds-soft uppercase tracking-wide border-b border-ds-border pb-2">Relleno (Fill)</h4>
                                
                                <div className="flex flex-wrap gap-2">
                                    {['color', 'gradient', 'image'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => onProgressBarConfigChange({ fillType: type as any })}
                                            className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${
                                                progressBarConfig.fillType === type
                                                    ? 'bg-ds-accent/10 text-ds-accent-text border-ds-accent '
                                                    : 'bg-transparent text-ds-soft border-transparent hover:bg-ds-surface '
                                            }`}
                                        >
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </button>
                                    ))}
                                </div>

                                {progressBarConfig.fillType === 'color' && (
                                    <div className="flex items-center gap-3 p-3 bg-ds-surface rounded-lg">
                                        <input
                                            type="color"
                                            value={progressBarConfig.fillColor}
                                            onChange={(e) => onProgressBarConfigChange({ fillColor: e.target.value })}
                                            className="w-8 h-8 rounded border border-ds-border cursor-pointer p-0"
                                        />
                                        <div className="flex-1">
                                            <span className="text-xs font-mono text-ds-soft block">HEX Color</span>
                                            <span className="text-sm font-bold text-ds-soft">{progressBarConfig.fillColor}</span>
                                        </div>
                                    </div>
                                )}

                                {progressBarConfig.fillType === 'gradient' && (
                                    <div className="space-y-3 p-3 bg-ds-surface rounded-lg">
                                        <div className="flex items-center justify-between gap-2">
                                            <input type="color" value={progressBarConfig.fillGradient.color1} onChange={(e) => onProgressBarConfigChange({ fillGradient: { ...progressBarConfig.fillGradient, color1: e.target.value } })} className="w-8 h-8 rounded border cursor-pointer p-0" />
                                            <span className="text-ds-soft text-xs">→</span>
                                            <input type="color" value={progressBarConfig.fillGradient.color2} onChange={(e) => onProgressBarConfigChange({ fillGradient: { ...progressBarConfig.fillGradient, color2: e.target.value } })} className="w-8 h-8 rounded border cursor-pointer p-0" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-ds-soft block mb-1">Ángulo ({progressBarConfig.fillGradient.angle}°)</label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="360"
                                                value={progressBarConfig.fillGradient.angle}
                                                onChange={(e) => onProgressBarConfigChange({ fillGradient: { ...progressBarConfig.fillGradient, angle: Number(e.target.value) } })}
                                                className="w-full h-1.5 bg-ds-raised rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                )}

                                {(progressBarConfig.fillType === 'image' || progressBarConfig.fillType === 'gif') && (
                                    <MediaInputWithSelector
                                        value={progressBarConfig.fillImage}
                                        onChange={(value) => onProgressBarConfigChange({ fillImage: value })}
                                        label=""
                                        placeholder="URL de relleno..."
                                        allowedTypes={['image', 'gif']}
                                    />
                                )}

                                {/* Animated Stripes Toggle */}
                                <div className="pt-2 border-t border-ds-border flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Film className="w-4 h-4 text-ds-accent-text" />
                                        <div>
                                            <p className="text-xs font-bold text-ds-text">Efecto Animado</p>
                                            <p className="text-[10px] text-ds-soft">Patrón de rayas en movimiento</p>
                                        </div>
                                    </div>
                                    <ToggleSwitch
                                        checked={progressBarConfig.animatedStripes || false}
                                        onChange={(checked) => onProgressBarConfigChange({ animatedStripes: checked })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* SECCIÓN INDICADOR */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => toggleSection('indicator')}
                        className="flex items-center gap-2 group"
                    >
                        <MousePointer2 className="w-4 h-4 text-ds-accent-text" />
                        <h3 className="text-sm font-bold text-ds-text">Indicador / Icono Seguidor</h3>
                        {expandedSections.indicator ? <ChevronUp className="w-4 h-4 text-ds-soft" /> : <ChevronDown className="w-4 h-4 text-ds-soft" />}
                    </button>
                    <ToggleSwitch
                        checked={progressBarConfig.indicatorEnabled}
                        onChange={(checked) => onProgressBarConfigChange({ indicatorEnabled: checked })}
                    />
                </div>

                {expandedSections.indicator && progressBarConfig.indicatorEnabled && (
                    <div className="mt-6 animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                {/* Tipo de Indicador Base */}
                                <div>
                                    <label className="text-xs font-bold text-ds-soft block mb-2">Forma Base</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['circle', 'image', 'gif'].map(type => (
                                            <button
                                                key={type}
                                                onClick={() => onProgressBarConfigChange({ indicatorType: type as any })}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                                                    progressBarConfig.indicatorType === type
                                                        ? 'bg-ds-accent/10 text-ds-accent-text border-ds-accent '
                                                        : 'bg-ds-surface text-ds-soft border-transparent'
                                                }`}
                                            >
                                                {type === 'circle' ? 'Círculo' : type === 'image' ? 'Imagen' : 'GIF'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {progressBarConfig.indicatorType === 'circle' ? (
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="color"
                                            value={progressBarConfig.indicatorColor}
                                            onChange={(e) => onProgressBarConfigChange({ indicatorColor: e.target.value })}
                                            className="w-10 h-10 rounded border border-ds-border cursor-pointer p-0"
                                        />
                                        <div className="flex-1">
                                            <span className="text-xs font-mono text-ds-soft block">Color</span>
                                            <span className="text-sm font-bold text-ds-soft">{progressBarConfig.indicatorColor}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <MediaInputWithSelector
                                        value={progressBarConfig.indicatorImage}
                                        onChange={(value) => onProgressBarConfigChange({ indicatorImage: value })}
                                        label=""
                                        placeholder="URL..."
                                        allowedTypes={['image', 'gif']}
                                    />
                                )}
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs font-bold text-ds-soft block mb-2">Tamaño ({progressBarConfig.indicatorSize}px)</label>
                                    <input
                                        type="range"
                                        min="10"
                                        max="100"
                                        value={progressBarConfig.indicatorSize}
                                        onChange={(e) => onProgressBarConfigChange({ indicatorSize: Number(e.target.value) })}
                                        className="w-full h-1.5 bg-ds-raised rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-3 bg-ds-surface rounded-lg">
                                    <label className="text-xs font-bold text-ds-soft">Rotar con Progreso</label>
                                    <ToggleSwitch
                                        checked={progressBarConfig.indicatorRotate}
                                        onChange={(checked) => onProgressBarConfigChange({ indicatorRotate: checked })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* SECCIÓN BORDES */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => toggleSection('border')}
                        className="flex items-center gap-2 group"
                    >
                        <Box className="w-4 h-4 text-ds-warn" />
                        <h3 className="text-sm font-bold text-ds-text">Bordes</h3>
                        {expandedSections.border ? <ChevronUp className="w-4 h-4 text-ds-soft" /> : <ChevronDown className="w-4 h-4 text-ds-soft" />}
                    </button>
                    <ToggleSwitch
                        checked={progressBarConfig.borderEnabled}
                        onChange={(checked) => onProgressBarConfigChange({ borderEnabled: checked })}
                    />
                </div>

                {expandedSections.border && progressBarConfig.borderEnabled && (
                    <div className="mt-6 animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={progressBarConfig.borderColor}
                                    onChange={(e) => onProgressBarConfigChange({ borderColor: e.target.value })}
                                    className="w-10 h-10 rounded border border-ds-border cursor-pointer p-0"
                                />
                                <div className="flex-1">
                                    <span className="text-xs font-mono text-ds-soft block">Color Borde</span>
                                    <span className="text-sm font-bold text-ds-soft">{progressBarConfig.borderColor}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-ds-soft block mb-1">Grosor ({progressBarConfig.borderWidth}px)</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="20"
                                        value={progressBarConfig.borderWidth}
                                        onChange={(e) => onProgressBarConfigChange({ borderWidth: Number(e.target.value) })}
                                        className="w-full h-1.5 bg-ds-raised rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-ds-soft block mb-1">Redondez ({progressBarConfig.borderRadius}px)</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="50"
                                        value={progressBarConfig.borderRadius}
                                        onChange={(e) => onProgressBarConfigChange({ borderRadius: Number(e.target.value) })}
                                        className="w-full h-1.5 bg-ds-raised rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgressBarTab;
