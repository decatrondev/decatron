import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WheelCelebration from '../components/wheel/WheelCelebration';
import { presentationOf, soundForMode, type ActiveSpin, type Presentation } from '../components/wheel/presentations';
import {
    esVideoUrl, FONTS, fitBoxToAspect, RAFFLE_SOUND_FOR, resolveVisual, SOUND_KEYS, soundUrl,
    WATERMARK_BASE_HEIGHT, WINNER_BASE_HEIGHT,
    type LayoutBox, type LayoutMedia, type LayoutText, type PieceWhen,
    type SoundKey, type WheelLayout, type WheelVisual,
} from '../components/wheel/visualConfig';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';

/**
 * Overlay de la Rueda de la Suerte.
 *
 * El backend ya decidió el gajo ganador antes de mandar el evento; acá solo se
 * anima hasta ese ángulo. Nunca al revés: si el azar viviera en el navegador,
 * cualquiera con las DevTools abiertas elegiría su premio.
 */

interface Segment {
    id: number;
    label: string;
    color: string | null;
    icon: string | null;
}

interface SpinEvent {
    slug: string;
    spinId: number | null;
    dryRun: boolean;
    segmentId: number;
    segmentIndex: number;
    segmentCount: number;
    label: string;
    color: string | null;
    icon: string | null;
    spinner: string | null;
    trigger: string;

    // --- solo en modo Sorteo ---
    // El sorteo manda SU PROPIA lista de gajos dentro del evento en vez de confiar
    // en la que el overlay ya tiene. En modo Premios los gajos son configuracion y
    // no cambian entre giros; en Sorteo el pool cambia con cada inscripcion, asi que
    // la lista del overlay puede tener treinta segundos de atraso y la aguja pararia
    // en el nombre equivocado. Con la lista dentro del evento no hay dos fuentes.
    mode?: string;
    segments?: { label: string; count: number; grouped: boolean }[];
    winner?: string;
    poolSize?: number;
    drawIndex?: number;
    drawTotal?: number;

    // --- solo en modo Premios ---
    // Los gajos sobre los que el backend calculo `segmentIndex`. Mismo motivo que
    // en Sorteo: si el streamer edito los gajos y esta fuente todavia tenia la
    // lista vieja, la aguja pararia en un gajo y la tarjeta anunciaria otro.
    wheelSegments?: Segment[];
}

/** Lo que devuelve `/api/wheel/overlay`, ya reducido a lo que el overlay usa. */
interface OverlayData {
    segments: Segment[];
    visual: unknown;
    /** `prizes` o `raffle`. Decide que sonidos precargar. */
    mode: string | null;
}

/** Cuanto dura la entrada y la salida de la rueda entera en modo `spin`. */
const ENTRADA_MS = 520;
const SALIDA_MS = 460;

/**
 * Minimo entre dos ticks. Al arrancar, una rueda con muchos gajos cruza un borde
 * en cada frame: sesenta ticks por segundo ya no se oyen como ticks sino como un
 * zumbido. Veintidos por segundo sigue leyendose como velocidad.
 */
const TICK_MIN_MS = 45;

/** Espera tras un aviso de cambio antes de recargar: agrupa una rafaga de inscritos. */
const RECARGA_MS = 350;

