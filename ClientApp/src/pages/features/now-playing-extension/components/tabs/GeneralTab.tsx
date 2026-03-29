/**
 * Now Playing Extension - General Tab
 */

import React, { useState, useEffect } from 'react';
import { Copy, Check, Link, Unlink, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import api from '../../../../../services/api';
import type { NowPlayingState, TierLimits, CupoInfo } from '../../types';
import { Card, SectionTitle, Label, TierLock, TextInput, Toggle, Slider } from '../ui/SharedUI';

const GeneralTab: React.FC<{
    config: NowPlayingState;
    onUpdate: (partial: Partial<NowPlayingState>) => void;
    overlayUrl: string;
    channelName: string;
    limits: TierLimits;
    userTier: string;
    cupos: CupoInfo;
    onCuposChange: (c: CupoInfo) => void;
}> = ({ config, onUpdate, overlayUrl, limits, userTier, cupos, onCuposChange }) => {
    const [copied, setCopied] = useState(false);
    const [validating, setValidating] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [spotifyDisconnecting, setSpotifyDisconnecting] = useState(false);
    const [requestingCupo, setRequestingCupo] = useState(false);
    const [spotifyEmailInput, setSpotifyEmailInput] = useState('');
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>(
        config.lastfmUsername ? 'connected' : 'disconnected'
    );
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [usernameInput, setUsernameInput] = useState(config.lastfmUsername || '');

    useEffect(() => {
        setConnectionStatus(config.lastfmUsername ? 'connected' : 'disconnected');
        setUsernameInput(config.lastfmUsername || '');
    }, [config.lastfmUsername]);

    // Check for Spotify OAuth callback result
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const spotifyResult = params.get('spotify');
        if (spotifyResult === 'success') {
            setStatusMessage({ type: 'success', text: 'Spotify conectado exitosamente.' });
            onUpdate({ provider: 'spotify', spotifyConnected: true });
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
        } else if (spotifyResult === 'error') {
            const msg = params.get('message') || 'Error desconocido';
            setStatusMessage({ type: 'error', text: `Error conectando Spotify: ${msg}` });
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(overlayUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* ignore */ }
    };

    const handleValidate = async () => {
        if (!usernameInput.trim()) return;
        setValidating(true);
        setStatusMessage(null);
        try {
            const res = await api.post('/nowplaying/validate/lastfm', { username: usernameInput.trim() });
            const isValid = res.data?.success && res.data?.valid;
            setStatusMessage({
                type: isValid ? 'success' : 'error',
                text: isValid ? 'Usuario de Last.fm verificado correctamente.' : 'Usuario de Last.fm no encontrado.',
            });
        } catch {
            setStatusMessage({ type: 'error', text: 'Error al verificar el usuario.' });
        } finally {
            setValidating(false);
        }
    };

    const handleConnect = async () => {
        if (!usernameInput.trim()) return;
        setConnecting(true);
        setStatusMessage(null);
        try {
            const res = await api.post('/nowplaying/connect/lastfm', { username: usernameInput.trim() });
            if (res.data?.success) {
                onUpdate({ lastfmUsername: usernameInput.trim() });
                setConnectionStatus('connected');
                setStatusMessage({ type: 'success', text: 'Conectado a Last.fm correctamente.' });
            } else {
                setStatusMessage({ type: 'error', text: res.data?.message || 'Error al conectar' });
            }
        } catch {
            setStatusMessage({ type: 'error', text: 'Error al conectar con Last.fm.' });
        } finally {
            setConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        setDisconnecting(true);
        setStatusMessage(null);
        try {
            const res = await api.post('/nowplaying/disconnect', {});
            if (res.data?.success) {
                onUpdate({ lastfmUsername: null });
                setConnectionStatus('disconnected');
                setUsernameInput('');
                setStatusMessage({ type: 'success', text: 'Desconectado de Last.fm.' });
            }
        } catch {
            setStatusMessage({ type: 'error', text: 'Error al desconectar.' });
        } finally {
            setDisconnecting(false);
        }
    };

    return (
        <div className="space-y-5">
            {/* Enable/Disable */}
            <Card>
                <SectionTitle>Estado</SectionTitle>
                <Toggle
                    checked={config.isEnabled}
                    onChange={(v) => onUpdate({ isEnabled: v })}
                    label="Now Playing activo"
                    description="Activa o desactiva el overlay de Now Playing"
                    size="lg"
                />
            </Card>

            {/* Provider */}
            <Card>
                <SectionTitle>Proveedor de Musica</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => onUpdate({ provider: 'lastfm' })}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                            config.provider === 'lastfm'
                                ? 'border-red-500 bg-red-500/10'
                                : 'border-[#374151] bg-[#262626] hover:border-[#4b5563]'
                        }`}
                    >
                        <div className="font-bold text-[#f8fafc] text-sm">Last.fm</div>
                        <div className="text-xs text-[#94a3b8] mt-1">Cualquier reproductor via scrobbling</div>
                    </button>
                    <TierLock allowed={limits.canUseSpotify} requiredTier="supporter">
                        <button
                            onClick={() => onUpdate({ provider: 'spotify' })}
                            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                                config.provider === 'spotify'
                                    ? 'border-green-500 bg-green-500/10'
                                    : 'border-[#374151] bg-[#262626] hover:border-[#4b5563]'
                            }`}
                        >
                            <div className="font-bold text-[#f8fafc] text-sm">Spotify</div>
                            <div className="text-xs text-[#94a3b8] mt-1">Conexion directa, progreso exacto</div>
                        </button>
                    </TierLock>
                </div>
            </Card>

            {/* Provider Connection */}
            {config.provider === 'lastfm' ? (
                <Card>
                    <SectionTitle>Conexion Last.fm</SectionTitle>
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-3">
                            <div className={`w-2.5 h-2.5 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-[#64748b]'}`} />
                            <span className={`text-sm font-medium ${connectionStatus === 'connected' ? 'text-green-400' : 'text-[#94a3b8]'}`}>
                                {connectionStatus === 'connected' ? `Conectado: ${config.lastfmUsername}` : 'No conectado'}
                            </span>
                        </div>

                        <div>
                            <Label>Usuario de Last.fm</Label>
                            <TextInput
                                value={usernameInput}
                                onChange={setUsernameInput}
                                placeholder="tu-usuario-lastfm"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleValidate}
                                disabled={validating || !usernameInput.trim()}
                                className="px-4 py-2 bg-[#262626] border border-[#374151] text-[#f8fafc] rounded-lg text-sm font-medium hover:bg-[#374151] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                Verificar
                            </button>
                            <button
                                onClick={handleConnect}
                                disabled={connecting || !usernameInput.trim()}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                                Conectar
                            </button>
                            {connectionStatus === 'connected' && (
                                <button
                                    onClick={handleDisconnect}
                                    disabled={disconnecting}
                                    className="px-4 py-2 bg-[#262626] border border-red-500/30 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                                    Desconectar
                                </button>
                            )}
                        </div>
                    </div>
                </Card>
            ) : (
                <Card>
                    <SectionTitle>Conexion Spotify</SectionTitle>
                    <div className="space-y-4">
                        {/* Status indicator */}
                        <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${
                                config.spotifyConnected
                                    ? (config.spotifySlotAssigned ? 'bg-green-500' : config.spotifySlotRequested ? 'bg-amber-500' : 'bg-blue-500')
                                    : 'bg-[#64748b]'
                            }`} />
                            <span className={`text-sm font-medium ${
                                config.spotifyConnected
                                    ? (config.spotifySlotAssigned ? 'text-green-400' : config.spotifySlotRequested ? 'text-amber-400' : 'text-blue-400')
                                    : 'text-[#94a3b8]'
                            }`}>
                                {!config.spotifyConnected ? 'No conectado'
                                    : config.spotifySlotAssigned ? 'Spotify conectado — overlay activo'
                                    : config.spotifySlotRequested ? 'Cupo solicitado — pendiente'
                                    : 'Spotify conectado — solicita cupo'}
                            </span>
                        </div>

                        <p className="text-xs text-[#64748b]">
                            Conecta tu cuenta de Spotify para mostrar la cancion que estas escuchando con progreso exacto.
                        </p>

                        {/* Connect button */}
                        {!config.spotifyConnected && (
                            <button
                                onClick={async () => {
                                    try {
                                        const res = await api.get('/spotify/authorize-url');
                                        if (res.data?.success && res.data.url) {
                                            window.location.href = res.data.url;
                                        } else {
                                            setStatusMessage({ type: 'error', text: res.data?.message || 'Error al obtener URL de Spotify' });
                                        }
                                    } catch (err: any) {
                                        setStatusMessage({ type: 'error', text: err?.response?.data?.message || 'Error al conectar con Spotify' });
                                    }
                                }}
                                className="px-4 py-2 bg-[#1DB954] hover:bg-[#1ed760] text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                            >
                                <Link className="w-4 h-4" />
                                Conectar Spotify
                            </button>
                        )}

                        {/* Connected + slot assigned -> all good */}
                        {config.spotifyConnected && config.spotifySlotAssigned && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg w-fit">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-xs font-medium text-green-400">Overlay activo</span>
                            </div>
                        )}

                        {/* Connected + NO slot -> show cupo system */}
                        {config.spotifyConnected && !config.spotifySlotAssigned && !config.spotifySlotRequested && (
                            <div className="bg-[#262626] rounded-lg p-4 border border-[#374151]">
                                <p className="text-sm text-[#f8fafc] font-medium mb-1">Solicitar cupo</p>
                                <p className="text-xs text-[#94a3b8] mb-3">
                                    Para activar el overlay necesitas un cupo. Ingresa tu email de Spotify y solicita uno.
                                </p>

                                {/* Cupo counter */}
                                <div className="flex items-center gap-3 mb-4">
                                    {Array.from({ length: cupos.total }).map((_, i) => (
                                        <div key={i} className={`w-3 h-3 rounded-full ${i < cupos.used ? 'bg-[#1DB954]' : 'bg-[#374151]'}`} />
                                    ))}
                                    <span className="text-xs font-bold text-[#f8fafc]">{cupos.used}/{cupos.total}</span>
                                </div>

                                {/* Email input */}
                                <div className="mb-3">
                                    <label className="block text-xs font-medium text-[#94a3b8] mb-1">Email de tu cuenta Spotify</label>
                                    <input
                                        type="email"
                                        value={spotifyEmailInput}
                                        onChange={(e) => setSpotifyEmailInput(e.target.value)}
                                        placeholder="tu-email@ejemplo.com"
                                        className="w-full px-3 py-2 bg-[#1B1C1D] border border-[#374151] rounded-lg text-sm text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-[#1DB954]"
                                    />
                                </div>

                                {cupos.available > 0 ? (
                                    <button
                                        onClick={async () => {
                                            if (!spotifyEmailInput.trim()) {
                                                setStatusMessage({ type: 'error', text: 'Ingresa tu email de Spotify' });
                                                return;
                                            }
                                            setRequestingCupo(true);
                                            setStatusMessage(null);
                                            try {
                                                const res = await api.post('/nowplaying/request-spotify-cupo', { spotifyEmail: spotifyEmailInput.trim() });
                                                if (res.data?.success) {
                                                    onUpdate({ spotifySlotRequested: true });
                                                    setStatusMessage({ type: 'success', text: 'Cupo solicitado. El admin lo activara pronto.' });
                                                } else {
                                                    setStatusMessage({ type: 'error', text: res.data?.message || 'Error' });
                                                }
                                            } catch (err: any) {
                                                setStatusMessage({ type: 'error', text: err?.response?.data?.message || 'Error al solicitar cupo' });
                                            } finally {
                                                setRequestingCupo(false);
                                            }
                                        }}
                                        disabled={requestingCupo || !spotifyEmailInput.trim()}
                                        className="px-4 py-2 bg-[#1DB954] hover:bg-[#1ed760] text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {requestingCupo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                        Solicitar cupo
                                    </button>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                                            <p className="text-sm text-amber-400 font-medium mb-1">No hay cupos disponibles ({cupos.total}/{cupos.total})</p>
                                            <p className="text-xs text-[#94a3b8]">
                                                Todos los cupos estan ocupados. Puedes solicitar con prioridad adquiriendo un plan de soporte.
                                            </p>
                                        </div>
                                        <a
                                            href="/supporters"
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                            Ver planes de Supporter
                                        </a>
                                        <p className="text-xs text-[#64748b]">
                                            Alternativa: Usa Last.fm como proveedor gratuito sin limites.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Cupo requested, pending */}
                        {config.spotifyConnected && config.spotifySlotRequested && !config.spotifySlotAssigned && (
                            <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/20">
                                <p className="text-sm text-amber-400 font-medium mb-1">Cupo solicitado — pendiente de activacion</p>
                                <p className="text-xs text-[#64748b]">El admin activara tu cupo pronto. Te notificaremos cuando este listo.</p>
                            </div>
                        )}


                        {/* Disconnect button */}
                        {config.spotifyConnected && (
                            <button
                                onClick={async () => {
                                    setSpotifyDisconnecting(true);
                                    try {
                                        const res = await api.post('/spotify/disconnect', {});
                                        if (res.data?.success) {
                                            onUpdate({ spotifyConnected: false, spotifySlotRequested: false, spotifySlotAssigned: false });
                                            setStatusMessage({ type: 'success', text: 'Spotify desconectado.' });
                                        }
                                    } catch {
                                        setStatusMessage({ type: 'error', text: 'Error al desconectar Spotify.' });
                                    } finally {
                                        setSpotifyDisconnecting(false);
                                    }
                                }}
                                disabled={spotifyDisconnecting}
                                className="px-4 py-2 bg-[#262626] border border-red-500/30 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {spotifyDisconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                                Desconectar Spotify
                            </button>
                        )}
                    </div>
                </Card>
            )}

            {/* Status Message */}
            {statusMessage && (
                <div className={`text-sm px-3 py-2 rounded-lg ${
                    statusMessage.type === 'success'
                        ? 'bg-green-900/30 text-green-400 border border-green-500/20'
                        : 'bg-red-900/30 text-red-400 border border-red-500/20'
                }`}>
                    {statusMessage.text}
                </div>
            )}

            {/* Polling Interval */}
            <Card>
                <SectionTitle>Intervalo de Actualizacion</SectionTitle>
                <Label>Cada cuanto se consulta la cancion actual</Label>
                <Slider value={config.pollingInterval} onChange={(v) => onUpdate({ pollingInterval: v })} min={3} max={10} unit="s" />
            </Card>

            {/* Overlay URL */}
            <Card>
                <SectionTitle>URL del Overlay</SectionTitle>
                <p className="text-xs text-[#64748b] mb-3">Copia esta URL en una fuente de navegador en OBS.</p>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        readOnly
                        value={overlayUrl}
                        className="flex-1 px-3 py-2 bg-[#262626] border border-[#374151] rounded-lg text-[#94a3b8] text-sm font-mono truncate"
                    />
                    <button
                        onClick={handleCopy}
                        className={`p-2.5 rounded-lg border transition-colors ${
                            copied
                                ? 'bg-green-500/20 border-green-500/30 text-green-400'
                                : 'bg-[#262626] border-[#374151] text-[#94a3b8] hover:bg-[#374151]'
                        }`}
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                </div>
            </Card>
        </div>
    );
};

export default GeneralTab;
