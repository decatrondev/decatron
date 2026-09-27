// Motor del overlay de Event Alerts: diseño por elementos (tarjeta, media y textos) que dibuja
// EventAlertRenderer en OBS, en la vista previa y en el editor (fase 0 del rediseño).

export type AlertEventType = 'follow' | 'bits' | 'subs' | 'giftSubs' | 'raids' | 'resubs' | 'hypeTrain';

/** Estilo viejo (global.defaultStyle y el `style` parcial de cada evento, nivel o variante). */
export interface LegacyAlertStyle {
    width: number;
    height: number;
    backgroundType: 'color' | 'gradient' | 'image' | 'transparent';
    backgroundColor: string;
    backgroundGradient: { color1: string; color2: string; angle: number };
    backgroundImage: string;
    opacity: number;
    borderEnabled: boolean;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    padding: number;
    mediaLayout: 'top' | 'bottom' | 'left' | 'right' | 'background' | 'hidden';
    mediaObjectFit: 'cover' | 'contain';
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    textColor: string;
    textShadow: TextShadow;
    textAlign: 'left' | 'center' | 'right';
}

export interface LegacyElementBox { x: number; y: number; width: number; height: number; enabled: boolean }

/** Posiciones viejas (global.overlayElements): una sola para todos los eventos. */
export interface LegacyOverlayElements {
    card: LegacyElementBox;
    media: LegacyElementBox;
    text: LegacyElementBox;
}

/** Lo que llega con cada alerta (SignalR ShowEventAlert). Solo la parte que se dibuja: el audio lo maneja el overlay. */
export interface EventAlertData {
    eventType: AlertEventType;
    username: string;
    amount?: number;
    tier?: string;
    months?: number;
    viewers?: number;
    level?: number;
    /** Mensaje de la alerta con las variables ya reemplazadas por el backend. */
    message?: string;
    mediaType?: 'image' | 'video' | 'gif';
    mediaUrl?: string;
    duration?: number;
    /** fadeIn / slideIn / bounceIn / zoomIn (y sus Out). */
    animationIn?: string;
    animationOut?: string;
    /** shake, glow, float, pulse, confetti: solo cuenta el primero, como en el overlay viejo. */
    effects?: string[];
    /** global.defaultStyle combinado con el `style` del evento, nivel o variante. */
    style?: Partial<LegacyAlertStyle>;
    overlayElements?: LegacyOverlayElements;
}

export type TextShadow = 'none' | 'normal' | 'strong' | 'glow';
export type Direction = 'left' | 'right' | 'top' | 'bottom';
export type Easing = 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';

/** 'event' = la animación configurada en el evento (la que llega en la alerta); 'bounce' es el rebote por escala del viejo. */
export type AnimationType = 'event' | 'none' | 'fade' | 'slide' | 'bounce' | 'zoom';

export interface AnimationStep {
    type: AnimationType;
    /** Solo para slide: de dónde entra o hacia dónde sale. */
    direction: Direction;
    durationMs: number;
    easing: Easing;
    delayMs: number;
}

export interface ElementAnimation {
    enter: AnimationStep;
    exit: AnimationStep;
}

export interface Rect { x: number; y: number; width: number; height: number }

export interface CardBackground {
    type: 'color' | 'gradient' | 'image' | 'transparent';
    color: string;
    gradient: { color1: string; color2: string; angle: number };
    /** URL; si está vacía se usa el color (como el viejo). */
    image: string;
}

export interface CardElement extends Rect {
    enabled: boolean;
    background: CardBackground;
    /** 0-100, de toda la tarjeta (fondo y borde). */
    opacity: number;
    border: { enabled: boolean; color: string; width: number };
    radius: number;
    /** Sombra CSS ('' = sin sombra). */
    shadow: string;
    animation: ElementAnimation;
}

export interface MediaElement extends Rect {
    enabled: boolean;
    fit: 'cover' | 'contain' | 'fill';
    /** 0-100. */
    opacity: number;
    radius: number;
    animation: ElementAnimation;
}

export interface TextLine {
    /** Con variables: {username}, {amount}, {tier}, {months}, {viewers}, {level}, {message}, {emoji}, {title}. */
    template: string;
    fontSize: number;
    /** Sin valor hereda el grosor de la página (así se veía el mensaje en el viejo). */
    fontWeight?: string;
    lineHeight: number;
    /** 0-100. */
    opacity: number;
    /** Espacio sobre la línea en px. */
    marginTop: number;
    /** Variable que tiene que tener valor para que la línea se muestre (ej. 'message'). */
    requires?: string;
}

/** Caja de texto: sus líneas se apilan y se centran a lo alto dentro de la caja. */
export interface TextElement extends Rect {
    id: string;
    enabled: boolean;
    lines: TextLine[];
    fontFamily: string;
    color: string;
    align: 'left' | 'center' | 'right';
    verticalAlign: 'top' | 'center' | 'bottom';
    shadow: TextShadow;
    /** Fondo CSS de la caja ('transparent' = sin fondo). */
    background: string;
    padding: number;
    radius: number;
    animation: ElementAnimation;
}

export interface AlertDesign {
    canvas: { width: number; height: number };
    card: CardElement;
    media: MediaElement;
    /** En orden de dibujo: los últimos quedan encima. */
    texts: TextElement[];
    /** Animación de la alerta entera (encima de la de cada elemento). */
    animation: ElementAnimation;
    /**
     * Configs viejas: el estilo y las posiciones que llegan con cada alerta (global.defaultStyle + el `style` del
     * evento, nivel o variante, y global.overlayElements) mandan sobre este diseño, como hacía el overlay viejo.
     */
    followAlertStyle: boolean;
}

export type HypeTrainLevelKey = '1' | '2' | '3' | '4' | '5' | 'completed';

export interface HypeTrainDesign extends AlertDesign {
    /** Diseño propio por nivel; el que falte usa el del hype train. */
    levels?: Partial<Record<HypeTrainLevelKey, AlertDesign>>;
}

export interface EventAlertsDesign {
    version: 2;
    general: AlertDesign;
    /** Diseño propio por evento; el que falte usa el general. */
    events: {
        follow?: AlertDesign;
        bits?: AlertDesign;
        subs?: AlertDesign;
        giftSubs?: AlertDesign;
        raids?: AlertDesign;
        resubs?: AlertDesign;
        hypeTrain?: HypeTrainDesign;
    };
}
