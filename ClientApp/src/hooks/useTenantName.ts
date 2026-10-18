import { useEffect, useState } from 'react';
import { loadTenantName } from '../platform/tenantHost';

/** Nombre del proyecto del subdominio donde se abre el panel; fuera de un subdominio de tenant es null (se usa la marca de Decatron). */
export function useTenantName(): string | null {
    const [name, setName] = useState<string | null>(null);
    useEffect(() => { loadTenantName().then(setName); }, []);
    return name;
}
