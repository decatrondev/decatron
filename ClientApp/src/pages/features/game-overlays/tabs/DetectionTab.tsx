/**
 * Pestaña Detección: automatica por categoria, juego fijo, override temporal,
 * y que hacer cuando no hay juego (Just Chatting).
 */
import React, { useState } from 'react';
import { Radar, Zap } from 'lucide-react';
import { Card, SectionTitle, SubLabel, Label, SelectInput } from '../../now-playing-extension/components/ui/SharedUI';
import { Detection, gameOverlaysApi, errorMessage } from '../api';
import { GAME_IDS, GAME_NAMES, GameId, GameOverlayInstance } from '../types';

interface Props {
    instance: GameOverlayInstance;
    detection?: Detection | null;
    enabledGames: GameId[];
    onChange: (patch: Partial<Pick<GameOverlayInstance, 'detectionMode' | 'forcedGame' | 'idleBehavior'>>) => void;
    onRefresh: () => Promise<void>;
}

export const DetectionTab: React.FC<Props> = ({ instance, detection, enabledGames, onChange, onRefresh }) => {
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    const force = async (game: string | null) => {
        setBusy(true); setMsg(null);
        try { await gameOverlaysApi.forceGame(game); await onRefresh(); setMsg(game ? `Mostrando ${GAME_NAMES[game as GameId]} hasta que vuelvas a automático` : 'Detección automática'); }
        catch (e) { setMsg(errorMessage(e)); }
        finally { setBusy(false); }
    };

    const detected = detection?.detectedGame ? GAME_NAMES[detection.detectedGame] : null;

    return (
        <div className="space-y-6">
            <Card>
                <SectionTitle>Estado ahora</SectionTitle>
                <div className="mt-2 text-sm text-[#e6edf3] space-y-1">
                    <div><span className="text-[#94a3b8]">Categoría del stream:</span> {detection?.categoryName ?? '—'}</div>
                    <div><span className="text-[#94a3b8]">Juego detectado:</span> {detected ?? (detection?.categoryName ? 'sin overlay para esa categoría' : '—')}</div>
                    {detection?.overrideGame && <div className="text-amber-300 flex items-center gap-1"><Zap className="w-4 h-4" /> Forzado a {GAME_NAMES[detection.overrideGame]} (temporal)</div>}
                </div>
                <SubLabel>La categoría llega en tiempo real desde Twitch/Kick. Si cambias de juego y no cambias la categoría, el overlay no lo sabe: usa el forzado de abajo o el comando <code>!juego</code>.</SubLabel>
            </Card>

            <Card>
                <SectionTitle>Modo de detección</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div>
                        <Label>Cómo elegir el juego</Label>
                        <SelectInput value={instance.detectionMode} onChange={v => onChange(v === 'auto' ? { detectionMode: 'auto', forcedGame: null } : { detectionMode: 'manual' })}
                            options={[{ value: 'auto', label: 'Automático por categoría del stream' }, { value: 'manual', label: 'Siempre el mismo juego' }]} />
                    </div>
                    {instance.detectionMode === 'manual' && (
                        <div>
                            <Label>Juego fijo</Label>
                            <SelectInput value={instance.forcedGame ?? ''} onChange={v => onChange({ forcedGame: (v || null) as any })}
                                options={[{ value: '', label: '—' }, ...GAME_IDS.map(g => ({ value: g, label: GAME_NAMES[g] }))]} />
                        </div>
                    )}
                    <div>
                        <Label>Sin juego (Just Chatting, otra categoría)</Label>
                        <SelectInput value={instance.idleBehavior} onChange={v => onChange({ idleBehavior: v as any })}
                            options={[{ value: 'hide', label: 'Ocultar el overlay' }, { value: 'multi_card', label: 'Tarjeta con todos mis rangos (próximamente)', disabled: true }]} />
                    </div>
                </div>
            </Card>

            <Card>
                <SectionTitle className="flex items-center gap-2"><Radar className="w-4 h-4" /> Forzar ahora (temporal)</SectionTitle>
                <SubLabel>Sobrescribe la detección hasta que vuelvas a automático. Igual que <code>!juego lol</code> / <code>!juego auto</code> en el chat.</SubLabel>
                <div className="flex flex-wrap gap-2 mt-3">
                    <button disabled={busy} onClick={() => force(null)} className={`px-3 py-1.5 rounded-lg text-sm border ${!detection?.overrideGame ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#262626] border-[#374151] text-[#e6edf3]'}`}>Automático</button>
                    {enabledGames.map(g => (
                        <button key={g} disabled={busy} onClick={() => force(g)} className={`px-3 py-1.5 rounded-lg text-sm border ${detection?.overrideGame === g ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#262626] border-[#374151] text-[#e6edf3]'}`}>{GAME_NAMES[g]}</button>
                    ))}
                    {enabledGames.length === 0 && <span className="text-xs text-[#94a3b8]">Activa algún juego primero.</span>}
                </div>
                {msg && <p className="text-xs text-[#94a3b8] mt-2">{msg}</p>}
            </Card>
        </div>
    );
};
