import { useEffect, type CSSProperties, type ReactNode, type Ref, type VideoHTMLAttributes } from 'react';
import type { AlertContent, AlertDesign, Rect } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/defaults';
import { LINE_HEIGHT, replaceVariables } from '../model';

interface Props {
    design: AlertDesign;
    content: AlertContent;
    /** Ancho en pantalla / 1920: el tamaño de letra se escala con el ancho, como siempre lo hizo el overlay. */
    scale: number;
    /** Solo el overlay: el video real con sus eventos para medir la duración. */
    videoRef?: Ref<HTMLVideoElement>;
    videoProps?: VideoHTMLAttributes<HTMLVideoElement>;
    /** Vista previa y editor: el video en silencio y en bucle. */
    previewMedia?: boolean;
    /** Lo que se dibuja encima (por ejemplo, el audio oculto del overlay). */
    children?: ReactNode;
}

/** Posición en porcentaje del lienzo de 1920×1080: el overlay ocupa toda la fuente de OBS, sea del tamaño que sea. */
export function boxStyle(r: Rect): CSSProperties {
    return {
        position: 'absolute',
        left: `${(r.x / CANVAS_WIDTH) * 100}%`,
        top: `${(r.y / CANVAS_HEIGHT) * 100}%`,
        width: `${(r.width / CANVAS_WIDTH) * 100}%`,
        height: `${(r.height / CANVAS_HEIGHT) * 100}%`,
    };
}

export function textShadowCss(shadow: string): string {
    switch (shadow) {
        case 'normal': return '2px 2px 4px rgba(0,0,0,0.5)';
        case 'strong': return '3px 3px 6px rgba(0,0,0,0.8)';
        case 'glow': return '0 0 10px rgba(255,255,255,0.8)';
        default: return 'none';
    }
}

export function backgroundCss(s: AlertDesign['styles']): CSSProperties | null {
    if (s.backgroundType === 'solid') return { background: s.solidColor, opacity: s.backgroundOpacity / 100 };
    if (s.backgroundType === 'gradient') {
        return { background: `linear-gradient(${s.gradientAngle}deg, ${s.gradientColor1}, ${s.gradientColor2})`, opacity: s.backgroundOpacity / 100 };
    }
    return null;
}

/**
 * Qué se ve en la caja de la imagen para un audio: la imagen si hay y no está apagada;
 * el icono por defecto solo si el aviso pide la imagen de forma explícita.
 */
export function audioVisual(content: AlertContent): 'image' | 'icon' | null {
    if (content.imageUrl) return content.showImage !== false ? 'image' : null;
    return content.showImage === true ? 'icon' : null;
}

/** Carga la fuente elegida desde Google Fonts (antes solo se veía si estaba instalada en la PC). */
function useAlertFont(family: string) {
    useEffect(() => {
        if (!family || family === 'Arial') return;
        const id = 'sa-font';
        let link = document.getElementById(id) as HTMLLinkElement | null;
        if (!link) {
            link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;600;700&display=swap`;
    }, [family]);
}

/** La alerta dibujada: el mismo componente en OBS, en la vista previa y en el editor. */
export default function SoundAlertRenderer({ design, content, scale, videoRef, videoProps, previewMedia, children }: Props) {
    const { styles, layout, textOutline } = design;
    useAlertFont(styles.fontFamily);
    const media = boxStyle(layout.media);
    const bg = backgroundCss(styles);
    const outline: CSSProperties = textOutline.enabled
        ? { WebkitTextStroke: `${textOutline.width}px ${textOutline.color}`, paintOrder: 'stroke fill' }
        : {};
    const visual = content.fileType === 'sound' ? audioVisual(content) : null;

    return (
        <div style={{ position: 'absolute', inset: 0, fontFamily: styles.fontFamily }}>
            {bg && <div style={{ ...boxStyle(layout.panel), ...bg }} />}

            {content.fileUrl && content.fileType === 'image' && (
                <img src={content.fileUrl} alt="" style={{ ...media, objectFit: 'scale-down' }} />
            )}

            {content.fileUrl && content.fileType === 'video' && (
                <video
                    ref={videoRef}
                    key={content.fileUrl}
                    src={content.fileUrl}
                    autoPlay
                    playsInline
                    {...(previewMedia ? { muted: true, loop: true } : {})}
                    {...videoProps}
                    style={{ ...media, objectFit: 'scale-down' }}
                />
            )}

            {visual === 'image' && <img src={content.imageUrl!} alt="" style={{ ...media, objectFit: 'scale-down' }} />}
            {visual === 'icon' && (
                <div
                    style={{
                        ...media,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: `${120 * scale}px`,
                    }}
                >
                    🎵
                </div>
            )}

            {design.textLines.filter(l => l.enabled).map((line, i) => (
                <div
                    key={i}
                    style={{
                        ...boxStyle(line),
                        textAlign: line.align,
                        fontSize: `${line.fontSize * scale}px`,
                        fontWeight: line.fontWeight as CSSProperties['fontWeight'],
                        lineHeight: LINE_HEIGHT,
                        color: styles.textColor,
                        textShadow: textShadowCss(styles.textShadow),
                        fontFamily: styles.fontFamily,
                        ...outline,
                    }}
                >
                    {replaceVariables(line.text, content)}
                </div>
            ))}

            {children}
        </div>
    );
}