export default function WheelOverlay() {
    const [params] = useSearchParams();
    const channel = (params.get('channel') || '').toLowerCase();
    const slug = (params.get('wheel') || '').toLowerCase();

    const [segments, setSegments] = useState<Segment[]>([]);
    const [visualRaw, setVisualRaw] = useState<unknown>(null);
    const [mode, setMode] = useState<string | null>(null);

    // El aspecto configurado por el streamer, ya completado con los defaults de
    // Decatron. Si el streamer no toco nada, esto es exactamente el pack de fabrica.
    const visual: WheelVisual = useMemo(() => resolveVisual(visualRaw), [visualRaw]);

    // Los callbacks del giro viven mas que un render (timers de varios segundos):
    // leen el aspecto de aca para no quedarse con el de cuando arranco el giro.
    const visualRef = useRef(visual);
    visualRef.current = visual;

    // Quién dibuja. El overlay no sabe si es una rueda, una tira o una rejilla:
    // solo le pide que anime hasta el indice ganador y le avise cuando llego.
    const pres: Presentation = useMemo(() => presentationOf(visual), [visual]);

    // El lienzo, o `null` si esta rueda nunca paso por el editor. La caja de la
    // rueda se corrige a la proporcion de la presentacion ACA y no al guardarla:
    // la presentacion se puede cambiar despues de haber colocado las piezas, y una
    // caja cuadrada heredada por una tira la dibujaria aplastada.
    const layout: WheelLayout | null = useMemo(
        () => (visual.layout ? { ...visual.layout, wheel: fitBoxToAspect(visual.layout.wheel, pres.aspect) } : null),
        [visual.layout, pres.aspect],
    );

    const [phase, setPhase] = useState<'idle' | 'spinning' | 'revealed'>('idle');
    const [winner, setWinner] = useState<SpinEvent | null>(null);
    const [activeSpin, setActiveSpin] = useState<ActiveSpin | null>(null);
    // Contador y no booleano: dos giros seguidos tienen que celebrarse dos veces.
    const [celebracion, setCelebracion] = useState(0);

    // Solo cuenta en modo `spin`. `null` es "todavia no aparecio nunca": sin
    // animacion de salida, para que abrir la escena no haga salir una rueda que
    // nadie vio entrar.
    const [shown, setShown] = useState<boolean | null>(null);
    const shownRef = useRef(false);

    const queueRef = useRef<SpinEvent[]>([]);
    const busyRef = useRef(false);
    /** El evento que se esta animando ahora, para revelarlo cuando termine. */
    const currentRef = useRef<SpinEvent | null>(null);
    const nonceRef = useRef(0);
    /**
     * Una recarga que llego en mitad de un giro. Se aplica cuando la cola se vacia:
     * cambiar los gajos o el aspecto con la rueda girando la haria saltar, o parar
     * en un gajo que ya no esta donde estaba.
     */
    const pendingRef = useRef<OverlayData | null>(null);

    // ----------------------------------------------------------------
    // Audio
    // ----------------------------------------------------------------
    // WebAudio y no <audio>: el tick se dispara hasta 20 veces por segundo y un
    // elemento HTML no puede re-arrancar tan rápido sin cortarse a sí mismo.
    //
    // El contexto se crea UNA vez. Antes se recreaba con cada cambio de aspecto y
    // descargaba los cinco sonidos de nuevo: un aviso de recarga justo antes de un
    // giro lo dejaba mudo. Los buffers se guardan por URL, asi que cambiar un
    // volumen no descarga nada y cambiar un sonido descarga solo ese.
    const ctxRef = useRef<AudioContext | null>(null);
    const buffersRef = useRef(new Map<string, AudioBuffer>());
    const cargandoRef = useRef(new Set<string>());
    const lastTickRef = useRef(0);

    useEffect(() => {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        ctxRef.current = ctx;

        // OBS arranca el contexto suspendido más veces de las que debería.
        const wake = () => ctx.state === 'suspended' && ctx.resume();
        const timer = window.setInterval(wake, 1000);

        return () => {
            window.clearInterval(timer);
            ctxRef.current = null;
            ctx.close();
        };
    }, []);

    const cargar = useCallback(async (url: string) => {
        const ctx = ctxRef.current;
        if (!ctx || buffersRef.current.has(url) || cargandoRef.current.has(url)) return;
        cargandoRef.current.add(url);
        try {
            const res = await fetch(url);
            if (!res.ok) return;
            buffersRef.current.set(url, await ctx.decodeAudioData(await res.arrayBuffer()));
        } catch {
            // Un sonido que no carga no puede impedir que la rueda gire.
        } finally {
            cargandoRef.current.delete(url);
        }
    }, []);

    // Se precarga lo que este configurado AHORA: el que el streamer silencio no se
    // descarga, y el que reemplazo por uno propio se descarga en lugar del de
    // Decatron.
    // Y solo los del modo de esta rueda: una de Premios nunca va a sonar los del
    // Sorteo, ni al reves.
    useEffect(() => {
        for (const key of SOUND_KEYS) {
            if (soundForMode(key, mode ?? undefined) !== key) continue;
            if (mode !== 'raffle' && Object.values(RAFFLE_SOUND_FOR).includes(key)) continue;
            const url = soundUrl(visual, key);
            if (url) cargar(url);
        }
    }, [visual, mode, cargar]);

    /** El buffer y el volumen final de un sonido, o null si no hay que sonar. */
    const preparar = useCallback((key: SoundKey) => {
        const ctx = ctxRef.current;
        const v = visualRef.current;
        if (!ctx) return null;
        const cfg = v.sounds[key];
        if (cfg.mode === 'mute') return null;
        const url = soundUrl(v, key);
        const buf = url ? buffersRef.current.get(url) : undefined;
        if (!buf) {
            if (url) cargar(url);
            return null;
        }
        // Volumen por evento por el maestro: el streamer baja todo de una o afina
        // solo el que le molesta, sin tener que tocar los cinco.
        return { ctx, buf, volume: (cfg.volume ?? 1) * v.sounds.master };
    }, [cargar]);

    const play = useCallback((pedido: SoundKey) => {
        // En modo Sorteo el arranque y la celebracion tienen sonido propio. Se
        // traduce aca, en un solo sitio, para que ninguna presentacion tenga que
        // saber en que modo esta.
        const key = soundForMode(pedido, currentRef.current?.mode);

        if (key === 'spin_tick') {
            const ahora = performance.now();
            if (ahora - lastTickRef.current < TICK_MIN_MS) return;
            lastTickRef.current = ahora;
        }

        const p = preparar(key);
        if (!p) return;
        const src = p.ctx.createBufferSource();
        const gain = p.ctx.createGain();
        gain.gain.value = p.volume;
        src.buffer = p.buf;
        src.connect(gain).connect(p.ctx.destination);
        src.start();
    }, [preparar]);

    /**
     * La frenada, programada para que TERMINE cuando la presentacion se detiene.
     *
     * Antes cada presentacion la disparaba al 72% del tiempo. Con la curva de
     * fabrica la rueda ya esta casi quieta en ese punto, y como el audio dura casi
     * dos segundos se montaba encima del revelado. Ahora arranca cuanto antes haga
     * falta para acabar a tiempo —nunca antes de un tercio del giro, que es cuando
     * todavia va rapido— y si el giro es mas corto que el audio, se apaga con un
     * fundido justo al parar en vez de cortarse seco.
     */
    const programarFrenada = useCallback((segundos: number) => {
        const p = preparar('spin_slowdown');
        if (!p) return;

        const ahora = p.ctx.currentTime;
        const inicio = ahora + Math.max(segundos * 0.35, segundos - p.buf.duration);
        const fin = ahora + segundos;

        const src = p.ctx.createBufferSource();
        const gain = p.ctx.createGain();
        gain.gain.setValueAtTime(p.volume, ahora);
        gain.gain.setValueAtTime(p.volume, fin);
        gain.gain.linearRampToValueAtTime(0, fin + 0.25);
        src.buffer = p.buf;
        src.connect(gain).connect(p.ctx.destination);
        src.start(inicio);
        src.stop(fin + 0.3);
    }, [preparar]);

    // ----------------------------------------------------------------
    // Datos
    // ----------------------------------------------------------------
    const aplicar = useCallback((data: OverlayData) => {
        setSegments(data.segments);
        setVisualRaw(data.visual);
        setMode(data.mode);
    }, []);

    const reintentoRef = useRef<number | null>(null);
    const esperaRef = useRef(5000);

    const loadData = useCallback(async () => {
        if (!channel || !slug) return;
        if (reintentoRef.current) { window.clearTimeout(reintentoRef.current); reintentoRef.current = null; }

        let data: OverlayData | null;
        try {
            const res = await fetch(`/api/wheel/overlay?channel=${encodeURIComponent(channel)}&wheel=${encodeURIComponent(slug)}`);
            if (res.status === 404) {
                // La rueda no existe o esta apagada: el overlay se vacia en vez de
                // quedarse mostrando la ultima que vio. Cuando la enciendan, el aviso
                // del backend la trae de vuelta.
                data = { segments: [], visual: null, mode: null };
            } else if (!res.ok) {
                throw new Error(String(res.status));
            } else {
                const json = await res.json();
                if (!json?.success) throw new Error('respuesta invalida');
                data = {
                    segments: json.data.segments || [],
                    visual: json.data.wheel?.visual ?? null,
                    mode: json.data.wheel?.mode ?? null,
                };
            }
            esperaRef.current = 5000;
        } catch {
            // Servidor caido o red cortada al abrir la escena: se reintenta solo, con
            // espera creciente, en vez de quedarse en blanco hasta un refresco manual.
            reintentoRef.current = window.setTimeout(loadData, esperaRef.current);
            esperaRef.current = Math.min(esperaRef.current * 2, 60000);
            return;
        }

        if (busyRef.current) pendingRef.current = data;
        else aplicar(data);
    }, [channel, slug, aplicar]);

    useEffect(() => {
        loadData();
        return () => { if (reintentoRef.current) window.clearTimeout(reintentoRef.current); };
    }, [loadData]);

    // ----------------------------------------------------------------
    // El giro
    // ----------------------------------------------------------------
    const startRef = useRef<number | null>(null);

    const runSpin = useCallback((ev: SpinEvent) => {
        // El evento trae la lista sobre la que se calculo el indice (en Sorteo, los
        // inscritos; en Premios, los gajos de ahora). Se adopta AL GIRAR y no al
        // recibirlo: si llegara encolado, cambiaria la rueda que esta girando.
        const lista: Segment[] | null = ev.segments && ev.segments.length > 0
            ? ev.segments.map((sl, i) => ({ id: -(i + 1), label: sl.label, color: null, icon: null }))
            : ev.wheelSegments && ev.wheelSegments.length > 0
                ? ev.wheelSegments
                : null;

        const count = ev.segmentCount || lista?.length || 0;
        if (count === 0) return;

        busyRef.current = true;
        currentRef.current = ev;
        if (lista) setSegments(lista);
        setWinner(null);

        const arrancar = () => {
            startRef.current = null;
            setPhase('spinning');
            nonceRef.current += 1;
            setActiveSpin({ nonce: nonceRef.current, segmentIndex: ev.segmentIndex, segmentCount: count });
            if (presentationOf(visualRef.current).sounds.includes('spin_slowdown')) {
                programarFrenada(visualRef.current.spinSeconds);
            }
        };

        // En modo `spin` la rueda primero entra y despues gira: girar durante la
        // entrada haria que el espectador se perdiera el arranque.
        const v = visualRef.current;
        if (v.visibility === 'spin' && !shownRef.current) {
            shownRef.current = true;
            setShown(true);
            setPhase('idle');
            startRef.current = window.setTimeout(arrancar, v.visibilityAnimation === 'none' ? 0 : ENTRADA_MS);
        } else {
            arrancar();
        }
    }, [programarFrenada]);

    /** Vuelve a reposo y sigue con la cola, o aplica la recarga que estaba esperando. */
    const reposo = useCallback(() => {
        setPhase('idle');
        setWinner(null);
        setActiveSpin(null);
        busyRef.current = false;
        currentRef.current = null;

        const next = queueRef.current.shift();
        if (next) { runSpin(next); return; }

        const pendiente = pendingRef.current;
        pendingRef.current = null;
        if (pendiente) aplicar(pendiente);
    }, [runSpin, aplicar]);

    /** La presentacion llego al ganador. De aca en adelante es igual en todas. */
    const handleFinished = useCallback(() => {
        const ev = currentRef.current;
        if (!ev) return;

        setPhase('revealed');
        setWinner(ev);
        setCelebracion(n => n + 1);
        play('reveal');
        window.setTimeout(() => play('win_celebration'), 220);

        window.setTimeout(() => {
            const v = visualRef.current;
            // Con giros en cola, en modo `spin` la rueda se queda en pantalla: salir y
            // volver a entrar entre dos giros seguidos se veria como un parpadeo.
            if (v.visibility === 'spin' && queueRef.current.length === 0) {
                shownRef.current = false;
                setShown(false);
                window.setTimeout(reposo, v.visibilityAnimation === 'none' ? 0 : SALIDA_MS);
            } else {
                reposo();
            }
        }, visualRef.current.revealSeconds * 1000);
    }, [play, reposo]);

    const enqueue = useCallback((ev: SpinEvent) => {
        if (ev.slug !== slug) return;   // otra rueda del mismo canal

        if (busyRef.current) queueRef.current.push(ev);
        else runSpin(ev);
    }, [runSpin, slug]);

    // Si el streamer cambia a "siempre visible" con la rueda escondida, aparece.
    // Al volver despues a "solo al girar", arranca escondida y no con el estado
    // que tenia antes del cambio.
    useEffect(() => {
        if (visual.visibility === 'always') { shownRef.current = false; setShown(null); }
    }, [visual.visibility]);

    useEffect(() => () => { if (startRef.current) window.clearTimeout(startRef.current); }, []);

    // ----------------------------------------------------------------
    // SignalR
    // ----------------------------------------------------------------
    useEffect(() => {
        if (!channel) return;
        let connection: signalR.HubConnection | null = null;
        let alive = true;
        let recarga: number | null = null;

        // Una rafaga de avisos (diez inscritos en un segundo) es UNA recarga.
        const recargarPronto = () => {
            if (recarga) window.clearTimeout(recarga);
            recarga = window.setTimeout(() => { recarga = null; loadData(); }, RECARGA_MS);
        };

        const connect = async () => {
            try {
                connection = new signalR.HubConnectionBuilder()
                    .withUrl(`${window.location.origin}/hubs/overlay`, { withCredentials: false })
                    .withAutomaticReconnect()
                    .build();

                connection.on('WheelSpin', (data: SpinEvent) => enqueue(data));
                // Solo el aviso de ESTA rueda. `ConfigurationChanged` ya no se
                // escucha: lo mandan el timer y otros overlays del canal, y la rueda
                // se recargaba con cada cambio ajeno.
                connection.on('WheelConfigChanged', (data: { slug?: string }) => {
                    if ((data?.slug || '').toLowerCase() === slug) recargarPronto();
                });

                connection.onreconnected(async () => {
                    await connection?.invoke('JoinChannel', channel);
                    await connection?.invoke('RegisterOverlay', channel, 'wheel');
                    loadData();
                });

                await connection.start();
                if (!alive) return;
                await connection.invoke('JoinChannel', channel);
                await connection.invoke('RegisterOverlay', channel, 'wheel');
            } catch {
                if (alive) window.setTimeout(connect, 5000);
            }
        };

        connect();
        return () => {
            alive = false;
            if (recarga) window.clearTimeout(recarga);
            connection?.stop();
        };
    }, [channel, slug, enqueue, loadData]);

    // En modo `spin` la rueda solo se ve mientras hay algo que mostrar.
    const enEscena = visual.visibility === 'always' || shown === true;
    const claseEscena = visual.visibility === 'always'
        ? 'is-always'
        : shown === true ? 'is-on' : shown === false ? 'is-off' : '';

    if (!channel || !slug || segments.length === 0) return null;

    const tarjeta = winner && (
        <div className="wheel-winner" key={winner.spinId ?? winner.segmentId}>
            <span className="wheel-winner-label">
                {winner.icon ? `${winner.icon} ` : ''}{winner.label}
            </span>
            {winner.spinner && <span className="wheel-winner-who">{winner.spinner}</span>}
        </div>
    );

    const rueda = (
        <div className={`wheel-shell ${phase === 'revealed' ? 'is-revealed' : ''}`}>
            <pres.Component
                segments={segments}
                visual={visual}
                spin={activeSpin}
                phase={phase}
                onSound={play}
                onFinished={handleFinished}
            />
        </div>
    );

    /** Lo que reemplaza a las variables de un texto propio. */
    const vars: Record<string, string> = {
        ganador: winner?.spinner ?? '',
        premio: winner?.label ?? '',
        icono: winner?.icon ?? '',
        canal: channel,
    };

    return (
        <div className={`wheel-stage ${claseEscena}`} data-anim={visual.visibilityAnimation}>
            <style>{buildCss(visual, pres, layout)}</style>

            {/* El fondo es una CAJA y no la pantalla entera. Antes se pintaba sobre
                `.wheel-stage`, que es `inset: 0`: elegir un color tapaba la escena
                del streamer de lado a lado. Con `transparent` —el valor de fabrica—
                no se dibuja nada, ni aca ni antes. */}
            {layout
                ? layout.background.enabled && visual.background !== 'transparent' && (
                    <div className="wheel-backdrop" />
                )
                : null}

            {/* Las piezas sueltas van antes que la rueda en el DOM; quien manda es
                su `zIndex`, que el streamer decide. */}
            {layout?.media.filter(m => m.url).map(m => (
                <Pieza key={m.id} visible={seVe(m.when, phase)} pieza={m}>
                    {esVideoUrl(m.url)
                        // Un video de la escena escondida no puede seguir sonando.
                        ? <Video pieza={m} visible={enEscena && seVe(m.when, phase)} />
                        : (
                            <img
                                src={m.url}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: m.fit, borderRadius: m.radius, opacity: m.opacity / 100 }}
                            />
                        )}
                </Pieza>
            ))}

            {layout?.texts.map(tx => (
                <Pieza key={tx.id} visible={seVe(tx.when, phase)} pieza={tx}>
                    <span className="wheel-piece-text" style={estiloTexto(tx)}>
                        {aplicarVars(tx.template, vars)}
                    </span>
                </Pieza>
            ))}

            {/* La rueda y la tarjeta. Con lienzo cada una va en su caja; sin el, las
                dos van dentro de un grupo centrado que es QUIEN LLEVA EL FONDO — el
                fondo tiene que ceñirse a lo que se dibuja, no a la pantalla. */}
            {layout ? (
                <>
                    {rueda}
                    {tarjeta && <div className="wheel-winner-slot">{tarjeta}</div>}
                </>
            ) : (
                <div className="wheel-auto-group">
                    {rueda}
                    {tarjeta}
                </div>
            )}

            {/* Sobre el escenario entero y no dentro de la rueda: el confeti tiene que
                poder cruzar por delante de la tarjeta del ganador, que esta fuera del
                disco. Va despues de la tarjeta en el DOM para quedar por encima. */}
            {layout
                ? <div className="wheel-celebration-slot"><WheelCelebration visual={visual} nonce={celebracion} /></div>
                : <WheelCelebration visual={visual} nonce={celebracion} />}

            {visual.showWatermark && (
                <div className="wheel-mark">Rueda de la Suerte · Decatron</div>
            )}
        </div>
    );
}

