import type { ReactNode } from 'react';

// Marco común de TODA la documentación (pública y con cuenta): fondo, texto y ambiente (cuadrícula azul tenue +
// resplandor) salen de las variables del sistema de diseño (--ds-*). No hay reglas atadas a un layout: si el
// marco es este, el aspecto es el mismo. `fixed` deja el ambiente fijo a la ventana (página completa);
// El ambiente va al final para no alterar los `space-y-*` del contenido.
// `bleed` extiende el fondo hasta el borde del panel del dashboard (compensa su padding).
export default function DocsFrame({ children, fixed, bleed, className = '' }: { children: ReactNode; fixed?: boolean; bleed?: boolean; className?: string }) {
    const bleedCls = bleed
        ? '-m-4 sm:-m-6 xl:-m-8 p-4 sm:p-6 xl:p-8 min-h-[calc(100%+2rem)] sm:min-h-[calc(100%+3rem)] xl:min-h-[calc(100%+4rem)]'
        : '';
    return (
        <div className={`relative isolate bg-ds-bg text-ds-text ${bleedCls} ${className}`}>
            {children}
            <div aria-hidden="true" className={`-z-10 hidden dark:block ds-ambient ${fixed ? 'ds-ambient--fixed' : ''}`} />
        </div>
    );
}
