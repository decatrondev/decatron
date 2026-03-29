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
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#94a3b8] dark:peer-focus:ring-[#64748b] rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#64748b]"></div>
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
            <div className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4">
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                    ℹ️ Personaliza la apariencia y comportamiento de la barra de progreso del timer.
                </p>
            </div>

            {/* Estructura Principal (Tipo, Orientación, Tamaño) */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-6 border-b border-gray-100 dark:border-gray-800 pb-2">
                    📐 Estructura y Dimensiones
                </h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
                    {/* Columna Izquierda: Tipo y Orientación */}
                    <div className="space-y-6">
                        {/* Tipo de Barra */}
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Tipo de Barra</label>
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
                                                ? 'bg-[#64748b] text-white border-[#64748b]'
                                                : 'bg-white dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#374151] hover:border-[#94a3b8]'
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
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Dirección</label>
                            <div className="grid grid-cols-2 gap-2">
                                {getOrientationOptions().map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => onProgressBarConfigChange({ orientation: opt.value as any })}
                                        className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-xs font-bold transition-all border ${
                                            progressBarConfig.orientation === opt.value
                                                ? 'bg-[#64748b] text-white border-[#64748b]'
                                                : 'bg-white dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#374151] hover:border-[#94a3b8]'
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
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Dimensiones (Ancho x Alto)</label>
                            <div className="flex gap-2 items-center">
                                <div className="flex-1 relative">
                                    <input
                                        type="number"
                                        value={progressBarConfig.size.width}
                                        onChange={(e) => onProgressBarConfigChange({ size: { ...progressBarConfig.size, width: Number(e.target.value) } })}
                                        className="w-full pl-3 pr-8 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-sm"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs text-gray-400">W</span>
                                </div>
                                <span className="text-gray-400">×</span>
                                <div className="flex-1 relative">
                                    <input
                                        type="number"
                                        value={progressBarConfig.size.height}
                                        onChange={(e) => onProgressBarConfigChange({ size: { ...progressBarConfig.size, height: Number(e.target.value) } })}
                                        className="w-full pl-3 pr-8 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-sm"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs text-gray-400">H</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Posición (X , Y)</label>
                            <div className="flex gap-2 items-center">
                                <div className="flex-1 relative">
                                    <input
                                        type="number"
                                        value={progressBarConfig.position.x}
                                        onChange={(e) => onProgressBarConfigChange({ position: { ...progressBarConfig.position, x: Number(e.target.value) } })}
                                        className="w-full pl-3 pr-8 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-sm"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs text-gray-400">X</span>
                                </div>
                                <span className="text-gray-400">,</span>
                                <div className="flex-1 relative">
                                    <input
                                        type="number"
                                        value={progressBarConfig.position.y}
                                        onChange={(e) => onProgressBarConfigChange({ position: { ...progressBarConfig.position, y: Number(e.target.value) } })}
                                        className="w-full pl-3 pr-8 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-sm"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs text-gray-400">Y</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCIÓN ESTILO (Fondo y Relleno) */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <button
                    onClick={() => toggleSection('style')}
                    className="w-full flex items-center justify-between group"
                >
                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                        <Palette className="w-4 h-4 text-blue-500" /> Estilo Visual
                    </h3>
                    {expandedSections.style ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {expandedSections.style && (
                    <div className="mt-6 animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            
                            {/* Columna Izquierda: Fondo */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 dark:border-gray-800 pb-2">Fondo (Background)</h4>
                                
                                <div className="flex flex-wrap gap-2">
                                    {['color', 'gradient', 'image'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => onProgressBarConfigChange({ backgroundType: type as any })}
                                            className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${
                                                progressBarConfig.backgroundType === type
                                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 border-blue-200 dark:border-blue-800'
                                                    : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-50 dark:hover:bg-[#262626]'
                                            }`}
                                        >
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </button>
                                    ))}
                                </div>

                                {progressBarConfig.backgroundType === 'color' && (
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#262626] rounded-lg">
                                        <input
                                            type="color"
                                            value={progressBarConfig.backgroundColor}
                                            onChange={(e) => onProgressBarConfigChange({ backgroundColor: e.target.value })}
                                            className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0"
                                        />
                                        <div className="flex-1">
                                            <span className="text-xs font-mono text-gray-500 block">HEX Color</span>
                                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{progressBarConfig.backgroundColor}</span>
                                        </div>
                                    </div>
                                )}
                                
                                {progressBarConfig.backgroundType === 'gradient' && (
                                    <div className="space-y-3 p-3 bg-gray-50 dark:bg-[#262626] rounded-lg">
                                        <div className="flex items-center justify-between gap-2">
                                            <input type="color" value={progressBarConfig.backgroundGradient.color1} onChange={(e) => onProgressBarConfigChange({ backgroundGradient: { ...progressBarConfig.backgroundGradient, color1: e.target.value } })} className="w-8 h-8 rounded border cursor-pointer p-0" />
                                            <span className="text-gray-400 text-xs">→</span>
                                            <input type="color" value={progressBarConfig.backgroundGradient.color2} onChange={(e) => onProgressBarConfigChange({ backgroundGradient: { ...progressBarConfig.backgroundGradient, color2: e.target.value } })} className="w-8 h-8 rounded border cursor-pointer p-0" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 block mb-1">Ángulo ({progressBarConfig.backgroundGradient.angle}°)</label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="360"
                                                value={progressBarConfig.backgroundGradient.angle}
                                                onChange={(e) => onProgressBarConfigChange({ backgroundGradient: { ...progressBarConfig.backgroundGradient, angle: Number(e.target.value) } })}
                                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
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
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 dark:border-gray-800 pb-2">Relleno (Fill)</h4>
                                
                                <div className="flex flex-wrap gap-2">
                                    {['color', 'gradient', 'image'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => onProgressBarConfigChange({ fillType: type as any })}
                                            className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${
                                                progressBarConfig.fillType === type
                                                    ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 border-purple-200 dark:border-purple-800'
                                                    : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-50 dark:hover:bg-[#262626]'
                                            }`}
                                        >
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </button>
                                    ))}
                                </div>

                                {progressBarConfig.fillType === 'color' && (
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#262626] rounded-lg">
                                        <input
                                            type="color"
                                            value={progressBarConfig.fillColor}
                                            onChange={(e) => onProgressBarConfigChange({ fillColor: e.target.value })}
                                            className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0"
                                        />
                                        <div className="flex-1">
                                            <span className="text-xs font-mono text-gray-500 block">HEX Color</span>
                                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{progressBarConfig.fillColor}</span>
                                        </div>
                                    </div>
                                )}

                                {progressBarConfig.fillType === 'gradient' && (
                                    <div className="space-y-3 p-3 bg-gray-50 dark:bg-[#262626] rounded-lg">
                                        <div className="flex items-center justify-between gap-2">
                                            <input type="color" value={progressBarConfig.fillGradient.color1} onChange={(e) => onProgressBarConfigChange({ fillGradient: { ...progressBarConfig.fillGradient, color1: e.target.value } })} className="w-8 h-8 rounded border cursor-pointer p-0" />
                                            <span className="text-gray-400 text-xs">→</span>
                                            <input type="color" value={progressBarConfig.fillGradient.color2} onChange={(e) => onProgressBarConfigChange({ fillGradient: { ...progressBarConfig.fillGradient, color2: e.target.value } })} className="w-8 h-8 rounded border cursor-pointer p-0" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 block mb-1">Ángulo ({progressBarConfig.fillGradient.angle}°)</label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="360"
                                                value={progressBarConfig.fillGradient.angle}
                                                onChange={(e) => onProgressBarConfigChange({ fillGradient: { ...progressBarConfig.fillGradient, angle: Number(e.target.value) } })}
                                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
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
                                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Film className="w-4 h-4 text-purple-500" />
                                        <div>
                                            <p className="text-xs font-bold text-[#1e293b] dark:text-[#f8fafc]">Efecto Animado</p>
                                            <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">Patrón de rayas en movimiento</p>
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
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => toggleSection('indicator')}
                        className="flex items-center gap-2 group"
                    >
                        <MousePointer2 className="w-4 h-4 text-purple-500" />
                        <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">Indicador / Icono Seguidor</h3>
                        {expandedSections.indicator ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
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
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Forma Base</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['circle', 'image', 'gif'].map(type => (
                                            <button
                                                key={type}
                                                onClick={() => onProgressBarConfigChange({ indicatorType: type as any })}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                                                    progressBarConfig.indicatorType === type
                                                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 border-purple-200 dark:border-purple-800'
                                                        : 'bg-gray-50 dark:bg-[#262626] text-gray-500 border-transparent'
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
                                            className="w-10 h-10 rounded border border-gray-300 cursor-pointer p-0"
                                        />
                                        <div className="flex-1">
                                            <span className="text-xs font-mono text-gray-500 block">Color</span>
                                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{progressBarConfig.indicatorColor}</span>
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
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Tamaño ({progressBarConfig.indicatorSize}px)</label>
                                    <input
                                        type="range"
                                        min="10"
                                        max="100"
                                        value={progressBarConfig.indicatorSize}
                                        onChange={(e) => onProgressBarConfigChange({ indicatorSize: Number(e.target.value) })}
                                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#262626] rounded-lg">
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Rotar con Progreso</label>
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
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => toggleSection('border')}
                        className="flex items-center gap-2 group"
                    >
                        <Box className="w-4 h-4 text-orange-500" />
                        <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">Bordes</h3>
                        {expandedSections.border ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
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
                                    className="w-10 h-10 rounded border border-gray-300 cursor-pointer p-0"
                                />
                                <div className="flex-1">
                                    <span className="text-xs font-mono text-gray-500 block">Color Borde</span>
                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{progressBarConfig.borderColor}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-1">Grosor ({progressBarConfig.borderWidth}px)</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="20"
                                        value={progressBarConfig.borderWidth}
                                        onChange={(e) => onProgressBarConfigChange({ borderWidth: Number(e.target.value) })}
                                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-1">Redondez ({progressBarConfig.borderRadius}px)</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="50"
                                        value={progressBarConfig.borderRadius}
                                        onChange={(e) => onProgressBarConfigChange({ borderRadius: Number(e.target.value) })}
                                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
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
