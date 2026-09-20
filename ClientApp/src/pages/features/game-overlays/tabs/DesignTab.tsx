/**
 * Pestaña Diseño: editor visual del overlay para un juego. Canvas con la
 * tarjeta arrastrable (datos simulados del backend) + propiedades: layout,
 * fondo, acento, elementos (visibilidad, fuente, tamaño), animaciones.
 * Todo esto es free para todos (decision de producto, plan §6).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { CanvasEditor } from '../../../../components/overlay-editor/CanvasEditor';
import { Card, SectionTitle, Label, SubLabel, SelectInput, ColorInput, Slider, Toggle, NumberInput, Checkbox } from '../../now-playing-extension/components/ui/SharedUI';
import { GameOverlayCard } from '../GameOverlayCard';
import { gameOverlaysApi } from '../api';
import { ELEMENT_LABELS, ElementConfig, ElementId, GAME_ACCENTS, GAME_IDS, GAME_NAMES, GAMES_WITH_STATS, GameId, GameVisualConfig, LAYOUT_LABELS, OverlayState, STATS_ELEMENTS, STYLE_PRESET_ELEMENTS, STYLE_PRESET_LABELS, StylePreset, defaultGameConfig, formatTier } from '../types';

const FONT_FAMILIES = ['Inter', 'Roboto', 'Montserrat', 'Poppins', 'Oswald', 'Bebas Neue', 'Rajdhani', 'Exo 2', 'Press Start 2P', 'system-ui'];
const BASE_ELEMENT_ORDER: ElementId[] = ['emblem', 'gameLogo', 'rank', 'lp', 'accountName', 'session', 'recent', 'liveCharacter'];
const ALL_ELEMENT_ORDER: ElementId[] = [...BASE_ELEMENT_ORDER, ...STATS_ELEMENTS];

interface Props {
    slug: string;
    game: GameId;
    games: Record<GameId, GameVisualConfig>;
    canvas: { width: number; height: number };
    onSelectGame: (g: GameId) => void;
    onChange: (game: GameId, patch: Partial<GameVisualConfig>) => void;
    onCanvasChange: (c: { width: number; height: number }) => void;
}

export const DesignTab: React.FC<Props> = ({ slug, game, games, canvas, onSelectGame, onChange, onCanvasChange }) => {
    const cfg = games[game];
    const [preview, setPreview] = useState<OverlayState | null>(null);
    const [selected, setSelected] = useState<ElementId>('rank');
    // Los widgets de estadisticas solo existen donde el proveedor da esos datos (hoy LoL).
    const hasStats = GAMES_WITH_STATS.includes(game);
    const ELEMENT_ORDER = hasStats ? ALL_ELEMENT_ORDER : BASE_ELEMENT_ORDER;
    useEffect(() => { if (!hasStats && STATS_ELEMENTS.includes(selected)) setSelected('rank'); }, [hasStats, selected]);

    const applyPreset = (preset: StylePreset) => {
        const show = new Set(STYLE_PRESET_ELEMENTS[preset]);
        const elements: GameVisualConfig['elements'] = { ...cfg.elements };
        for (const id of ALL_ELEMENT_ORDER) elements[id] = { ...(elements[id] ?? defaultGameConfig(game).elements[id]!), visible: show.has(id) };
        onChange(game, { elements });
    };

    useEffect(() => {
        let alive = true;
        gameOverlaysApi.preview(slug, game).then(r => { if (alive && r.success) setPreview(r.state); }).catch(() => {});
        return () => { alive = false; };
    }, [slug, game]);

    // Carga la fuente elegida desde Google Fonts para el preview (el overlay hace lo mismo).
    const fontsInUse = useMemo(() => {
        const set = new Set<string>();
        for (const id of ELEMENT_ORDER) { const f = cfg.elements[id]?.font?.family; if (f && f !== 'system-ui' && f !== 'Inter') set.add(f); }
        return [...set];
    }, [cfg]);
    useEffect(() => {
        if (fontsInUse.length === 0) return;
        const id = 'go-fonts';
        let link = document.getElementById(id) as HTMLLinkElement | null;
        if (!link) { link = document.createElement('link'); link.id = id; link.rel = 'stylesheet'; document.head.appendChild(link); }
        link.href = `https://fonts.googleapis.com/css2?${fontsInUse.map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700;800`).join('&')}&display=swap`;
    }, [fontsInUse]);

    const account = preview?.accounts?.[0];
    const el = cfg.elements[selected] ?? { visible: true };
    const setEl = (patch: Partial<ElementConfig>) => onChange(game, { elements: { ...cfg.elements, [selected]: { ...el, ...patch } } });
    const setFont = (patch: Partial<NonNullable<ElementConfig['font']>>) => setEl({ font: { ...el.font, ...patch } });
    const hasFont = !['emblem', 'recent', 'lpGraph'].includes(selected);
    const toggleMetric = (m: 'kda' | 'cs' | 'damage' | 'vision') => {
        const cur = el.metrics ?? ['kda', 'cs'];
        setEl({ metrics: cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m] });
    };

    return (
        <div className="space-y-5">
            <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <SectionTitle>Diseño · {GAME_NAMES[game]}</SectionTitle>
                        <SubLabel>Lo que ves aquí es exactamente lo que sale en OBS. Datos de ejemplo.</SubLabel>
                    </div>
                    <div className="flex items-center gap-2">
                        <SelectInput value={game} onChange={v => onSelectGame(v as GameId)} options={GAME_IDS.map(g => ({ value: g, label: `${GAME_NAMES[g]}${games[g].enabled ? '' : ' (desactivado)'}` }))} />
                        <button onClick={() => { if (confirm('¿Volver al diseño por defecto de este juego?')) onChange(game, { ...defaultGameConfig(game), enabled: cfg.enabled, accounts: cfg.accounts, rotation: cfg.rotation, sessionScope: cfg.sessionScope }); }}
                            className="px-3 py-2 bg-[#262626] hover:bg-[#333] text-white rounded-lg text-sm flex items-center gap-2 border border-[#374151]" title="Restablecer diseño">
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="mt-4">
                    <CanvasEditor
                        width={canvas.width}
                        height={canvas.height}
                        snap={10}
                        onMove={(_, position) => onChange(game, { position })}
                        items={account ? [{
                            id: 'card',
                            position: cfg.position,
                            node: (
                                <GameOverlayCard game={game} gameName={GAME_NAMES[game]} config={cfg} account={account}
                                    accountIndex={0} accountCount={preview?.accounts.length ?? 1} switchAnimation="none" formatTier={formatTier} />
                            ),
                        }] : []}
                    />
                </div>
                <div className="flex flex-wrap items-end gap-4 mt-3">
                    <div className="w-40"><Label>Lienzo</Label>
                        <SelectInput value={`${canvas.width}x${canvas.height}`} onChange={v => { const [w, h] = v.split('x').map(Number); onCanvasChange({ width: w, height: h }); }}
                            options={[{ value: '1920x1080', label: '1920×1080' }, { value: '1280x720', label: '1280×720' }, { value: '2560x1440', label: '2560×1440' }, { value: '3840x2160', label: '3840×2160' }]} />
                    </div>
                    <div className="w-28"><Label>Posición X</Label><NumberInput value={cfg.position.x} onChange={x => onChange(game, { position: { ...cfg.position, x } })} min={0} max={canvas.width} /></div>
                    <div className="w-28"><Label>Posición Y</Label><NumberInput value={cfg.position.y} onChange={y => onChange(game, { position: { ...cfg.position, y } })} min={0} max={canvas.height} /></div>
                </div>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Card>
                    <SectionTitle>Tarjeta</SectionTitle>
                    <div className="space-y-4 mt-3">
                        <div>
                            <Label>Layout</Label>
                            <div className="grid grid-cols-4 gap-2 mt-1">
                                {(Object.keys(LAYOUT_LABELS) as (keyof typeof LAYOUT_LABELS)[]).map(l => (
                                    <button key={l} onClick={() => onChange(game, { layout: l })} className={`px-2 py-2 rounded-lg text-xs border ${cfg.layout === l ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#111214] border-[#374151] text-[#e6edf3] hover:bg-[#262626]'}`}>{LAYOUT_LABELS[l]}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <Label>Color de acento</Label>
                            <ColorInput value={cfg.accent ?? GAME_ACCENTS[game]} onChange={v => onChange(game, { accent: v })} />
                            <button className="text-[11px] text-[#94a3b8] underline mt-1" onClick={() => onChange(game, { accent: GAME_ACCENTS[game] })}>Usar el color del juego</button>
                        </div>
                        <div>
                            <Label>Fondo</Label>
                            <SelectInput value={cfg.background.type} onChange={v => onChange(game, { background: { ...cfg.background, type: v as any } })} options={[{ value: 'solid', label: 'Sólido' }, { value: 'transparent', label: 'Transparente' }]} />
                        </div>
                        {cfg.background.type === 'solid' && (
                            <>
                                <div><Label>Color de fondo</Label><ColorInput value={cfg.background.color} onChange={v => onChange(game, { background: { ...cfg.background, color: v } })} /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label>Opacidad</Label><Slider value={cfg.background.opacity} onChange={v => onChange(game, { background: { ...cfg.background, opacity: v } })} min={0} max={100} unit="%" /></div>
                                    <div><Label>Bordes</Label><Slider value={cfg.background.radius} onChange={v => onChange(game, { background: { ...cfg.background, radius: v } })} min={0} max={32} unit="px" /></div>
                                </div>
                            </>
                        )}
                        <div className="grid grid-cols-3 gap-3">
                            <div><Label>Entrada</Label><SelectInput value={cfg.animation.in} onChange={v => onChange(game, { animation: { ...cfg.animation, in: v as any } })} options={[{ value: 'fade', label: 'Fundido' }, { value: 'slide', label: 'Deslizar' }, { value: 'none', label: 'Ninguna' }]} /></div>
                            <div><Label>Salida</Label><SelectInput value={cfg.animation.out} onChange={v => onChange(game, { animation: { ...cfg.animation, out: v as any } })} options={[{ value: 'fade', label: 'Fundido' }, { value: 'slide', label: 'Deslizar' }, { value: 'none', label: 'Ninguna' }]} /></div>
                            <div><Label>Cambio de cuenta</Label><SelectInput value={cfg.animation.accountSwitch} onChange={v => onChange(game, { animation: { ...cfg.animation, accountSwitch: v as any } })} options={[{ value: 'slide', label: 'Deslizar' }, { value: 'fade', label: 'Fundido' }, { value: 'none', label: 'Ninguna' }]} /></div>
                        </div>
                    </div>
                </Card>

                <Card>
                    <SectionTitle>Elementos</SectionTitle>
                    {hasStats && (
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            <span className="text-[11px] text-[#94a3b8]">Preset:</span>
                            {(Object.keys(STYLE_PRESET_LABELS) as StylePreset[]).map(p => (
                                <button key={p} onClick={() => applyPreset(p)} className="px-2.5 py-1 rounded-lg text-xs border bg-[#111214] border-[#374151] text-[#e6edf3] hover:bg-[#262626]" title="Activa y desactiva elementos; no toca fuentes ni colores">{STYLE_PRESET_LABELS[p]}</button>
                            ))}
                        </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {ELEMENT_ORDER.map(id => {
                            const visible = cfg.elements[id]?.visible !== false;
                            return (
                                <button key={id} onClick={() => setSelected(id)} className={`px-2.5 py-1.5 rounded-lg text-xs border ${selected === id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#111214] border-[#374151] text-[#e6edf3] hover:bg-[#262626]'} ${visible ? '' : 'line-through opacity-60'}`}>
                                    {ELEMENT_LABELS[id]}
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-4 space-y-4">
                        <Toggle checked={el.visible !== false} onChange={v => setEl({ visible: v })} label={`Mostrar ${ELEMENT_LABELS[selected].toLowerCase()}`} size="sm" />

                        {selected === 'emblem' && (
                            <div><Label>Tamaño</Label><Slider value={el.size ?? 96} onChange={v => setEl({ size: v })} min={32} max={200} unit="px" /></div>
                        )}
                        {selected === 'recent' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div><Label>Cantidad</Label><NumberInput value={el.count ?? 5} onChange={v => setEl({ count: v })} min={1} max={20} /></div>
                                <div><Label>Estilo</Label><SelectInput value={el.style ?? 'dots'} onChange={v => setEl({ style: v as any })} options={[{ value: 'dots', label: 'Puntos' }, { value: 'cards', label: 'Tarjetas con KDA' }, ...(hasStats ? [{ value: 'icons', label: 'Íconos de campeón' }] : [])]} /></div>
                            </div>
                        )}
                        {selected === 'winrate' && (
                            <div><Label>Qué winrate</Label>
                                <SelectInput value={el.scope ?? 'ranked'} onChange={v => setEl({ scope: v as any })} options={[{ value: 'ranked', label: 'Temporada (W-L de ranked)' }, { value: 'recent', label: 'Últimas 20 partidas' }, { value: 'session', label: 'Sesión de hoy' }]} />
                            </div>
                        )}
                        {selected === 'kdaCs' && (
                            <div><Label>Métricas (promedio de las últimas 20)</Label>
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    <Checkbox checked={(el.metrics ?? ['kda', 'cs']).includes('kda')} onChange={() => toggleMetric('kda')} label="KDA" />
                                    <Checkbox checked={(el.metrics ?? ['kda', 'cs']).includes('cs')} onChange={() => toggleMetric('cs')} label="CS por minuto" />
                                    <Checkbox checked={(el.metrics ?? ['kda', 'cs']).includes('damage')} onChange={() => toggleMetric('damage')} label="Daño a campeones" />
                                    <Checkbox checked={(el.metrics ?? ['kda', 'cs']).includes('vision')} onChange={() => toggleMetric('vision')} label="Puntuación de visión" />
                                </div>
                            </div>
                        )}
                        {(selected === 'topChamps' || selected === 'mastery') && (
                            <div><Label>Cantidad</Label><NumberInput value={el.count ?? 3} onChange={v => setEl({ count: v })} min={1} max={5} /></div>
                        )}
                        {selected === 'lpGraph' && (
                            <div><Label>Alto del gráfico</Label><Slider value={el.height ?? 48} onChange={v => setEl({ height: v })} min={24} max={120} unit="px" /></div>
                        )}
                        {selected === 'streak' && <p className="text-[11px] text-[#6b7280]">Se muestra solo a partir de 2 victorias o derrotas seguidas (de la sesión si hay, si no de las últimas 20).</p>}
                        {selected === 'topChamps' && <p className="text-[11px] text-[#6b7280]">Campeones más jugados en las últimas 20 partidas de la cola elegida, con winrate y KDA.</p>}
                        {selected === 'mastery' && <p className="text-[11px] text-[#6b7280]">Top de maestría de la cuenta (nivel y puntos). Se actualiza cada hora.</p>}
                        {selected === 'lpGraph' && <p className="text-[11px] text-[#6b7280]">Curva de LP de la sesión de hoy. Solo aparece en vivo y con al menos dos cambios de LP.</p>}
                        {selected === 'session' && (
                            <Checkbox checked={el.showDelta !== false} onChange={v => setEl({ showDelta: v })} label="Mostrar delta de puntos (+38 LP)" />
                        )}
                        {hasFont && (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label>Fuente</Label>
                                        <SelectInput value={el.font?.family ?? 'Inter'} onChange={v => setFont({ family: v })} options={FONT_FAMILIES.map(f => ({ value: f, label: f }))} />
                                    </div>
                                    <div>
                                        <Label>Peso</Label>
                                        <SelectInput value={String(el.font?.weight ?? 500)} onChange={v => setFont({ weight: Number(v) })} options={[400, 500, 600, 700, 800].map(w => ({ value: String(w), label: String(w) }))} />
                                    </div>
                                </div>
                                <div><Label>Tamaño</Label><Slider value={el.font?.size ?? 14} onChange={v => setFont({ size: v })} min={8} max={72} unit="px" /></div>
                                <div><Label>Color</Label><ColorInput value={el.font?.color ?? '#ffffff'} onChange={v => setFont({ color: v })} /></div>
                                <Checkbox checked={!!el.font?.shadow} onChange={v => setFont({ shadow: v })} label="Sombra de texto" />
                            </div>
                        )}
                        {selected === 'gameLogo' && <p className="text-[11px] text-[#6b7280]">Muestra el nombre del juego en el color de acento, arriba del rango.</p>}
                    </div>
                </Card>
            </div>
        </div>
    );
};
