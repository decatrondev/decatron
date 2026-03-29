/**
 * Hook de permisos (re-exporta desde PermissionsContext)
 *
 * Este archivo mantiene compatibilidad con el código existente.
 * Ahora los permisos se cargan UNA sola vez a nivel de App mediante PermissionsProvider,
 * en lugar de que cada componente haga su propia petición HTTP.
 *
 * Esto soluciona el problema de 200+ validaciones JWT simultáneas al cargar el dashboard.
 */

export { usePermissions } from '../contexts/PermissionsContext';