/**
 * Desde donde crece y se encoge la escena al entrar y salir. Con lienzo, desde el
 * centro de la RUEDA: si la rueda esta en una esquina y la escena creciera desde el
 * centro de la pantalla, entraria volando en diagonal.
 */
function origenEscena(layout: WheelLayout | null): string {
    if (!layout) return '50% 50%';
    const w = layout.wheel;
    return `${(w.x + w.width / 2).toFixed(0)}px ${(w.y + w.height / 2).toFixed(0)}px`;
}

/** Si una pieza se ve en esta fase. */
function seVe(when: PieceWhen, phase: 'idle' | 'spinning' | 'revealed'): boolean {
    if (when === 'always') return true;
    if (when === 'spinning') return phase === 'spinning';
    return phase === 'revealed';
}

/** `{ganador}`, `{premio}`, `{icono}` y `{canal}`. Lo que no exista se borra. */
function aplicarVars(plantilla: string, vars: Record<string, string>): string {
    return plantilla.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

function estiloTexto(tx: LayoutText): React.CSSProperties {
    return {
        fontSize: tx.fontSize,
        fontWeight: tx.weight,
        color: tx.color,
        textAlign: tx.align,
        textTransform: tx.uppercase ? 'uppercase' : 'none',
        background: tx.background,
        borderRadius: tx.radius,
        padding: tx.padding,
        // Debajo del relleno, como en los gajos: al reves el trazo se come cada
        // letra desde adentro.
        WebkitTextStroke: tx.outline > 0 ? `${tx.outline}px ${tx.outlineColor}` : undefined,
        paintOrder: 'stroke fill',
    };
}

/**
 * El video de una pieza.
 *
 * Va aparte de la imagen porque necesita algo que un `<img>` no: **volver al
 * principio cada vez que la pieza se muestra**. Las piezas no se desmontan —eso es
 * lo que permite animarles la salida—, asi que un video con `when: revealed` se
 * quedaria congelado en su ultimo fotograma y el segundo premio de la noche no
 * veria el video, veria el final del video.
 */
function Video({ pieza, visible }: { pieza: LayoutMedia; visible: boolean }) {
    const ref = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const v = ref.current;
        if (!v) return;
        if (!visible) { v.pause(); return; }
        v.currentTime = 0;
        v.volume = pieza.videoAudio ? pieza.videoVolume / 100 : 0;
        // Un fallo al reproducir no puede tumbar el overlay: OBS y los navegadores
        // tienen politicas distintas y lo peor que pasa es que no se vea el video.
        v.play().catch(() => { });
    }, [visible, pieza.videoAudio, pieza.videoVolume, pieza.url]);

    return (
        <video
            ref={ref}
            src={pieza.url}
            loop={pieza.loop}
            muted={!pieza.videoAudio}
            playsInline
            autoPlay
            style={{ width: '100%', height: '100%', objectFit: pieza.fit, borderRadius: pieza.radius, opacity: pieza.opacity / 100 }}
        />
    );
}

