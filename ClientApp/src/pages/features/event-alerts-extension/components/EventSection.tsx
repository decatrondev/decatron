import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

// Tarjeta plegable de la pestaña Eventos (rediseño, fase 4): el mismo estilo que el resto de la vista y cerrada
// por defecto, así un evento no es una pared de tarjetas. Lo de adentro es lo de siempre.

interface Props {
    title: ReactNode;
    description?: ReactNode;
    /** Abierta al entrar (la primera de cada evento, por ejemplo). */
    defaultOpen?: boolean;
    children: ReactNode;
}

export function EventSection({ title, description, defaultOpen = false, children }: Props) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 3xl:px-6 3xl:py-5 text-left"
            >
                <span className="min-w-0">
                    <span className="block text-base 3xl:text-lg font-bold text-ds-text">{title}</span>
                    {description && <span className="block text-sm 3xl:text-base text-ds-soft mt-0.5">{description}</span>}
                </span>
                <ChevronDown className={`w-5 h-5 shrink-0 text-ds-soft transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="px-5 pb-5 3xl:px-6 3xl:pb-6">{children}</div>}
        </div>
    );
}
