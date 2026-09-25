import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useBrand } from './BrandContext';
import { FONT_STACKS } from './builtins';
import { SLOT_BY_KEY, pickVariant } from './slots';
import type { BrandElement, BrandLayout, BrandSlotConfig, BrandTheme, ResolvedImage } from './types';
import { normalizeConfig } from './layout';

function useViewportWidth(): number {
    const [w, setW] = useState(() => (typeof window === 'undefined' ? 1920 : window.innerWidth));
    useEffect(() => {
        const on = () => setW(window.innerWidth);
        window.addEventListener('resize', on);
        return () => window.removeEventListener('resize', on);
    }, []);
    return w;
}

interface LayoutViewProps {
    layout: BrandLayout;
    resolve: (ref: string | null | undefined) => ResolvedImage | null;
    /** Fija el tema; sin él se usan las clases dark: de Tailwind (sigue al tema del usuario). */
    theme?: BrandTheme;
    alt?: string;
    className?: string;
    style?: CSSProperties;
}

function ElementView({ el, z, resolve, theme, alt }: { el: BrandElement; z: number; resolve: LayoutViewProps['resolve']; theme?: BrandTheme; alt: string }) {
    const box: CSSProperties = { position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h, zIndex: z, pointerEvents: 'none' };

    if (el.type === 'image') {
        const light = resolve(el.ref);
        if (!light) return null;
        const dark = el.refDark ? resolve(el.refDark) : null;
        const style: CSSProperties = { ...box, objectFit: el.keepAspect ? 'contain' : 'fill', maxWidth: 'none', userSelect: 'none' };
        if (theme) return <img src={(theme === 'dark' ? (dark ?? light) : light).url} alt={alt} draggable={false} style={style} />;
        if (!dark) return <img src={light.url} alt={alt} draggable={false} style={style} />;
        return <>
            <img src={light.url} alt={alt} draggable={false} style={style} className="dark:hidden" />
            <img src={dark.url} alt={alt} draggable={false} style={style} className="hidden dark:block" />
        </>;
    }

    if (!el.text) return null;
    const justify = el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start';
    const style: CSSProperties & Record<string, string | number> = {
        ...box, display: 'flex', alignItems: 'center', justifyContent: justify,
        fontFamily: FONT_STACKS[el.font] ?? FONT_STACKS.sans,
        fontWeight: el.weight, fontSize: el.size, lineHeight: 1.2,
        letterSpacing: el.letterSpacing, fontStyle: el.italic ? 'italic' : 'normal',
        textTransform: el.uppercase ? 'uppercase' : 'none', whiteSpace: 'nowrap',
    };
    if (theme) style.color = theme === 'dark' ? el.colorDark : el.color;
    else { style['--bm-c'] = el.color; style['--bm-cd'] = el.colorDark; }
    return <span style={style} className={theme ? undefined : 'text-[color:var(--bm-c)] dark:text-[color:var(--bm-cd)]'}>{el.text}</span>;
}

/** Dibuja una caja de marca. La usan las vistas y el lienzo del editor, así se ven idénticas. */
export function BrandLayoutView({ layout, resolve, theme, alt = 'Decatron', className, style }: LayoutViewProps) {
    return (
        <div className={className} style={{ position: 'relative', width: layout.width, height: layout.height, flexShrink: 0, ...style }}>
            {layout.elements.map((el, i) => el.visible && <ElementView key={el.id} el={el} z={i + 1} resolve={resolve} theme={theme} alt={alt} />)}
        </div>
    );
}

interface BrandMarkProps {
    slot: string;
    /** Lo que se ve hoy en el código; se usa mientras el lugar no tenga config. */
    fallback: ReactNode;
    /** Para lugares por formato (p. ej. games-promo: 'bar' | 'card'). */
    variant?: string;
    theme?: BrandTheme;
    className?: string;
    style?: CSSProperties;
    /** Config sin guardar (vista previa del editor). */
    configOverride?: BrandSlotConfig;
}

/** Logo de Decatron en un lugar, según lo que diga /admin/brand. */
export function BrandMark({ slot, fallback, variant, theme, className, style, configOverride }: BrandMarkProps) {
    const { data, ready, resolve } = useBrand();
    const width = useViewportWidth();
    const def = SLOT_BY_KEY[slot];
    const config = normalizeConfig(configOverride ?? data?.slots?.[slot]);

    // Sin copia local y sin respuesta todavía: se reserva el lugar sin mostrar el logo
    // viejo, para que no parpadee de uno a otro.
    if (!ready) return <div style={{ visibility: 'hidden' }}>{fallback}</div>;
    if (!def || !config?.layouts) return <>{fallback}</>;

    const key = variant ?? pickVariant(def, config, width);
    const layout = key ? config.layouts[key] : undefined;
    if (!layout) return <>{fallback}</>;
    if (!layout.visible) return null;
    // Si la imagen elegida ya no existe (se borró de la biblioteca) se vuelve al diseño de código.
    if (layout.elements.some(e => e.visible && e.type === 'image' && !resolve(e.ref))) return <>{fallback}</>;

    const forced = theme ?? (def.themes.length === 1 && def.themes[0] === 'dark' ? 'dark' : undefined);
    return <BrandLayoutView layout={layout} resolve={resolve} theme={forced} className={className} style={style} />;
}
