/**
 * Now Playing Extension - Preview / Testing Tab
 */

import React, { useState, useMemo } from 'react';
import { Music, Play, Loader2 } from 'lucide-react';
import api from '../../../../../services/api';
import type { ConfigJson, NowPlayingState } from '../../types';
import { Card, SectionTitle } from '../ui/SharedUI';

export const PreviewTab: React.FC<{
    config: ConfigJson;
    state: NowPlayingState;
}> = ({ config, state }) => {
    const [sending, setSending] = useState(false);
    const [testMessage, setTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleTest = async () => {
        setSending(true);
        setTestMessage(null);
        try {
            await api.post('/nowplaying/test');
            setTestMessage({ type: 'success', text: 'Prueba enviada al overlay.' });
        } catch {
            setTestMessage({ type: 'error', text: 'Error al enviar la prueba. Verifica que el overlay este abierto.' });
        } finally {
            setSending(false);
        }
    };

    // Build preview styles
    const bgStyle = useMemo(() => {
        const s = config.style;
        if (s.backgroundType === 'transparent') return { background: 'transparent' };
        if (s.backgroundType === 'gradient') {
            return { background: `linear-gradient(${s.backgroundGradient.angle}deg, ${s.backgroundGradient.color1}, ${s.backgroundGradient.color2})` };
        }
        return { background: s.backgroundColor };
    }, [config.style]);

    const borderStyle = useMemo(() => {
        if (!config.style.borderEnabled) return {};
        return {
            border: `${config.style.borderWidth}px solid ${config.style.borderColor}`,
        };
    }, [config.style]);

    const isHorizontal = config.layout.orientation === 'horizontal';

    const textShadowValue = (ts?: string) => {
        if (!ts || ts === 'none') return undefined;
        return ts;
    };

    return (
        <div className="space-y-5">
            {/* Live Preview */}
            <Card>
                <SectionTitle>Vista Previa en Vivo</SectionTitle>
                <div className="flex items-center justify-center p-8 bg-[#0a0a0a] rounded-lg border border-[#374151] min-h-[200px]">
                    <div
                        className={`flex ${isHorizontal ? 'flex-row items-center' : 'flex-col items-center'} gap-3 p-4`}
                        style={{
                            ...bgStyle,
                            ...borderStyle,
                            opacity: config.style.opacity / 100,
                            borderRadius: `${config.style.borderRadius}px`,
                            maxWidth: `${(config.overlay.cardConfig?.card || config.overlay.freeConfig?.card || { width: 400 }).width}px`,
                        }}
                    >
                        {/* Album Art */}
                        {config.layout.showAlbumArt && (
                            <div
                                className="flex-shrink-0 bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center"
                                style={{
                                    width: `${config.albumArt.size}px`,
                                    height: `${config.albumArt.size}px`,
                                    borderRadius: `${config.albumArt.borderRadius}%`,
                                    boxShadow: config.albumArt.shadow ? '0 4px 12px rgba(0,0,0,0.5)' : 'none',
                                }}
                            >
                                <Music className="w-1/2 h-1/2 text-white/60" />
                            </div>
                        )}

                        {/* Text Content */}
                        <div className={`flex flex-col ${isHorizontal ? '' : 'items-center text-center'} gap-0.5 min-w-0 flex-1`}>
                            <span
                                className="truncate"
                                style={{
                                    fontFamily: config.typography.songTitle.fontFamily,
                                    fontSize: `${config.typography.songTitle.fontSize}px`,
                                    fontWeight: config.typography.songTitle.fontWeight,
                                    color: config.typography.songTitle.color,
                                    textShadow: textShadowValue(config.typography.songTitle.textShadow),
                                }}
                            >
                                Bohemian Rhapsody
                            </span>

                            {config.layout.showArtist && (
                                <span
                                    className="truncate"
                                    style={{
                                        fontFamily: config.typography.artist.fontFamily,
                                        fontSize: `${config.typography.artist.fontSize}px`,
                                        fontWeight: config.typography.artist.fontWeight,
                                        color: config.typography.artist.color,
                                        textShadow: textShadowValue(config.typography.artist.textShadow),
                                    }}
                                >
                                    Queen
                                </span>
                            )}

                            {config.layout.showAlbum && (
                                <span
                                    className="truncate"
                                    style={{
                                        fontFamily: config.typography.album.fontFamily,
                                        fontSize: `${config.typography.album.fontSize}px`,
                                        fontWeight: config.typography.album.fontWeight,
                                        color: config.typography.album.color,
                                        textShadow: textShadowValue(config.typography.album.textShadow),
                                    }}
                                >
                                    A Night at the Opera
                                </span>
                            )}

                            {/* Progress Bar */}
                            {config.layout.showProgressBar && (
                                <div className="w-full mt-2">
                                    {config.layout.showTimeStamps && (
                                        <div className="flex justify-between mb-1">
                                            <span style={{
                                                fontFamily: config.typography.time.fontFamily,
                                                fontSize: `${config.typography.time.fontSize}px`,
                                                fontWeight: config.typography.time.fontWeight,
                                                color: config.typography.time.color,
                                            }}>2:34</span>
                                            <span style={{
                                                fontFamily: config.typography.time.fontFamily,
                                                fontSize: `${config.typography.time.fontSize}px`,
                                                fontWeight: config.typography.time.fontWeight,
                                                color: config.typography.time.color,
                                            }}>5:55</span>
                                        </div>
                                    )}
                                    <div
                                        className="w-full overflow-hidden"
                                        style={{
                                            height: `${config.progressBar.height}px`,
                                            borderRadius: `${config.progressBar.borderRadius}px`,
                                            backgroundColor: config.progressBar.backgroundColor,
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '43%',
                                                height: '100%',
                                                borderRadius: `${config.progressBar.borderRadius}px`,
                                                backgroundColor: config.progressBar.foregroundColor,
                                                transition: config.progressBar.animated ? 'width 0.5s ease' : 'none',
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Provider Icon */}
                        {config.layout.showProviderIcon && isHorizontal && (
                            <div className="flex-shrink-0 ml-2 opacity-50">
                                <Music className="w-4 h-4 text-red-500" />
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* Test Button */}
            <Card>
                <SectionTitle>Enviar Prueba</SectionTitle>
                <p className="text-xs text-[#64748b] mb-4">
                    Envia una cancion de prueba al overlay para verificar que todo funciona correctamente. Asegurate de tener el overlay abierto en OBS.
                </p>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleTest}
                        disabled={sending}
                        className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Enviar prueba
                    </button>
                    {testMessage && (
                        <span className={`text-sm px-3 py-1.5 rounded-lg ${
                            testMessage.type === 'success'
                                ? 'bg-green-900/30 text-green-400'
                                : 'bg-red-900/30 text-red-400'
                        }`}>
                            {testMessage.text}
                        </span>
                    )}
                </div>
            </Card>

            {/* Config Summary */}
            <Card>
                <SectionTitle>Resumen de Configuracion</SectionTitle>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-[#94a3b8]">Estado</span>
                        <span className={state.isEnabled ? 'text-green-400' : 'text-red-400'}>{state.isEnabled ? 'Activo' : 'Inactivo'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[#94a3b8]">Proveedor</span>
                        <span className="text-[#f8fafc]">{state.provider === 'lastfm' ? 'Last.fm' : state.provider}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[#94a3b8]">Usuario</span>
                        <span className="text-[#f8fafc]">{state.lastfmUsername || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[#94a3b8]">Intervalo</span>
                        <span className="text-[#f8fafc]">{state.pollingInterval}s</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[#94a3b8]">Orientacion</span>
                        <span className="text-[#f8fafc] capitalize">{config.layout.orientation}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[#94a3b8]">Fondo</span>
                        <span className="text-[#f8fafc] capitalize">{config.style.backgroundType}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[#94a3b8]">Canvas</span>
                        <span className="text-[#f8fafc]">{config.canvas.width}x{config.canvas.height}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[#94a3b8]">Posicion</span>
                        <span className="text-[#f8fafc]">{(config.overlay.cardConfig?.card || { x: 0, y: 0 }).x}, {(config.overlay.cardConfig?.card || { x: 0, y: 0 }).y}</span>
                    </div>
                </div>
            </Card>
        </div>
    );
};
