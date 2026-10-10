// src/components/GameAutocomplete.tsx
import { useState, useCallback, Fragment } from 'react';
import { Combobox, Transition } from '@headlessui/react';
import { Search, Gamepad2, Loader2, CheckCircle2 } from 'lucide-react';
import { debounce } from '../utils/debounce';
import api from '../services/api';

export interface GameOption {
    id: string;
    name: string;
    boxArtUrl: string | null;
    source: 'alias' | 'cache' | 'api';
}

interface GameAutocompleteProps {
    value: GameOption | null;
    onChange: (game: GameOption | null) => void;
    placeholder?: string;
}

export default function GameAutocomplete({ value, onChange, placeholder = 'Buscar juego...' }: GameAutocompleteProps) {
    const [query, setQuery] = useState('');
    const [games, setGames] = useState<GameOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Debounced search function
    const searchGames = useCallback(
        debounce(async (searchQuery: string) => {
            if (!searchQuery || searchQuery.length < 2) {
                setGames([]);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const response = await api.get(`/commands/microcommands/search-games?q=${encodeURIComponent(searchQuery)}&limit=10`);

                if (response.data.success) {
                    setGames(response.data.games || []);
                } else {
                    throw new Error(response.data.message || 'Error buscando juegos');
                }
            } catch (err) {
                console.error('Error searching games:', err);
                setError('Error al buscar juegos');
                setGames([]);
            } finally {
                setLoading(false);
            }
        }, 300),
        []
    );

    const handleQueryChange = (newQuery: string) => {
        setQuery(newQuery);
        searchGames(newQuery);
    };

    const getSourceBadge = (source: string) => {
        switch (source) {
            case 'alias':
                return <span className="text-xs bg-ds-ok/10 text-ds-ok px-2 py-0.5 rounded-full font-bold">⚡ Alias</span>;
            case 'cache':
                return <span className="text-xs bg-ds-raised text-ds-accent-text px-2 py-0.5 rounded-full font-bold">💾 Cache</span>;
            case 'api':
                return <span className="text-xs bg-ds-bg text-ds-text px-2 py-0.5 rounded-full font-bold">🌐 API</span>;
            default:
                return null;
        }
    };

    return (
        <Combobox value={value} onChange={onChange}>
            <div className="relative">
                {/* Label */}
                <label className="block text-sm font-bold text-ds-text mb-2">
                    Categoría (Juego) *
                </label>

                {/* Input Container */}
                <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Search className="h-5 w-5 text-ds-soft" />
                    </div>

                    <Combobox.Input
                        className="ds-input pl-10 pr-10"
                        placeholder={placeholder}
                        onChange={(event) => handleQueryChange(event.target.value)}
                        displayValue={(game: GameOption | null) => game?.name || ''}
                    />

                    {/* Loading Spinner */}
                    {loading && (
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <Loader2 className="h-5 w-5 text-ds-accent-text animate-spin" />
                        </div>
                    )}

                    {/* Selected Check */}
                    {value && !loading && (
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <CheckCircle2 className="h-5 w-5 text-ds-ok" />
                        </div>
                    )}
                </div>

                {/* Helper Text */}
                <p className="text-xs text-ds-soft mt-1">
                    Escribe al menos 2 caracteres para buscar. Ej: lol, val, minecraft
                </p>

                {/* Error Message */}
                {error && (
                    <p className="text-xs text-ds-danger mt-1">
                        {error}
                    </p>
                )}

                {/* Options Dropdown */}
                <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                    afterLeave={() => setQuery('')}
                >
                    <Combobox.Options className="absolute z-10 mt-2 max-h-60 w-full overflow-auto rounded-lg bg-ds-surface py-1 border border-ds-border focus:outline-none">
                        {games.length === 0 && query.length >= 2 && !loading ? (
                            <div className="relative cursor-default select-none py-4 px-4 text-center text-ds-soft">
                                <Gamepad2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No se encontraron juegos</p>
                                <p className="text-xs mt-1">Intenta con otro término de búsqueda</p>
                            </div>
                        ) : (
                            games.map((game) => (
                                <Combobox.Option
                                    key={game.id}
                                    value={game}
                                    className={({ active }) =>
                                        `relative cursor-pointer select-none py-3 px-4 ${
                                            active
                                                ? 'bg-ds-accent/10 '
                                                : ''
                                        }`
                                    }
                                >
                                    {({ selected }) => (
                                        <div className="flex items-center gap-3">
                                            {/* Game Box Art */}
                                            {game.boxArtUrl ? (
                                                <img
                                                    src={game.boxArtUrl}
                                                    alt={game.name}
                                                    className="w-12 h-16 rounded object-cover bg-ds-bg"
                                                />
                                            ) : (
                                                <div className="w-12 h-16 rounded bg-ds-bg flex items-center justify-center">
                                                    <Gamepad2 className="w-6 h-6 text-ds-soft" />
                                                </div>
                                            )}

                                            {/* Game Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={`block truncate font-semibold ${
                                                            selected
                                                                ? 'text-ds-accent-text '
                                                                : 'text-ds-text '
                                                        }`}
                                                    >
                                                        {game.name}
                                                    </span>
                                                    {selected && (
                                                        <CheckCircle2 className="w-4 h-4 text-ds-accent-text" />
                                                    )}
                                                </div>
                                                <div className="mt-1">
                                                    {getSourceBadge(game.source)}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </Combobox.Option>
                            ))
                        )}
                    </Combobox.Options>
                </Transition>
            </div>
        </Combobox>
    );
}
