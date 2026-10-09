import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import type { SpriteCollectionItem } from './SpiritCard';

export const RARITIES = ['Rare', 'Special', 'Epic', 'Legendary', 'Mythic'];
export const THEMES = ['Basic', 'Gold', 'Candy', 'Galaxy', 'Gem', 'Holofoil', 'Cube', 'Rift/Cube', 'Cheat', 'Quack', 'Hacker'];

export type StatusFilter = 'all' | 'obtained' | 'missing';

// Filtros de las vistas públicas de spirits. La temporada actual viene del backend
// (appsettings Fortnite:CurrentSeason) y es el filtro de temporada por defecto.
export function useSpiritFilters(items: SpriteCollectionItem[]) {
    const [search, setSearch] = useState('');
    const [filterChar, setFilterChar] = useState('');
    const [filterRarity, setFilterRarity] = useState('');
    const [filterTheme, setFilterTheme] = useState('');
    const [filterSeason, setFilterSeason] = useState('');
    const [currentSeason, setCurrentSeason] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [showUnreleased, setShowUnreleased] = useState(false);

    useEffect(() => {
        api.get('/fortnite/current-season')
            .then(r => {
                const cs = r.data.currentSeason ?? '';
                setCurrentSeason(cs);
                setFilterSeason(cs);
            })
            .catch(() => {});
    }, []);

    const characters = useMemo(() => [...new Set(items.map(c => c.sprite.character))].sort(), [items]);
    const seasons = useMemo(() => {
        const found = [...new Set(items.map(c => c.sprite.season).filter((s): s is string => !!s))];
        return found.sort((a, b) => a === currentSeason ? -1 : b === currentSeason ? 1 : a.localeCompare(b));
    }, [items, currentSeason]);

    const filtered = useMemo(() => items.filter(c => {
        if (!showUnreleased && c.sprite.isUnreleased) return false;
        if (statusFilter === 'obtained' && !c.isObtained) return false;
        if (statusFilter === 'missing' && c.isObtained) return false;
        if (filterChar && c.sprite.character !== filterChar) return false;
        if (filterRarity && c.sprite.rarity !== filterRarity) return false;
        if (filterTheme && c.sprite.theme !== filterTheme) return false;
        if (filterSeason && c.sprite.season !== filterSeason) return false;
        if (search && !c.sprite.name.toLowerCase().includes(search.toLowerCase()) &&
            !c.sprite.character.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    }), [items, statusFilter, filterChar, filterRarity, filterTheme, filterSeason, search, showUnreleased]);

    const hasFilters = !!(filterChar || filterRarity || filterTheme || filterSeason !== currentSeason || search || showUnreleased || statusFilter !== 'all');

    const clear = () => {
        setFilterChar(''); setFilterRarity(''); setFilterTheme(''); setFilterSeason(currentSeason);
        setSearch(''); setShowUnreleased(false); setStatusFilter('all');
    };

    return {
        search, setSearch, filterChar, setFilterChar, filterRarity, setFilterRarity,
        filterTheme, setFilterTheme, filterSeason, setFilterSeason, statusFilter, setStatusFilter,
        showUnreleased, setShowUnreleased, currentSeason, characters, seasons, filtered, hasFilters, clear,
    };
}

export type SpiritFilters = ReturnType<typeof useSpiritFilters>;
