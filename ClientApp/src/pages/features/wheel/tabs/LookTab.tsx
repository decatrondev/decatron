import { RotateCcw, Volume2, VolumeX } from 'lucide-react';
import MediaInputWithSelector from '../../../../components/timer/MediaInputWithSelector';
import { type Celebration, DEFAULT_VISUAL, type Easing, FONT_KEYS, type FontKey, FONTS, LAYOUT_ANIMATIONS, type LayoutAnimation, NEEDLE_SHAPES, NEEDLE_SIDES, type NeedleShape, type NeedleSide, PRESENTATION_KEYS, type PresentationKey, type SoundKey, type SoundMode, WHEEL_VISIBILITIES, type WheelVisibility, type WheelVisual } from '../../../../components/wheel/visualConfig';
import WheelFace from '../../../../components/wheel/WheelFace';
import { applyTemplate, TEMPLATES } from '../../../../components/wheel/templates';
import { type Presentation, presentationOf, soundsFor } from '../../../../components/wheel/presentations';
import { CARD, FIELD, Row, Toggle } from '../ui';

export const MUESTRA_PLANTILLA = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1, label: '', color: null, icon: null,
}));

/// Los nombres propios de cada familia. No se traducen — "Bebas Neue" se llama
/// igual en los dos idiomas. La unica que si se traduce es la del sistema, que no
/// es una familia sino "la que traiga el equipo".
export const FONT_NAMES: Record<Exclude<FontKey, 'system'>, string> = {
    inter: 'Inter',
    chakra: 'Chakra Petch',
    outfit: 'Outfit',
    fredoka: 'Fredoka',
    bebas: 'Bebas Neue',
    luckiest: 'Luckiest Guy',
    press: 'Press Start 2P',
    jetbrains: 'JetBrains Mono',
};

