import type { ComponentType } from 'react';
import { useLocation } from 'react-router-dom';
import { ModuleDoc } from '../../ModuleDoc';

// Guías de módulos con texto en es+en: el contenido vive en public/locales/{es,en}/docs-guides.json (una clave por guía).
export function GuideDoc({ page, icon }: { page: string; icon: ComponentType<{ className?: string }> }) {
    const scope = useLocation().pathname.startsWith('/dashboard') ? 'private' : 'public';
    return <ModuleDoc ns="docs-guides" page={page} scope={scope} icon={icon} />;
}
