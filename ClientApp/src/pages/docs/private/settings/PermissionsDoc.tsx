import { Lock } from 'lucide-react';
import { ModuleDoc } from '../../ModuleDoc';

// Accesos y permisos del panel: el texto vive en public/locales/{es,en}/docs-access.json.
export default function PermissionsDoc() {
    return <ModuleDoc ns="docs-access" page="permissions" scope="private" icon={Lock} />;
}
