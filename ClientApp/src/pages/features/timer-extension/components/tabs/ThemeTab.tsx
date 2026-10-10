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
            <div className="bg-ds-bg border border-ds-border rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <Palette className="w-5 h-5 text-ds-soft mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-ds-text mb-1">
                            Apariencia del Contenedor
                        </p>
                        <p className="text-xs text-ds-soft">
                            Define el estilo visual completo. Los presets aplicarán colores al texto y la barra de progreso.
                        </p>
                    </div>
                </div>
            </div>

            {/* Presets Rápidos */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <h3 className="text-sm font-bold text-ds-text mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-ds-warn" />
                    Temas Completos (Fondo + Texto + Barra)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {PRESET_THEMES.map((theme) => (
                        <button
                            key={theme.id}
                            onClick={() => handlePresetClick(theme.data)}
                            className="group relative flex flex-col items-center gap-3 p-3 rounded-lg border-2 border-transparent hover:border-ds-accent hover:bg-ds-accent/10 transition-all transform hover:-translate-y-1"
                        >
                            {/* Visualización del Preset */}
                            <div className="w-full aspect-video rounded-lg overflow-hidden flex ring-1 ring-ds-border/5 relative" 
                                 style={{ backgroundColor: theme.previewColors[0] }}>
                                
                                {/* Simulación de Barra de Progreso */}
                                <div className="absolute bottom-2 left-2 right-2 h-2 rounded-full overflow-hidden bg-ds-surface/10">
                                    <div className="h-full w-2/3" style={{ backgroundColor: theme.previewColors[2] }}></div>
                                </div>
                                
                                {/* Simulación de Texto */}
                                <div className="absolute top-2 left-2 font-bold text-[10px]" style={{ color: theme.previewColors[1] }}>
                                    Aa
                                </div>
                            </div>
                            
                            <span className="text-xs font-bold text-ds-soft group-hover:text-ds-accent-text">
                                {theme.name}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Configuración de Fondo */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <h3 className="text-sm font-bold text-ds-text mb-6 flex items-center gap-2">
                    <Layout className="w-4 h-4 text-ds-accent-text" />
                    Ajuste Manual del Fondo
                </h3>

                <div className="space-y-6">
                    {/* Selector de Modo */}
                    <div className="flex bg-ds-raised p-1 rounded-lg">
                        <button
                            onClick={() => onThemeConfigChange({ 
                                mode: 'transparent',
                                containerBackground: 'transparent',
                                containerOpacity: 0
                            })}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                isTransparent
                                    ? 'bg-ds-surface text-ds-accent-text '
                                    : 'text-ds-soft hover:text-ds-soft '
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
                                    ? 'bg-ds-surface text-ds-accent-text '
                                    : 'text-ds-soft hover:text-ds-soft '
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
                            <div className="flex p-1 bg-ds-bg rounded-lg mb-4">
                                <button
                                    onClick={() => handleColorUpdate('#000000')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                                        !isImageMode 
                                            ? 'bg-ds-surface text-ds-accent-text ' 
                                            : 'text-ds-soft hover:text-ds-soft '
                                    }`}
                                >
                                    Color Sólido
                                </button>
                                <button
                                    onClick={() => handleImageUpdate('')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                                        isImageMode 
                                            ? 'bg-ds-surface text-ds-accent-text ' 
                                            : 'text-ds-soft hover:text-ds-soft '
                                    }`}
                                >
                                    Imagen / GIF
                                </button>
                            </div>

                            {isImageMode ? (
                                /* Controles de Imagen */
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-ds-soft block mb-2">
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
                                            <label className="text-xs font-bold text-ds-soft block mb-2">Blur (Desenfoque)</label>
                                            <input type="range" min="0" max="20" defaultValue="0" className="w-full h-2 bg-ds-raised rounded-lg appearance-none cursor-pointer accent-ds-accent" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-ds-soft block mb-2">Oscurecer Fondo</label>
                                            <input type="range" min="0" max="100" defaultValue="0" className="w-full h-2 bg-ds-raised rounded-lg appearance-none cursor-pointer accent-ds-accent" />
                                        </div>
                                    </div>

                                    <div className="p-3 bg-ds-accent/10 rounded-lg text-xs text-ds-accent-text flex items-center gap-2">
                                        <Zap className="w-4 h-4" />
                                        <span>Tip: Usa GIFs animados para fondos dinámicos estilo cyberpunk.</span>
                                    </div>
                                </div>
                            ) : (
                                /* Controles de Color */
                                <div>
                                    <label className="text-xs font-bold text-ds-soft block mb-2">
                                        Color de Fondo
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-ds-border cursor-pointer hover:scale-105 transition-transform">
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
                                            className="w-32 px-3 py-2 text-sm border border-ds-border rounded-lg bg-ds-surface text-ds-text font-mono uppercase"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Opacidad (Común) */}
                            <div className="pt-4 border-t border-ds-border">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-ds-soft flex items-center gap-2">
                                        <Droplets className="w-3 h-3" /> Opacidad / Transparencia
                                    </label>
                                    <span className="text-xs font-mono font-bold text-ds-accent-text">
                                        {themeConfig.containerOpacity}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={themeConfig.containerOpacity}
                                    onChange={(e) => onThemeConfigChange({ containerOpacity: Number(e.target.value) })}
                                    className="w-full h-2 bg-ds-raised rounded-lg appearance-none cursor-pointer accent-ds-accent"
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