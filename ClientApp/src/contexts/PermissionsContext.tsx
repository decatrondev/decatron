import { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';
import { onTokenChanged, onTokenRemoved } from '../utils/tokenEvents';

interface PermissionsData {
    userId?: string;
    channelOwnerId?: string;
    isOwner: boolean;
    accessLevel: string | null;
    sections: {
        [key: string]: boolean;
    };
}

interface PermissionsContextValue {
    permissions: PermissionsData;
    loading: boolean;
    channelOwnerId: string | null;
    hasAccess: (section: string) => boolean;
    hasMinimumLevel: (requiredLevel: 'commands' | 'moderation' | 'control_total') => boolean;
    refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
    const [permissions, setPermissions] = useState<PermissionsData>({
        isOwner: false,
        accessLevel: null,
        sections: {}
    });
    const [loading, setLoading] = useState(true);
    const loadingRef = useRef(false); // Evitar cargas simultáneas
    const lastLoadTime = useRef(0); // Evitar cargas muy frecuentes

    const loadPermissions = async () => {
        // Evitar múltiples cargas simultáneas
        if (loadingRef.current) {
            return;
        }

        // Evitar cargas muy frecuentes (menos de 200ms desde la última)
        const now = Date.now();
        if (now - lastLoadTime.current < 200) {
            return;
        }

        try {
            loadingRef.current = true;
            lastLoadTime.current = now;
            setLoading(true);
            const res = await api.get('/user/permissions');
            if (res.data.success) {
                setPermissions(res.data.permissions);
            }
        } catch (err) {
            console.error('Error loading permissions:', err);
        } finally {
            setLoading(false);
            loadingRef.current = false;
        }
    };

    useEffect(() => {
        // Cargar permisos al montar el componente (solo si hay token)
        const token = localStorage.getItem('token');
        if (token) {
            loadPermissions();
        } else {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Escuchar cambios de token (nuevo login después de expiración)
    useEffect(() => {
        const unsubscribeTokenChanged = onTokenChanged(() => {
            loadPermissions();
        });

        const unsubscribeTokenRemoved = onTokenRemoved(() => {
            setPermissions({
                isOwner: false,
                accessLevel: null,
                sections: {}
            });
            setLoading(false);
        });

        return () => {
            unsubscribeTokenChanged();
            unsubscribeTokenRemoved();
        };
    }, []);

    const hasAccess = (section: string): boolean => {
        if (permissions.isOwner) return true;
        return permissions.sections[section] === true;
    };

    const hasMinimumLevel = (requiredLevel: 'commands' | 'moderation' | 'control_total'): boolean => {
        if (permissions.isOwner) {
            return true;
        }

        const levels = {
            'commands': 1,
            'moderation': 2,
            'control_total': 3
        };

        const userLevelValue = levels[permissions.accessLevel as keyof typeof levels] || 0;
        const requiredLevelValue = levels[requiredLevel];

        return userLevelValue >= requiredLevelValue;
    };

    return (
        <PermissionsContext.Provider
            value={{
                permissions,
                loading,
                channelOwnerId: permissions.channelOwnerId || null,
                hasAccess,
                hasMinimumLevel,
                refreshPermissions: loadPermissions
            }}
        >
            {children}
        </PermissionsContext.Provider>
    );
}

export function usePermissions() {
    const context = useContext(PermissionsContext);
    if (context === undefined) {
        throw new Error('usePermissions must be used within a PermissionsProvider');
    }
    return context;
}