/// La pestana Aspecto: colores, cubo, tipografia, tiempos del giro y sonidos.
///
/// El preview vive en la columna de al lado y usa el MISMO componente que el
/// overlay, asi que cada cambio de color o de imagen se ve al instante sin tener
/// que abrir OBS.
export function LookTab({ visual, onVisual, onPointer, onSound, mode, canHideWatermark, onTestCelebration, t }: {
    visual: WheelVisual;
    onVisual: (c: Partial<WheelVisual>) => void;
    onPointer: (c: Partial<WheelVisual['pointer']>) => void;
    onSound: (k: SoundKey, c: Partial<WheelVisual['sounds'][SoundKey]>) => void;
    /** `prizes` o `raffle`: el Sorteo tiene su propio arranque y su propia celebracion. */
    mode: string;
    canHideWatermark: boolean;
    onTestCelebration: () => void;
    t: any;
}) {
    const fondoTransparente = visual.background === 'transparent';
    // La presentacion decide que controles tienen sentido. Un ajuste que no hace
    // nada es peor que un ajuste que falta: el streamer lo mueve, no pasa nada y
    // asume que la feature esta rota.
    const pres: Presentation = presentationOf(visual);

    return (
        <div className="space-y-4">
            {/* --- presentacion --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-ds-border">
                    <h2 className="font-bold text-ds-text">{t('wheel.look.presentationTitle')}</h2>
                    <p className="text-xs text-ds-soft mt-0.5">{t('wheel.look.presentationHelp')}</p>
                </div>

                <Row label={t('wheel.look.presentation')} help={t('wheel.look.presentationRowHelp')}>
                    <select
                        value={visual.presentation}
                        onChange={e => onVisual({ presentation: e.target.value as PresentationKey })}
                        className={FIELD}
                        disabled={PRESENTATION_KEYS.length < 2}
                    >
                        {PRESENTATION_KEYS.map(k => (
                            <option key={k} value={k}>{t(`wheel.look.pres_${k}`)}</option>
                        ))}
                    </select>
                    {PRESENTATION_KEYS.length < 2 && (
                        <span className="text-xs text-ds-soft ml-3">{t('wheel.look.presentationOnlyOne')}</span>
                    )}
                </Row>
            </section>

            {/* --- plantillas ---
                Un aspecto entero de un clic. No tocan el lienzo ni la presentacion:
                ver el comentario de cabecera de `templates.ts`. Como el aspecto no
                se guarda hasta pulsar Guardar, probarse una y salir no deja rastro. */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-ds-border">
                    <h2 className="font-bold text-ds-text">{t('wheel.look.templatesTitle')}</h2>
                    <p className="text-xs text-ds-soft mt-0.5">{t('wheel.look.templatesHelp')}</p>
                </div>

                <div className="px-5 py-4 flex flex-wrap gap-3">
                    {TEMPLATES.map(tpl => (
                        <button
                            key={tpl.key}
                            onClick={() => onVisual(applyTemplate(visual, tpl))}
                            className="w-32 rounded-lg border border-ds-border bg-ds-bg hover:border-ds-accent transition-colors p-2 text-center"
                            title={t(`wheel.look.tpl_${tpl.key}`)}
                        >
                            {/* La miniatura la dibuja el MISMO componente que el overlay,
                                con la plantilla ya aplicada: lo que se ve en el boton es
                                literalmente lo que va a salir. */}
                            <div className="aspect-square">
                                <WheelFace
                                    segments={MUESTRA_PLANTILLA}
                                    visual={applyTemplate(visual, tpl)}
                                />
                            </div>
                            <span className="block text-xs font-medium text-ds-text mt-1.5">
                                {t(`wheel.look.tpl_${tpl.key}`)}
                            </span>
                        </button>
                    ))}
                </div>
            </section>

            {/* --- el puntero ---
                Solo si la presentacion tiene alguno, y solo los controles de SU
                clase: forma y lado son de la aguja, grosor y puntas del visor. La
                carta y la bola no muestran nada — la bola es su propia marca y la
                carta no sortea a la vista. */}
            {pres.pointer !== 'none' && (
                <section className={CARD}>
                    <div className="px-5 py-4 border-b border-ds-border">
                        <h2 className="font-bold text-ds-text">{t('wheel.look.pointerTitle')}</h2>
                        <p className="text-xs text-ds-soft mt-0.5">
                            {pres.pointer === 'needle'
                                ? t('wheel.look.pointerHelpNeedle')
                                : t('wheel.look.pointerHelpViewer')}
                        </p>
                    </div>

                    <Row label={t('wheel.look.pointerHidden')} help={t('wheel.look.pointerHiddenHelp')}>
                        <Toggle on={visual.pointer.hidden} onChange={v => onPointer({ hidden: v })} />
                    </Row>

                    {!visual.pointer.hidden && (
                        <>
                            {pres.pointer === 'needle' && (
                                <>
                                    <Row label={t('wheel.look.pointerShape')} help={t('wheel.look.pointerShapeHelp')}>
                                        <select
                                            value={visual.pointer.shape}
                                            onChange={e => onPointer({ shape: e.target.value as NeedleShape })}
                                            className={FIELD}
                                        >
                                            {NEEDLE_SHAPES.map(k => (
                                                <option key={k} value={k}>{t(`wheel.look.shape_${k}`)}</option>
                                            ))}
                                        </select>
                                    </Row>

                                    <Row label={t('wheel.look.pointerSide')} help={t('wheel.look.pointerSideHelp')}>
                                        <select
                                            value={visual.pointer.side}
                                            onChange={e => onPointer({ side: e.target.value as NeedleSide })}
                                            className={FIELD}
                                        >
                                            {NEEDLE_SIDES.map(k => (
                                                <option key={k} value={k}>{t(`wheel.look.side_${k}`)}</option>
                                            ))}
                                        </select>
                                    </Row>
                                </>
                            )}

                            {pres.pointer === 'viewer' && (
                                <>
                                    <Row label={t('wheel.look.pointerThickness')} help={t('wheel.look.pointerThicknessHelp')}>
                                        <input
                                            type="number" min={1} max={14}
                                            value={visual.pointer.thickness}
                                            onChange={e => onPointer({ thickness: Number(e.target.value) || 1 })}
                                            className={`${FIELD} w-24`}
                                        />
                                    </Row>

                                    <Row label={t('wheel.look.pointerCaps')} help={t('wheel.look.pointerCapsHelp')}>
                                        <Toggle on={visual.pointer.caps} onChange={v => onPointer({ caps: v })} />
                                    </Row>
                                </>
                            )}

                            <Row label={t('wheel.look.pointerSize')} help={t('wheel.look.pointerSizeHelp')}>
                                <input
                                    type="range" min={0.4} max={3} step={0.1}
                                    value={visual.pointer.size}
                                    onChange={e => onPointer({ size: Number(e.target.value) })}
                                    className="w-40 accent-ds-accent"
                                />
                                <span className="text-xs text-ds-soft ml-3 tabular-nums">{visual.pointer.size.toFixed(1)}x</span>
                            </Row>

                            <Row label={t('wheel.look.pointerColor')} help={t('wheel.look.pointerColorHelp')}>
                                <input
                                    type="color"
                                    value={visual.pointer.color ?? visual.accent}
                                    onChange={e => onPointer({ color: e.target.value })}
                                    className="w-10 h-10 rounded-lg bg-transparent border border-ds-border cursor-pointer"
                                />
                                {visual.pointer.color && (
                                    <button
                                        onClick={() => onPointer({ color: null })}
                                        className="text-xs text-ds-soft hover:text-ds-text ml-3"
                                    >
                                        {t('wheel.look.pointerColorReset')}
                                    </button>
                                )}
                            </Row>
                        </>
                    )}
                </section>
            )}

            {/* --- colores --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-ds-border">
                    <h2 className="font-bold text-ds-text">{t('wheel.look.colorsTitle')}</h2>
                    <p className="text-xs text-ds-soft mt-0.5">{t('wheel.look.colorsHelp')}</p>
                </div>

                {([
                    ['accent', t('wheel.look.accent'), t('wheel.look.accentHelp')],
                    ['ink', t('wheel.look.ink'), t('wheel.look.inkHelp')],
                    ['bone', t('wheel.look.bone'), t('wheel.look.boneHelp')],
                ] as const).map(([campo, label, help]) => (
                    <Row key={campo} label={label} help={help}>
                        <input
                            type="color"
                            value={visual[campo]}
                            onChange={e => onVisual({ [campo]: e.target.value } as Partial<WheelVisual>)}
                            className="w-10 h-10 rounded-lg bg-transparent border border-ds-border cursor-pointer"
                        />
                        <code className="text-xs text-ds-soft ml-2">{visual[campo]}</code>
                    </Row>
                ))}

                <Row label={t('wheel.look.background')} help={t('wheel.look.backgroundHelp')}>
                    <Toggle
                        on={fondoTransparente}
                        onChange={v => onVisual({ background: v ? 'transparent' : '#12101B' })}
                    />
                    <span className="text-xs text-ds-soft ml-3">{t('wheel.look.transparent')}</span>
                    {!fondoTransparente && (
                        <input
                            type="color"
                            value={visual.background}
                            onChange={e => onVisual({ background: e.target.value })}
                            className="w-10 h-10 rounded-lg bg-transparent border border-ds-border cursor-pointer ml-3"
                        />
                    )}
                    {/* El color se elige aca; DONDE se pinta es del lienzo. Antes se
                        pintaba la pantalla entera, que tapaba la escena del streamer
                        de lado a lado. Sin lienzo, se pinta solo alrededor de la rueda. */}
                    {!fondoTransparente && (
                        <p className="text-xs text-ds-soft mt-2 basis-full">{t('wheel.look.backgroundBoxNote')}</p>
                    )}
                </Row>

                {/* La marca de agua solo se puede apagar desde premium. El backend lo
                    fuerza igual al guardar: esconder el toggle no es una regla. */}
                <Row label={t('wheel.look.watermark')} help={canHideWatermark ? t('wheel.look.watermarkHelp') : t('wheel.look.watermarkLocked')}>
                    {canHideWatermark ? (
                        <Toggle on={visual.showWatermark} onChange={v => onVisual({ showWatermark: v })} />
                    ) : (
                        <span className="text-xs text-ds-soft">{t('wheel.look.watermarkAlwaysOn')}</span>
                    )}
                </Row>

                <div className="px-5 py-4 border-t border-ds-border">
                    <p className="text-sm font-medium text-ds-text">{t('wheel.look.palette')}</p>
                    <p className="text-xs text-ds-soft mt-0.5 mb-3">{t('wheel.look.paletteHelp')}</p>
                    <div className="flex flex-wrap items-center gap-2">
                        {visual.palette.map((c, i) => (
                            <div key={i} className="relative">
                                <input
                                    type="color"
                                    value={c}
                                    onChange={e => {
                                        const p = [...visual.palette];
                                        p[i] = e.target.value;
                                        onVisual({ palette: p });
                                    }}
                                    className="w-10 h-10 rounded-lg bg-transparent border border-ds-border cursor-pointer"
                                />
                                {/* Con un solo color la paleta deja de poder rotar entre
                                    gajos, asi que el ultimo no se puede quitar. */}
                                {visual.palette.length > 1 && (
                                    <button
                                        onClick={() => onVisual({ palette: visual.palette.filter((_, j) => j !== i) })}
                                        className="ds-btn ds-btn--secondary absolute w-4"
                                        aria-label={t('wheel.look.paletteRemove')}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            onClick={() => onVisual({ palette: [...visual.palette, '#E8B455'] })}
                            className="w-10 h-10 rounded-lg border border-dashed border-ds-border text-ds-soft hover:text-ds-text hover:border-ds-border transition-colors"
                            aria-label={t('wheel.look.paletteAdd')}
                        >
                            +
                        </button>
                    </div>
                </div>
            </section>

            {/* --- cubo central --- */}
            {pres.parts.centerImage && (
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-ds-border">
                    <h2 className="font-bold text-ds-text">{t('wheel.look.centerTitle')}</h2>
                    <p className="text-xs text-ds-soft mt-0.5">{t('wheel.look.centerHelp')}</p>
                </div>
                <div className="p-5">
                    {/* Sale de la biblioteca de medios compartida, no de un subidor
                        propio de la rueda: la cuota es la global del tier. */}
                    <MediaInputWithSelector
                        value={visual.centerImage || ''}
                        onChange={v => onVisual({ centerImage: v || null })}
                        label={t('wheel.look.centerImage')}
                        placeholder={t('wheel.look.centerPlaceholder')}
                        allowedTypes={['image', 'gif']}
                    />

                    {visual.centerImage && (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <span className="text-xs text-ds-soft">{t('wheel.look.centerSize')}</span>
                            <input
                                type="range" min={20} max={140} step={2}
                                value={visual.centerImageSize}
                                onChange={e => onVisual({ centerImageSize: Number(e.target.value) })}
                                className="w-48"
                            />
                            <span className="text-xs text-ds-soft tabular-nums w-10">
                                {visual.centerImageSize}
                            </span>
                            <button
                                onClick={() => onVisual({ centerImage: null })}
                                className="text-xs text-ds-soft hover:text-ds-danger transition-colors ml-auto"
                            >
                                {t('wheel.look.centerClear')}
                            </button>
                        </div>
                    )}
                </div>
            </section>
            )}

            {/* --- tipografia --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-ds-border">
                    <h2 className="font-bold text-ds-text">{t('wheel.look.typoTitle')}</h2>
                    <p className="text-xs text-ds-soft mt-0.5">{t('wheel.look.typoHelp')}</p>
                </div>

                <Row label={t('wheel.look.font')} help={t('wheel.look.fontHelp')}>
                    <select
                        value={visual.font}
                        onChange={e => onVisual({ font: e.target.value as FontKey })}
                        className={FIELD}
                        // Cada opcion se dibuja con su propia letra: elegir tipografia
                        // por el nombre obliga a probarlas una por una.
                    >
                        {FONT_KEYS.map(k => (
                            <option key={k} value={k} style={{ fontFamily: FONTS[k].stack }}>
                                {k === 'system' ? t('wheel.look.fontSystem') : FONT_NAMES[k]}
                            </option>
                        ))}
                    </select>
                </Row>

                <Row label={t('wheel.look.fontWeight')} help={t('wheel.look.fontWeightHelp')}>
                    {FONTS[visual.font].weights.length > 1 ? (
                        <select
                            value={visual.fontWeight}
                            onChange={e => onVisual({ fontWeight: Number(e.target.value) })}
                            className={FIELD}
                        >
                            {FONTS[visual.font].weights.map(w => (
                                <option key={w} value={w}>{w}</option>
                            ))}
                        </select>
                    ) : (
                        // Una familia de un solo peso no ofrece un selector de un item:
                        // parece roto. Se dice que esa letra viene con un grosor solo.
                        <span className="text-xs text-ds-soft">{t('wheel.look.fontOneWeight')}</span>
                    )}
                </Row>

                <Row label={t('wheel.look.textScale')} help={t('wheel.look.textScaleHelp')}>
                    <input
                        type="range" min={0.5} max={2} step={0.05}
                        value={visual.textScale}
                        onChange={e => onVisual({ textScale: Number(e.target.value) })}
                        className="w-40 accent-ds-accent"
                    />
                    <span className="text-xs text-ds-soft ml-3 tabular-nums w-12 inline-block">
                        {Math.round(visual.textScale * 100)}%
                    </span>
                </Row>

                <Row label={t('wheel.look.textUppercase')} help={t('wheel.look.textUppercaseHelp')}>
                    <Toggle on={visual.textUppercase} onChange={v => onVisual({ textUppercase: v })} />
                </Row>

                <Row label={t('wheel.look.textColor')} help={t('wheel.look.textColorHelp')}>
                    <Toggle
                        on={visual.textColor === null}
                        onChange={v => onVisual({ textColor: v ? null : visual.ink })}
                    />
                    <span className="text-xs text-ds-soft ml-3">{t('wheel.look.followsInk')}</span>
                    {visual.textColor !== null && (
                        <input
                            type="color"
                            value={visual.textColor}
                            onChange={e => onVisual({ textColor: e.target.value })}
                            className="ml-3 w-11 h-9 bg-transparent border border-ds-border rounded-lg cursor-pointer align-middle"
                        />
                    )}
                </Row>

                <Row label={t('wheel.look.textOutline')} help={t('wheel.look.textOutlineHelp')}>
                    <input
                        type="range" min={0} max={6} step={0.5}
                        value={visual.textOutline}
                        onChange={e => onVisual({ textOutline: Number(e.target.value) })}
                        className="w-40 accent-ds-accent"
                    />
                    <span className="text-xs text-ds-soft ml-3 tabular-nums w-12 inline-block">
                        {visual.textOutline === 0 ? t('wheel.look.outlineOff') : visual.textOutline}
                    </span>
                    {visual.textOutline > 0 && (
                        <input
                            type="color"
                            value={visual.textOutlineColor ?? visual.bone}
                            onChange={e => onVisual({ textOutlineColor: e.target.value })}
                            className="ml-3 w-11 h-9 bg-transparent border border-ds-border rounded-lg cursor-pointer align-middle"
                            aria-label={t('wheel.look.textOutlineColor')}
                        />
                    )}
                </Row>
            </section>

            {/* --- movimiento --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-ds-border">
                    <h2 className="font-bold text-ds-text">{t('wheel.look.motionTitle')}</h2>
                </div>

                <Row label={t('wheel.look.visibility')} help={t(`wheel.look.visibilityHelp_${visual.visibility}`)}>
                    <select
                        value={visual.visibility}
                        onChange={e => onVisual({ visibility: e.target.value as WheelVisibility })}
                        className={FIELD}
                    >
                        {WHEEL_VISIBILITIES.filter(v => v !== 'registration' || mode === 'raffle').map(v => (
                            <option key={v} value={v}>{t(`wheel.look.visibility_${v}`)}</option>
                        ))}
                    </select>
                    {visual.visibility !== 'always' && (
                        <select
                            value={visual.visibilityAnimation}
                            onChange={e => onVisual({ visibilityAnimation: e.target.value as LayoutAnimation })}
                            className={`${FIELD} ml-3`}
                            aria-label={t('wheel.look.visibilityAnimation')}
                        >
                            {LAYOUT_ANIMATIONS.map(a => (
                                <option key={a} value={a}>{t('wheel.look.visibilityAnimation')}: {t(`wheel.canvas.anim_${a}`)}</option>
                            ))}
                        </select>
                    )}
                </Row>

                {pres.motion.spinSeconds && (
                <Row label={t('wheel.look.spinSeconds')} help={t('wheel.look.spinSecondsHelp')}>
                    <input
                        type="number" min={1} max={20} step={0.2}
                        value={visual.spinSeconds}
                        onChange={e => onVisual({ spinSeconds: Number(e.target.value) })}
                        className={`${FIELD} w-24`}
                    />
                </Row>
                )}

                {pres.motion.turns && (
                <Row label={t('wheel.look.turns')} help={t('wheel.look.turnsHelp')}>
                    <input
                        type="number" min={1} max={12}
                        value={visual.turns}
                        onChange={e => onVisual({ turns: Number(e.target.value) })}
                        className={`${FIELD} w-24`}
                    />
                </Row>
                )}

                {pres.motion.easing && (
                <Row label={t('wheel.look.easing')} help={t('wheel.look.easingHelp')}>
                    <select
                        value={visual.easing}
                        onChange={e => onVisual({ easing: e.target.value as Easing })}
                        className={FIELD}
                    >
                        <option value="quint">{t('wheel.look.easingQuint')}</option>
                        <option value="cubic">{t('wheel.look.easingCubic')}</option>
                        <option value="expo">{t('wheel.look.easingExpo')}</option>
                    </select>
                </Row>
                )}

                <Row label={t('wheel.look.revealSeconds')} help={t('wheel.look.revealSecondsHelp')}>
                    <input
                        type="number" min={1} max={30} step={0.5}
                        value={visual.revealSeconds}
                        onChange={e => onVisual({ revealSeconds: Number(e.target.value) })}
                        className={`${FIELD} w-24`}
                    />
                </Row>

                <Row label={t('wheel.look.celebration')} help={t('wheel.look.celebrationHelp')}>
                    <select
                        value={visual.celebration}
                        onChange={e => onVisual({ celebration: e.target.value as Celebration })}
                        className={FIELD}
                    >
                        <option value="confetti">{t('wheel.look.celebConfetti')}</option>
                        <option value="flash">{t('wheel.look.celebFlash')}</option>
                        <option value="none">{t('wheel.look.celebNone')}</option>
                    </select>
                    {visual.celebration !== 'none' && (
                        <button
                            type="button"
                            onClick={onTestCelebration}
                            className="ds-btn ds-btn--secondary ml-3"
                        >
                            {t('wheel.look.celebTest')}
                        </button>
                    )}
                </Row>
            </section>

            {/* --- sonidos --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-ds-border flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="font-bold text-ds-text">{t('wheel.look.soundsTitle')}</h2>
                        <p className="text-xs text-ds-soft mt-0.5">{t('wheel.look.soundsHelp')}</p>
                    </div>
                    <button
                        onClick={() => onVisual({ sounds: DEFAULT_VISUAL.sounds })}
                        className="ds-btn ds-btn--secondary ds-btn--sm flex-shrink-0"
                    >
                        <RotateCcw className="w-4 h-4" />
                        {t('wheel.look.soundsRestore')}
                    </button>
                </div>

                <Row label={t('wheel.look.masterVolume')}>
                    <input
                        type="range" min={0} max={1} step={0.05}
                        value={visual.sounds.master}
                        onChange={e => onVisual({ sounds: { ...visual.sounds, master: Number(e.target.value) } })}
                        className="w-40"
                    />
                    <span className="text-xs text-ds-soft ml-3 tabular-nums w-10">
                        {Math.round(visual.sounds.master * 100)}%
                    </span>
                </Row>

                {soundsFor(pres, mode).map(key => {
                    const cfg = visual.sounds[key];
                    // spin_tick no admite sonido propio: se reproduce en bucle rapido
                    // mientras la rueda gira y un sample con cola suena espantoso
                    // repetido treinta veces por segundo. Silenciarlo si se puede.
                    const soloDefault = key === 'spin_tick';

                    return (
                        <div key={key} className="px-5 py-4 border-t border-ds-border space-y-3">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex-1 min-w-[160px]">
                                    <p className="text-sm font-medium text-ds-text">{t(`wheel.look.sound_${key}`)}</p>
                                    <p className="text-xs text-ds-soft mt-0.5">
                                        {soloDefault
                                            ? `${t(pres.key === 'card' ? 'wheel.look.soundWhen_spin_tick_card' : 'wheel.look.soundWhen_spin_tick')} ${t('wheel.look.tickOnlyDefault')}`
                                            : t(`wheel.look.soundWhen_${key}`)}
                                    </p>
                                </div>

                                <select
                                    value={cfg.mode}
                                    onChange={e => onSound(key, { mode: e.target.value as SoundMode })}
                                    className={FIELD}
                                >
                                    <option value="default">{t('wheel.look.modeDefault')}</option>
                                    <option value="mute">{t('wheel.look.modeMute')}</option>
                                    {!soloDefault && <option value="custom">{t('wheel.look.modeCustom')}</option>}
                                </select>

                                {cfg.mode === 'mute'
                                    ? <VolumeX className="w-4 h-4 text-ds-soft" />
                                    : <Volume2 className="w-4 h-4 text-ds-soft" />}

                                {cfg.mode !== 'mute' && (
                                    <>
                                        <input
                                            type="range" min={0} max={1} step={0.05}
                                            value={cfg.volume ?? 1}
                                            onChange={e => onSound(key, { volume: Number(e.target.value) })}
                                            className="w-28"
                                            aria-label={t('wheel.look.volume')}
                                        />
                                        <span className="text-xs text-ds-soft tabular-nums w-10">
                                            {Math.round((cfg.volume ?? 1) * 100)}%
                                        </span>
                                    </>
                                )}
                            </div>

                            {cfg.mode === 'custom' && !soloDefault && (
                                <MediaInputWithSelector
                                    value={cfg.url || ''}
                                    onChange={v => onSound(key, { url: v || null })}
                                    label={t('wheel.look.soundFile')}
                                    placeholder={t('wheel.look.soundPlaceholder')}
                                    allowedTypes={['audio']}
                                />
                            )}
                        </div>
                    );
                })}
            </section>
        </div>
    );
}