/**
 * Una pieza suelta del lienzo, con su entrada y su salida.
 *
 * NO se monta y desmonta: se queda en el DOM y cambia de clase. Desmontarla
 * obligaria a retenerla mientras dura la animacion de salida —o a no tener
 * animacion de salida— y a llevar ese estado por pieza. Con clases lo resuelve
 * el CSS, y la primera pasada no dispara la salida porque `mostrada` empieza en
 * false: sin eso, cada pieza haria su animacion de salida al abrir la escena.
 */
function Pieza({ pieza, visible, children }: {
    pieza: (LayoutText | LayoutMedia);
    visible: boolean;
    children: React.ReactNode;
}) {
    const mostrada = useRef(false);
    if (visible) mostrada.current = true;

    return (
        <div
            className={`wheel-piece ${visible ? 'is-on' : mostrada.current ? 'is-off' : ''}`}
            data-in={pieza.animationIn}
            data-out={pieza.animationOut}
            style={{
                left: pieza.x, top: pieza.y, width: pieza.width, height: pieza.height,
                zIndex: pieza.zIndex,
            }}
        >
            {children}
        </div>
    );
}

/**
 * Las animaciones de entrada y salida de las piezas.
 *
 * Cada una tiene su par: lo que entra deslizandose hacia arriba sale hacia abajo,
 * no hacia arriba otra vez. Que una pieza salga por donde entro es lo que hace que
 * se lea como que "se va" y no como que se corta.
 */
