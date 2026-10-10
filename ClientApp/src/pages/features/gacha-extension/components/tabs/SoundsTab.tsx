import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Play, Square, RotateCcw, Save, Music, Zap, Star, Trophy, Drum, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../../../../services/api';
import MediaSelector from '../../../../../components/timer/MediaSelector';
import type { SoundEventKey, SoundEventConfig, GachaSoundsMap } from '../../types';
import { SOUND_EVENT_KEYS, DEFAULT_SOUND_EVENT, DEFAULT_SOUND_URLS, SOUND_EVENT_META, RARITY_CONFIG } from '../../types';
import type { RarityType } from '../../types';

const buildDefaultSoundsMap = (): GachaSoundsMap => {
    const map: Record<string, SoundEventConfig> = {};
    for (const key of SOUND_EVENT_KEYS) {
        map[key] = { ...DEFAULT_SOUND_EVENT };
    }
    return map as GachaSoundsMap;
};

const RARITY_FOR_REVEAL: Record<string, RarityType> = {
    reveal_common: 'common',
    reveal_uncommon: 'uncommon',
    reveal_rare: 'rare',
    reveal_epic: 'epic',
    reveal_legendary: 'legendary',
};

const EVENT_ICON: Record<string, React.ReactNode> = {
    drum_roll: <Drum className="w-5 h-5" />,
    flash: <Zap className="w-5 h-5" />,
    win: <Trophy className="w-5 h-5" />,
    ambient: <Music className="w-5 h-5" />,
    reveal_common: <Star className="w-5 h-5" />,
    reveal_uncommon: <Star className="w-5 h-5" />,
    reveal_rare: <Star className="w-5 h-5" />,
    reveal_epic: <Star className="w-5 h-5" />,
    reveal_legendary: <Star className="w-5 h-5" />,
};

