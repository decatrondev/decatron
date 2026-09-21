import React from 'react';

// Compartido entre TournamentConfig.tsx y BlueShellPanel.tsx — evita duplicar el tipo
// de edicion y el selector de edicion en cada panel nuevo que se agregue.

export interface TournamentEdition {
    id: number;
    name: string;
    slug: string;
    mode: string;
    bracketFormat: string | null;
    region: string;
    status: string;
    startsAt: string | null;
    endsAt: string | null;
    // Nombre propio de este canal para la ficha de castigo y el factor de suerte de
    // LP — nunca se usa el nombre de un producto de terceros como default, cada
    // organizador pone el suyo.
    shellItemName: string;
    aegisMechanicName: string;
}

export function EditionPicker({ editions, onSelectEdition }: { editions: TournamentEdition[]; onSelectEdition: (id: number) => void }) {
    return (
        <div className="space-y-3">
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Elegi una edicion:</p>
            {editions.length === 0 ? (
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Primero cread una edicion en la pestana "Ediciones".</p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {editions.map((ed) => (
                        <button
                            key={ed.id}
                            onClick={() => onSelectEdition(ed.id)}
                            className="px-3 py-1.5 rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-sm font-bold text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]"
                        >
                            {ed.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
