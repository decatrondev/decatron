/**
 * Overlay "Mascota" para OBS.
 * URL: /overlay/pets?channel=<login>&platform=twitch|kick
 *
 * La mascota vive sola en el navegador (usePetBrain); el backend solo manda estímulos por SignalR ("PetEvent")
 * y avisa cambios de config ("PetConfigChanged"). El glb se descarga con una URL firmada que viene en la config pública.
 * Ver .dev/plans/PETS_PLAN.md §5.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import PetScene from './features/pets/PetScene';
import { PetEventBus } from './features/pets/PetEventBus';
import { resolvePetsConfig, type PetEvent, type PetManifest, type PetsConfig, type PetsPublicResponse } from './features/pets/types';

const OVERLAY_STYLES = `html, body, #root { background: transparent !important; margin: 0; overflow: hidden; }`;

export default function PetsOverlay() {
    const [params] = useSearchParams();
    const channel = params.get('channel') || '';
    const platform = params.get('platform') || 'twitch';

    const [config, setConfig] = useState<PetsConfig | null>(null);
    const [models, setModels] = useState<{ manifest: PetManifest; url: string }[]>([]);
    const [channelKey, setChannelKey] = useState('');
    const bus = useMemo(() => new PetEventBus(), []);
    const modelUrlRef = useRef<Record<string, string>>({});

    const load = useCallback(async () => {
        if (!channel) return;
        try {
            const res = await fetch(`/api/pets/overlay/${encodeURIComponent(channel)}?platform=${platform}`);
            const data: PetsPublicResponse = await res.json();
            if (!data.success) return;
            setChannelKey(data.channelKey);
            if (!data.enabled || !data.config || !data.models) { setConfig(null); return; }
            // La URL firmada cambia en cada carga; mantener la primera por modelo para no recargar el glb.
            for (const m of data.models) if (!modelUrlRef.current[m.manifest.id]) modelUrlRef.current[m.manifest.id] = m.url;
            setModels(data.models.map(m => ({ manifest: m.manifest, url: modelUrlRef.current[m.manifest.id] })));
            setConfig(resolvePetsConfig(data.config, data.models[0]?.manifest.id));
        } catch (e) {
            console.warn('[PetsOverlay] load failed', e);
        }
    }, [channel, platform]);

    useEffect(() => { load(); const t = setInterval(load, 120000); return () => clearInterval(t); }, [load]);

    useEffect(() => {
        if (!channelKey) return;
        let isMounted = true;
        const connection = new signalR.HubConnectionBuilder()
            .withUrl('/hubs/overlay')
            .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
            .build();
        connection.on('PetEvent', (e: PetEvent) => { if (isMounted && e?.state) bus.emit(e); });
        connection.on('PetConfigChanged', () => { if (isMounted) load(); });
        connection.on('RefreshOverlay', () => window.location.reload());
        connection.onreconnected(() => { connection.invoke('JoinChannel', channelKey).catch(() => {}); load(); });
        const start = async () => {
            if (!isMounted || connection.state !== signalR.HubConnectionState.Disconnected) return;
            try {
                await connection.start();
                await connection.invoke('JoinChannel', channelKey);
            } catch (err: any) {
                if (!isMounted || err?.message?.includes('negotiation')) return;
                setTimeout(start, 5000);
            }
        };
        start();
        return () => { isMounted = false; connection.stop().catch(() => {}); };
    }, [channelKey, load, bus]);

    // Fuente de Google del nombre/burbuja
    useEffect(() => {
        if (!config) return;
        const fonts = [...new Set([config.nameStyle.font, config.bubbleStyle.font])].filter(f => f && f !== 'system-ui' && f !== 'Inter');
        if (fonts.length === 0) return;
        const id = 'pets-fonts';
        let link = document.getElementById(id) as HTMLLinkElement | null;
        if (!link) { link = document.createElement('link'); link.id = id; link.rel = 'stylesheet'; document.head.appendChild(link); }
        link.href = `https://fonts.googleapis.com/css2?${fonts.map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;600;700`).join('&')}&display=swap`;
    }, [config]);

    const active = useMemo(() => {
        if (!config) return null;
        const pet = config.pets[0];
        return models.find(m => m.manifest.id === pet.model) ?? models[0] ?? null;
    }, [config, models]);

    if (!channel) return <div style={{ color: '#fff', padding: 16, fontFamily: 'sans-serif' }}>Falta ?channel=</div>;

    return (
        <>
            <style>{OVERLAY_STYLES}</style>
            {config && active && (
                <PetScene config={config} manifest={active.manifest} modelUrl={active.url} bus={bus} />
            )}
        </>
    );
}
