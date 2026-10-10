/**
 * Buscador de canales con autocompletado para las pantallas de administración.
 *
 * Existe porque escribir el login exacto de memoria falla: un guion bajo de más y el
 * tier o los créditos se le asignan a nadie, sin error visible. Aquí se elige de una
 * lista real, así que o aciertas o no hay a quién aplicar nada.
 */

import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import api from '../../services/api';

export interface AdminUser {
    id: number;
    login: string;
    displayName?: string;
    profileImageUrl?: string;
}

export function UserSearchInput({
    value,
    onSelect,
    onClear,
    placeholder = 'Escribe al menos 2 letras del canal',
    inputClassName,
}: {
    /** Canal ya elegido, si lo hay. Con uno elegido se enseña en vez del buscador. */
    value: AdminUser | null;
    onSelect: (user: AdminUser) => void;
    onClear: () => void;
    placeholder?: string;
    inputClassName?: string;
}) {
    const [query, setQuery] = useState('');
    const [hits, setHits] = useState<AdminUser[]>([]);
    const [searching, setSearching] = useState(false);
    const [touched, setTouched] = useState(false);

    // Descarta respuestas de búsquedas ya obsoletas: al escribir rápido llegan
    // desordenadas y la lista acaba mostrando resultados de lo que escribiste antes.
    const requestId = useRef(0);

    useEffect(() => {
        if (value) return;

        if (query.trim().length < 2) {
            setHits([]);
            setSearching(false);
            return;
        }

        setSearching(true);
        const mine = ++requestId.current;

        // Con retardo: escribir "pixi" no debe disparar cuatro consultas
        const t = setTimeout(async () => {
            try {
                const res = await api.get('/admin/users/search', { params: { q: query.trim() } });
                if (mine === requestId.current) setHits(res.data?.users ?? []);
            } catch {
                if (mine === requestId.current) setHits([]);
            } finally {
                if (mine === requestId.current) setSearching(false);
            }
        }, 350);

        return () => clearTimeout(t);
    }, [query, value]);

    const inputClass = inputClassName ??
        'w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none text-sm';

    if (value) {
        return (
            <div className="flex items-center gap-3 p-2 rounded-lg border border-ds-border bg-ds-bg">
                {value.profileImageUrl && (
                    <img src={value.profileImageUrl} alt="" className="w-8 h-8 rounded-full" />
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-ds-text truncate">
                        {value.displayName || value.login}
                    </p>
                    <p className="text-xs text-ds-soft truncate">@{value.login}</p>
                </div>
                <button
                    onClick={() => { setQuery(''); setHits([]); setTouched(false); onClear(); }}
                    className="p-1 text-ds-soft hover:text-ds-danger transition-colors"
                    title="Elegir otro canal"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ds-soft" />
                <input
                    value={query}
                    onChange={e => { setQuery(e.target.value); setTouched(true); }}
                    placeholder={placeholder}
                    className={inputClass + ' pl-9'}
                />
                {searching && (
                    <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-ds-soft animate-spin" />
                )}
            </div>

            {hits.length > 0 && (
                <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
                    {hits.map(u => (
                        <button
                            key={u.id}
                            onClick={() => { setHits([]); setQuery(''); onSelect(u); }}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-ds-bg transition-colors text-left"
                        >
                            {u.profileImageUrl && (
                                <img src={u.profileImageUrl} alt="" className="w-8 h-8 rounded-full" />
                            )}
                            <span className="text-sm font-bold text-ds-text">
                                {u.displayName || u.login}
                            </span>
                            <span className="text-xs text-ds-soft">@{u.login}</span>
                        </button>
                    ))}
                </div>
            )}

            {touched && query.trim().length >= 2 && !searching && hits.length === 0 && (
                <p className="text-xs text-ds-soft mt-2">Ningún canal coincide.</p>
            )}
        </div>
    );
}
