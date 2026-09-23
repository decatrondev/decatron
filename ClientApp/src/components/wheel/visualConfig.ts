/**
 * El aspecto de una Rueda de la Suerte: esquema, valores por defecto de Decatron
 * y lectura defensiva.
 *
 * Vive aparte del overlay y del panel porque los dos tienen que entender lo mismo.
 * Antes el aspecto eran constantes sueltas dentro de `WheelOverlay.tsx` y el panel
 * dibujaba su propia copia; cualquier cambio en uno dejaba al otro mintiendo.
 *
 * Todo se guarda en `wheels.visual_config` (jsonb). Lo que el streamer no toca no
 * se guarda: se cae al default de Decatron, que es el principio de la feature —
 * sin configurar nada, funciona y se ve bien.
 */

export type SoundKey =
    | 'spin_start'
    | 'spin_tick'
    | 'spin_slowdown'
    | 'reveal'
    | 'win_celebration'
    // Solo en modo Sorteo, donde reemplazan a `spin_start` y a `win_celebration`:
    // sortear a una persona no suena igual que girar por un premio.
    | 'raffle_draw'
    | 'raffle_winner';

/** `default` = el de Decatron · `mute` = silencio · `custom` = uno del streamer. */
export type SoundMode = 'default' | 'mute' | 'custom';

export interface SoundSetting {
    mode: SoundMode;
    /** Solo con `mode: 'custom'`. Sale de la biblioteca de medios. */
    url?: string | null;
    /** 0 a 1, se multiplica por el volumen maestro. */
    volume?: number;
}

/**
 * Las tipografias que puede elegir el streamer.
 *
 * Es una lista cerrada a proposito. El overlay corre dentro de OBS, en un
 * navegador que NO tiene instaladas las fuentes de la computadora del streamer:
 * dejar escribir un nombre libre daria un panel que se ve bien y un directo que
 * sale en la fuente de reserva. Aca cada opcion es o una pila del sistema o una
 * familia de Google Fonts que el propio overlay descarga, asi que lo que se ve
 * en el preview es lo que sale en pantalla.
 *
 * `weights` son los pesos que existen de verdad. Se piden solo esos y el panel
 * solo ofrece esos: pedirle a Google un peso que la familia no tiene devuelve un
 * 404 y el navegador termina fingiendo la negrita.
 */
export type FontKey =
    | 'system' | 'inter' | 'chakra' | 'outfit' | 'fredoka'
    | 'bebas' | 'luckiest' | 'press' | 'jetbrains';

export interface FontOption {
    /** Lo que va en `font-family`. */
    stack: string;
    weights: number[];
    /** El `family=` de Google Fonts, o null si no hay nada que descargar. */
    google: string | null;
}

export const FONTS: Record<FontKey, FontOption> = {
    system:    { stack: 'system-ui, -apple-system, "Segoe UI", sans-serif', weights: [400, 600, 700, 800, 900], google: null },
    inter:     { stack: '"Inter", system-ui, sans-serif', weights: [400, 600, 700, 800, 900], google: 'Inter' },
    chakra:    { stack: '"Chakra Petch", system-ui, sans-serif', weights: [400, 500, 600, 700], google: 'Chakra+Petch' },
    outfit:    { stack: '"Outfit", system-ui, sans-serif', weights: [400, 600, 700, 800, 900], google: 'Outfit' },
    fredoka:   { stack: '"Fredoka", system-ui, sans-serif', weights: [400, 500, 600, 700], google: 'Fredoka' },
    bebas:     { stack: '"Bebas Neue", Impact, system-ui, sans-serif', weights: [400], google: 'Bebas+Neue' },
    luckiest:  { stack: '"Luckiest Guy", system-ui, cursive', weights: [400], google: 'Luckiest+Guy' },
    press:     { stack: '"Press Start 2P", "Courier New", monospace', weights: [400], google: 'Press+Start+2P' },
    jetbrains: { stack: '"JetBrains Mono", "Courier New", monospace', weights: [400, 500, 700, 800], google: 'JetBrains+Mono' },
};

export const FONT_KEYS = Object.keys(FONTS) as FontKey[];

/**
 * Mete en el `<head>` el `<link>` de la familia elegida, una sola vez por familia.
 *
 * Lo llama quien dibuja la rueda — overlay y panel — en vez de precargarlas todas
 * en el index: son nueve familias y una rueda usa una. En OBS cada kilobyte se
 * traduce en parpadeo al abrir la escena.
 */
