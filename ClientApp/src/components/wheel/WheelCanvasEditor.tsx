/**
 * El editor del lienzo de la Rueda, sobre el editor compartido de overlays
 * (`components/overlay-editor`), el mismo que usan Song Request, Shoutout, Sound Alerts,
 * Now Playing y Event Alerts.
 *
 * Sustituye a `LayoutEditor` SIN cambiar lo que se guarda: lee y escribe exactamente
 * `visual.layout` (fondo, rueda, tarjeta del ganador, celebracion, marca, y los textos e
 * imagenes libres con sus animaciones y su "cuando"). Las ruedas existentes no se mueven
 * ni se migran. Lo que se conserva del editor anterior, y por que:
 *
 * 1. **La caja de la rueda mantiene la proporcion.** Cada presentacion declara su `aspect`;
 *    estirar solo el ancho dejaria una tira dibujada como rueda. Manda el alto y el ancho
 *    sale de la proporcion, anclado al borde que NO se arrastra (si se escribe el ancho a
 *    mano, manda el ancho).
 * 2. **Dibuja la presentacion de verdad**, no un rectangulo con una etiqueta: el mismo
 *    componente que sale en OBS, a tamano real de lienzo (el editor lo escala).
 * 3. **El fondo es una caja** y se puede apagar.
 * 4. **No hay "posicion por defecto" que aplicar al abrir.** Mientras el streamer no mueva
 *    nada, `visual.layout` sigue en `null` y el overlay usa el reparto automatico. Se
 *    muestra el reparto traducido a coordenadas, pero no se guarda hasta el primer cambio.
 *    "Volver al automatico" devuelve `null`.
 */
import { useCallback, useMemo, useState } from 'react';
import { RotateCcw, Trash2, Type, Image as ImageIcon, Maximize2 } from 'lucide-react';
import OverlayCanvasEditor, { type EditorElement, type Rect } from '../overlay-editor/OverlayCanvasEditor';
import { Field, inputClass, Toggle } from '../overlay-editor/ui';
import MediaInputWithSelector from '../timer/MediaInputWithSelector';
import {
    CANVAS_HEIGHT, CANVAS_WIDTH, clampBox, defaultLayout, esVideoUrl, fitBoxToAspect,
    LAYOUT_ANIMATIONS, MAX_MEDIA, MAX_TEXTS, PIECE_WHENS,
    WATERMARK_BASE_HEIGHT, WINNER_BASE_HEIGHT,
    type LayoutAnimation, type LayoutBox, type LayoutMedia, type LayoutPart,
    type LayoutText, type PieceWhen, type WheelLayout, type WheelVisual,
} from './visualConfig';
import { presentationOf } from './presentations';
import type { FaceSegment } from './WheelFace';

type Piece = LayoutText | LayoutMedia;

/** Tamanos minimos, en pixeles del lienzo. */
const MINIMOS: Record<string, { width: number; height: number }> = {
    wheel: { width: 120, height: 120 },
    winner: { width: 220, height: 40 },
    background: { width: 40, height: 40 },
    celebration: { width: 120, height: 120 },
    // La marca es de pago: encogerla hasta que no se lea seria apagarla sin tener el
    // tier. El servidor vuelve a comprobarlo al guardar; aqui solo evita el gesto.
    watermark: { width: 150, height: 12 },
    pieza: { width: 40, height: 24 },
};

/** Encima de la rueda y de la tarjeta, debajo de la celebracion. */
const Z_NUEVA_PIEZA = 4;

const PART_PREFIX = 'part:';
const isPart = (id: string) => id.startsWith(PART_PREFIX);
const partOf = (id: string) => id.slice(PART_PREFIX.length) as LayoutPart;

interface Props {
    visual: WheelVisual;
    onVisual: (cambios: Partial<WheelVisual>) => void;
    segments: FaceSegment[];
    t: (k: string, o?: Record<string, unknown>) => string;
}

