/**
 * El editor del lienzo de la Rueda.
 *
 * Un lienzo de 1920x1080 con todo lo que sale en pantalla: el fondo, la
 * presentacion, la tarjeta del ganador, la celebracion, la marca de Decatron y
 * los textos e imagenes que el streamer quiera anadir. Lo que se guarda son
 * pixeles de ese lienzo, que el overlay aplica tal cual.
 *
 * Cuatro cosas que lo separan del editor de Event Alerts:
 *
 * 1. **La caja de la rueda mantiene la proporcion.** Cada presentacion declara su
 *    `aspect`; estirar solo el ancho dejaria una tira de 3.4 dibujada como de 1.9
 *    y un carrete aplastado. El alto manda y el ancho sale de la proporcion.
 * 2. **Dibuja la presentacion de verdad**, no un rectangulo con una etiqueta. Es
 *    el mismo componente que sale en OBS.
 * 3. **El fondo es una caja.** Antes se pintaba sobre la pantalla entera y elegir
 *    un color tapaba la escena del streamer de lado a lado.
 * 4. **No hay "posicion por defecto" que aplicar al abrir.** Mientras el streamer
 *    no mueva nada, la rueda sigue con el reparto automatico, que se adapta a
 *    cualquier tamano de fuente. Restablecer vuelve a no tener ninguna.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Move, RotateCcw, Grid3x3, Plus, Trash2, Type, Image as ImageIcon, Maximize2 } from 'lucide-react';
import {
    CANVAS_HEIGHT, CANVAS_WIDTH, clampBox, defaultLayout, esVideoUrl, fitBoxToAspect,
    LAYOUT_ANIMATIONS, LAYOUT_PARTS, MAX_MEDIA, MAX_TEXTS, PIECE_WHENS,
    WATERMARK_BASE_HEIGHT, WINNER_BASE_HEIGHT,
    type LayoutAnimation, type LayoutBox, type LayoutMedia, type LayoutPart,
    type LayoutText, type PieceWhen, type WheelLayout, type WheelVisual,
} from './visualConfig';
import { presentationOf } from './presentations';
import MediaInputWithSelector from '../timer/MediaInputWithSelector';
import type { FaceSegment } from './WheelFace';

type Handle = 'nw' | 'ne' | 'sw' | 'se';
/** Que hay seleccionado: una pieza fija del reparto, o una suelta por su id. */
type Sel = { tipo: 'part'; part: LayoutPart } | { tipo: 'pieza'; id: string } | null;

/** Tamanos minimos, en pixeles del lienzo. */
const MINIMOS: Record<string, { width: number; height: number }> = {
    wheel: { width: 120, height: 120 },
    winner: { width: 220, height: 40 },
    background: { width: 40, height: 40 },
    celebration: { width: 120, height: 120 },
    // La marca es de pago: encogerla hasta que no se lea seria apagarla sin tener
    // el tier. El servidor vuelve a comprobar esto al guardar — aca solo es para
    // que el tirador no deje hacerlo en primer lugar.
    watermark: { width: 150, height: 12 },
    pieza: { width: 40, height: 24 },
};

const REJILLA = 10;
/** Encima de la rueda y de la tarjeta, debajo de la celebracion. */
const Z_NUEVA_PIEZA = 4;

interface Props {
    visual: WheelVisual;
    onVisual: (cambios: Partial<WheelVisual>) => void;
    segments: FaceSegment[];
    t: (k: string, o?: Record<string, unknown>) => string;
}

