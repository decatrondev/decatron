import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isTokenExpired, getTokenTimeRemaining } from '../utils/jwt';

interface TokenMonitorOptions {
    /**
     * Intervalo de verificación en milisegundos (default: 30000 = 30 segundos)
     */
    checkInterval?: number;

    /**
     * Segundos de advertencia antes de expiración (default: 300 = 5 minutos)
     */
    warningThreshold?: number;

    /**
     * Callback cuando el token está por expirar
     */
    onTokenExpiringSoon?: (secondsRemaining: number) => void;

    /**
     * Callback cuando el token expiró
     */
    onTokenExpired?: () => void;
}

/**
 * Hook para monitorear el estado del token JWT y manejar su expiración
 */
export function useTokenMonitor(options: TokenMonitorOptions = {}) {
    const {
        checkInterval = 30000, // 30 segundos
        warningThreshold = 300, // 5 minutos
        onTokenExpiringSoon,
        onTokenExpired
    } = options;

    const navigate = useNavigate();
    const [tokenStatus, setTokenStatus] = useState<{
        isValid: boolean;
        isExpiringSoon: boolean;
        secondsRemaining: number;
    }>({
        isValid: false,
        isExpiringSoon: false,
        secondsRemaining: 0
    });

    useEffect(() => {
        const checkToken = () => {
            const token = localStorage.getItem('token');

            if (!token) {
                setTokenStatus({
                    isValid: false,
                    isExpiringSoon: false,
                    secondsRemaining: 0
                });
                return;
            }

            // Verificar si el token está expirado
            if (isTokenExpired(token, 0)) {
                console.warn('🔴 Token expirado en useTokenMonitor');
                localStorage.removeItem('token');
                setTokenStatus({
                    isValid: false,
                    isExpiringSoon: false,
                    secondsRemaining: 0
                });

                // Callback y redirección
                onTokenExpired?.();
                if (window.location.pathname !== '/login') {
                    navigate('/login', { replace: true });
                }
                return;
            }

            // Obtener tiempo restante
            const secondsRemaining = getTokenTimeRemaining(token);
            const isExpiringSoon = secondsRemaining <= warningThreshold;

            setTokenStatus({
                isValid: true,
                isExpiringSoon,
                secondsRemaining
            });

            // Callback si está por expirar
            if (isExpiringSoon) {
                console.warn(`⚠️ Token expirará pronto: ${secondsRemaining} segundos restantes`);
                onTokenExpiringSoon?.(secondsRemaining);
            }
        };

        // Verificación inicial
        checkToken();

        // Verificación periódica
        const interval = setInterval(checkToken, checkInterval);

        return () => clearInterval(interval);
    }, [checkInterval, warningThreshold, navigate, onTokenExpiringSoon, onTokenExpired]);

    return tokenStatus;
}
