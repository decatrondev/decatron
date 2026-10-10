import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

/**
 * Carga y guardado de la configuración de un comando (Watchtime, Ruleta…): GET/POST al mismo endpoint, con
 * `fromApi`/`toApi` para traducir entre el formato del servidor y el de la pantalla.
 * `normalize` (opcional) corrige dependencias entre campos al editar (p. ej. mínimo ≤ máximo).
 * Con `skip` no pide nada (p. ej. sesión de Kick donde la función no existe).
 */
export function useCommandConfig<T extends object>({ endpoint, defaults, fromApi, toApi, name, normalize, skip }: {
    endpoint: string;
    defaults: T;
    fromApi: (api: any) => T;
    toApi: (config: T) => unknown;
    name: string;
    normalize?: (next: T, key: keyof T) => T;
    skip?: boolean;
}) {
    const [config, setConfig] = useState<T>(defaults);
    const [loading, setLoading] = useState(!skip);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (skip) { setLoading(false); return; }
        (async () => {
            try {
                const res = await api.get(endpoint);
                if (res.data?.success) setConfig(fromApi(res.data.config));
            } catch (err) {
                console.error(`Error cargando config de ${name}`, err);
                setError('No se pudo cargar la configuración, se muestran valores por defecto');
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [skip]);

    const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
        setConfig(prev => {
            const next = { ...prev, [key]: value };
            return normalize ? normalize(next, key) : next;
        });
        setSaved(false);
    }, [normalize]);

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await api.post(endpoint, toApi(config));
            if (res.data?.success) {
                setConfig(fromApi(res.data.config));
                setSaved(true);
            } else {
                setError(res.data?.message || 'Error guardando la configuración');
            }
        } catch (err: any) {
            console.error(`Error guardando config de ${name}`, err);
            setError(err?.response?.data?.message || 'Error guardando la configuración');
        } finally {
            setSaving(false);
        }
    };

    return { config, set, loading, saving, saved, error, save };
}
