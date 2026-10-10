

export const CARD = 'bg-ds-surface rounded-lg border border-ds-border';

/// Alto maximo del preview de la columna derecha. Se aplica como tope del ANCHO
/// (`alto x proporcion`) para que la forma la siga decidiendo la presentacion.
export const ALTO_PREVIEW = 340;
export const FIELD = 'px-3 py-2 bg-ds-bg border border-ds-border rounded-lg text-ds-text text-sm focus:outline-none focus:border-ds-accent';

export function Row({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
    return (
        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-ds-border last:border-0">
            <div className="min-w-0">
                <p className="text-sm font-medium text-ds-text">{label}</p>
                {help && <p className="text-xs text-ds-soft mt-0.5 max-w-md">{help}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">{children}</div>
        </div>
    );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
    // La bolita necesita `left-0.5` explicito: sin el arrancaba donde el navegador
    // decidiera (con el padding por defecto del <button> encima) y al desplazarse se
    // salia de la pildora. Por lo mismo el boton lleva p-0 y shrink-0.
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => onChange(!on)}
            className={`relative w-11 h-6 p-0 shrink-0 rounded-full transition-colors ${on ? 'bg-ds-accent' : 'bg-ds-raised'}`}
        >
            <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-ds-surface shadow transition-transform ${
                    on ? 'translate-x-5' : 'translate-x-0'
                }`}
            />
        </button>
    );
}
