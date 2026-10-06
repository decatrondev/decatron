import { useCallback, useEffect, useState } from 'react';
import api from '../../../../services/api';
import type { ChannelReward, SoundAlertOption } from '../model';

export interface TierLimits {
    tier: string;
    maxWheels: number;
    maxSegments: number;
    wheels: number;
    wheelsTotal: number;
    canHideWatermark: boolean;
    historyDays: number;
}

/**
 * Lo del canal que el panel necesita y que no depende de la rueda abierta: la URL base
 * y el login para armar el enlace del overlay, las recompensas de puntos, las alertas de
 * sonido y los topes del tier. Cada carga falla en silencio: sin ellas el panel sigue
 * sirviendo para editar.
 */
export function useChannelResources() {
    const [rewards, setRewards] = useState<ChannelReward[]>([]);
    const [rewardsError, setRewardsError] = useState(false);
    const [soundAlerts, setSoundAlerts] = useState<SoundAlertOption[]>([]);
    const [limits, setLimits] = useState<TierLimits | null>(null);
    const [frontendUrl, setFrontendUrl] = useState(window.location.origin);
    const [channelLogin, setChannelLogin] = useState('');

    // De donde sale el nombre del canal para armar la URL del overlay. Puede no ser
    // el del usuario logueado: un moderador configura el canal del streamer.
    const loadFrontendInfo = useCallback(async () => {
        try {
            const { data } = await api.get('/settings/frontend-info');
            if (data.success) {
                setFrontendUrl(data.frontendUrl || window.location.origin);
                setChannelLogin(data.channel?.login || '');
            }
        } catch {
            // Sin esto la URL no se puede armar, pero la rueda se sigue editando.
        }
    }, []);

    // Las recompensas de puntos salen del endpoint que ya existe para sound alerts;
    // no hace falta uno nuevo.
    const loadRewards = useCallback(async () => {
        try {
            const { data } = await api.get('/soundalerts/channel-points-rewards');
            if (data?.success) setRewards(data.rewards || []);
            else setRewardsError(true);
        } catch {
            setRewardsError(true);
        }
    }, []);

    // Las alertas de sonido del canal, para el premio `sound_alert`. El streamer
    // elige de una lista; no escribe ningun id a mano.
    const loadSoundAlerts = useCallback(async () => {
        try {
            const { data } = await api.get('/wheel/sound-alerts');
            if (data?.success) setSoundAlerts(data.data || []);
        } catch {
            // Sin la lista el premio no se puede elegir, pero el resto del panel sigue.
        }
    }, []);

    // Los topes del tier. Se cargan aparte para poder apagar el boton de crear ANTES
    // de que lo aprieten: enterarse del tope por un error es una forma fea de decirlo.
    const loadLimits = useCallback(async () => {
        try {
            const { data } = await api.get('/wheel/limits');
            if (data?.success) setLimits(data);
        } catch {
            // Sin los topes el panel sigue andando: el backend los aplica igual.
        }
    }, []);

    useEffect(() => {
        loadFrontendInfo(); loadRewards(); loadSoundAlerts(); loadLimits();
    }, [loadFrontendInfo, loadRewards, loadSoundAlerts, loadLimits]);

    return { rewards, rewardsError, soundAlerts, limits, loadLimits, frontendUrl, channelLogin };
}