const ANIM_CSS = `
@keyframes p-fade-in   { from { opacity: 0 } to { opacity: 1 } }
@keyframes p-fade-out  { from { opacity: 1 } to { opacity: 0 } }
@keyframes p-slideUp-in    { from { opacity: 0; transform: translateY(40px) } to { opacity: 1; transform: none } }
@keyframes p-slideUp-out   { from { opacity: 1; transform: none } to { opacity: 0; transform: translateY(40px) } }
@keyframes p-slideDown-in  { from { opacity: 0; transform: translateY(-40px) } to { opacity: 1; transform: none } }
@keyframes p-slideDown-out { from { opacity: 1; transform: none } to { opacity: 0; transform: translateY(-40px) } }
@keyframes p-slideLeft-in  { from { opacity: 0; transform: translateX(60px) } to { opacity: 1; transform: none } }
@keyframes p-slideLeft-out { from { opacity: 1; transform: none } to { opacity: 0; transform: translateX(60px) } }
@keyframes p-slideRight-in  { from { opacity: 0; transform: translateX(-60px) } to { opacity: 1; transform: none } }
@keyframes p-slideRight-out { from { opacity: 1; transform: none } to { opacity: 0; transform: translateX(-60px) } }
@keyframes p-zoom-in   { from { opacity: 0; transform: scale(.72) } to { opacity: 1; transform: none } }
@keyframes p-zoom-out  { from { opacity: 1; transform: none } to { opacity: 0; transform: scale(.72) } }
@keyframes p-bounce-in {
    0% { opacity: 0; transform: translateY(18px) scale(.9) }
    60% { opacity: 1; transform: translateY(-6px) scale(1.03) }
    100% { opacity: 1; transform: none }
}
@keyframes p-bounce-out {
    0% { opacity: 1; transform: none }
    30% { transform: translateY(-8px) scale(1.04) }
    100% { opacity: 0; transform: translateY(22px) scale(.9) }
}

.wheel-piece {
    position: absolute;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; visibility: hidden;
    pointer-events: none;
}
.wheel-piece.is-on  { opacity: 1; visibility: visible; }
.wheel-piece.is-off { opacity: 0; visibility: visible; }
.wheel-piece-text {
    display: block; width: 100%;
    line-height: 1.15;
    text-shadow: 0 2px 6px rgba(0,0,0,.55);
}
${['fade', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'zoom', 'bounce'].map(a => `
.wheel-piece.is-on[data-in="${a}"]  { animation: p-${a}-in 520ms cubic-bezier(.22,1,.36,1) both; }
.wheel-piece.is-off[data-out="${a}"] { animation: p-${a}-out 460ms ease-in both; }
`).join('')}
/* Sin animacion la pieza aparece y desaparece seca. Es una opcion de verdad: un
   contador o un marco fijo parpadeando molesta mas de lo que aporta. */
.wheel-piece.is-off[data-out="none"] { visibility: hidden; }
`;