export const SoundsTab: React.FC = () => {
    const [masterVolume, setMasterVolume] = useState(80);
    const [enableSounds, setEnableSounds] = useState(false);
    const [sounds, setSounds] = useState<GachaSoundsMap>(buildDefaultSoundsMap);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [playingKey, setPlayingKey] = useState<string | null>(null);
    const [mediaSelectorOpen, setMediaSelectorOpen] = useState(false);
    const [mediaSelectorKey, setMediaSelectorKey] = useState<SoundEventKey | null>(null);
    const [showHelp, setShowHelp] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        loadConfig();
        return () => { audioRef.current?.pause(); };
    }, []);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const res = await api.get('/gacha/sound-config');
            if (res.data.config) {
                setMasterVolume(res.data.config.masterVolume ?? 80);
                setEnableSounds(res.data.config.enableSounds ?? true);
                const parsed = JSON.parse(res.data.config.soundsJson || '{}');
                const merged = buildDefaultSoundsMap();
                for (const key of SOUND_EVENT_KEYS) {
                    if (parsed[key]) merged[key] = { ...merged[key], ...parsed[key] };
                }
                setSounds(merged);
            }
        } catch (err) {
            console.error('Error loading sound config', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/gacha/sound-config', {
                masterVolume,
                enableSounds,
                soundsJson: JSON.stringify(sounds),
            });
        } catch (err) {
            console.error('Error saving sound config', err);
        } finally {
            setSaving(false);
        }
    };

    const updateSound = (key: SoundEventKey, update: Partial<SoundEventConfig>) => {
        setSounds(prev => ({ ...prev, [key]: { ...prev[key], ...update } }));
    };

    const resetSound = (key: SoundEventKey) => {
        setSounds(prev => ({ ...prev, [key]: { ...DEFAULT_SOUND_EVENT } }));
    };

    const getResolvedUrl = (key: SoundEventKey): string => {
        const s = sounds[key];
        if (!s.useDefault && s.url) return s.url;
        return DEFAULT_SOUND_URLS[key];
    };

    const handlePreview = (key: SoundEventKey) => {
        if (playingKey === key) {
            audioRef.current?.pause();
            setPlayingKey(null);
            return;
        }
        if (audioRef.current) audioRef.current.pause();

        const audio = new Audio(getResolvedUrl(key));
        const eventVol = sounds[key].volume / 100;
        const masterVol = masterVolume / 100;
        audio.volume = masterVol * eventVol;
        audio.onended = () => setPlayingKey(null);
        audio.onerror = () => setPlayingKey(null);
        audio.play().catch(() => setPlayingKey(null));
        audioRef.current = audio;
        setPlayingKey(key);
    };

    const openMediaSelector = (key: SoundEventKey) => {
        setMediaSelectorKey(key);
        setMediaSelectorOpen(true);
    };

    const handleMediaSelect = (fileUrl: string, _fileName: string) => {
        if (mediaSelectorKey) {
            updateSound(mediaSelectorKey, { url: fileUrl, useDefault: false });
        }
        setMediaSelectorOpen(false);
        setMediaSelectorKey(null);
    };

    if (loading) return <p className="text-center text-ds-soft py-8">Cargando...</p>;

    const generalKeys = SOUND_EVENT_KEYS.filter(k => SOUND_EVENT_META[k].group === 'general');
    const revealKeys = SOUND_EVENT_KEYS.filter(k => SOUND_EVENT_META[k].group === 'reveal');

    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-ds-border">
                <div className="p-3 bg-gradient-to-r from-ds-accent to-fuchsia-600 rounded-lg">
                    <Volume2 className="w-6 h-6 text-ds-text" />
                </div>
                <div className="flex-1">
                    <h2 className="text-2xl font-black text-ds-text">Sonidos</h2>
                    <p className="text-sm text-ds-soft">Configura los efectos de sonido del overlay por fase y rareza</p>
                </div>
                <button
                    onClick={() => setEnableSounds(!enableSounds)}
                    className={`px-4 py-2 rounded-lg font-bold transition-all ${
                        enableSounds ? 'bg-ds-accent text-ds-on-accent' : 'bg-ds-raised text-ds-soft '
                    }`}
                >
                    {enableSounds ? 'Activado' : 'Desactivado'}
                </button>
            </div>

            {/* Help Banner */}
            <div className="rounded-lg border border-ds-border bg-ds-bg overflow-hidden">
                <button onClick={() => setShowHelp(!showHelp)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                    <HelpCircle className="w-5 h-5 text-ds-soft flex-shrink-0" />
                    <span className="flex-1 text-sm font-bold text-ds-soft">Como funcionan los sonidos</span>
                    {showHelp ? <ChevronUp className="w-4 h-4 text-ds-soft" /> : <ChevronDown className="w-4 h-4 text-ds-soft" />}
                </button>
                {showHelp && (
                    <div className="px-4 pb-4 space-y-3 text-sm text-ds-soft">
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                            <span>El overlay puede reproducir <strong className="text-ds-text">sonidos</strong> en cada fase de la animacion</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                            <span>Hay <strong className="text-ds-text">9 eventos</strong>: redoble, flash, 5 reveals por rareza, celebracion y ambiente</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                            <span>Cada evento tiene su propio <strong className="text-ds-text">volumen</strong> y puede usar el sonido <strong className="text-ds-text">default</strong> o uno <strong className="text-ds-text">custom</strong></span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
                            <span>Sube tus propios archivos MP3 con el selector de medios</span>
                        </div>
                        <div className="mt-2 p-3 rounded-lg bg-ds-raised text-xs">
                            <strong className="text-ds-text">Tip:</strong> Los sonidos estan desactivados por defecto. Activalos con el boton de arriba y ajusta el volumen master.
                        </div>
                    </div>
                )}
            </div>

            {/* Master Volume */}
            <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        {masterVolume === 0 ? <VolumeX className="w-5 h-5 text-ds-accent-text" /> : <Volume2 className="w-5 h-5 text-ds-accent-text" />}
                        <span className="font-bold text-ds-text">Volumen Master</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-ds-accent-text">{masterVolume}%</span>
                </div>
                <input
                    type="range" min={0} max={100} value={masterVolume}
                    onChange={e => setMasterVolume(parseInt(e.target.value))}
                    className="w-full accent-ds-accent"
                />
            </div>

            {/* General Sounds */}
            <div className="space-y-3">
                <h3 className="text-sm font-bold text-ds-soft uppercase tracking-wider">Sonidos Generales</h3>
                {generalKeys.map(key => (
                    <SoundEventRow
                        key={key}
                        eventKey={key}
                        config={sounds[key]}
                        icon={EVENT_ICON[key]}
                        meta={SOUND_EVENT_META[key]}
                        isPlaying={playingKey === key}
                        onUpdate={update => updateSound(key, update)}
                        onReset={() => resetSound(key)}
                        onPreview={() => handlePreview(key)}
                        onSelectCustom={() => openMediaSelector(key)}
                    />
                ))}
            </div>

            {/* Reveal per Rarity */}
            <div className="space-y-3">
                <h3 className="text-sm font-bold text-ds-soft uppercase tracking-wider">Sonido de Reveal por Rareza</h3>
                {revealKeys.map(key => {
                    const rarity = RARITY_FOR_REVEAL[key];
                    const rarityColor = rarity ? RARITY_CONFIG[rarity]?.color : undefined;
                    return (
                        <SoundEventRow
                            key={key}
                            eventKey={key}
                            config={sounds[key]}
                            icon={EVENT_ICON[key]}
                            meta={SOUND_EVENT_META[key]}
                            accentColor={rarityColor}
                            isPlaying={playingKey === key}
                            onUpdate={update => updateSound(key, update)}
                            onReset={() => resetSound(key)}
                            onPreview={() => handlePreview(key)}
                            onSelectCustom={() => openMediaSelector(key)}
                        />
                    );
                })}
            </div>

            {/* Save */}
            <button
                onClick={handleSave} disabled={saving}
                className="w-full px-4 py-3 bg-ds-accent hover:bg-ds-accent-hover disabled:bg-ds-faint text-ds-on-accent rounded-lg font-bold transition-all flex items-center justify-center gap-2"
            >
                <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar Configuracion'}
            </button>

            {/* MediaSelector modal */}
            <MediaSelector
                isOpen={mediaSelectorOpen}
                onClose={() => { setMediaSelectorOpen(false); setMediaSelectorKey(null); }}
                onSelect={handleMediaSelect}
                allowedTypes={['sound']}
            />
        </div>
    );
};

