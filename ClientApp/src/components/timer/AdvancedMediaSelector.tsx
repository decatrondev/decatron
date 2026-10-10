/**
 * Advanced Media Selector Component
 *
 * Permite seleccionar y combinar diferentes tipos de media:
 * - Video: opcionalmente mutear y agregar audio separado
 * - Audio: complementar con imagen de fondo
 * - Imagen: complementar con audio
 */

import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Image as ImageIcon, Music, Film, Info } from 'lucide-react';
import MediaInputWithSelector from './MediaInputWithSelector';

export interface AdvancedMediaConfig {
    // Archivo principal
    primaryUrl: string;
    primaryType: 'video' | 'audio' | 'image' | 'none';
    primaryVolume?: number;

    // Configuración de video
    muteVideo?: boolean;

    // Audio complementario
    hasAudio?: boolean;
    audioUrl?: string;
    audioVolume?: number;

    // Imagen complementaria
    hasImage?: boolean;
    imageUrl?: string;
}

interface AdvancedMediaSelectorProps {
    value: AdvancedMediaConfig;
    onChange: (value: AdvancedMediaConfig) => void;
    label?: string;
    className?: string;
}

export default function AdvancedMediaSelector({
    value,
    onChange,
    label = 'Multimedia',
    className = ''
}: AdvancedMediaSelectorProps) {
    const [primaryType, setPrimaryType] = useState<'video' | 'audio' | 'image' | 'none'>(value.primaryType || 'none');

    // Detectar tipo de archivo desde URL
    const detectFileType = (url: string): 'video' | 'audio' | 'image' | 'none' => {
        if (!url) return 'none';
        const lowerUrl = url.toLowerCase();

        if (lowerUrl.match(/\.(mp4|webm|mov|avi|mkv)$/)) return 'video';
        if (lowerUrl.match(/\.(mp3|wav|ogg|m4a|aac)$/)) return 'audio';
        if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'image';

        return 'none';
    };

    // Actualizar tipo cuando cambia el archivo principal
    useEffect(() => {
        if (value.primaryUrl) {
            const detectedType = detectFileType(value.primaryUrl);
            if (detectedType !== 'none' && detectedType !== primaryType) {
                setPrimaryType(detectedType);
                onChange({ ...value, primaryType: detectedType });
            }
        }
    }, [value.primaryUrl]);

    const handlePrimaryChange = (url: string) => {
        const newType = detectFileType(url);
        const newValue: AdvancedMediaConfig = {
            ...value,
            primaryUrl: url,
            primaryType: newType,
            primaryVolume: value.primaryVolume ?? 100
        };

        // Reset de opciones según el tipo
        if (newType === 'video') {
            // Mantener opciones de video
        } else if (newType === 'audio') {
            // Resetear mute de video si había
            delete newValue.muteVideo;
        } else if (newType === 'image') {
            // Resetear mute de video si había
            delete newValue.muteVideo;
        }

        setPrimaryType(newType);
        onChange(newValue);
    };

    const handlePrimaryVolumeChange = (volume: number) => {
        onChange({ ...value, primaryVolume: volume });
    };

    const handleMuteVideoChange = (mute: boolean) => {
        onChange({ ...value, muteVideo: mute });
    };

    const handleAudioToggle = (enabled: boolean) => {
        onChange({
            ...value,
            hasAudio: enabled,
            audioUrl: enabled ? value.audioUrl : '',
            audioVolume: enabled ? (value.audioVolume || 100) : 100
        });
    };

    const handleAudioChange = (url: string) => {
        onChange({ ...value, audioUrl: url });
    };

    const handleAudioVolumeChange = (volume: number) => {
        onChange({ ...value, audioVolume: volume });
    };

    const handleImageToggle = (enabled: boolean) => {
        onChange({
            ...value,
            hasImage: enabled,
            imageUrl: enabled ? value.imageUrl : ''
        });
    };

    const handleImageChange = (url: string) => {
        onChange({ ...value, imageUrl: url });
    };

    return (
        <div className={`space-y-4 ${className}`}>
            {label && (
                <h4 className="text-sm font-bold text-ds-text">
                    {label}
                </h4>
            )}

            {/* Archivo Principal */}
            <div className="bg-ds-bg border border-ds-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                    {primaryType === 'video' && <Film className="w-4 h-4 text-ds-soft" />}
                    {primaryType === 'audio' && <Music className="w-4 h-4 text-ds-soft" />}
                    {primaryType === 'image' && <ImageIcon className="w-4 h-4 text-ds-soft" />}
                    <h5 className="text-xs font-bold text-ds-soft">
                        Archivo Principal
                    </h5>
                </div>

                <MediaInputWithSelector
                    value={value.primaryUrl || ''}
                    onChange={handlePrimaryChange}
                    label=""
                    placeholder="Selecciona video, audio o imagen..."
                    allowedTypes={['video', 'audio', 'image', 'gif']}
                />

                {value.primaryUrl && (
                    <div className="mt-2 p-2 bg-ds-bg rounded-lg">
                        <div className="flex items-start gap-2 mb-2">
                            <Info className="w-4 h-4 text-ds-soft flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-ds-soft">
                                Detectado: <strong>{primaryType}</strong>
                            </p>
                        </div>
                        
                        {(primaryType === 'video' || primaryType === 'audio') && !value.muteVideo && (
                            <div className="mt-2">
                                <label className="text-xs font-bold text-ds-soft block mb-1">
                                    🎚️ Volumen Principal: {value.primaryVolume ?? 100}%
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={value.primaryVolume ?? 100}
                                    onChange={(e) => handlePrimaryVolumeChange(Number(e.target.value))}
                                    className="w-full"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Opciones para VIDEO */}
            {primaryType === 'video' && (
                <div className="space-y-4">
                    {/* Mutear Video */}
                    <div className="bg-ds-surface border border-ds-border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {value.muteVideo ? (
                                    <VolumeX className="w-4 h-4 text-ds-accent-text" />
                                ) : (
                                    <Volume2 className="w-4 h-4 text-ds-soft" />
                                )}
                                <div>
                                    <label className="text-xs font-bold text-ds-text block">
                                        Silenciar Video
                                    </label>
                                    <p className="text-xs text-ds-soft">
                                        Desactiva el audio del video
                                    </p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={value.muteVideo ?? false}
                                    onChange={(e) => handleMuteVideoChange(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-faint rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all border-ds-border peer-checked:bg-ds-accent"></div>
                            </label>
                        </div>
                    </div>

                    {/* Audio Complementario (solo si video está muteado) */}
                    {value.muteVideo && (
                        <div className="bg-ds-surface border border-ds-border rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Music className="w-4 h-4 text-ds-soft" />
                                    <div>
                                        <label className="text-xs font-bold text-ds-text block">
                                            Agregar Audio Separado
                                        </label>
                                        <p className="text-xs text-ds-soft">
                                            Reproduce un audio junto con el video mudo
                                        </p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={value.hasAudio ?? false}
                                        onChange={(e) => handleAudioToggle(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-faint rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all border-ds-border peer-checked:bg-ds-accent"></div>
                                </label>
                            </div>

                            {value.hasAudio && (
                                <>
                                    <MediaInputWithSelector
                                        value={value.audioUrl || ''}
                                        onChange={handleAudioChange}
                                        label="Archivo de Audio"
                                        placeholder="Selecciona archivo de audio..."
                                        allowedTypes={['audio']}
                                    />

                                    <div>
                                        <label className="text-xs font-bold text-ds-soft block mb-2">
                                            🎚️ Volumen Individual: {value.audioVolume ?? 100}%
                                        </label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={value.audioVolume ?? 100}
                                            onChange={(e) => handleAudioVolumeChange(Number(e.target.value))}
                                            className="w-full"
                                        />
                                        <p className="text-xs text-ds-soft mt-1">
                                            💡 Se combina con el Volumen Global de la sección "Configuración Global"
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Opciones para AUDIO */}
            {primaryType === 'audio' && (
                <div className="bg-ds-surface border border-ds-border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-ds-soft" />
                            <div>
                                <label className="text-xs font-bold text-ds-text block">
                                    Agregar Imagen de Fondo
                                </label>
                                <p className="text-xs text-ds-soft">
                                    Muestra una imagen mientras reproduce el audio
                                </p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={value.hasImage ?? false}
                                onChange={(e) => handleImageToggle(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-faint rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all border-ds-border peer-checked:bg-ds-accent"></div>
                        </label>
                    </div>

                    {value.hasImage && (
                        <MediaInputWithSelector
                            value={value.imageUrl || ''}
                            onChange={handleImageChange}
                            label="Imagen de Fondo"
                            placeholder="Selecciona imagen o GIF..."
                            allowedTypes={['image', 'gif']}
                        />
                    )}
                </div>
            )}

            {/* Opciones para IMAGEN */}
            {primaryType === 'image' && (
                <div className="bg-ds-surface border border-ds-border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Music className="w-4 h-4 text-ds-soft" />
                            <div>
                                <label className="text-xs font-bold text-ds-text block">
                                    Agregar Audio
                                </label>
                                <p className="text-xs text-ds-soft">
                                    Reproduce audio mientras muestra la imagen
                                </p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={value.hasAudio ?? false}
                                onChange={(e) => handleAudioToggle(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-faint rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all border-ds-border peer-checked:bg-ds-accent"></div>
                        </label>
                    </div>

                    {value.hasAudio && (
                        <>
                            <MediaInputWithSelector
                                value={value.audioUrl || ''}
                                onChange={handleAudioChange}
                                label="Archivo de Audio"
                                placeholder="Selecciona archivo de audio..."
                                allowedTypes={['audio']}
                            />

                            <div>
                                <label className="text-xs font-bold text-ds-soft block mb-2">
                                    🎚️ Volumen Individual: {value.audioVolume ?? 100}%
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={value.audioVolume ?? 100}
                                    onChange={(e) => handleAudioVolumeChange(Number(e.target.value))}
                                    className="w-full"
                                />
                                <p className="text-xs text-ds-soft mt-1">
                                    💡 Se combina con el Volumen Global de la sección "Configuración Global"
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Resumen de configuración */}
            {value.primaryUrl && (
                <div className="bg-ds-bg border border-ds-border rounded-lg p-4">
                    <h5 className="text-xs font-bold text-ds-text mb-2">
                        📋 Resumen de configuración
                    </h5>
                    <ul className="text-xs text-ds-soft space-y-1">
                        <li>• Archivo principal: {primaryType}</li>
                        {primaryType === 'video' && value.muteVideo && <li>• Video silenciado</li>}
                        {value.hasAudio && value.audioUrl && <li>• Con audio complementario ({value.audioVolume}% vol)</li>}
                        {value.hasImage && value.imageUrl && <li>• Con imagen de fondo</li>}
                    </ul>
                </div>
            )}
        </div>
    );
}