/**
 * El CSS depende del aspecto y del lienzo, asi que se arma por rueda en vez de ser
 * una constante. Va inline y no en una hoja aparte porque el overlay es una fuente
 * de OBS: cuantos menos archivos tenga que traer antes de dibujar, menos parpadeo
 * al abrir la escena.
 *
 * Hay dos repartos y no uno con casos particulares:
 *
 *   Sin `layout`  - el de siempre. Una columna centrada que se dimensiona con el
 *                   tamano real de la fuente (`vh`, `vw`), asi que se ve bien en
 *                   una fuente de 720p, 1080p o 1440p sin que nadie configure
 *                   nada. Es lo que ve una rueda que nunca abrio el editor.
 *   Con `layout`  - coordenadas de 1920x1080 aplicadas tal cual. Es lo que el
 *                   streamer coloco a mano y exige que la fuente de OBS mida
 *                   exactamente eso.
 *
 * Lo que **ya no** hace ninguno de los dos es pintar el fondo sobre la pantalla
 * entera. El escenario es siempre transparente; el color va en una caja.
 */
function buildCss(v: WheelVisual, pres: Presentation, layout: WheelLayout | null) {
    const base = `
.wheel-stage {
    position: fixed; inset: 0;
    background: transparent;
    font-family: ${FONTS[v.font].stack};
    overflow: hidden;
}
.wheel-winner {
    display: flex; flex-direction: column; align-items: center;
    background: ${v.ink};
    border-color: ${v.accent};
    border-style: solid;
    box-shadow: 0 10px 34px rgba(0,0,0,.6);
}
.wheel-winner-label {
    color: ${v.bone};
    font-weight: ${v.fontWeight};
    letter-spacing: -0.02em;
    line-height: 1.1;
    text-align: center;
}
.wheel-winner-who { color: ${v.accent}; font-weight: 600; }

.wheel-mark {
    color: ${v.bone}; opacity: .62;
    font-weight: 600; letter-spacing: .01em;
    text-shadow: 0 1px 3px rgba(0,0,0,.9);
    z-index: 6;
}
/* Visibilidad de la escena entera en modo "solo al girar". Sin clase es que
   todavia no aparecio nunca: invisible y sin animacion de salida. */
.wheel-stage { opacity: 0; visibility: hidden; transform-origin: ${origenEscena(layout)}; }
.wheel-stage.is-always, .wheel-stage.is-on { opacity: 1; visibility: visible; }
.wheel-stage.is-off { opacity: 0; visibility: visible; }
.wheel-stage.is-off[data-anim="none"] { visibility: hidden; }
${['fade', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'zoom', 'bounce'].map(a => `
.wheel-stage.is-on[data-anim="${a}"]  { animation: p-${a}-in ${ENTRADA_MS}ms cubic-bezier(.22,1,.36,1) both; }
.wheel-stage.is-off[data-anim="${a}"] { animation: p-${a}-out ${SALIDA_MS}ms ease-in both; }
`).join('')}

/* Al revelar, la rueda se aparta y deja el escenario a la tarjeta del ganador. */
.wheel-shell.is-revealed { transform: scale(.9); }
.wheel-shell { transition: transform 620ms cubic-bezier(.22,1,.36,1), opacity 620ms; }
` + ANIM_CSS;

    if (!layout) {
        return base + `
.wheel-stage {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
}
/* El grupo es quien lleva el fondo, y no el escenario. Transparente —el valor de
   fabrica— no se ve, y el reparto queda identico al de siempre; con un color se
   pinta lo que rodea a la rueda y no la escena entera del streamer. */
.wheel-auto-group {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 22px;
    background: ${v.background};
    ${v.background === 'transparent' ? '' : 'padding: 30px 38px; border-radius: 26px;'}
}
/* El alto manda y el ancho sale de la proporcion que declara la presentacion:
   asi una tira horizontal (aspect 4) y un carrete vertical (aspect 0.4) se
   dimensionan solos, sin que el overlay sepa nada de ellos. */
.wheel-shell {
    position: relative;
    aspect-ratio: ${pres.aspect};
    /* El alto se limita por los tres lados y el ancho sale solo de la proporcion.
       Si el ancho tambien fuera explicito, un recorte por 92vw deformaria la
       presentacion en vez de encogerla: una tira de 3.4 saldria de 1.9. */
    height: min(58vh, 520px, calc(92vw / ${pres.aspect}));
    width: auto;
}
.wheel-winner {
    gap: 4px; padding: 14px 34px; border-width: 3px; border-radius: 14px;
    animation: p-bounce-in 520ms cubic-bezier(.22,1,.36,1) both;
}
.wheel-winner-label { font-size: clamp(22px, 3.6vh, 40px); }
.wheel-winner-who { font-size: clamp(13px, 1.9vh, 19px); }
.wheel-mark { position: fixed; right: 16px; bottom: 14px; font-size: 12px; }
`;
    }

    // La letra sigue al alto de su caja: una caja del doble de alto se lee al doble
    // de grande. Con un tamano fijo, agrandar la tarjeta solo dibujaria mas aire
    // alrededor del mismo texto, que no es lo que nadie espera de un tirador.
    const kw = layout.winner.height / WINNER_BASE_HEIGHT;
    const km = layout.watermark.height / WATERMARK_BASE_HEIGHT;
    const caja = (b: LayoutBox) =>
        `left: ${b.x}px; top: ${b.y}px; width: ${b.width}px; height: ${b.height}px;`;

    return base + `
.wheel-backdrop { position: absolute; ${caja(layout.background)} background: ${v.background}; z-index: 0; }
.wheel-shell { position: absolute; ${caja(layout.wheel)} z-index: 2; }
/* La caja dice DONDE va la tarjeta y de que tamano es su letra; la tarjeta se
   sigue ajustando a su contenido y se centra dentro. Estirar un recuadro vacio
   alrededor de un premio corto se veria peor que hoy, no mejor. */
.wheel-winner-slot {
    position: absolute; ${caja(layout.winner)}
    display: flex; align-items: center; justify-content: center;
    pointer-events: none; z-index: 3;
}
.wheel-winner {
    gap: ${(4 * kw).toFixed(1)}px;
    padding: ${(14 * kw).toFixed(1)}px ${(34 * kw).toFixed(1)}px;
    border-width: ${Math.max(1, 3 * kw).toFixed(1)}px;
    border-radius: ${(14 * kw).toFixed(1)}px;
    max-width: 100%;
    animation: p-${layout.winnerAnimationIn}-in 520ms cubic-bezier(.22,1,.36,1) both;
}
.wheel-winner-label { font-size: ${(38.9 * kw).toFixed(1)}px; }
.wheel-winner-who { font-size: ${(19 * kw).toFixed(1)}px; }
/* El confeti cae dentro de su caja y no sobre toda la pantalla. Por defecto la
   caja ES toda la pantalla, que es donde caia antes. */
.wheel-celebration-slot { position: absolute; ${caja(layout.celebration)} pointer-events: none; z-index: 5; }
.wheel-mark {
    position: absolute; ${caja(layout.watermark)}
    display: flex; align-items: center; justify-content: center;
    font-size: ${(12 * km).toFixed(1)}px;
    white-space: nowrap;
}
`;
}
