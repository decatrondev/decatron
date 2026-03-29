/**
 * Timer Extension - Theme Tab Component
 *
 * Configuración del fondo y apariencia general del contenedor.
 * ACTUALIZADO: Los presets ahora aplican estilos completos (texto, barra, fondo).
 */

import { Palette, Layout, Droplets, Zap } from 'lucide-react';
import { useState } from 'react';
import MediaInputWithSelector from '../../../../../components/timer/MediaInputWithSelector';
import type { ThemeConfig, StyleConfig, ProgressBarConfig } from '../../types';

interface ThemeTabProps {
    themeConfig: ThemeConfig;
    onThemeConfigChange: (updates: Partial<ThemeConfig>) => void;
    onApplyPreset?: (config: { 
        theme?: Partial<ThemeConfig>; 
        style?: Partial<StyleConfig>; 
        progressBar?: Partial<ProgressBarConfig>;
    }) => void;
}

// Definición completa de la "Receta" de cada tema
interface ThemePreset {
    id: string;
    name: string;
    previewColors: string[]; // Colores para mostrar en el botón (Fondo, Texto, Barra)
    data: {
        theme: Partial<ThemeConfig>;
        style: Partial<StyleConfig>;
        progressBar: Partial<ProgressBarConfig>;
    };
}

const PRESET_THEMES: ThemePreset[] = [
    {
        id: 'cyberpunk',
        name: 'Cyberpunk',
        previewColors: ['#000000', '#22d3ee', '#f472b6'], // Fondo Negro, Texto Cyan, Barra Rosa
        data: {
            theme: { containerBackground: '#000000', containerOpacity: 90, mode: 'dark' },
            style: { textColor: '#22d3ee', textShadow: 'glow' },
            progressBar: { 
                fillColor: '#f472b6', 
                backgroundColor: 'rgba(34, 211, 238, 0.2)', 
                fillType: 'gradient',
                fillGradient: { color1: '#f472b6', color2: '#a855f7', angle: 90 },
                indicatorColor: '#ffffff'
            }
        }
    },
    {
        id: 'minimal-dark',
        name: 'Minimal Dark',
        previewColors: ['#1a1a1a', '#ffffff', '#525252'], // Fondo Gris Oscuro, Texto Blanco, Barra Gris
        data: {
            theme: { containerBackground: '#1a1a1a', containerOpacity: 95, mode: 'dark' },
            style: { textColor: '#ffffff', textShadow: 'normal' },
            progressBar: { 
                fillColor: '#ffffff', 
                backgroundColor: 'rgba(255,255,255,0.1)', 
                fillType: 'color',
                indicatorColor: '#ffffff'
            }
        }
    },
    {
        id: 'clean-white',
        name: 'Clean White',
        previewColors: ['#ffffff', '#1e293b', '#3b82f6'], // Fondo Blanco, Texto Oscuro, Barra Azul
        data: {
            theme: { containerBackground: '#ffffff', containerOpacity: 95, mode: 'light' },
            style: { textColor: '#1e293b', textShadow: 'none' },
            progressBar: { 
                fillColor: '#3b82f6', 
                backgroundColor: 'rgba(0,0,0,0.1)', 
                fillType: 'color',
                indicatorColor: '#2563eb'
            }
        }
    },
    {
        id: 'nature',
        name: 'Nature',
        previewColors: ['#064e3b', '#ecfccb', '#4ade80'], // Fondo Bosque, Texto Lima, Barra Verde
        data: {
            theme: { containerBackground: '#064e3b', containerOpacity: 90, mode: 'dark' },
            style: { textColor: '#ecfccb', textShadow: 'normal' },
            progressBar: { 
                fillColor: '#4ade80', 
                backgroundColor: 'rgba(255,255,255,0.1)', 
                fillType: 'gradient',
                fillGradient: { color1: '#4ade80', color2: '#166534', angle: 45 },
                indicatorColor: '#dcfce7'
            }
        }
    },
    {
        id: 'sunset',
        name: 'Sunset',
        previewColors: ['#431407', '#ffedd5', '#fb923c'], // Fondo Café, Texto Crema, Barra Naranja
        data: {
            theme: { containerBackground: '#431407', containerOpacity: 90, mode: 'dark' },
            style: { textColor: '#ffedd5', textShadow: 'strong' },
            progressBar: { 
                fillColor: '#fb923c', 
                backgroundColor: 'rgba(255,255,255,0.1)', 
                fillType: 'gradient',
                fillGradient: { color1: '#fb923c', color2: '#be185d', angle: 90 },
                indicatorColor: '#fff7ed'
            }
        }
    }
];