export default function WheelCanvasEditor({ visual, onVisual, segments, t }: Props) {
    // Solo sirve para pedirle al editor que elija lo recien agregado; la seleccion vive en el.
    const [focusId, setFocusId] = useState<string | undefined>(undefined);
    const pres = useMemo(() => presentationOf(visual), [visual]);
    const automatico = visual.layout === null;

    // Lo que se dibuja. Si la rueda todavia no tiene lienzo se muestra el reparto
    // automatico traducido a coordenadas: asi se ve de donde parte, pero no se guarda
    // nada hasta que se mueva algo.
    const layout: WheelLayout = useMemo(() => {
        const base = visual.layout ?? defaultLayout(pres.aspect);
        return { ...base, wheel: fitBoxToAspect(base.wheel, pres.aspect) };
    }, [visual.layout, pres.aspect]);

    const piezas: Piece[] = useMemo(() => [...layout.media, ...layout.texts], [layout.media, layout.texts]);

    const etiqueta = (p: Piece) => p.kind === 'text'
        ? p.template.slice(0, 24) || t('wheel.canvas.piece_text')
        : (p.url.split('/').pop() || '').slice(0, 24) || t('wheel.canvas.piece_media');

    // ----------------------------------------------------------------
    // Los elementos del editor
    // ----------------------------------------------------------------
    // El orden de `zIndex` es el del OVERLAY (rueda 2, tarjeta 3, marca 6, piezas el suyo,
    // todos +10), para que un clic agarre lo que se ve arriba, con una excepcion: el fondo
    // y la celebracion cubren las 1920x1080 por defecto y se quedarian con todos los
    // clics, asi que van por debajo de todo (0 y 1). Se eligen igual desde la lista.
    const elements: EditorElement[] = useMemo(() => {
        const fija = (part: LayoutPart, z: number, extra: Partial<EditorElement> = {}): EditorElement => ({
            id: PART_PREFIX + part, label: t(`wheel.canvas.part_${part}`),
            ...(layout[part] as LayoutBox), enabled: true, toggleable: false, zIndex: z, ...extra,
        });
        return [
            fija('wheel', 12),
            fija('winner', 13),
            ...piezas.map<EditorElement>(p => ({
                id: p.id, label: etiqueta(p), x: p.x, y: p.y, width: p.width, height: p.height,
                enabled: true, toggleable: false, zIndex: 10 + p.zIndex,
            })),
            ...(visual.showWatermark ? [fija('watermark', 16)] : []),
            fija('celebration', 1),
            fija('background', 0, { enabled: layout.background.enabled, toggleable: true }),
        ];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layout, piezas, visual.showWatermark, t]);

    const cajaDe = useCallback((id: string): LayoutBox | null => {
        if (isPart(id)) return layout[partOf(id)] as LayoutBox;
        return piezas.find(p => p.id === id) ?? null;
    }, [layout, piezas]);

    /** Escribe una caja. Siempre parte del layout efectivo: el primer cambio lo materializa. */
    const escribir = useCallback((id: string, caja: LayoutBox) => {
        if (isPart(id)) {
            const part = partOf(id);
            onVisual({ layout: { ...layout, [part]: { ...(layout[part] as LayoutBox), ...caja } } });
            return;
        }
        onVisual({
            layout: {
                ...layout,
                texts: layout.texts.map(p => (p.id === id ? { ...p, ...caja } : p)),
                media: layout.media.map(p => (p.id === id ? { ...p, ...caja } : p)),
            },
        });
    }, [layout, onVisual]);

    const onRectChange = useCallback((id: string, patch: Partial<Rect>) => {
        const cur = cajaDe(id);
        if (!cur) return;
        const min = MINIMOS[isPart(id) ? partOf(id) : 'pieza'];
        const b: LayoutBox = { ...cur, ...patch };

        // Un minimo que se alcanza arrastrando el borde izquierdo o el de arriba tiene que
        // dejar quieto el borde contrario, no empujar la caja.
        if (b.width < min.width) { if (b.x !== cur.x) b.x = cur.x + cur.width - min.width; b.width = min.width; }
        if (b.height < min.height) { if (b.y !== cur.y) b.y = cur.y + cur.height - min.height; b.height = min.height; }

        if (id === PART_PREFIX + 'wheel') {
            if (patch.width !== undefined && patch.height === undefined) {
                // Escribio el ancho a mano: manda el ancho.
                b.height = Math.max(min.height, Math.round(b.width / pres.aspect));
            } else {
                const ancho = Math.round(b.height * pres.aspect);
                // Con la esquina de la izquierda, el borde fijo es el derecho.
                const anclaDerecha = patch.x !== undefined && patch.width !== undefined
                    && patch.width !== cur.width && patch.x + patch.width === cur.x + cur.width;
                b.x = anclaDerecha ? cur.x + cur.width - ancho : b.x;
                b.width = ancho;
            }
        }
        escribir(id, clampBox(b));
    }, [cajaDe, escribir, pres.aspect]);

    const onToggle = (id: string, enabled: boolean) => {
        if (id === PART_PREFIX + 'background') {
            onVisual({ layout: { ...layout, background: { ...layout.background, enabled } } });
        }
    };

    // ----------------------------------------------------------------
    // Anadir y quitar piezas
    // ----------------------------------------------------------------
    const nuevoId = () => `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

    const anadirTexto = () => {
        if (layout.texts.length >= MAX_TEXTS) return;
        const nuevo: LayoutText = {
            kind: 'text', id: nuevoId(),
            x: 660, y: 120, width: 600, height: 110,
            when: 'always', zIndex: Z_NUEVA_PIEZA, animationIn: 'fade', animationOut: 'fade',
            template: t('wheel.canvas.newTextTemplate'),
            fontSize: 64, color: visual.bone, align: 'center', weight: 800,
            uppercase: false, outline: 0, outlineColor: visual.ink,
            background: 'transparent', radius: 0, padding: 0,
        };
        onVisual({ layout: { ...layout, texts: [...layout.texts, nuevo] } });
        setFocusId(nuevo.id);
    };

    const anadirImagen = () => {
        if (layout.media.length >= MAX_MEDIA) return;
        const nuevo: LayoutMedia = {
            kind: 'media', id: nuevoId(),
            x: 120, y: 120, width: 320, height: 320,
            when: 'always', zIndex: Z_NUEVA_PIEZA, animationIn: 'fade', animationOut: 'fade',
            // Nace SIN url: el inspector la pide y hasta que no la tenga se dibuja como un
            // hueco con su nombre. Guardar una pieza sin url la descarta al leer.
            url: '', fit: 'cover', opacity: 100, radius: 0,
            loop: true, videoAudio: false, videoVolume: 80,
        };
        onVisual({ layout: { ...layout, media: [...layout.media, nuevo] } });
        setFocusId(nuevo.id);
    };

    const quitarPieza = (id: string) => {
        onVisual({
            layout: {
                ...layout,
                texts: layout.texts.filter(p => p.id !== id),
                media: layout.media.filter(p => p.id !== id),
            },
        });
    };

    /**
     * Cambia campos que no son la caja: color, plantilla, animacion...
     * `Omit<..., 'kind'>` en los dos lados porque `LayoutText & LayoutMedia` es un tipo
     * imposible (sus `kind` son literales distintos y la interseccion sale `never`).
     */
    const editarPieza = (id: string, cambios: Partial<Omit<LayoutText, 'kind'> & Omit<LayoutMedia, 'kind'>>) =>
        onVisual({
            layout: {
                ...layout,
                texts: layout.texts.map(p => (p.id === id ? { ...p, ...cambios } as LayoutText : p)),
                media: layout.media.map(p => (p.id === id ? { ...p, ...cambios } as LayoutMedia : p)),
            },
        });

    // ----------------------------------------------------------------
    // Lo que se dibuja dentro del lienzo (a tamano real: el editor lo escala)
    // ----------------------------------------------------------------
    const kw = layout.winner.height / WINNER_BASE_HEIGHT;
    const km = layout.watermark.height / WATERMARK_BASE_HEIGHT;
    const box = (b: LayoutBox, z: number): React.CSSProperties => ({
        position: 'absolute', left: b.x, top: b.y, width: b.width, height: b.height, zIndex: z, overflow: 'hidden',
    });
    const opacidadPieza = (p: Piece) => (p.when === 'always' ? 1 : 0.65);

    const dibujo = (
        // `isolation` encierra los z-index del dibujo (una pieza con zIndex 100 no puede quedar
        // por encima de las cajas del editor) y `pointerEvents: none` deja pasar los clics a ellas.
        <div className="absolute inset-0" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, isolation: 'isolate', pointerEvents: 'none' }}>
            {/* El fondo, solo si pinta algo; con `transparent` se ve el damero del editor. */}
            {layout.background.enabled && visual.background !== 'transparent' && (
                <div style={{ ...box(layout.background, 0), background: visual.background }} />
            )}

            {piezas.map(p => (
                <div key={p.id} style={box(p, p.zIndex)}>
                    {p.kind === 'text' ? (
                        <span
                            className="block w-full"
                            style={{
                                fontSize: p.fontSize,
                                fontWeight: p.weight,
                                color: p.color,
                                textAlign: p.align,
                                textTransform: p.uppercase ? 'uppercase' : 'none',
                                background: p.background,
                                borderRadius: p.radius,
                                padding: p.padding,
                                lineHeight: 1.15,
                                WebkitTextStroke: p.outline > 0 ? `${p.outline}px ${p.outlineColor}` : undefined,
                                paintOrder: 'stroke fill',
                                opacity: opacidadPieza(p),
                            }}
                        >
                            {p.template}
                        </span>
                    ) : p.url ? (
                        // El video va SIEMPRE mudo en el panel, tenga o no audio en el
                        // overlay: quien configura no espera que el navegador hable.
                        esVideoUrl(p.url) ? (
                            <video
                                src={p.url} muted loop autoPlay playsInline
                                className="w-full h-full"
                                style={{ objectFit: p.fit, borderRadius: p.radius, opacity: (p.opacity / 100) * opacidadPieza(p) }}
                            />
                        ) : (
                            <img
                                src={p.url} alt=""
                                className="w-full h-full"
                                style={{ objectFit: p.fit, borderRadius: p.radius, opacity: (p.opacity / 100) * opacidadPieza(p) }}
                            />
                        )
                    ) : (
                        <span className="w-full h-full flex items-center justify-center text-[20px] text-ds-soft border-2 border-dashed border-ds-border">
                            {t('wheel.canvas.noImageYet')}
                        </span>
                    )}
                </div>
            ))}

            <div style={box(layout.wheel, 2)}>
                <pres.Component
                    segments={segments}
                    visual={visual}
                    spin={null}
                    phase="idle"
                    onSound={() => { }}
                    onFinished={() => { }}
                />
            </div>

            <div style={box(layout.winner, 3)} className="flex items-center justify-center">
                <div
                    className="flex flex-col items-center max-w-full"
                    style={{
                        gap: 4 * kw,
                        padding: `${14 * kw}px ${34 * kw}px`,
                        background: visual.ink,
                        border: `${3 * kw}px solid ${visual.accent}`,
                        borderRadius: 14 * kw,
                    }}
                >
                    <span style={{ color: visual.bone, fontSize: 38.9 * kw, fontWeight: visual.fontWeight, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                        {t('wheel.canvas.samplePrize')}
                    </span>
                    <span style={{ color: visual.accent, fontSize: 19 * kw, fontWeight: 600 }}>
                        {t('wheel.canvas.sampleWho')}
                    </span>
                </div>
            </div>

            {/* La celebracion no se dibuja: es confeti animado y quieto no dice nada. Se
                marca su area, que es lo unico que hay que colocar. */}
            <div style={{ ...box(layout.celebration, 5), pointerEvents: 'none' }}>
                <div className="w-full h-full border-2 border-dashed border-fuchsia-400/40 rounded" />
            </div>

            {visual.showWatermark && (
                <div
                    style={{ ...box(layout.watermark, 6), color: visual.bone, opacity: .62, fontSize: 12 * km, fontWeight: 600 }}
                    className="flex items-center justify-center whitespace-nowrap"
                >
                    Rueda de la Suerte · Decatron
                </div>
            )}
        </div>
    );

    // ----------------------------------------------------------------
    // Controles del elemento elegido
    // ----------------------------------------------------------------
    const labeled = (label: string, control: React.ReactNode) => <Field label={label}>{control}</Field>;
    const animSelect = (value: LayoutAnimation, onChange: (a: LayoutAnimation) => void) => (
        <select className={inputClass} value={value} onChange={e => onChange(e.target.value as LayoutAnimation)}>
            {LAYOUT_ANIMATIONS.map(a => <option key={a} value={a}>{t(`wheel.canvas.anim_${a}`)}</option>)}
        </select>
    );
    // Numeros sin tope al teclear: con un campo que recorta en cada pulsacion no se puede
    // escribir "64" (el "6" se recorta a 8 antes de llegar al "4"). El overlay ya sanea al leer.
    const numero = (value: number, min: number, max: number, onChange: (n: number) => void) => (
        <input type="number" className={inputClass} min={min} max={max} value={value}
            onChange={e => onChange(Number(e.target.value) || 0)} />
    );
    const colorInput = (value: string, onChange: (v: string) => void) => (
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
            className="w-14 h-9 rounded-lg bg-transparent border border-ds-border cursor-pointer" />
    );

    const extra = (id: string) => {
        const botonCubrir = (
            <button
                onClick={() => onRectChange(id, { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold bg-ds-raised text-ds-soft hover:bg-ds-raised"
            >
                <Maximize2 className="w-4 h-4" /> {t('wheel.canvas.coverAll')}
            </button>
        );

        if (id === PART_PREFIX + 'background') {
            return (
                <div className="space-y-3">
                    <Toggle
                        checked={layout.background.enabled}
                        onChange={v => onToggle(id, v)}
                        label={t('wheel.canvas.bgEnabled')}
                        hint={t('wheel.canvas.bgColorNote')}
                    />
                    {botonCubrir}
                </div>
            );
        }
        if (id === PART_PREFIX + 'celebration') return botonCubrir;

        if (id === PART_PREFIX + 'winner') {
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(['winnerAnimationIn', 'winnerAnimationOut'] as const).map(campo => (
                        <Field key={campo} label={t(`wheel.canvas.f_${campo}`)}>
                            {animSelect(layout[campo], a => onVisual({ layout: { ...layout, [campo]: a } }))}
                        </Field>
                    ))}
                </div>
            );
        }

        const p = piezas.find(x => x.id === id);
        if (!p) return null;

        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {labeled(t('wheel.canvas.f_when'), (
                        <select className={inputClass} value={p.when} onChange={e => editarPieza(p.id, { when: e.target.value as PieceWhen })}>
                            {PIECE_WHENS.map(w => <option key={w} value={w}>{t(`wheel.canvas.when_${w}`)}</option>)}
                        </select>
                    ))}
                    {labeled(t('wheel.canvas.f_zIndex'), (
                        <input type="number" className={inputClass} value={p.zIndex}
                            onChange={e => editarPieza(p.id, { zIndex: Math.round(Number(e.target.value) || 0) })} />
                    ))}
                    {(['animationIn', 'animationOut'] as const).map(campo => (
                        <Field key={campo} label={t(`wheel.canvas.f_${campo}`)}>
                            {animSelect(p[campo], a => editarPieza(p.id, { [campo]: a }))}
                        </Field>
                    ))}
                </div>

                {p.kind === 'text' ? (
                    <div className="space-y-3">
                        {labeled(t('wheel.canvas.f_template'), (
                            <input type="text" className={inputClass} value={p.template}
                                onChange={e => editarPieza(p.id, { template: e.target.value })} />
                        ))}
                        <p className="text-xs 3xl:text-sm text-ds-soft">{t('wheel.canvas.varsHelp')}</p>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {([['fontSize', 8, 400], ['weight', 100, 900], ['outline', 0, 16], ['padding', 0, 200], ['radius', 0, 200]] as const).map(([campo, min, max]) => (
                                <Field key={campo} label={t(`wheel.canvas.f_${campo}`)}>
                                    {numero(p[campo], min, max, n => editarPieza(p.id, { [campo]: n }))}
                                </Field>
                            ))}
                            {labeled(t('wheel.canvas.f_align'), (
                                <select className={inputClass} value={p.align} onChange={e => editarPieza(p.id, { align: e.target.value as LayoutText['align'] })}>
                                    {(['left', 'center', 'right'] as const).map(a => <option key={a} value={a}>{t(`wheel.canvas.align_${a}`)}</option>)}
                                </select>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-end gap-4">
                            {labeled(t('wheel.canvas.f_color'), colorInput(p.color, v => editarPieza(p.id, { color: v })))}
                            {labeled(t('wheel.canvas.f_outlineColor'), colorInput(p.outlineColor, v => editarPieza(p.id, { outlineColor: v })))}
                            {p.background !== 'transparent' && labeled(t('wheel.canvas.f_textBg'), colorInput(p.background, v => editarPieza(p.id, { background: v })))}
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-3">
                            <Toggle checked={p.uppercase} onChange={v => editarPieza(p.id, { uppercase: v })} label={t('wheel.canvas.f_uppercase')} />
                            {/* Una caja detras del texto, para que se lea sobre cualquier escena. */}
                            <Toggle
                                checked={p.background !== 'transparent'}
                                onChange={v => editarPieza(p.id, { background: v ? visual.ink : 'transparent' })}
                                label={t('wheel.canvas.f_textBg')}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <MediaInputWithSelector
                            value={p.url}
                            onChange={v => editarPieza(p.id, { url: v })}
                            label={t('wheel.canvas.f_image')}
                            allowedTypes={['image', 'video']}
                        />
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {labeled(t('wheel.canvas.f_fit'), (
                                <select className={inputClass} value={p.fit} onChange={e => editarPieza(p.id, { fit: e.target.value as LayoutMedia['fit'] })}>
                                    {(['cover', 'contain', 'fill'] as const).map(f => <option key={f} value={f}>{t(`wheel.canvas.fit_${f}`)}</option>)}
                                </select>
                            ))}
                            {([['opacity', 0, 100], ['radius', 0, 400]] as const).map(([campo, min, max]) => (
                                <Field key={campo} label={t(`wheel.canvas.f_${campo}`)}>
                                    {numero(p[campo], min, max, n => editarPieza(p.id, { [campo]: n }))}
                                </Field>
                            ))}
                        </div>

                        {/* Solo para video, y se decide por la extension del archivo: un
                            campo aparte seria un segundo sitio donde la misma verdad puede
                            desincronizarse. */}
                        {esVideoUrl(p.url) && (
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-x-6 gap-y-3">
                                    <Toggle checked={p.loop} onChange={v => editarPieza(p.id, { loop: v })} label={t('wheel.canvas.f_loop')} />
                                    <Toggle checked={p.videoAudio} onChange={v => editarPieza(p.id, { videoAudio: v })} label={t('wheel.canvas.f_videoAudio')} />
                                </div>
                                {p.videoAudio && (
                                    <div className="max-w-[10rem]">
                                        {labeled(t('wheel.canvas.f_videoVolume'), numero(p.videoVolume, 0, 100, n => editarPieza(p.id, { videoVolume: n })))}
                                    </div>
                                )}
                                <p className="text-xs 3xl:text-sm text-ds-soft">{t('wheel.canvas.videoNote')}</p>
                            </div>
                        )}
                    </div>
                )}

                <button
                    onClick={() => quitarPieza(p.id)}
                    className="px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold bg-ds-danger-solid/10 border border-ds-danger/40 text-ds-danger hover:bg-ds-danger-solid/20 transition-colors flex items-center gap-1.5"
                >
                    <Trash2 className="w-4 h-4" />
                    {t('wheel.canvas.removePiece')}
                </button>
            </div>
        );
    };

    // El aviso esta SIEMPRE, cambiando el texto, y no aparece y desaparece; con una altura
    // minima para que el primer arrastre (que lo cambia de "automatico" a "fijo") no mueva
    // el lienzo bajo el cursor.
    const notice = (
        <div className="space-y-2">
            <p className="text-xs 3xl:text-sm text-ds-soft bg-ds-bg border border-ds-border rounded-lg px-3 py-2 min-h-[4.5rem] md:min-h-[3rem]">
                {/* Cada clave entera en su propia llamada: la auditoria de i18n las busca
                    con una expresion regular y una armada con ternaria no la ve. */}
                {automatico ? t('wheel.canvas.autoNote') : t('wheel.canvas.fixedNote')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs 3xl:text-sm text-ds-soft">{t('wheel.canvas.size')}</span>
                <button
                    onClick={() => onVisual({ layout: null })}
                    disabled={automatico}
                    className="ds-btn ds-btn--secondary ds-btn--sm ml-auto"
                >
                    <RotateCcw className="w-4 h-4" />
                    {t('wheel.canvas.reset')}
                </button>
            </div>
        </div>
    );

    const addButton = (onClick: () => void, disabled: boolean, icon: React.ReactNode, label: string) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className="px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold bg-ds-raised text-ds-soft hover:bg-ds-raised disabled:opacity-40 transition-colors flex items-center gap-1.5"
        >
            {icon}{label}
        </button>
    );

    return (
        // El panel de la Rueda es oscuro siempre; el editor compartido admite claro y oscuro.
        // Con `dark` aqui se ve igual que el resto del panel en cualquiera de los dos temas.
        <div className="dark">
            <OverlayCanvasEditor
                canvas={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
                elements={elements}
                onRectChange={onRectChange}
                onToggle={onToggle}
                title={t('wheel.canvas.title')}
                description={t('wheel.canvas.help')}
                notice={notice}
                initialSelected={PART_PREFIX + 'wheel'}
                selectedId={focusId}
                noRaise={[PART_PREFIX + 'background', PART_PREFIX + 'celebration']}
                selectedExtra={extra}
                layersActions={(
                    <div className="flex flex-wrap gap-2">
                        {addButton(anadirTexto, layout.texts.length >= MAX_TEXTS, <Type className="w-4 h-4" />, t('wheel.canvas.addText'))}
                        {addButton(anadirImagen, layout.media.length >= MAX_MEDIA, <ImageIcon className="w-4 h-4" />, t('wheel.canvas.addImage'))}
                    </div>
                )}
            >
                {dibujo}
            </OverlayCanvasEditor>
        </div>
    );
}
