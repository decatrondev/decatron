/**
 * Timer Extension - Animations Tab Component
 *
 * Configuración completa de animaciones: entrada, salida y Modo Crítico.
 * UPDATE:
 * - Fix: Volumen de previsualización sincronizado en tiempo real con el slider.
 * - Fix: Previsualización de playlist respeta el volumen global configurado.
 */

import { useState, useRef, useEffect } from 'react';
import { Play, Square, Volume2, AlertTriangle, Repeat, Plus, Trash2, Music } from 'lucide-react';
import MediaInputWithSelector from '../../../../../components/timer/MediaInputWithSelector';
import type { AnimationConfig } from '../../types';

interface AnimationsTabProps {
    animationConfig: AnimationConfig;
    onAnimationConfigChange: (updates: Partial<AnimationConfig>) => void;
}

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
    </label>
);

export const AnimationsTab: React.FC<AnimationsTabProps> = ({
    animationConfig,
    onAnimationConfigChange
}) => {
    // Estado local para el reproductor de audio de prueba
    const [playingIndex, setPlayingIndex] = useState<number | null>(null); // Index del audio sonando
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [audioError, setAudioError] = useState<string | null>(null);
    const [newAudioUrl, setNewAudioUrl] = useState(''); // Input temporal

    // Efecto para sincronizar volumen en tiempo real (mientras suena)
    useEffect(() => {
        if (audioRef.current) {
            const currentVol = (animationConfig.criticalMode?.soundVolume ?? 100) / 100;
            // Aseguramos rango 0-1
            audioRef.current.volume = Math.max(0, Math.min(1, currentVol));
        }
    }, [animationConfig.criticalMode?.soundVolume]);

    // Limpieza al desmontar
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    const handlePlaySound = (url: string, index: number) => {
        if (!url) return;

        // Inicializar ref si no existe
        if (!audioRef.current) {
            audioRef.current = new Audio();
        }

        const audio = audioRef.current;

        if (playingIndex === index) {
            // Stop current
            audio.pause();
            audio.currentTime = 0;
            setPlayingIndex(null);
        } else {
            // Play new
            audio.src = url;
            // Aplicar volumen actual
            const currentVol = (animationConfig.criticalMode?.soundVolume ?? 100) / 100;
            audio.volume = Math.max(0, Math.min(1, currentVol));
            
            // Las pruebas no deben loopear
            audio.loop = false;
            
            audio.play().catch(e => {
                console.error("Error playing sound:", e);
                setAudioError("Error al reproducir audio.");
            });
            
            // Auto-reset estado al terminar
            audio.onended = () => setPlayingIndex(null);
            
            setPlayingIndex(index);
            setAudioError(null);
        }
    };

    const validateAudioUrl = (url: string) => {
        if (!url) return null;
        // Validación laxa para permitir blobs y urls relativas, pero advertir extensiones raras
        const audioExtensions = /\.(mp3|wav|ogg|m4a|aac)$/i;
        // Si es una URL completa y tiene extensión, validamos. Si no, asumimos que puede ser válida (blob/relative).
        if (url.includes('.') && !url.startsWith('blob:') && !audioExtensions.test(url)) {
            // return "El archivo debe ser un audio válido (.mp3, .wav, .ogg)"; // Warning opcional
        }
        return null;
    };

    const updateCriticalMode = (updates: Partial<NonNullable<AnimationConfig['criticalMode']>>) => {
        const currentMode = animationConfig.criticalMode || {
            enabled: false,
            triggerTime: 60,
            triggerTimeUnit: 'seconds',
            effectType: 'pulse',
            effectSpeed: 'fast',
            soundEnabled: false,
            soundUrl: '',
            playlist: [],
            soundVolume: 100,
            loopAudio: true
        };
        
        onAnimationConfigChange({
            criticalMode: { ...currentMode, ...updates }
        });
    };

    const handleAddAudio = () => {
        const error = validateAudioUrl(newAudioUrl);
        if (error) {
            setAudioError(error);
            return;
        }
        if (!newAudioUrl.trim()) return;

        const currentPlaylist = animationConfig.criticalMode?.playlist || [];
        // Si la lista estaba vacía y había un soundUrl legacy, lo incluimos primero para no perderlo
        let newPlaylist = [...currentPlaylist];
        if (newPlaylist.length === 0 && animationConfig.criticalMode?.soundUrl && !newPlaylist.includes(animationConfig.criticalMode.soundUrl)) {
             newPlaylist.push(animationConfig.criticalMode.soundUrl);
        }

        updateCriticalMode({ 
            playlist: [...newPlaylist, newAudioUrl],
            soundUrl: newAudioUrl // Actualizamos también el legacy por compatibilidad
        });
        setNewAudioUrl('');
        setAudioError(null);
    };

    const removeAudio = (index: number) => {
        const currentPlaylist = animationConfig.criticalMode?.playlist || [];
        const newPlaylist = currentPlaylist.filter((_, i) => i !== index);
        
        // Actualizar legacy soundUrl al último disponible o vacío
        const nextLegacyUrl = newPlaylist.length > 0 ? newPlaylist[newPlaylist.length - 1] : '';
        
        updateCriticalMode({ 
            playlist: newPlaylist,
            soundUrl: nextLegacyUrl
        });

        // Si estamos reproduciendo el que borramos, parar
        if (playingIndex === index) {
            if (audioRef.current) audioRef.current.pause();
            setPlayingIndex(null);
        }
    };

    // Asegurar que la playlist esté sincronizada con soundUrl si es la primera vez
    const playlist = animationConfig.criticalMode?.playlist && animationConfig.criticalMode.playlist.length > 0
        ? animationConfig.criticalMode.playlist
        : (animationConfig.criticalMode?.soundUrl ? [animationConfig.criticalMode.soundUrl] : []);

    return (
        <div className="space-y-6">
            {/* Elemento de audio invisible para pruebas */}
            <audio ref={audioRef} />

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                    ℹ️ Configura las animaciones de entrada, salida y el Modo Crítico para momentos de alta tensión.
                </p>
            </div>

            {/* Animación de Entrada */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">🎬 Animación de Entrada</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Tipo</label>
                        <select
                            value={animationConfig.entranceType}
                            onChange={(e) => onAnimationConfigChange({ entranceType: e.target.value as AnimationConfig['entranceType'] })}
                            className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                        >
                            <option value="none">🚫 Ninguna</option>
                            <option value="fade">🌫️ Fundido</option>
                            <option value="slide">➡️ Deslizar</option>
                            <option value="bounce">⚡ Rebotar</option>
                            <option value="zoom">🔍 Zoom</option>
                            <option value="rotate">🔄 Rotar</option>
                        </select>
                    </div>

                    {animationConfig.entranceType !== 'none' && (
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Velocidad</label>
                            <select
                                value={animationConfig.entranceSpeed}
                                onChange={(e) => onAnimationConfigChange({ entranceSpeed: e.target.value as AnimationConfig['entranceSpeed'] })}
                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                            >
                                <option value="slow">🐢 Lenta</option>
                                <option value="normal">🚶 Normal</option>
                                <option value="fast">🏃 Rápida</option>
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Animación de Salida */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">🎭 Animación de Salida</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Tipo</label>
                        <select
                            value={animationConfig.exitType}
                            onChange={(e) => onAnimationConfigChange({ exitType: e.target.value as AnimationConfig['exitType'] })}
                            className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                        >
                            <option value="none">🚫 Ninguna</option>
                            <option value="fade">🌫️ Fundido</option>
                            <option value="slide">➡️ Deslizar</option>
                            <option value="bounce">⚡ Rebotar</option>
                            <option value="zoom">🔍 Zoom</option>
                            <option value="rotate">🔄 Rotar</option>
                        </select>
                    </div>

                    {animationConfig.exitType !== 'none' && (
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Velocidad</label>
                            <select
                                value={animationConfig.exitSpeed}
                                onChange={(e) => onAnimationConfigChange({ exitSpeed: e.target.value as AnimationConfig['exitSpeed'] })}
                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                            >
                                <option value="slow">🐢 Lenta</option>
                                <option value="normal">🚶 Normal</option>
                                <option value="fast">🏃 Rápida</option>
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Efectos de Tiempo Añadido (+Tiempo) */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                        ✨ Efectos de Tiempo Añadido
                    </h3>
                    <ToggleSwitch
                        checked={animationConfig.donationEffect?.enabled ?? true}
                        onChange={(checked) => onAnimationConfigChange({ donationEffect: { ...animationConfig.donationEffect, enabled: checked } as any })}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Configuración */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Animación</label>
                            <select
                                value={animationConfig.donationEffect?.type || 'float-up'}
                                onChange={(e) => onAnimationConfigChange({ donationEffect: { ...animationConfig.donationEffect, type: e.target.value as any } as any })}
                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                            >
                                <option value="float-up">⬆️ Flotar Arriba (Clásico)</option>
                                <option value="pop">💥 Pop / Explosión</option>
                                <option value="shake">📳 Sacudida</option>
                                <option value="glow">✨ Brillo Intenso</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Color del Texto</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onAnimationConfigChange({ donationEffect: { ...animationConfig.donationEffect, color: 'auto' } as any })}
                                    className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg border transition-colors ${
                                        (animationConfig.donationEffect?.color || 'auto') === 'auto'
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-600'
                                            : 'bg-white dark:bg-[#262626] border-[#e2e8f0] dark:border-[#374151] text-gray-500'
                                    }`}
                                >
                                    🎨 Auto (Según Evento)
                                </button>
                                <div className="relative w-10 h-9 rounded border border-gray-300 dark:border-[#374151] overflow-hidden">
                                    <input
                                        type="color"
                                        value={(animationConfig.donationEffect?.color === 'auto' ? '#22c55e' : animationConfig.donationEffect?.color) || '#22c55e'}
                                        onChange={(e) => onAnimationConfigChange({ donationEffect: { ...animationConfig.donationEffect, color: e.target.value } as any })}
                                        className="absolute -top-2 -left-2 w-16 h-16 p-0 border-0 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preview Box */}
                    <div className="bg-[#0f172a] rounded-xl border border-[#334155] p-4 flex flex-col items-center justify-center relative overflow-hidden h-40">
                        <div className="absolute inset-0 opacity-20 bg-[url('https://upload.wikimedia.org/wikipedia/commons/5/5d/Checker-16x16.png')]"></div>
                        
                        {/* Elemento de Ejemplo (Timer Estático) */}
                        <div className="text-2xl font-mono font-bold text-white mb-2 z-10">01:30:00</div>
                        
                        {/* Botón de Prueba */}
                        <button
                            onClick={() => {
                                const el = document.getElementById('preview-anim-text');
                                if (el) {
                                    el.style.animation = 'none';
                                    el.offsetHeight; /* trigger reflow */
                                    
                                    const type = animationConfig.donationEffect?.type || 'float-up';
                                    let animName = 'floatUp';
                                    if (type === 'pop') animName = 'popIn';
                                    if (type === 'shake') animName = 'shake';
                                    if (type === 'glow') animName = 'glowPulse';
                                    
                                    el.style.animation = `${animName} 1.5s ease-out forwards`;
                                    el.style.opacity = '1';
                                }
                            }}
                            className="z-20 px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded-full backdrop-blur-sm transition-colors border border-white/20 flex items-center gap-1"
                        >
                            <Play className="w-3 h-3" /> Probar Efecto
                        </button>

                        {/* Elemento Animado (+5m) */}
                        <div 
                            id="preview-anim-text"
                            className="absolute z-10 font-bold text-2xl opacity-0"
                            style={{ 
                                top: '30%', 
                                color: (animationConfig.donationEffect?.color === 'auto' || !animationConfig.donationEffect?.color) ? '#4ade80' : animationConfig.donationEffect.color,
                                textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                            }}
                        >
                            +5m
                        </div>

                        {/* Estilos CSS Inline para Preview */}
                        <style>{`
                            @keyframes floatUp {
                                0% { transform: translateY(0) scale(0.8); opacity: 0; }
                                20% { transform: translateY(-10px) scale(1.1); opacity: 1; }
                                100% { transform: translateY(-40px) scale(1); opacity: 0; }
                            }
                            @keyframes popIn {
                                0% { transform: scale(0); opacity: 0; }
                                50% { transform: scale(1.5); opacity: 1; }
                                100% { transform: scale(1); opacity: 0; }
                            }
                            @keyframes glowPulse {
                                0% { filter: drop-shadow(0 0 0px white); opacity: 0; transform: scale(0.9); }
                                20% { filter: drop-shadow(0 0 10px white); opacity: 1; transform: scale(1.1); }
                                100% { filter: drop-shadow(0 0 0px white); opacity: 0; transform: scale(1); }
                            }
                        `}</style>
                    </div>
                </div>
            </div>

            {/* 🔥 MODO CRÍTICO (NUEVO) */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border-2 border-red-100 dark:border-red-900/30 p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-bl-full pointer-events-none"></div>
                
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <div>
                        <h3 className="text-lg font-black text-red-600 dark:text-red-400 flex items-center gap-2">
                            🔥 Modo Crítico
                        </h3>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                            Efectos de alta tensión cuando se acaba el tiempo.
                        </p>
                    </div>
                    <ToggleSwitch
                        checked={animationConfig.criticalMode?.enabled ?? false}
                        onChange={(checked) => updateCriticalMode({ enabled: checked })}
                    />
                </div>

                {(animationConfig.criticalMode?.enabled) && (
                    <div className="space-y-6 animate-fade-in-down">
                        {/* Trigger */}
                        <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                            <label className="text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wider block mb-2">
                                ¿Cuándo activar?
                            </label>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-[#64748b] dark:text-[#94a3b8]">Cuando falten</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={animationConfig.criticalMode.triggerTime}
                                        onChange={(e) => updateCriticalMode({ triggerTime: Math.max(1, Number(e.target.value)) })}
                                        className="w-24 px-3 py-2 text-center font-bold text-lg border-2 border-red-200 dark:border-red-800 rounded-lg bg-white dark:bg-[#1a1a1a] text-red-600 focus:outline-none focus:border-red-500"
                                        min="1"
                                    />
                                    <select
                                        value={animationConfig.criticalMode.triggerTimeUnit || 'seconds'}
                                        onChange={(e) => updateCriticalMode({ triggerTimeUnit: e.target.value as any })}
                                        className="px-3 py-2 border-2 border-red-200 dark:border-red-800 rounded-lg bg-white dark:bg-[#1a1a1a] text-[#1e293b] dark:text-[#f8fafc] font-bold focus:outline-none focus:border-red-500"
                                    >
                                        <option value="seconds">Segundos</option>
                                        <option value="minutes">Minutos</option>
                                        <option value="hours">Horas</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Efecto Visual */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                    👁️ Efecto Visual
                                </h4>
                                <div>
                                    <label className="text-xs text-[#64748b] dark:text-[#94a3b8] block mb-2">Tipo de Animación</label>
                                    <select
                                        value={animationConfig.criticalMode.effectType}
                                        onChange={(e) => updateCriticalMode({ effectType: e.target.value as any })}
                                        className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                    >
                                        <option value="pulse">💓 Latido Rápido</option>
                                        <option value="shake">📳 Terremoto</option>
                                        <option value="flash">🚨 Parpadeo Rojo</option>
                                        <option value="none">🚫 Sin efecto visual</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-[#64748b] dark:text-[#94a3b8] block mb-2">Intensidad</label>
                                    <select
                                        value={animationConfig.criticalMode.effectSpeed}
                                        onChange={(e) => updateCriticalMode({ effectSpeed: e.target.value as any })}
                                        className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                    >
                                        <option value="slow">🐢 Moderada</option>
                                        <option value="normal">🚶 Intensa</option>
                                        <option value="fast">🏃 Extrema (Pánico)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Efecto de Audio */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                        🔊 Audio de Tensión
                                    </h4>
                                    <ToggleSwitch
                                        checked={animationConfig.criticalMode.soundEnabled}
                                        onChange={(checked) => updateCriticalMode({ soundEnabled: checked })}
                                    />
                                </div>

                                {animationConfig.criticalMode.soundEnabled && (
                                    <div className="space-y-4 p-4 bg-gray-50 dark:bg-[#262626] rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                                        {/* Playlist Management */}
                                        <div className="space-y-3">
                                            <div className="flex gap-2 items-end">
                                                <div className="flex-1">
                                                    <MediaInputWithSelector
                                                        value={newAudioUrl}
                                                        onChange={(val) => { setNewAudioUrl(val); setAudioError(null); }}
                                                        label="Añadir Audio a la Lista"
                                                        placeholder="URL o selecciona de galería..."
                                                        allowedTypes={['audio']}
                                                    />
                                                </div>
                                                <button
                                                    onClick={handleAddAudio}
                                                    className="mb-[1px] h-[42px] px-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center shadow-sm"
                                                    title="Añadir a playlist"
                                                >
                                                    <Plus className="w-5 h-5" />
                                                </button>
                                            </div>
                                            {audioError && (
                                                <p className="text-[10px] text-red-500 flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" /> {audioError}
                                                </p>
                                            )}

                                            {/* Playlist Items */}
                                            <div className="max-h-32 overflow-y-auto space-y-2">
                                                {playlist.map((url, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg group">
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <Music className="w-3 h-3 text-[#64748b] flex-shrink-0" />
                                                            <span className="text-xs text-[#64748b] dark:text-[#94a3b8] truncate" title={url}>
                                                                {url.split('/').pop()}
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => handlePlaySound(url, idx)}
                                                                className={`p-1.5 rounded transition-colors ${playingIndex === idx ? 'bg-red-500 text-white' : 'text-[#64748b] hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                                                title={playingIndex === idx ? 'Detener' : 'Probar'}
                                                            >
                                                                {playingIndex === idx ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                                                            </button>
                                                            <button
                                                                onClick={() => removeAudio(idx)}
                                                                className="p-1.5 text-[#64748b] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {playlist.length === 0 && (
                                                    <p className="text-xs text-center text-gray-400 py-2 italic">Sin audios en la lista</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="pt-3 border-t border-[#e2e8f0] dark:border-[#374151]">
                                            <div className="flex items-center justify-between mb-3">
                                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8] flex items-center gap-1 cursor-pointer">
                                                    <input 
                                                        type="checkbox"
                                                        checked={animationConfig.criticalMode.loopAudio !== false}
                                                        onChange={(e) => updateCriticalMode({ loopAudio: e.target.checked })}
                                                        className="w-3 h-3 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                    />
                                                    <Repeat className="w-3 h-3" /> Bucle (reproducir aleatorio al terminar)
                                                </label>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Volume2 className="w-3 h-3 text-[#64748b]" />
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={animationConfig.criticalMode.soundVolume}
                                                    onChange={(e) => updateCriticalMode({ soundVolume: Number(e.target.value) })}
                                                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-red-500"
                                                />
                                                <span className="text-xs font-bold text-[#1e293b] dark:text-[#f8fafc] w-8 text-right">
                                                    {animationConfig.criticalMode.soundVolume}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnimationsTab;