export function ensureFont(key: FontKey): void {
    const f = FONTS[key];
    if (!f?.google || typeof document === 'undefined') return;

    const id = `wheel-font-${key}`;
    if (document.getElementById(id)) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${f.google}:wght@${f.weights.join(';')}&display=swap`;
    document.head.appendChild(link);
}

/** El peso valido mas cercano al pedido dentro de la familia. */
export function nearestWeight(key: FontKey, weight: number): number {
    const pesos = FONTS[key]?.weights ?? FONTS.system.weights;
    return pesos.reduce((mejor, w) => Math.abs(w - weight) < Math.abs(mejor - weight) ? w : mejor, pesos[0]);
}

/**
 * Cómo se dibuja el resultado de un giro. El motor es el mismo en todas: el
 * servidor elige el índice ganador y la presentación solo anima hasta él.
 *
 * La union vive acá, y no en el registro de presentaciones, para que
 * `visualConfig` no dependa de los componentes — el registro sí depende de esta
 * clave, y al revés serían imports circulares. Agregar una clave acá obliga a
 * registrar su componente: `PRESENTATIONS` es un `Record` de esta union y no
 * compila incompleto.
 */
export type PresentationKey = 'wheel' | 'strip' | 'reel' | 'grid' | 'ball' | 'card';

export const PRESENTATION_KEYS: PresentationKey[] = ['wheel', 'ball', 'strip', 'reel', 'grid', 'card'];

/* ------------------------------------------------------------------ *
 * El lienzo
 * ------------------------------------------------------------------ */

/**
 * La resolucion de diseno del overlay. El editor del panel coloca todo sobre un
 * lienzo de este tamano y el overlay aplica esas coordenadas **tal cual**, en
 * pixeles: es la misma convencion que usa el editor de Event Alerts.
 *
 * La consecuencia hay que decirla: la fuente de navegador del streamer en OBS
 * tiene que medir exactamente esto, o el diseno sale corrido. El panel lo avisa
 * junto al enlace del overlay. Una rueda que nunca paso por el editor NO tiene
 * este problema: sin `layout` el overlay sigue centrandose solo y se adapta a
 * cualquier tamano de fuente, que es como funciono siempre.
 */
export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;

/** Una caja del lienzo, en pixeles de 1920x1080. */
export interface LayoutBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Donde va cada pieza. Es `null` mientras el streamer no haya tocado el editor,
 * y eso NO es lo mismo que "todo en su sitio por defecto": con `null` el overlay
 * usa el reparto automatico de siempre —centrado, relativo al tamano real de la
 * fuente— y no las coordenadas fijas. Volver a `null` es el boton de restablecer.
 */
export interface WheelLayout {
    /**
     * El fondo. Es una caja como cualquier otra y NO la pantalla entera: pintar
     * todo el lienzo tapa la escena del streamer de lado a lado, que es lo que
     * hacia antes de existir esto. Empieza cubriendolo todo —que era el
     * comportamiento anterior— y se encoge, se mueve o se apaga.
     *
     * El color sigue en `visual.background`, con `transparent` como valor de
     * fabrica: apagar el fondo no necesita el editor.
     */
    background: LayoutBox & { enabled: boolean };
    /** La presentacion: rueda, tira, carrete, rejilla, bola o carta. */
    wheel: LayoutBox;
    /**
     * El area donde aparece la tarjeta del ganador. La tarjeta se sigue ajustando
     * a su contenido y se centra dentro de la caja: la caja dice donde va y de
     * que tamano es la letra, no estira un recuadro vacio alrededor del premio.
     */
    winner: LayoutBox;
    /** Donde pasa la celebracion. El confeti cae dentro de esta caja. */
    celebration: LayoutBox;
    /** La marca de Decatron. */
    watermark: LayoutBox;

    /** Los textos propios del streamer. */
    texts: LayoutText[];
    /** Las imagenes propias del streamer. */
    media: LayoutMedia[];

    /** Como entra y sale la tarjeta del ganador. */
    winnerAnimationIn: LayoutAnimation;
    winnerAnimationOut: LayoutAnimation;
}

/**
 * Los altos con los que el reparto automatico dibuja hoy la tarjeta y la marca a
 * 1920x1080. Sirven de referencia para escalar su letra: una caja del doble de
 * alto tiene la letra del doble de grande.
 */
export const WINNER_BASE_HEIGHT = 98;
export const WATERMARK_BASE_HEIGHT = 16;

/**
 * El reparto de siempre, escrito en coordenadas.
 *
 * Sale de las mismas cuentas que hace el CSS del overlay a 1920x1080
 * (`min(58vh, 520px, 92vw/aspect)` para la rueda, la tarjeta debajo con 22px de
 * aire, la marca abajo a la derecha), asi que abrir el editor y no tocar nada
 * deja la rueda **donde ya estaba**.
 *
 * Depende del `aspect` de la presentacion, que vive en el registro; por eso es
 * una funcion y no una constante, y por eso la llama quien conoce la
 * presentacion en vez de `resolveVisual` — `visualConfig` no puede importar el
 * registro sin volver circular la dependencia.
 */
export function defaultLayout(aspect: number): WheelLayout {
    const alto = Math.min(0.58 * CANVAS_HEIGHT, 520, (0.92 * CANVAS_WIDTH) / aspect);
    const ancho = alto * aspect;

    const wheel: LayoutBox = {
        x: Math.round((CANVAS_WIDTH - ancho) / 2),
        y: Math.round((CANVAS_HEIGHT - alto) / 2),
        width: Math.round(ancho),
        height: Math.round(alto),
    };

    const winnerAncho = 900;
    const winner: LayoutBox = {
        x: Math.round((CANVAS_WIDTH - winnerAncho) / 2),
        y: wheel.y + wheel.height + 22,
        width: winnerAncho,
        height: WINNER_BASE_HEIGHT,
    };

    const markAncho = 210;
    const watermark: LayoutBox = {
        x: CANVAS_WIDTH - 16 - markAncho,
        y: CANVAS_HEIGHT - 14 - WATERMARK_BASE_HEIGHT,
        width: markAncho,
        height: WATERMARK_BASE_HEIGHT,
    };

    return {
        // Cubriendo todo y encendido: es lo que el overlay hacia hasta ahora, para
        // que abrir el editor no cambie nada. Encogerlo o apagarlo es la novedad.
        background: { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, enabled: true },
        wheel,
        winner,
        // El confeti ocupaba la pantalla entera y ese sigue siendo su sitio por
        // defecto: es un efecto de escena, no una pieza que se lea.
        celebration: { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
        watermark,
        texts: [],
        media: [],
        winnerAnimationIn: 'bounce',
        winnerAnimationOut: 'fade',
    };
}

/**
 * El reparto de fabrica: el que el proyecto usa en su propia rueda.
 *
 * Sale de `defaultLayout(1)` con tres cosas movidas a mano — la marca, el fondo y la
 * celebracion —, asi que una rueda recien creada nace ya colocada en vez de con el
 * reparto automatico. Es una eleccion consciente y tiene su precio, dicho aqui para
 * que nadie lo descubra en directo: **con coordenadas fijas la fuente de navegador de
 * OBS tiene que medir exactamente 1920x1080**. "Volver al automatico" guarda
 * `layout: null` y deshace la eleccion; ese null NO es esto.
 */
export const DEFAULT_LAYOUT: WheelLayout = {
    background: { x: 510, y: 220, width: 910, height: 730, enabled: true },
    wheel: { x: 700, y: 280, width: 520, height: 520 },
    winner: { x: 510, y: 822, width: 900, height: 98 },
    celebration: { x: 510, y: 220, width: 910, height: 730 },
    watermark: { x: 1200, y: 930, width: 210, height: 16 },
    texts: [],
    media: [],
    winnerAnimationIn: 'bounce',
    winnerAnimationOut: 'fade',
};

/**
 * Corrige la caja de la rueda para que respete la proporcion de su presentacion,
 * conservando el centro.
 *
 * Hace falta porque la caja se guarda con la rueda y la presentacion se puede
 * cambiar despues: una caja cuadrada heredada por una tira la dibujaria aplastada.
 * Manda el alto, igual que en el overlay y en el preview, porque asi una tira se
 * ensancha en vez de encogerse.
 */
export function fitBoxToAspect(box: LayoutBox, aspect: number): LayoutBox {
    const ancho = box.height * aspect;
    if (Math.abs(ancho - box.width) < 0.5) return box;
    return {
        x: Math.round(box.x + (box.width - ancho) / 2),
        y: box.y,
        width: Math.round(ancho),
        height: box.height,
    };
}

/** Mete una caja dentro del lienzo sin cambiarle el tamano. */
export function clampBox(box: LayoutBox): LayoutBox {
    const width = Math.min(Math.max(box.width, 8), CANVAS_WIDTH);
    const height = Math.min(Math.max(box.height, 8), CANVAS_HEIGHT);
    return {
        width,
        height,
        x: Math.min(Math.max(box.x, 0), CANVAS_WIDTH - width),
        y: Math.min(Math.max(box.y, 0), CANVAS_HEIGHT - height),
    };
}

/**
 * Cuando se ve una pieza. Es lo que hace util un texto o una imagen propios: un
 * titulo que esta siempre no es lo mismo que un "y el premio es..." que solo
 * aparece al revelar.
 */
export type PieceWhen = 'always' | 'spinning' | 'revealed';
export const PIECE_WHENS: PieceWhen[] = ['always', 'spinning', 'revealed'];

/** Como entra y como sale una pieza que aparece y desaparece. */
export type LayoutAnimation =
    | 'none' | 'fade' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight'
    | 'zoom' | 'bounce';

export const LAYOUT_ANIMATIONS: LayoutAnimation[] = [
    'none', 'fade', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'zoom', 'bounce',
];

/** Lo que toda pieza suelta del lienzo declara, sea texto o imagen. */
export interface LayoutPieceBase extends LayoutBox {
    id: string;
    when: PieceWhen;
    zIndex: number;
    animationIn: LayoutAnimation;
    animationOut: LayoutAnimation;
}

/**
 * Un texto del streamer. La plantilla admite las mismas variables que los mensajes
 * de chat: `{ganador}`, `{premio}`, `{icono}` y `{canal}`.
 */
export interface LayoutText extends LayoutPieceBase {
    kind: 'text';
    template: string;
    /** Pixeles del lienzo de 1920x1080, como todo lo demas de aca. */
    fontSize: number;
    color: string;
    align: 'left' | 'center' | 'right';
    weight: number;
    uppercase: boolean;
    outline: number;
    outlineColor: string;
    /** `transparent` o un color: una caja detras del texto, para que se lea. */
    background: string;
    radius: number;
    padding: number;
}

/** Una imagen, GIF o video del streamer, de su biblioteca de medios. */
export interface LayoutMedia extends LayoutPieceBase {
    kind: 'media';
    url: string;
    fit: 'cover' | 'contain' | 'fill';
    /** 0 a 100. */
    opacity: number;
    radius: number;

    // --- solo video ---
    /** Repetir en bucle. Un video de fondo si; una entrada de premio no. */
    loop: boolean;
    /**
     * Dejar sonar el audio del video.
     *
     * Apagado por defecto **a proposito**: el overlay es una fuente de OBS que
     * arranca sola, y un video con voz sonando encima del streamer es peor que uno
     * mudo. Ademas los navegadores solo dejan arrancar en automatico lo que va
     * silenciado; OBS es mas permisivo, pero el panel no.
     */
    videoAudio: boolean;
    /** 0 a 100. Solo tiene efecto con `videoAudio`. */
    videoVolume: number;
}

/**
 * Si una URL de la biblioteca es un video.
 *
 * Se decide por la extension y no por un campo guardado: el tipo lo decide el
 * archivo, y un campo aparte es un segundo sitio donde la misma verdad se puede
 * desincronizar — cambiar la URL de un mp4 a un png dejaria el campo mintiendo.
 */
export function esVideoUrl(url: string): boolean {
    return /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(url.trim());
}

/**
 * Cuantas piezas sueltas se dibujan como maximo.
 *
 * El tope se aplica **al leer** y no al guardar: `visual_config` es jsonb libre y
 * una lista larguisima llegada por la API no puede dejar el overlay arrastrandose
 * en mitad de un directo. Doce y ocho son mas de lo que cabe con sentido en una
 * pantalla; el limite existe para que exista, no para acotar a nadie.
 */
export const MAX_TEXTS = 12;
export const MAX_MEDIA = 8;

export const LAYOUT_PARTS = ['background', 'wheel', 'winner', 'celebration', 'watermark'] as const;
export type LayoutPart = typeof LAYOUT_PARTS[number];

/* ------------------------------------------------------------------ *
 * El puntero
 * ------------------------------------------------------------------ */

/**
 * Que clase de puntero tiene una presentacion. Lo declara ella, igual que
 * `motion`, `parts` y `sounds`, y el panel esconde lo que no aplique.
 *
 *   `needle` - una aguja que apunta al ganador (la rueda).
 *   `viewer` - un marco alrededor de la casilla ganadora (tira, carrete, rejilla).
 *   `none`   - no hay nada que apuntar (la bola es su propia marca; la carta no
 *              sortea a la vista).
 *
 * Sin esto, el puntero habria sido un elemento mas del lienzo y habria dejado
 * controles muertos en cinco de las seis presentaciones.
 */
export type PointerKind = 'needle' | 'viewer' | 'none';

export type NeedleShape = 'triangle' | 'arrow' | 'drop' | 'bar';
export const NEEDLE_SHAPES: NeedleShape[] = ['triangle', 'arrow', 'drop', 'bar'];

export type NeedleSide = 'top' | 'right' | 'bottom' | 'left';
export const NEEDLE_SIDES: NeedleSide[] = ['top', 'right', 'bottom', 'left'];

/** Cuantos grados hay que correr el disco para que el ganador caiga bajo la aguja. */
export const SIDE_ANGLE: Record<NeedleSide, number> = { top: 0, right: 90, bottom: 180, left: 270 };

export interface WheelPointer {
    /** Sin puntero. La rueda sigue parando donde para; solo no se dibuja la marca. */
    hidden: boolean;
    /** Multiplica el tamano de fabrica. */
    size: number;
    /** `null` = sigue al color de acento, como siempre. */
    color: string | null;

    // --- solo `needle` ---
    shape: NeedleShape;
    /**
     * De que lado apunta. Mover la aguja NO es solo CSS: el disco tiene que parar
     * corrido esos mismos grados o la aguja senalaria otro gajo. Por eso existe
     * `SIDE_ANGLE` y por eso esto vive en el aspecto y no en el lienzo.
     */
    side: NeedleSide;

    // --- solo `viewer` ---
    /** Grosor del marco, en pixeles del dibujo. */
    thickness: number;
    /** Las dos puntas del visor. Sin ellas se lee como un recuadro, no como mira. */
    caps: boolean;
}

/** Exactamente lo que las presentaciones dibujaban antes de ser configurable. */
export const DEFAULT_POINTER: WheelPointer = {
    hidden: false,
    size: 1,
    color: null,
    shape: 'triangle',
    side: 'top',
    thickness: 3,
    caps: true,
};

export type Easing = 'quint' | 'cubic' | 'expo';
export type Celebration = 'confetti' | 'flash' | 'none';

/**
 * Cuando se ve la rueda en OBS.
 *
 *   `always` - siempre en pantalla, girando o en reposo.
 *   `spin`   - invisible en reposo. Entra al llegar un giro y sale cuando termina
 *              de mostrar al ganador. Con giros en cola se queda hasta el ultimo:
 *              salir y volver a entrar entre dos giros seguidos se veria como un
 *              parpadeo.
 */
export type WheelVisibility = 'always' | 'spin';
export const WHEEL_VISIBILITIES: WheelVisibility[] = ['spin', 'always'];

export interface WheelVisual {
    /** Colores de reserva para los gajos que no eligieron uno propio. */
    palette: string[];
    /** Tinta: aro, cubo, texto de los gajos y fondo de la tarjeta del ganador. */
    ink: string;
    /** El color del acento: aro exterior, aguja y punto del cubo. */
    accent: string;
    /** Texto sobre la tinta. */
    bone: string;
    /** `transparent` para OBS, o un hex si el streamer quiere fondo. */
    background: string;
    /** Imagen del cubo central. De la biblioteca de medios. Admite PNG, JPG y GIF. */
    centerImage: string | null;
    /**
     * Radio de la imagen del centro, en unidades del dibujo (la rueda mide 520 y su
     * disco tiene radio 236). El cubo por defecto mide 40, que para un logo va bien
     * pero deja cualquier ilustracion demasiado chica para reconocerla.
     */
    centerImageSize: number;

    /** Cómo se dibuja el giro. Por rueda y no por canal: una rueda grande de
     *  subs y una rueda rápida de bits no tienen por qué verse igual. */
    presentation: PresentationKey;

    /** Tipografia de toda la rueda: gajos, tarjeta del ganador y marca. */
    font: FontKey;
    /** Grosor del texto de los gajos. Se ajusta al peso mas cercano que exista. */
    fontWeight: number;
    /**
     * Multiplica el tamano que la rueda calcula sola para cada etiqueta. El
     * calculo automatico sigue mandando (encoge con etiquetas largas y con gajos
     * angostos) porque es lo que impide que el texto se salga de la cuna; esto
     * solo lo sube o lo baja entero.
     */
    textScale: number;
    /** Color del texto de los gajos. `null` = sigue a la tinta, como siempre. */
    textColor: string | null;
    /** Grosor del contorno del texto, 0 = sin contorno. */
    textOutline: number;
    /** Color del contorno. `null` = sigue al color de texto sobre tinta. */
    textOutlineColor: string | null;
    /** Escribir las etiquetas en mayusculas. */
    textUppercase: boolean;

    /** Ver `WheelVisibility`. */
    visibility: WheelVisibility;
    /** Como entra y sale la rueda entera en modo `spin`. Las mismas del lienzo. */
    visibilityAnimation: LayoutAnimation;

    spinSeconds: number;
    revealSeconds: number;
    /** Vueltas completas antes de frenar. */
    turns: number;
    easing: Easing;
    celebration: Celebration;

    /** Marca de agua de Decatron. Solo la puede apagar quien su tier lo permita. */
    showWatermark: boolean;

    /**
     * El puntero. Que partes de esto se usan lo decide la presentacion con su
     * `pointer`; el panel esconde el resto.
     */
    pointer: WheelPointer;

    /**
     * Donde va cada pieza en el lienzo de 1920x1080, o `null` si esta rueda nunca
     * paso por el editor. `null` no es "los valores por defecto": es el reparto
     * automatico de siempre, que se centra solo y se adapta al tamano real de la
     * fuente de OBS. Las coordenadas fijas son algo que el streamer elige.
     */
    layout: WheelLayout | null;

    sounds: {
        master: number;
    } & Record<SoundKey, SoundSetting>;
}

/**
 * Los archivos del pack de Decatron. No cuentan contra la cuota del streamer.
 *
 * El `?v=` es para la cache de OBS: al reemplazar un archivo con el mismo nombre,
 * la fuente seguiria sonando el viejo. Subirlo cada vez que se cambia un audio.
 *
 * v2: la frenada era una grabacion de diez clics cada vez mas separados —otra
 * rueda girando— que sonaba encima de los ticks reales y se oia como si la rueda
 * arrancara de nuevo al salir el premio. Ahora es un roce continuo sin golpes: la
 * desaceleracion ya la marcan los ticks de verdad. El revelado era un pitido plano
 * y ahora es una campana de dos notas.
 */
export const DEFAULT_SOUND_FILES: Record<SoundKey, string> = {
    spin_start: '/assets/wheel/sounds/spin_start.mp3',
    spin_tick: '/assets/wheel/sounds/spin_tick.mp3',
    spin_slowdown: '/assets/wheel/sounds/spin_slowdown.mp3?v=2',
    reveal: '/assets/wheel/sounds/reveal.mp3?v=2',
    win_celebration: '/assets/wheel/sounds/win_celebration.mp3',
    raffle_draw: '/assets/wheel/sounds/raffle_draw.mp3',
    raffle_winner: '/assets/wheel/sounds/raffle_winner.mp3',
};

/**
 * `spin_tick` NO admite sonido propio, solo silenciarse. Se reproduce en bucle
 * rápido mientras la rueda gira y un sample con cola o con ruido suena espantoso
 * repetido treinta veces por segundo. Es la única excepción del set.
 */
export const TICK_IS_DEFAULT_ONLY = true;

export const SOUND_KEYS: SoundKey[] = [
    'spin_start',
    'spin_tick',
    'spin_slowdown',
    'reveal',
    'win_celebration',
    'raffle_draw',
    'raffle_winner',
];

/** Los sonidos que solo existen en modo Sorteo, y a cual reemplaza cada uno. */
export const RAFFLE_SOUND_FOR: Partial<Record<SoundKey, SoundKey>> = {
    spin_start: 'raffle_draw',
    win_celebration: 'raffle_winner',
};

/** Paleta de escenario de concurso: tinta profunda, latón, magenta y cian. */
export const DEFAULT_PALETTE = ['#E8B455', '#FF3D7F', '#3DE0FF', '#8B7BF7', '#4ADE80', '#FF8A3D'];

export const DEFAULT_VISUAL: WheelVisual = {
    palette: DEFAULT_PALETTE,
    ink: '#12101B',
    accent: '#E8B455',
    bone: '#F5F0E6',
    background: 'transparent',
    centerImage: null,
    centerImageSize: 40,

    presentation: 'wheel',

    // La tipografia de fabrica es la que el proyecto usa en su propia rueda: mas
    // grande, en mayusculas y con contorno, que es lo que se lee de verdad en un
    // directo a 1080p con la escena del juego debajo. NO es lo que la rueda dibujaba
    // antes de que el campo existiera (peso 800, escala 1, sin contorno); las ruedas
    // que ya guardaron su aspecto conservan el suyo, porque `resolveVisual` solo cae
    // aqui cuando el campo falta.
    font: 'system',
    fontWeight: 700,
    textScale: 1.65,
    textColor: null,
    textOutline: 6,
    textOutlineColor: null,
    textUppercase: true,

    // `always` y no `spin`: es lo que ve una rueda guardada antes de que existiera
    // la opcion, y cambiarselo haria desaparecer una rueda de una escena ya armada.
    // Las ruedas NUEVAS nacen en `spin` porque el backend les guarda la clave.
    visibility: 'always',
    visibilityAnimation: 'zoom',

    spinSeconds: 5.2,
    revealSeconds: 4.5,
    turns: 4,
    easing: 'quint',
    celebration: 'confetti',

    showWatermark: true,
    // El puntero de fabrica NO es `DEFAULT_POINTER` a secas. Ese es la base neutra
    // desde la que las plantillas construyen el suyo (`{ ...DEFAULT_POINTER, shape }`),
    // y meterle aqui el lado y el color dejaria a Neon con una aguja azul a la derecha
    // en vez de una que sigue a su acento. Son dos cosas distintas y por eso viven en
    // dos sitios.
    pointer: { ...DEFAULT_POINTER, side: 'right', size: 1.4, color: '#1c4a87' },
    // Sin editor: la rueda se sigue centrando sola, como siempre.
    layout: DEFAULT_LAYOUT,

    sounds: {
        master: 0.8,
        spin_start: { mode: 'default', volume: 1 },
        spin_tick: { mode: 'default', volume: 0.9 },
        spin_slowdown: { mode: 'default', volume: 0.55 },
        reveal: { mode: 'default', volume: 1 },
        win_celebration: { mode: 'default', volume: 1 },
        raffle_draw: { mode: 'default', volume: 1 },
        raffle_winner: { mode: 'default', volume: 1 },
    },
};

/**
 * Lee el lienzo guardado. Es todo o nada: si a una de las tres cajas le falta un
 * numero, se devuelve `null` y la rueda vuelve al reparto automatico.
 *
 * Mezclar cajas buenas con cajas inventadas seria peor que no tener ninguna: el
 * streamer veria dos piezas donde las puso y una tercera en un sitio que nadie
 * eligio, sin nada que le diga por que.
 */
function leerLayout(raw: unknown): WheelLayout | null {
    if (!raw || typeof raw !== 'object') return null;
    const l = raw as Record<string, unknown>;

    const caja = (v: unknown): LayoutBox | null => {
        if (!v || typeof v !== 'object') return null;
        const b = v as Record<string, unknown>;
        const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
        const [x, y, w, h] = [n(b.x), n(b.y), n(b.width), n(b.height)];
        if (x === null || y === null || w === null || h === null) return null;
        return clampBox({ x, y, width: w, height: h });
    };

    const wheel = caja(l.wheel);
    const winner = caja(l.winner);
    const watermark = caja(l.watermark);
    if (!wheel || !winner || !watermark) return null;

    // Estas tres llegaron despues que las de arriba. Un lienzo guardado antes de
    // que existieran no puede volverse invalido por eso: se caen a lo que hacia el
    // overlay entonces —fondo cubriendolo todo, confeti en toda la pantalla, sin
    // piezas sueltas—, que es exactamente el reparto por defecto.
    const todo = { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
    const fondoCaja = caja(l.background) ?? todo;
    const background = {
        ...fondoCaja,
        enabled: (l.background as Record<string, unknown> | undefined)?.enabled !== false,
    };
    const celebration = caja(l.celebration) ?? todo;

    const anim = (v: unknown, def: LayoutAnimation): LayoutAnimation =>
        LAYOUT_ANIMATIONS.includes(v as LayoutAnimation) ? v as LayoutAnimation : def;

    return {
        background,
        wheel,
        winner,
        celebration,
        watermark,
        texts: leerPiezas(l.texts, MAX_TEXTS, leerTexto),
        media: leerPiezas(l.media, MAX_MEDIA, leerMedia),
        winnerAnimationIn: anim(l.winnerAnimationIn, 'bounce'),
        winnerAnimationOut: anim(l.winnerAnimationOut, 'fade'),
    };
}

/** Lo comun a un texto y a una imagen; `null` si la caja no se puede leer. */
function leerBase(v: unknown, i: number): LayoutPieceBase | null {
    if (!v || typeof v !== 'object') return null;
    const b = v as Record<string, unknown>;
    const n = (x: unknown, def: number) => (typeof x === 'number' && Number.isFinite(x) ? x : def);

    const anim = (x: unknown): LayoutAnimation =>
        LAYOUT_ANIMATIONS.includes(x as LayoutAnimation) ? x as LayoutAnimation : 'none';

    return {
        id: typeof b.id === 'string' && b.id ? b.id : `p${i}`,
        ...clampBox({ x: n(b.x, 0), y: n(b.y, 0), width: n(b.width, 320), height: n(b.height, 90) }),
        when: PIECE_WHENS.includes(b.when as PieceWhen) ? b.when as PieceWhen : 'always',
        zIndex: Math.round(n(b.zIndex, 0)),
        animationIn: anim(b.animationIn),
        animationOut: anim(b.animationOut),
    };
}

function leerTexto(v: unknown, i: number): LayoutText | null {
    const base = leerBase(v, i);
    if (!base) return null;
    const b = v as Record<string, unknown>;
    const n = (x: unknown, def: number, min: number, max: number) =>
        typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : def;

    return {
        ...base,
        kind: 'text',
        template: typeof b.template === 'string' ? b.template : '',
        fontSize: n(b.fontSize, 48, 8, 400),
        color: typeof b.color === 'string' && b.color ? b.color : '#F5F0E6',
        align: b.align === 'left' || b.align === 'right' ? b.align : 'center',
        weight: Math.round(n(b.weight, 800, 100, 900)),
        uppercase: b.uppercase === true,
        outline: n(b.outline, 0, 0, 16),
        outlineColor: typeof b.outlineColor === 'string' && b.outlineColor ? b.outlineColor : '#12101B',
        background: typeof b.background === 'string' && b.background ? b.background : 'transparent',
        radius: n(b.radius, 0, 0, 200),
        padding: n(b.padding, 0, 0, 200),
    };
}

function leerMedia(v: unknown, i: number): LayoutMedia | null {
    const base = leerBase(v, i);
    if (!base) return null;
    const b = v as Record<string, unknown>;
    // Una pieza sin URL SI se conserva: es la que el editor acaba de crear y que el
    // streamer va a rellenar en el inspector. Descartarla aqui hacia que el boton
    // "Anadir imagen o video" no hiciera absolutamente nada — la pieza nacia y el
    // primer re-render se la llevaba. Quien no la dibuja es el overlay, que es donde
    // una caja invisible si seria un problema.
    const url = typeof b.url === 'string' ? b.url.trim() : '';

    const n = (x: unknown, def: number, min: number, max: number) =>
        typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : def;

    return {
        ...base,
        kind: 'media',
        url,
        fit: b.fit === 'contain' || b.fit === 'fill' ? b.fit : 'cover',
        opacity: n(b.opacity, 100, 0, 100),
        radius: n(b.radius, 0, 0, 400),
        loop: b.loop !== false,
        videoAudio: b.videoAudio === true,
        videoVolume: n(b.videoVolume, 80, 0, 100),
    };
}

/** Lee una lista de piezas, descartando las rotas y recortando al tope. */
function leerPiezas<T>(raw: unknown, tope: number, leer: (v: unknown, i: number) => T | null): T[] {
    if (!Array.isArray(raw)) return [];
    const out: T[] = [];
    for (let i = 0; i < raw.length && out.length < tope; i++) {
        const p = leer(raw[i], i);
        if (p) out.push(p);
    }
    return out;
}

/**
 * El puntero guardado, completado con el de fabrica.
 *
 * La base es `DEFAULT_VISUAL.pointer` y NO `DEFAULT_POINTER`: el segundo es el
 * puntero neutro del que parten las plantillas, y usarlo aqui dejaba el default de
 * fabrica sin efecto — un campo ausente volvia siempre al puntero antiguo por mucho
 * que el default dijera otra cosa. Lo mismo pasaba con el color, clavado a `null`.
 */
function leerPointer(raw: unknown): WheelPointer {
    const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const d = DEFAULT_VISUAL.pointer;
    const n = (x: unknown, def: number, min: number, max: number) =>
        typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : def;
    const b = (x: unknown, def: boolean) => typeof x === 'boolean' ? x : def;

    return {
        hidden: b(p.hidden, d.hidden),
        size: n(p.size, d.size, 0.4, 3),
        color: typeof p.color === 'string' && p.color.trim() !== '' ? p.color : d.color,
        shape: NEEDLE_SHAPES.includes(p.shape as NeedleShape) ? p.shape as NeedleShape : d.shape,
        side: NEEDLE_SIDES.includes(p.side as NeedleSide) ? p.side as NeedleSide : d.side,
        thickness: n(p.thickness, d.thickness, 1, 14),
        caps: b(p.caps, d.caps),
    };
}

const numero = (v: unknown, def: number, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;

const texto = (v: unknown, def: string) =>
    typeof v === 'string' && v.trim() !== '' ? v : def;

/**
 * Completa lo que venga de la base con los defaults de Decatron.
 *
 * Es deliberadamente tolerante: `visual_config` lo edita el streamer y lo guarda
 * como jsonb libre, así que una clave que falta, que sobra o que vino con otro
 * tipo no puede dejar el overlay en negro en mitad de un directo.
 */
export function resolveVisual(raw: unknown): WheelVisual {
    const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const s = (v.sounds && typeof v.sounds === 'object' ? v.sounds : {}) as Record<string, unknown>;

    const paleta = Array.isArray(v.palette) && v.palette.length > 0
        ? v.palette.filter((c): c is string => typeof c === 'string')
        : DEFAULT_VISUAL.palette;

    const fuente: FontKey = typeof v.font === 'string' && v.font in FONTS
        ? v.font as FontKey
        : DEFAULT_VISUAL.font;

    const sonidos = { master: numero(s.master, DEFAULT_VISUAL.sounds.master, 0, 1) } as WheelVisual['sounds'];

    for (const k of SOUND_KEYS) {
        const cfg = (s[k] && typeof s[k] === 'object' ? s[k] : {}) as Record<string, unknown>;
        const base = DEFAULT_VISUAL.sounds[k];

        let mode: SoundMode = cfg.mode === 'mute' || cfg.mode === 'custom' ? cfg.mode : 'default';

        // Un tick "propio" guardado por una versión vieja, o a mano por la API, se
        // trata como el de Decatron en vez de reproducir algo que va a sonar mal.
        if (k === 'spin_tick' && mode === 'custom') mode = 'default';

        sonidos[k] = {
            mode,
            url: typeof cfg.url === 'string' ? cfg.url : null,
            volume: numero(cfg.volume, base.volume ?? 1, 0, 1),
        };
    }

    return {
        palette: paleta.length > 0 ? paleta : DEFAULT_VISUAL.palette,
        ink: texto(v.ink, DEFAULT_VISUAL.ink),
        accent: texto(v.accent, DEFAULT_VISUAL.accent),
        bone: texto(v.bone, DEFAULT_VISUAL.bone),
        background: texto(v.background, DEFAULT_VISUAL.background),
        centerImage: typeof v.centerImage === 'string' && v.centerImage.trim() !== '' ? v.centerImage : null,
        centerImageSize: numero(v.centerImageSize, DEFAULT_VISUAL.centerImageSize, 20, 140),

        presentation: PRESENTATION_KEYS.includes(v.presentation as PresentationKey)
            ? v.presentation as PresentationKey
            : DEFAULT_VISUAL.presentation,

        font: fuente,
        fontWeight: nearestWeight(fuente, Math.round(numero(v.fontWeight, DEFAULT_VISUAL.fontWeight, 100, 900))),
        textScale: numero(v.textScale, DEFAULT_VISUAL.textScale, 0.5, 2),
        textColor: typeof v.textColor === 'string' && v.textColor.trim() !== '' ? v.textColor : null,
        textOutline: numero(v.textOutline, DEFAULT_VISUAL.textOutline, 0, 6),
        textOutlineColor: typeof v.textOutlineColor === 'string' && v.textOutlineColor.trim() !== '' ? v.textOutlineColor : null,
        textUppercase: typeof v.textUppercase === 'boolean' ? v.textUppercase : DEFAULT_VISUAL.textUppercase,

        visibility: v.visibility === 'spin' || v.visibility === 'always' ? v.visibility : DEFAULT_VISUAL.visibility,
        visibilityAnimation: LAYOUT_ANIMATIONS.includes(v.visibilityAnimation as LayoutAnimation)
            ? v.visibilityAnimation as LayoutAnimation
            : DEFAULT_VISUAL.visibilityAnimation,

        spinSeconds: numero(v.spinSeconds, DEFAULT_VISUAL.spinSeconds, 1, 20),
        revealSeconds: numero(v.revealSeconds, DEFAULT_VISUAL.revealSeconds, 1, 30),
        turns: Math.round(numero(v.turns, DEFAULT_VISUAL.turns, 1, 12)),
        easing: v.easing === 'cubic' || v.easing === 'expo' ? v.easing : DEFAULT_VISUAL.easing,
        celebration: v.celebration === 'flash' || v.celebration === 'none' ? v.celebration : DEFAULT_VISUAL.celebration,

        showWatermark: v.showWatermark === false ? false : true,
        pointer: leerPointer(v.pointer),
        layout: 'layout' in v ? leerLayout(v.layout) : DEFAULT_VISUAL.layout,
        sounds: sonidos,
    };
}

/** La URL que hay que reproducir para un evento, o null si va silenciado. */
export function soundUrl(visual: WheelVisual, key: SoundKey): string | null {
    const cfg = visual.sounds[key];
    if (cfg.mode === 'mute') return null;
    if (cfg.mode === 'custom' && cfg.url) return cfg.url;
    return DEFAULT_SOUND_FILES[key];
}

export const EASINGS: Record<Easing, (t: number) => number> = {
    // Rueda física: rápida al principio, se arrastra al final.
    quint: t => 1 - Math.pow(1 - t, 5),
    cubic: t => 1 - Math.pow(1 - t, 3),
    expo: t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
};