export default function LayoutEditor({ visual, onVisual, segments, t }: Props) {
    const lienzoRef = useRef<HTMLDivElement>(null);
    const [sel, setSel] = useState<Sel>({ tipo: 'part', part: 'wheel' });
    const [snap, setSnap] = useState(true);

    const pres = useMemo(() => presentationOf(visual), [visual]);

    /**
     * Cuanto mide el lienzo en pantalla, para escalar la letra de las piezas.
     *
     * Se mide con `ResizeObserver` y no con unidades de contenedor (`cqh`), que
     * habrian sido dos lineas menos: es la misma regla que sigue la tira, y aunque
     * aca el navegador es el del streamer y no el de OBS, tener dos formas de medir
     * lo mismo en la misma feature es como se cuelan las diferencias entre lo que
     * muestra el panel y lo que sale en pantalla.
     */
    const [anchoLienzo, setAnchoLienzo] = useState(0);
    useLayoutEffect(() => {
        const el = lienzoRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => setAnchoLienzo(e.contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Lo que se dibuja. Si la rueda todavia no tiene lienzo se muestra el reparto
    // automatico traducido a coordenadas: asi el streamer ve de donde parte, pero
    // no se guarda nada hasta que mueva algo.
    const layout: WheelLayout = useMemo(() => {
        const base = visual.layout ?? defaultLayout(pres.aspect);
        return { ...base, wheel: fitBoxToAspect(base.wheel, pres.aspect) };
    }, [visual.layout, pres.aspect]);

    const automatico = visual.layout === null;

    const piezas: (LayoutText | LayoutMedia)[] = useMemo(
        () => [...layout.media, ...layout.texts],
        [layout.media, layout.texts],
    );

    const escribir = useCallback((que: Sel, caja: LayoutBox) => {
        if (!que) return;
        const c = clampBox(caja);
        if (que.tipo === 'part') {
            const anterior = layout[que.part];
            onVisual({ layout: { ...layout, [que.part]: { ...anterior, ...c } } });
            return;
        }
        onVisual({
            layout: {
                ...layout,
                texts: layout.texts.map(p => (p.id === que.id ? { ...p, ...c } : p)),
                media: layout.media.map(p => (p.id === que.id ? { ...p, ...c } : p)),
            },
        });
    }, [layout, onVisual]);

    /**
     * Cambia campos que no son la caja: color, plantilla, animacion…
     *
     * `Omit<..., 'kind'>` en los dos lados porque `LayoutText & LayoutMedia` es un
     * tipo imposible: sus `kind` son literales distintos y la interseccion sale
     * `never`, asi que TypeScript rechazaba hasta `{ template: '…' }`.
     */
    const editarPieza = (id: string, cambios: Partial<Omit<LayoutText, 'kind'> & Omit<LayoutMedia, 'kind'>>) =>
        onVisual({
            layout: {
                ...layout,
                texts: layout.texts.map(p => (p.id === id ? { ...p, ...cambios } as LayoutText : p)),
                media: layout.media.map(p => (p.id === id ? { ...p, ...cambios } as LayoutMedia : p)),
            },
        });

    const cajaDe = (s: Sel): LayoutBox | null => {
        if (!s) return null;
        if (s.tipo === 'part') return layout[s.part];
        return piezas.find(p => p.id === s.id) ?? null;
    };

    const claveMinimos = (s: Sel) => (s?.tipo === 'part' ? s.part : 'pieza');

    // ----------------------------------------------------------------
    // Arrastrar y redimensionar
    // ----------------------------------------------------------------
    // El gesto vive en un ref y no en el estado: se lee en cada mousemove y
    // guardarlo en estado volveria a renderizar el lienzo entero por pixel movido.
    const gesto = useRef<{ que: Sel; handle: Handle | null; inicio: { x: number; y: number }; caja: LayoutBox } | null>(null);

    /** Pixeles del lienzo a partir de pixeles de la pantalla. */
    const aLienzo = (e: { clientX: number; clientY: number }) => {
        const r = lienzoRef.current?.getBoundingClientRect();
        if (!r) return { x: 0, y: 0 };
        const k = CANVAS_WIDTH / r.width;
        return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
    };

    const empezar = (e: React.MouseEvent, que: Sel, handle: Handle | null) => {
        e.preventDefault();
        e.stopPropagation();
        setSel(que);
        const caja = cajaDe(que);
        if (!caja) return;
        gesto.current = { que, handle, inicio: aLienzo(e), caja };
    };

    /** Todas las piezas del lienzo, de la mas chica a la mas grande. */
    const candidatos = (): { que: NonNullable<Sel>; box: LayoutBox }[] => {
        const fijas: { que: NonNullable<Sel>; box: LayoutBox }[] = LAYOUT_PARTS
            .filter(part => part !== 'watermark' || visual.showWatermark)
            .map(part => ({ que: { tipo: 'part' as const, part }, box: layout[part] }));
        const sueltas = piezas.map(p => ({ que: { tipo: 'pieza' as const, id: p.id }, box: p }));
        return [...fijas, ...sueltas]
            .sort((a, b) => a.box.width * a.box.height - b.box.width * b.box.height);
    };

    /**
     * Un clic en el lienzo agarra la pieza MAS CHICA que este bajo el cursor.
     *
     * Es lo que hace utilizable un editor con piezas superpuestas: el fondo y la
     * celebracion cubren las 1920x1080 por defecto, asi que con la regla de "la de
     * encima" se habrian quedado con todos los clics y ni la rueda ni la tarjeta se
     * habrian podido agarrar nunca.
     */
    const enLienzo = (e: React.MouseEvent) => {
        const p = aLienzo(e);
        const dentro = candidatos().find(c =>
            p.x >= c.box.x && p.x <= c.box.x + c.box.width &&
            p.y >= c.box.y && p.y <= c.box.y + c.box.height);
        if (!dentro) { setSel(null); return; }
        empezar(e, dentro.que, null);
    };

    // Se enganchan en cada render y sin condicion. Con un `if (!gesto.current) return`
    // el arrastre no arrancaba al volver a agarrar la pieza ya seleccionada: empezar
    // un gesto escribe en un ref y no vuelve a renderizar, asi que el efecto que
    // tenia que enganchar los listeners nunca se ejecutaba.
    useEffect(() => {
        const mover = (e: MouseEvent) => {
            const g = gesto.current;
            if (!g) return;

            const p = aLienzo(e);
            const dx = p.x - g.inicio.x;
            const dy = p.y - g.inicio.y;
            const min = MINIMOS[claveMinimos(g.que)];
            const ajusta = (n: number) => (snap ? Math.round(n / REJILLA) * REJILLA : Math.round(n));

            if (!g.handle) {
                escribir(g.que, { ...g.caja, x: ajusta(g.caja.x + dx), y: ajusta(g.caja.y + dy) });
                return;
            }

            // Se calcula con los dos bordes y despues se normaliza, para que arrastrar
            // una esquina por encima de la opuesta no deje una caja de ancho negativo.
            let x1 = g.caja.x;
            let y1 = g.caja.y;
            let x2 = g.caja.x + g.caja.width;
            let y2 = g.caja.y + g.caja.height;

            if (g.handle.includes('w')) x1 = Math.min(x1 + dx, x2 - min.width);
            if (g.handle.includes('e')) x2 = Math.max(x2 + dx, x1 + min.width);
            if (g.handle.includes('n')) y1 = Math.min(y1 + dy, y2 - min.height);
            if (g.handle.includes('s')) y2 = Math.max(y2 + dy, y1 + min.height);

            let caja: LayoutBox = {
                x: ajusta(x1), y: ajusta(y1),
                width: ajusta(x2 - x1), height: ajusta(y2 - y1),
            };

            // La rueda manda con el alto y saca el ancho de su proporcion, igual que
            // el overlay. Se ancla al borde que NO se esta arrastrando para que la
            // caja no se escape de debajo del cursor.
            if (g.que?.tipo === 'part' && g.que.part === 'wheel') {
                const ancho = Math.round(caja.height * pres.aspect);
                caja = {
                    ...caja,
                    width: ancho,
                    x: g.handle.includes('w') ? caja.x + caja.width - ancho : caja.x,
                };
            }

            escribir(g.que, caja);
        };

        const soltar = () => { gesto.current = null; };

        window.addEventListener('mousemove', mover);
        window.addEventListener('mouseup', soltar);
        return () => {
            window.removeEventListener('mousemove', mover);
            window.removeEventListener('mouseup', soltar);
        };
    });

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
        setSel({ tipo: 'pieza', id: nuevo.id });
    };

    const anadirImagen = () => {
        if (layout.media.length >= MAX_MEDIA) return;
        const nuevo: LayoutMedia = {
            kind: 'media', id: nuevoId(),
            x: 120, y: 120, width: 320, height: 320,
            when: 'always', zIndex: Z_NUEVA_PIEZA, animationIn: 'fade', animationOut: 'fade',
            // Nace SIN url y con una url de mentira no: el inspector la pide y hasta
            // que no la tenga se dibuja como un hueco con su nombre. Guardar una
            // pieza sin url la descarta al leer, que es lo correcto en el overlay.
            url: '', fit: 'cover', opacity: 100, radius: 0,
            loop: true, videoAudio: false, videoVolume: 80,
        };
        onVisual({ layout: { ...layout, media: [...layout.media, nuevo] } });
        setSel({ tipo: 'pieza', id: nuevo.id });
    };

    const quitarPieza = (id: string) => {
        onVisual({
            layout: {
                ...layout,
                texts: layout.texts.filter(p => p.id !== id),
                media: layout.media.filter(p => p.id !== id),
            },
        });
        setSel(null);
    };

    // ----------------------------------------------------------------
    // Dibujo
    // ----------------------------------------------------------------
    const pct = (b: LayoutBox) => ({
        left: `${(b.x / CANVAS_WIDTH) * 100}%`,
        top: `${(b.y / CANVAS_HEIGHT) * 100}%`,
        width: `${(b.width / CANVAS_WIDTH) * 100}%`,
        height: `${(b.height / CANVAS_HEIGHT) * 100}%`,
    });

    const seleccionado = (que: Sel) =>
        !!sel && !!que && (sel.tipo === 'part' && que.tipo === 'part'
            ? sel.part === que.part
            : sel.tipo === 'pieza' && que.tipo === 'pieza' && sel.id === que.id);

    /**
     * Una caja del lienzo.
     *
     * Es una FUNCION que devuelve JSX, no un componente declarado aca dentro. Un
     * componente definido dentro del render es un tipo nuevo en cada pasada, asi que
     * React desmonta y vuelve a montar su contenido: la rueda se reiniciaria entera
     * en cada pixel de arrastre.
     */
    const caja = (que: NonNullable<Sel>, etiqueta: string, box: LayoutBox, contenido: React.ReactNode, z = 1) => {
        const activa = seleccionado(que);
        return (
            <div
                key={que.tipo === 'part' ? que.part : que.id}
                // Sin `onMouseDown` propio: quien recoge el clic es el lienzo, que
                // elige la pieza MAS CHICA bajo el cursor. Con un manejador por caja,
                // el fondo y la celebracion —que por defecto ocupan las 1920x1080—
                // se quedaban con todos los clics y no habia forma de agarrar la
                // rueda ni la tarjeta.
                className={`absolute pointer-events-none ${activa
                    ? 'outline outline-2 outline-blue-400'
                    : 'outline outline-1 outline-white/20 hover:outline-white/60'}`}
                style={{ ...pct(box), zIndex: activa ? 40 : z }}
            >
                <span className="absolute -top-5 left-0 text-[10px] font-bold text-blue-300 whitespace-nowrap pointer-events-none">
                    {etiqueta}
                </span>

                {/* El contenido no puede robar el mousedown: quien arrastra es la caja. */}
                <div className="w-full h-full pointer-events-none overflow-hidden">{contenido}</div>

                {activa && (['nw', 'ne', 'sw', 'se'] as Handle[]).map(h => (
                    <span
                        key={h}
                        onMouseDown={e => empezar(e, que, h)}
                        className="absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full z-50 pointer-events-auto"
                        style={{
                            cursor: h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize',
                            top: h[0] === 'n' ? -6 : undefined,
                            bottom: h[0] === 's' ? -6 : undefined,
                            left: h[1] === 'w' ? -6 : undefined,
                            right: h[1] === 'e' ? -6 : undefined,
                        }}
                    />
                ))}
            </div>
        );
    };

    const kw = layout.winner.height / WINNER_BASE_HEIGHT;
    const km = layout.watermark.height / WATERMARK_BASE_HEIGHT;
    // El lienzo se dibuja mas chico que 1920, asi que la letra se encoge en la misma
    // proporcion: lo que se ve aca es lo que va a salir, a escala.
    const k = anchoLienzo > 0 ? anchoLienzo / CANVAS_WIDTH : 0;
    const px = (n: number) => `${(n * k).toFixed(2)}px`;

    const cajaSel = cajaDe(sel);
    const piezaSel = sel?.tipo === 'pieza' ? piezas.find(p => p.id === sel.id) ?? null : null;

    const CAMPO = 'px-2 py-1.5 bg-[#262626] border border-[#374151] rounded-lg text-[#f8fafc] text-sm focus:outline-none focus:border-blue-500';

    return (
        <div className="space-y-3">
            {/* El aviso esta SIEMPRE, cambiando el texto, y no aparece y desaparece.
                Al soltarse al primer arrastre, el lienzo subia el alto del aviso
                justo debajo del cursor y la pieza se quedaba a mitad de camino: el
                gesto compara contra el rectangulo del lienzo, que se acababa de
                mover. Ademas el estado nuevo tambien merece explicacion. */}
            <p className="text-xs text-[#94a3b8] bg-[#262626] border border-[#374151] rounded-lg px-3 py-2">
                {/* Cada clave escrita entera dentro de su propia llamada, y no una
                    ternaria dentro del parentesis: la auditoria de i18n las busca con
                    una expresion regular y una clave armada asi no la ve. */}
                {automatico ? t('wheel.canvas.autoNote') : t('wheel.canvas.fixedNote')}
            </p>

            <div className="flex flex-wrap items-center gap-2">
                <button
                    onClick={() => setSnap(!snap)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${snap
                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                        : 'bg-[#262626] border-[#374151] text-[#94a3b8]'}`}
                >
                    <Grid3x3 className="w-3.5 h-3.5" />
                    {t('wheel.canvas.snap')}
                </button>

                <button
                    onClick={anadirTexto}
                    disabled={layout.texts.length >= MAX_TEXTS}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#262626] border border-[#374151] text-[#94a3b8] hover:text-[#f8fafc] disabled:opacity-40 transition-colors flex items-center gap-1.5"
                >
                    <Type className="w-3.5 h-3.5" />
                    {t('wheel.canvas.addText')}
                </button>

                <button
                    onClick={anadirImagen}
                    disabled={layout.media.length >= MAX_MEDIA}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#262626] border border-[#374151] text-[#94a3b8] hover:text-[#f8fafc] disabled:opacity-40 transition-colors flex items-center gap-1.5"
                >
                    <ImageIcon className="w-3.5 h-3.5" />
                    {t('wheel.canvas.addImage')}
                </button>

                <span className="text-xs text-[#64748b]">{t('wheel.canvas.size')}</span>

                <button
                    onClick={() => onVisual({ layout: null })}
                    disabled={automatico}
                    className="ml-auto px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#262626] border border-[#374151] text-[#94a3b8] hover:text-[#f8fafc] disabled:opacity-40 transition-colors flex items-center gap-1.5"
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t('wheel.canvas.reset')}
                </button>
            </div>

            {/* Los chips llegan a lo que el lienzo no: una pieza escondida detras de
                otra mas chica, o una imagen sin url todavia. */}
            <div className="flex flex-wrap gap-1.5">
                {candidatos().slice().reverse().map(({ que }) => {
                    const suelta = que.tipo === 'pieza' ? piezas.find(p => p.id === que.id) : null;
                    const nombre = que.tipo === 'part'
                        ? t(`wheel.canvas.part_${que.part}`)
                        : suelta ? etiquetaPieza(suelta, t) : '';
                    return (
                        <button
                            key={que.tipo === 'part' ? que.part : que.id}
                            onClick={() => setSel(que)}
                            className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${seleccionado(que)
                                ? 'bg-blue-600/20 border-blue-500/50 text-blue-200'
                                : 'bg-[#262626] border-[#374151] text-[#94a3b8] hover:text-[#f8fafc]'}`}
                        >
                            {nombre}
                        </button>
                    );
                })}
            </div>

            <div
                ref={lienzoRef}
                onMouseDown={enLienzo}
                className="relative w-full rounded-xl overflow-hidden select-none cursor-crosshair border border-[#374151]"
                style={{
                    aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
                    // Damero: el fondo del overlay suele ser transparente y pintarlo de
                    // un gris liso haria creer que la rueda trae un fondo que no tiene.
                    backgroundColor: '#141416',
                    backgroundImage:
                        'linear-gradient(45deg, #1f1f22 25%, transparent 25%, transparent 75%, #1f1f22 75%),' +
                        'linear-gradient(45deg, #1f1f22 25%, transparent 25%, transparent 75%, #1f1f22 75%)',
                    backgroundSize: '18px 18px',
                    backgroundPosition: '0 0, 9px 9px',
                }}
            >
                {/* El fondo, como una caja mas. Se dibuja aunque este apagado o sea
                    transparente, para que se pueda seleccionar y colocar: una caja
                    invisible que no se puede agarrar no se puede configurar. */}
                {caja({ tipo: 'part', part: 'background' }, t('wheel.canvas.part_background'), layout.background, (
                    <div
                        className="w-full h-full"
                        style={{
                            background: layout.background.enabled ? visual.background : 'transparent',
                            opacity: layout.background.enabled && visual.background !== 'transparent' ? 1 : 0.25,
                            outline: visual.background === 'transparent' ? '1px dashed rgba(255,255,255,.25)' : undefined,
                        }}
                    />
                ), 0)}

                {piezas.map(p => caja({ tipo: 'pieza', id: p.id }, etiquetaPieza(p, t), p, (
                    p.kind === 'text' ? (
                        <span
                            className="block w-full"
                            style={{
                                fontSize: px(p.fontSize),
                                fontWeight: p.weight,
                                color: p.color,
                                textAlign: p.align,
                                textTransform: p.uppercase ? 'uppercase' : 'none',
                                background: p.background,
                                borderRadius: px(p.radius),
                                padding: px(p.padding),
                                lineHeight: 1.15,
                                opacity: p.when === 'always' ? 1 : 0.65,
                            }}
                        >
                            {p.template}
                        </span>
                    ) : p.url ? (
                        // El video va SIEMPRE mudo en el panel, tenga o no audio en
                        // el overlay: quien configura no espera que el navegador se
                        // ponga a hablar mientras arrastra una caja.
                        esVideoUrl(p.url) ? (
                            <video
                                src={p.url}
                                muted loop autoPlay playsInline
                                className="w-full h-full"
                                style={{ objectFit: p.fit, borderRadius: px(p.radius), opacity: (p.opacity / 100) * (p.when === 'always' ? 1 : 0.65) }}
                            />
                        ) : (
                            <img
                                src={p.url}
                                alt=""
                                className="w-full h-full"
                                style={{ objectFit: p.fit, borderRadius: px(p.radius), opacity: (p.opacity / 100) * (p.when === 'always' ? 1 : 0.65) }}
                            />
                        )
                    ) : (
                        <span className="w-full h-full flex items-center justify-center text-[10px] text-[#64748b] border border-dashed border-[#4b5563]">
                            {t('wheel.canvas.noImageYet')}
                        </span>
                    )
                ), p.zIndex))}

                {caja({ tipo: 'part', part: 'wheel' }, t('wheel.canvas.part_wheel'), layout.wheel, (
                    <pres.Component
                        segments={segments}
                        visual={visual}
                        spin={null}
                        phase="idle"
                        onSound={() => { }}
                        onFinished={() => { }}
                    />
                ), 2)}

                {caja({ tipo: 'part', part: 'winner' }, t('wheel.canvas.part_winner'), layout.winner, (
                    <div className="w-full h-full flex items-center justify-center">
                        <div
                            className="flex flex-col items-center max-w-full"
                            style={{
                                gap: px(4 * kw),
                                padding: `${px(14 * kw)} ${px(34 * kw)}`,
                                background: visual.ink,
                                border: `${px(3 * kw)} solid ${visual.accent}`,
                                borderRadius: px(14 * kw),
                            }}
                        >
                            <span style={{
                                color: visual.bone,
                                fontSize: px(38.9 * kw),
                                fontWeight: visual.fontWeight,
                                lineHeight: 1.1,
                                whiteSpace: 'nowrap',
                            }}>
                                {t('wheel.canvas.samplePrize')}
                            </span>
                            <span style={{ color: visual.accent, fontSize: px(19 * kw), fontWeight: 600 }}>
                                {t('wheel.canvas.sampleWho')}
                            </span>
                        </div>
                    </div>
                ), 3)}

                {/* La celebracion no se dibuja: es confeti animado y quieto no dice
                    nada. Se marca su area, que es lo unico que hay que colocar. */}
                {caja({ tipo: 'part', part: 'celebration' }, t('wheel.canvas.part_celebration'), layout.celebration, (
                    <div className="w-full h-full border border-dashed border-fuchsia-400/40 rounded" />
                ), 5)}

                {visual.showWatermark && caja({ tipo: 'part', part: 'watermark' }, t('wheel.canvas.part_watermark'), layout.watermark, (
                    <div
                        className="w-full h-full flex items-center justify-center whitespace-nowrap"
                        style={{ color: visual.bone, opacity: .62, fontSize: px(12 * km), fontWeight: 600 }}
                    >
                        Rueda de la Suerte · Decatron
                    </div>
                ), 6)}
            </div>

            {/* ---------------------------------------------------------- inspector */}
            {sel && cajaSel && (
                <div className="space-y-3 border-t border-[#374151] pt-3">
                    <div className="flex flex-wrap items-end gap-2">
                        <span className="text-xs font-bold text-[#f8fafc] flex items-center gap-1.5 mr-1">
                            <Move className="w-3.5 h-3.5 text-[#64748b]" />
                            {sel.tipo === 'part'
                                ? t(`wheel.canvas.part_${sel.part}`)
                                : piezaSel ? etiquetaPieza(piezaSel, t) : ''}
                        </span>

                        {(['x', 'y', 'width', 'height'] as const).map(campo => (
                            <label key={campo} className="flex flex-col gap-1 text-[10px] text-[#64748b] uppercase tracking-wide">
                                {t(`wheel.canvas.f_${campo}`)}
                                <input
                                    type="number"
                                    value={Math.round(cajaSel[campo])}
                                    // El ancho de la rueda lo decide su proporcion, no el
                                    // streamer: un campo que se puede escribir y que al
                                    // guardarse cambia solo es peor que un campo apagado.
                                    disabled={sel.tipo === 'part' && sel.part === 'wheel' && campo === 'width'}
                                    onChange={e => {
                                        const n = Number(e.target.value);
                                        if (!Number.isFinite(n)) return;
                                        const c = { ...cajaSel, [campo]: n };
                                        escribir(sel, sel.tipo === 'part' && sel.part === 'wheel'
                                            ? fitBoxToAspect(c, pres.aspect) : c);
                                    }}
                                    className={`w-20 ${CAMPO} disabled:opacity-40`}
                                />
                            </label>
                        ))}

                        {sel.tipo === 'part' && (sel.part === 'background' || sel.part === 'celebration') && (
                            <button
                                onClick={() => escribir(sel, { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT })}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#262626] border border-[#374151] text-[#94a3b8] hover:text-[#f8fafc] transition-colors flex items-center gap-1.5"
                            >
                                <Maximize2 className="w-3.5 h-3.5" />
                                {t('wheel.canvas.coverAll')}
                            </button>
                        )}

                        {sel.tipo === 'pieza' && (
                            <button
                                onClick={() => quitarPieza(sel.id)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/40 text-red-300 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                {t('wheel.canvas.removePiece')}
                            </button>
                        )}
                    </div>

                    {/* --- el fondo: encendido y aviso de que el color vive en Aspecto --- */}
                    {sel.tipo === 'part' && sel.part === 'background' && (
                        <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 text-xs text-[#94a3b8]">
                                <input
                                    type="checkbox"
                                    checked={layout.background.enabled}
                                    onChange={e => onVisual({ layout: { ...layout, background: { ...layout.background, enabled: e.target.checked } } })}
                                    className="accent-blue-500"
                                />
                                {t('wheel.canvas.bgEnabled')}
                            </label>
                            <span className="text-xs text-[#64748b]">{t('wheel.canvas.bgColorNote')}</span>
                        </div>
                    )}

                    {/* --- la tarjeta del ganador: como entra y como sale --- */}
                    {sel.tipo === 'part' && sel.part === 'winner' && (
                        <div className="flex flex-wrap items-end gap-2">
                            {(['winnerAnimationIn', 'winnerAnimationOut'] as const).map(campo => (
                                <label key={campo} className="flex flex-col gap-1 text-[10px] text-[#64748b] uppercase tracking-wide">
                                    {t(`wheel.canvas.f_${campo}`)}
                                    <select
                                        value={layout[campo]}
                                        onChange={e => onVisual({ layout: { ...layout, [campo]: e.target.value as LayoutAnimation } })}
                                        className={CAMPO}
                                    >
                                        {LAYOUT_ANIMATIONS.map(a => (
                                            <option key={a} value={a}>{t(`wheel.canvas.anim_${a}`)}</option>
                                        ))}
                                    </select>
                                </label>
                            ))}
                        </div>
                    )}

                    {/* --- las piezas sueltas --- */}
                    {piezaSel && (
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-end gap-2">
                                <label className="flex flex-col gap-1 text-[10px] text-[#64748b] uppercase tracking-wide">
                                    {t('wheel.canvas.f_when')}
                                    <select
                                        value={piezaSel.when}
                                        onChange={e => editarPieza(piezaSel.id, { when: e.target.value as PieceWhen })}
                                        className={CAMPO}
                                    >
                                        {PIECE_WHENS.map(w => (
                                            <option key={w} value={w}>{t(`wheel.canvas.when_${w}`)}</option>
                                        ))}
                                    </select>
                                </label>

                                {(['animationIn', 'animationOut'] as const).map(campo => (
                                    <label key={campo} className="flex flex-col gap-1 text-[10px] text-[#64748b] uppercase tracking-wide">
                                        {t(`wheel.canvas.f_${campo}`)}
                                        <select
                                            value={piezaSel[campo]}
                                            onChange={e => editarPieza(piezaSel.id, { [campo]: e.target.value as LayoutAnimation })}
                                            className={CAMPO}
                                        >
                                            {LAYOUT_ANIMATIONS.map(a => (
                                                <option key={a} value={a}>{t(`wheel.canvas.anim_${a}`)}</option>
                                            ))}
                                        </select>
                                    </label>
                                ))}

                                <label className="flex flex-col gap-1 text-[10px] text-[#64748b] uppercase tracking-wide">
                                    {t('wheel.canvas.f_zIndex')}
                                    <input
                                        type="number"
                                        value={piezaSel.zIndex}
                                        onChange={e => editarPieza(piezaSel.id, { zIndex: Math.round(Number(e.target.value) || 0) })}
                                        className={`w-20 ${CAMPO}`}
                                    />
                                </label>
                            </div>

                            {piezaSel.kind === 'text' ? (
                                <div className="space-y-2">
                                    <label className="flex flex-col gap-1 text-[10px] text-[#64748b] uppercase tracking-wide">
                                        {t('wheel.canvas.f_template')}
                                        <input
                                            type="text"
                                            value={piezaSel.template}
                                            onChange={e => editarPieza(piezaSel.id, { template: e.target.value })}
                                            className={`w-full ${CAMPO}`}
                                        />
                                    </label>
                                    <p className="text-[10px] text-[#64748b]">{t('wheel.canvas.varsHelp')}</p>

                                    <div className="flex flex-wrap items-end gap-2">
                                        {([['fontSize', 8, 400], ['weight', 100, 900], ['outline', 0, 16], ['padding', 0, 200], ['radius', 0, 200]] as const).map(([campo, min, max]) => (
                                            <label key={campo} className="flex flex-col gap-1 text-[10px] text-[#64748b] uppercase tracking-wide">
                                                {t(`wheel.canvas.f_${campo}`)}
                                                <input
                                                    type="number" min={min} max={max}
                                                    value={piezaSel[campo]}
                                                    onChange={e => editarPieza(piezaSel.id, { [campo]: Number(e.target.value) || 0 })}
                                                    className={`w-20 ${CAMPO}`}
                                                />
                                            </label>
                                        ))}

                                        <label className="flex flex-col gap-1 text-[10px] text-[#64748b] uppercase tracking-wide">
                                            {t('wheel.canvas.f_align')}
                                            <select
                                                value={piezaSel.align}
                                                onChange={e => editarPieza(piezaSel.id, { align: e.target.value as LayoutText['align'] })}
                                                className={CAMPO}
                                            >
                                                {(['left', 'center', 'right'] as const).map(a => (
                                                    <option key={a} value={a}>{t(`wheel.canvas.align_${a}`)}</option>
                                                ))}
                                            </select>
                                        </label>

                                        {([['color', piezaSel.color], ['outlineColor', piezaSel.outlineColor]] as const).map(([campo, valor]) => (
                                            <label key={campo} className="flex flex-col gap-1 text-[10px] text-[#64748b] uppercase tracking-wide">
                                                {t(`wheel.canvas.f_${campo}`)}
                                                <input
                                                    type="color"
                                                    value={valor}
                                                    onChange={e => editarPieza(piezaSel.id, { [campo]: e.target.value })}
                                                    className="w-12 h-8 rounded-lg bg-transparent border border-[#374151] cursor-pointer"
                                                />
                                            </label>
                                        ))}

                                        <label className="flex items-center gap-2 text-xs text-[#94a3b8]">
                                            <input
                                                type="checkbox"
                                                checked={piezaSel.uppercase}
                                                onChange={e => editarPieza(piezaSel.id, { uppercase: e.target.checked })}
                                                className="accent-blue-500"
                                            />
                                            {t('wheel.canvas.f_uppercase')}
                                        </label>

                                        {/* Una caja detras del texto, para que se lea sobre
                                            cualquier escena. `transparent` es lo normal. */}
                                        <label className="flex items-center gap-2 text-xs text-[#94a3b8]">
                                            <input
                                                type="checkbox"
                                                checked={piezaSel.background !== 'transparent'}
                                                onChange={e => editarPieza(piezaSel.id, { background: e.target.checked ? visual.ink : 'transparent' })}
                                                className="accent-blue-500"
                                            />
                                            {t('wheel.canvas.f_textBg')}
                                        </label>
                                        {piezaSel.background !== 'transparent' && (
                                            <input
                                                type="color"
                                                value={piezaSel.background}
                                                onChange={e => editarPieza(piezaSel.id, { background: e.target.value })}
                                                className="w-12 h-8 rounded-lg bg-transparent border border-[#374151] cursor-pointer"
                                            />
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <MediaInputWithSelector
                                        value={piezaSel.url}
                                        onChange={v => editarPieza(piezaSel.id, { url: v })}
                                        label={t('wheel.canvas.f_image')}
                                        allowedTypes={['image', 'video']}
                                    />
                                    <div className="flex flex-wrap items-end gap-2">
                                        <label className="flex flex-col gap-1 text-[10px] text-[#64748b] uppercase tracking-wide">
                                            {t('wheel.canvas.f_fit')}
                                            <select
                                                value={piezaSel.fit}
                                                onChange={e => editarPieza(piezaSel.id, { fit: e.target.value as LayoutMedia['fit'] })}
                                                className={CAMPO}
                                            >
                                                {(['cover', 'contain', 'fill'] as const).map(f => (
                                                    <option key={f} value={f}>{t(`wheel.canvas.fit_${f}`)}</option>
                                                ))}
                                            </select>
                                        </label>
                                        {([['opacity', 0, 100], ['radius', 0, 400]] as const).map(([campo, min, max]) => (
                                            <label key={campo} className="flex flex-col gap-1 text-[10px] text-[#64748b] uppercase tracking-wide">
                                                {t(`wheel.canvas.f_${campo}`)}
                                                <input
                                                    type="number" min={min} max={max}
                                                    value={piezaSel[campo]}
                                                    onChange={e => editarPieza(piezaSel.id, { [campo]: Number(e.target.value) || 0 })}
                                                    className={`w-20 ${CAMPO}`}
                                                />
                                            </label>
                                        ))}

                                        {/* Solo para video, y se decide por la extension del
                                            archivo: un campo aparte seria un segundo sitio
                                            donde la misma verdad puede desincronizarse. */}
                                        {esVideoUrl(piezaSel.url) && (
                                            <>
                                                <label className="flex items-center gap-2 text-xs text-[#94a3b8]">
                                                    <input
                                                        type="checkbox"
                                                        checked={piezaSel.loop}
                                                        onChange={e => editarPieza(piezaSel.id, { loop: e.target.checked })}
                                                        className="accent-blue-500"
                                                    />
                                                    {t('wheel.canvas.f_loop')}
                                                </label>

                                                <label className="flex items-center gap-2 text-xs text-[#94a3b8]">
                                                    <input
                                                        type="checkbox"
                                                        checked={piezaSel.videoAudio}
                                                        onChange={e => editarPieza(piezaSel.id, { videoAudio: e.target.checked })}
                                                        className="accent-blue-500"
                                                    />
                                                    {t('wheel.canvas.f_videoAudio')}
                                                </label>

                                                {piezaSel.videoAudio && (
                                                    <label className="flex flex-col gap-1 text-[10px] text-[#64748b] uppercase tracking-wide">
                                                        {t('wheel.canvas.f_videoVolume')}
                                                        <input
                                                            type="number" min={0} max={100}
                                                            value={piezaSel.videoVolume}
                                                            onChange={e => editarPieza(piezaSel.id, { videoVolume: Number(e.target.value) || 0 })}
                                                            className={`w-20 ${CAMPO}`}
                                                        />
                                                    </label>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    {esVideoUrl(piezaSel.url) && (
                                        <p className="text-[10px] text-[#64748b]">{t('wheel.canvas.videoNote')}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/** El nombre de una pieza suelta en el lienzo: su texto, o el nombre del archivo. */
function etiquetaPieza(p: LayoutText | LayoutMedia, t: (k: string) => string): string {
    if (p.kind === 'text') return p.template.slice(0, 24) || t('wheel.canvas.piece_text');
    const nombre = p.url.split('/').pop() || '';
    return nombre.slice(0, 24) || t('wheel.canvas.piece_media');
}
