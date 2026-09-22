import { useEffect, useState } from 'react';
import api from '../../../services/api';

export type FilterSeverity = 'leve' | 'medio' | 'severo';

export interface ModerationFilterState {
    key: string;
    enabled: boolean;
    severity: FilterSeverity;
    settings: Record<string, unknown>;
    message: string | null;
}

/** Estado de todos los filtros del canal (sin fila en la base = apagado). */
export async function fetchModerationFilters(): Promise<ModerationFilterState[]> {
    const res = await api.get('/moderation/filters');
    return res.data.success ? res.data.filters : [];
}

export async function saveModerationFilter(key: string, changes: Partial<Omit<ModerationFilterState, 'key'>>) {
    const res = await api.put(`/moderation/filters/${key}`, changes);
    return res.data.success === true;
}

/** Encendido/apagado de un filtro, con guardado optimista que se revierte si falla. */
export function useFilterEnabled(key: string) {
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchModerationFilters()
            .then(filters => setEnabled(filters.find(f => f.key === key)?.enabled ?? false))
            .catch(() => setEnabled(false));
    }, [key]);

    const toggle = async (next: boolean) => {
        const previous = enabled;
        setEnabled(next);
        setSaving(true);
        try {
            if (!(await saveModerationFilter(key, { enabled: next }))) setEnabled(previous);
        } catch {
            setEnabled(previous);
        } finally {
            setSaving(false);
        }
    };

    return { enabled, saving, toggle };
}

export function FilterSwitch({ on, disabled, onChange, label }: {
    on: boolean;
    disabled?: boolean;
    onChange: (next: boolean) => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!on)}
            className={`relative w-11 h-6 p-0 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-[#2563eb]' : 'bg-[#cbd5e1] dark:bg-[#374151]'}`}
        >
            <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`}
            />
        </button>
    );
}
