/**
 * La celebracion del ganador: confeti o destello.
 *
 * Vive aparte del overlay porque el panel tambien la dibuja — el selector de la
 * pestana Aspecto tiene un boton para verla sobre el preview. Si cada uno tuviera
 * su propia version volveriamos al problema que resolvio `WheelFace`: elegir algo
 * en el panel y que en OBS saliera otra cosa.
 *
 * Se pinta en un `<canvas>` y no con nodos del DOM: son mas de cien piezas
 * moviendose a la vez y el overlay corre dentro de OBS, compartiendo GPU con el
 * juego del streamer. Animar cien divs le cuesta fps al directo.
 *
 * Se posiciona `absolute`, asi que quien lo use tiene que ser un contenedor
 * posicionado. No captura clics.
 */
import { useEffect, useRef } from 'react';
import type { WheelVisual } from './visualConfig';

interface Pieza {
    x: number; y: number;
    vx: number; vy: number;
    /** Fase del giro sobre su propio eje: es lo que hace que la pieza aletee. */
    giro: number;
    vgiro: number;
    ancho: number;
    alto: number;
    color: string;
}

const GRAVEDAD = 0.30;
const ROCE = 0.994;
const PIEZAS = 150;

export default function WheelCelebration({ visual, nonce, seconds }: {
    visual: WheelVisual;
    /**
     * Cada valor nuevo dispara una celebracion. Es un contador y no un booleano
     * para que dos giros seguidos se celebren dos veces: con un booleano el
     * segundo no cambiaria de valor y no volveria a disparar.
     */
    nonce: number;
    /** Cuanto dura como mucho. Por defecto sigue al tiempo de revelado. */
    seconds?: number;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const flashRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (nonce <= 0 || visual.celebration === 'none') return;

        // --- destello ---
        if (visual.celebration === 'flash') {
            const el = flashRef.current;
            if (!el) return;
            // Reiniciar la animacion a mano: volver a poner la misma clase no la
            // vuelve a correr si el nodo nunca dejo de tenerla.
            el.style.animation = 'none';
            void el.offsetWidth;
            el.style.animation = '';
            el.classList.remove('is-on');
            void el.offsetWidth;
            el.classList.add('is-on');
            const t = window.setTimeout(() => el.classList.remove('is-on'), 900);
            return () => window.clearTimeout(t);
        }

        // --- confeti ---
        const canvas = canvasRef.current;
        const parent = canvas?.parentElement;
        if (!canvas || !parent) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const W = parent.clientWidth;
        const H = parent.clientHeight;
        if (W === 0 || H === 0) return;

        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(dpr, dpr);

        // Todo se escala con la altura del contenedor. Sin esto el mismo confeti
        // que se ve bien a pantalla completa en OBS sale disparado fuera del
        // preview de 280px del panel, que mide la mitad de alto.
        const k = H / 620;

        const colores = [...visual.palette, visual.accent, visual.bone].filter(Boolean);
        const piezas: Pieza[] = [];

        // Dos canones desde las esquinas de abajo, apuntando hacia adentro. Es la
        // forma que deja las piezas cruzando por delante de la rueda en vez de
        // taparla desde arriba.
        //
        // Las velocidades estan calzadas contra la gravedad para que la cima del
        // arco caiga DENTRO del cuadro: con `v` vertical, la altura maxima es
        // v² / 2g, asi que 14–22 contra una gravedad de 0.30 sube entre la mitad
        // y el borde de alto de referencia. La primera version disparaba al doble
        // y las piezas se iban por arriba de la pantalla antes de que nadie las
        // viera — algo que compilaba perfecto y que solo aparecio en la captura.
        for (let i = 0; i < PIEZAS; i++) {
            const izquierda = i % 2 === 0;
            piezas.push({
                x: izquierda ? -10 : W + 10,
                y: H + 10,
                vx: (izquierda ? 1 : -1) * (5 + Math.random() * 7) * k,
                vy: -(14 + Math.random() * 8) * k,
                giro: Math.random() * Math.PI * 2,
                vgiro: (Math.random() - 0.5) * 0.34,
                ancho: (6 + Math.random() * 6) * k,
                alto: (9 + Math.random() * 8) * k,
                color: colores[Math.floor(Math.random() * colores.length)],
            });
        }

        const duracion = Math.min(seconds ?? visual.revealSeconds, 6) * 1000;
        const inicio = performance.now();
        let raf = 0;

        const frame = (ahora: number) => {
            const t = ahora - inicio;
            ctx.clearRect(0, 0, W, H);

            // Se desvanece en el ultimo tercio en vez de cortarse de golpe cuando
            // vence el tiempo: la tarjeta del ganador sigue en pantalla y un corte
            // seco al lado se nota como un fallo.
            const alpha = t > duracion * 0.66
                ? Math.max(0, 1 - (t - duracion * 0.66) / (duracion * 0.34))
                : 1;

            let vivas = 0;
            for (const p of piezas) {
                p.vy += GRAVEDAD * k;
                p.vx *= ROCE;
                p.vy *= ROCE;
                p.x += p.vx;
                p.y += p.vy;
                p.giro += p.vgiro;

                if (p.y > H + 40) continue;
                vivas++;

                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.giro);
                // Aplastar el ancho segun el giro simula la pieza de papel girando
                // sobre si misma. Es lo que separa el confeti de una lluvia de
                // cuadraditos rigidos.
                ctx.scale(Math.cos(p.giro * 1.7), 1);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto);
                ctx.restore();
            }

            if (vivas > 0 && t < duracion) {
                raf = requestAnimationFrame(frame);
            } else {
                ctx.clearRect(0, 0, W, H);
            }
        };

        raf = requestAnimationFrame(frame);
        return () => {
            cancelAnimationFrame(raf);
            ctx.clearRect(0, 0, W, H);
        };
    }, [nonce, visual, seconds]);

    if (visual.celebration === 'none') return null;

    return (
        <div className="wheel-celebration" aria-hidden="true">
            <style>{CSS}</style>
            {visual.celebration === 'flash'
                ? <div
                    ref={flashRef}
                    className="wheel-flash"
                    // Un foco que se apaga hacia los bordes y no un rectangulo de
                    // pantalla completa: el overlay va sobre fondo transparente en
                    // OBS, asi que un rectangulo plano teniria la escena entera del
                    // streamer con un borde recto marcado. El centro sigue al de la
                    // rueda, que esta un poco por encima del medio.
                    style={{ background: `radial-gradient(circle at 50% 44%, ${visual.accent} 0%, transparent 62%)` }}
                  />
                : <canvas ref={canvasRef} className="wheel-confetti" />}
        </div>
    );
}

const CSS = `
.wheel-celebration { position: absolute; inset: 0; pointer-events: none; z-index: 5; overflow: hidden; }
.wheel-confetti { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.wheel-flash { position: absolute; inset: 0; opacity: 0; mix-blend-mode: screen; }
.wheel-flash.is-on { animation: wheel-flash-in 820ms ease-out both; }

@keyframes wheel-flash-in {
    0%   { opacity: 0; }
    12%  { opacity: .72; }
    30%  { opacity: .18; }
    46%  { opacity: .62; }
    100% { opacity: 0; }
}
`;