export const ThemeTab: React.FC<ThemeTabProps> = ({
    themeConfig,
    onThemeConfigChange,
    onApplyPreset
}) => {
    // Determinar si está en modo transparente o color
    const isTransparent = themeConfig.mode === 'transparent';
    
    // Estado local para URL de imagen
    const isImageMode = themeConfig.containerBackground?.startsWith('url(');
    const [imageUrl, setImageUrl] = useState('');

    const handleImageUpdate = (url: string) => {
        setImageUrl(url);
        onThemeConfigChange({ containerBackground: `url('${url}')` });
    };

    const handleColorUpdate = (color: string) => {
        onThemeConfigChange({ containerBackground: color });
    };

    const handlePresetClick = (presetData: ThemePreset['data']) => {
        if (onApplyPreset) {
            // Enviamos el paquete completo al orquestador
            onApplyPreset(presetData);
        } else {
            // Fallback por seguridad: solo aplica el tema si la función padre no existe
            onThemeConfigChange(presetData.theme);
        }
    };

    return (
        <div className="space-y-6">
            {/* Info Card */}
            <div className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4">
                <div className="flex items-start gap-3">
                    <Palette className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8] mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-1">
                            Apariencia del Contenedor
                        </p>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                            Define el estilo visual completo. Los presets aplicarán colores al texto y la barra de progreso.
                        </p>
                    </div>
                </div>
            </div>

            {/* Presets Rápidos */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    Temas Completos (Fondo + Texto + Barra)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {PRESET_THEMES.map((theme) => (
                        <button
                            key={theme.id}
                            onClick={() => handlePresetClick(theme.data)}
                            className="group relative flex flex-col items-center gap-3 p-3 rounded-2xl border-2 border-transparent hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all transform hover:-translate-y-1"
                        >
                            {/* Visualización del Preset */}
                            <div className="w-full aspect-video rounded-xl shadow-md overflow-hidden flex ring-1 ring-black/5 dark:ring-white/10 relative" 
                                 style={{ backgroundColor: theme.previewColors[0] }}>
                                
                                {/* Simulación de Barra de Progreso */}
                                <div className="absolute bottom-2 left-2 right-2 h-2 rounded-full overflow-hidden bg-white/10">
                                    <div className="h-full w-2/3" style={{ backgroundColor: theme.previewColors[2] }}></div>
                                </div>
                                
                                {/* Simulación de Texto */}
                                <div className="absolute top-2 left-2 font-bold text-[10px]" style={{ color: theme.previewColors[1] }}>
                                    Aa
                                </div>
                            </div>
                            
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                {theme.name}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Configuración de Fondo */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-6 flex items-center gap-2">
                    <Layout className="w-4 h-4 text-blue-500" />
                    Ajuste Manual del Fondo
                </h3>

                <div className="space-y-6">
                    {/* Selector de Modo */}
                    <div className="flex bg-[#f1f5f9] dark:bg-[#0f172a] p-1 rounded-xl">
                        <button
                            onClick={() => onThemeConfigChange({ 
                                mode: 'transparent',
                                containerBackground: 'transparent',
                                containerOpacity: 0
                            })}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                isTransparent
                                    ? 'bg-white dark:bg-[#262626] text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                        >
                            <div className="w-3 h-3 rounded-full border border-current bg-transparent" />
                            Transparente
                        </button>
                        <button
                            onClick={() => onThemeConfigChange({ 
                                mode: 'light',
                                containerBackground: '#000000',
                                containerOpacity: 85
                            })}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                !isTransparent
                                    ? 'bg-white dark:bg-[#262626] text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                        >
                            <div className="w-3 h-3 rounded-full bg-current" />
                            Personalizado
                        </button>
                    </div>

                    {/* Controles Personalizados (Solo si no es transparente) */}
                    {!isTransparent && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
                            
                            {/* Tabs Color vs Imagen */}
                            <div className="flex p-1 bg-gray-100 dark:bg-[#202020] rounded-lg mb-4">
                                <button
                                    onClick={() => handleColorUpdate('#000000')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                                        !isImageMode 
                                            ? 'bg-white dark:bg-[#262626] text-blue-600 shadow-sm' 
                                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                    }`}
                                >
                                    Color Sólido
                                </button>
                                <button
                                    onClick={() => handleImageUpdate('')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                                        isImageMode 
                                            ? 'bg-white dark:bg-[#262626] text-blue-600 shadow-sm' 
                                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                    }`}
                                >
                                    Imagen / GIF
                                </button>
                            </div>

                            {isImageMode ? (
                                /* Controles de Imagen */
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                            Origen de la Imagen
                                        </label>
                                        <MediaInputWithSelector
                                            value={imageUrl || themeConfig.containerBackground.replace(/url\(['"]?|['"]?\)/g, '')}
                                            onChange={handleImageUpdate}
                                            label=""
                                            placeholder="Pega una URL o selecciona un archivo..."
                                            allowedTypes={['image', 'gif']}
                                        />
                                    </div>
                                    
                                    {/* Efectos de Imagen (Simulados en UI por ahora, idealmente en ThemeConfig) */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Blur (Desenfoque)</label>
                                            <input type="range" min="0" max="20" defaultValue="0" className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Oscurecer Fondo</label>
                                            <input type="range" min="0" max="100" defaultValue="0" className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                        </div>
                                    </div>

                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                        <Zap className="w-4 h-4" />
                                        <span>Tip: Usa GIFs animados para fondos dinámicos estilo cyberpunk.</span>
                                    </div>
                                </div>
                            ) : (
                                /* Controles de Color */
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        Color de Fondo
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                                            <input
                                                type="color"
                                                value={themeConfig.containerBackground.startsWith('url') ? '#000000' : themeConfig.containerBackground}
                                                onChange={(e) => onThemeConfigChange({ containerBackground: e.target.value })}
                                                className="absolute -top-2 -left-2 w-16 h-16 p-0 border-0 cursor-pointer"
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            value={themeConfig.containerBackground.startsWith('url') ? '#000000' : themeConfig.containerBackground}
                                            onChange={(e) => onThemeConfigChange({ containerBackground: e.target.value })}
                                            className="w-32 px-3 py-2 text-sm border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] font-mono uppercase"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Opacidad (Común) */}
                            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] flex items-center gap-2">
                                        <Droplets className="w-3 h-3" /> Opacidad / Transparencia
                                    </label>
                                    <span className="text-xs font-mono font-bold text-[#2563eb] dark:text-[#60a5fa]">
                                        {themeConfig.containerOpacity}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={themeConfig.containerOpacity}
                                    onChange={(e) => onThemeConfigChange({ containerOpacity: Number(e.target.value) })}
                                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ThemeTab;