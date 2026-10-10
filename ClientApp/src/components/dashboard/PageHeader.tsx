import type { ReactNode } from 'react';

/** Cabecera de página del panel: título, subtítulo y acciones a la derecha. Una sola, para que todas se vean igual. */
export default function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
                <h1 className="text-3xl font-black text-ds-text">{title}</h1>
                {subtitle && <p className="text-ds-soft mt-2">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
    );
}