// =============================================================================
// SOUND EVENT ROW
// =============================================================================

interface SoundEventRowProps {
    eventKey: SoundEventKey;
    config: SoundEventConfig;
    icon: React.ReactNode;
    meta: { label: string; description: string };
    accentColor?: string;
    isPlaying: boolean;
    onUpdate: (update: Partial<SoundEventConfig>) => void;
    onReset: () => void;
    onPreview: () => void;
    onSelectCustom: () => void;
}

const SoundEventRow: React.FC<SoundEventRowProps> = ({
    config, icon, meta, accentColor, isPlaying,
    onUpdate, onReset, onPreview, onSelectCustom,
}) => {
    const borderColor = accentColor || '#6d28d9';

    return (
        <div
            className="p-4 bg-ds-bg rounded-lg border border-ds-border space-y-3 transition-all"
            style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}
        >
            {/* Top row: icon + label + toggle */}
            <div className="flex items-center gap-3">
                <div style={{ color: accentColor || '#8b5cf6' }}>{icon}</div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-ds-text truncate">{meta.label}</p>
                    <p className="text-xs text-ds-soft">{meta.description}</p>
                </div>
                <button
                    onClick={() => onUpdate({ enabled: !config.enabled })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        config.enabled
                            ? 'bg-ds-accent text-ds-on-accent'
                            : 'bg-ds-raised text-ds-soft '
                    }`}
                >
                    {config.enabled ? 'ON' : 'OFF'}
                </button>
            </div>

            {config.enabled && (
                <>
                    {/* Volume slider */}
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-ds-soft w-14">Vol</span>
                        <input
                            type="range" min={0} max={100} value={config.volume}
                            onChange={e => onUpdate({ volume: parseInt(e.target.value) })}
                            className="flex-1 accent-ds-accent"
                        />
                        <span className="text-xs font-mono font-bold text-ds-soft w-10 text-right">{config.volume}%</span>
                    </div>

                    {/* Source + actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Default / Custom toggle */}
                        <div className="flex rounded-lg overflow-hidden border border-ds-border">
                            <button
                                onClick={() => onUpdate({ useDefault: true })}
                                className={`px-3 py-1.5 text-xs font-bold transition-all ${
                                    config.useDefault
                                        ? 'bg-ds-accent text-ds-on-accent'
                                        : 'bg-ds-surface text-ds-soft '
                                }`}
                            >
                                Default
                            </button>
                            <button
                                onClick={() => {
                                    if (config.url) {
                                        onUpdate({ useDefault: false });
                                    } else {
                                        onSelectCustom();
                                    }
                                }}
                                className={`px-3 py-1.5 text-xs font-bold transition-all ${
                                    !config.useDefault
                                        ? 'bg-ds-accent text-ds-on-accent'
                                        : 'bg-ds-surface text-ds-soft '
                                }`}
                            >
                                Custom
                            </button>
                        </div>

                        {/* Custom file selector */}
                        {!config.useDefault && (
                            <button
                                onClick={onSelectCustom}
                                className="px-3 py-1.5 text-xs font-bold bg-ds-surface border border-ds-border rounded-lg hover:border-ds-accent transition-all truncate max-w-[200px]"
                            >
                                {config.url ? decodeURIComponent(config.url.split('/').pop() || 'Seleccionar') : 'Seleccionar archivo'}
                            </button>
                        )}

                        <div className="flex-1" />

                        {/* Preview */}
                        <button
                            onClick={onPreview}
                            className={`p-2 rounded-lg transition-all ${
                                isPlaying
                                    ? 'bg-ds-danger-solid text-ds-on-accent'
                                    : 'bg-ds-surface border border-ds-border text-ds-soft hover:border-ds-accent '
                            }`}
                            title={isPlaying ? 'Detener' : 'Preview'}
                        >
                            {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>

                        {/* Reset */}
                        <button
                            onClick={onReset}
                            className="p-2 rounded-lg bg-ds-surface border border-ds-border text-ds-soft hover:border-ds-warn/40 transition-all"
                            title="Resetear a default"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
