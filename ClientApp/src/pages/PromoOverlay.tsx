import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import PromoDesignRenderer, { type Phase } from '../components/promo-overlay/PromoDesignRenderer';
import { placeInZone, STAGE, type ZonePlacement } from '../components/promo-overlay/PromoPreview';
import type { PromoContent, PromoDesign, PromoVars } from '../components/promo-overlay/types';
import { useBrand } from '../brand/BrandContext';

interface Zone extends ZonePlacement { key: string }
interface Emergency { pieceId: number; zone: string; design: PromoDesign; content: PromoContent; channel: string }
interface Shown { pieceId: number; seconds: number; design: PromoDesign; content: PromoContent; vars: PromoVars }

/** Cuánto se deja correr la animación de salida antes de quitar la ficha y pedir la siguiente. */
const EXIT_MS = 1200;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Primeros comandos públicos del canal para la variable {{commands}} (los que el streamer no ocultó). */
async function loadCommands(channel: string): Promise<string> {
    try {
        const r = await fetch(`/api/public/commands/${encodeURIComponent(channel)}`);
        const j = await r.json();
        // Sin alias de una o dos letras (t, g): son atajos de otro comando y no dicen nada en pantalla.
        const names = [...new Set<string>((j.items ?? []).map((i: { name: string }) => (i.name ?? '').replace(/^!/, '')).filter((n: string) => n.length > 2))];
        return names.slice(0, 5).map(n => `!${n}`).join(' · ');
    } catch { return ''; }
}

/**
 * Una zona del lienzo: pide al servidor la siguiente pieza, la muestra el tiempo que dice, la retira y vuelve a pedir.
 * El servidor decide qué sale y cuándo (prioridad, peso, vigencia, mínimo entre piezas, tope por hora); aquí solo se dibuja.
 */
function ZoneSlot({ zone, alias, source, language, stopped }: { zone: Zone; alias: string; source: string | null; language: string; stopped: boolean }) {
    const { resolve } = useBrand();
    const [shown, setShown] = useState<Shown | null>(null);
    const [phase, setPhase] = useState<Phase>('enter');

    useEffect(() => {
        if (stopped) { setShown(null); return; }
        let alive = true;
        (async () => {
            while (alive) {
                let wait = 30;
                try {
                    const q = new URLSearchParams({ zone: zone.key });
                    if (source) q.set('source', source);
                    const res = await fetch(`/api/promo/next/${encodeURIComponent(alias)}?${q}`);
                    const d = await res.json();
                    if (d?.found && d.wait === 0 && alive) {
                        const link = d.content.link || 'https://decatron.net';
                        const vars: PromoVars = { channel: d.channel, link, commands: d.needsCommands ? await loadCommands(d.channel) : '' };
                        setPhase('enter');
                        setShown({ pieceId: d.pieceId, seconds: d.seconds, design: d.design, content: d.content, vars });
                        await sleep(d.seconds * 1000);
                        if (!alive) return;
                        setPhase('exit');
                        await sleep(EXIT_MS);
                        if (!alive) return;
                        setShown(null);
                        wait = 1;
                    } else if (d?.wait) wait = d.wait;
                } catch { wait = 15; }
                await sleep(wait * 1000);
            }
        })();
        return () => { alive = false; };
    }, [zone.key, alias, source, language, stopped]);

    if (!shown) return null;
    const pos = placeInZone(zone, shown.design.canvas.width, shown.design.canvas.height);
    return (
        <div key={shown.pieceId} style={{ position: 'absolute', left: pos.x, top: pos.y }}>
            <PromoDesignRenderer design={shown.design} content={shown.content} vars={shown.vars} resolveImage={resolve} phase={phase} />
        </div>
    );
}

/**
 * Overlay de Promociones para OBS (/overlay/promo?channel=<login>[&source=all|twitch|kick]). Patrón multiplataforma:
 * .dev/plans/MULTIPLATAFORMA_PATRON.md — pregunta la clave al conectar y en cada reconexión, y se registra en el grupo
 * overlay_{clave} para que el panel muestre «Conectado en OBS».
 */
export default function PromoOverlay() {
    const [params] = useSearchParams();
    const channel = params.get('channel') || '';
    const sourceParam = (params.get('source') || '').toLowerCase();
    const source = ['all', 'twitch', 'kick'].includes(sourceParam) ? sourceParam : null;

    const [zones, setZones] = useState<Zone[]>([]);
    const [language, setLanguage] = useState('es');
    const [scale, setScale] = useState(() => Math.min(window.innerWidth / STAGE.width, window.innerHeight / STAGE.height));
    const variantRef = useRef<string>('all');
    const [emergency, setEmergency] = useState<Emergency | null>(null);
    const { resolve } = useBrand();

    useEffect(() => {
        const onResize = () => setScale(Math.min(window.innerWidth / STAGE.width, window.innerHeight / STAGE.height));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        if (!channel) return;
        let disposed = false;
        let retry: ReturnType<typeof setTimeout> | null = null;
        let connection: signalR.HubConnection | null = null;
        let groupKey = channel;

        const scheduleRetry = () => {
            if (disposed || retry) return;
            retry = setTimeout(() => { retry = null; connect(); }, 5000);
        };

        const join = async (c: signalR.HubConnection) => {
            const res = await fetch(`/api/promo/resolve/${encodeURIComponent(channel)}`);
            const d = await res.json();
            if (d?.found) {
                groupKey = d.overlayKey;
                variantRef.current = source ?? (['all', 'twitch', 'kick'].includes(d.variant) ? d.variant : 'all');
                setLanguage(d.language);
                setZones(d.zones);
            }
            await c.invoke('JoinChannel', groupKey);
            await c.invoke('RegisterOverlay', groupKey, 'promo');
            await c.invoke('SetOverlayVariant', variantRef.current);
        };

        const connect = async () => {
            if (disposed) return;
            connection?.stop().catch(() => undefined);
            try {
                const c = new signalR.HubConnectionBuilder()
                    .withUrl(`${window.location.origin}/hubs/overlay`, { withCredentials: false })
                    .withAutomaticReconnect()
                    .configureLogging(signalR.LogLevel.Warning)
                    .build();
                c.onreconnected(async () => { try { await join(c); } catch (e) { console.error('[PROMO] Error al volver a unirse:', e); } });
                c.onclose(() => scheduleRetry());
                connection = c;
                await c.start();
                await join(c);
            } catch (e) {
                console.error('[PROMO] Error de conexión:', e);
                scheduleRetry();
            }
        };

        connect();
        return () => { disposed = true; if (retry) clearTimeout(retry); connection?.stop(); };
    }, [channel, source]);

    // Una pieza de emergencia publicada reemplaza a todas las demás: se consulta cada pocos segundos y, mientras haya una,
    // la rotación se detiene y la pieza se queda en pantalla hasta que el dueño la despublique o venza.
    useEffect(() => {
        if (!channel) return;
        let alive = true;
        const check = async () => {
            try {
                const q = source ? `?source=${source}` : '';
                const d = await (await fetch(`/api/promo/emergency/${encodeURIComponent(channel)}${q}`)).json();
                if (!alive) return;
                setEmergency(prev => {
                    if (!d?.active) return null;
                    return prev && prev.pieceId === d.pieceId ? prev : { pieceId: d.pieceId, zone: d.zone, design: d.design, content: d.content, channel: d.channel };
                });
            } catch { /* se conserva el estado anterior */ }
        };
        check();
        const id = window.setInterval(check, 15000);
        return () => { alive = false; window.clearInterval(id); };
    }, [channel, source]);

    if (!channel || zones.length === 0) return <div style={{ width: '100vw', height: '100vh' }} />;

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: 'transparent' }}>
            <div style={{ position: 'relative', width: STAGE.width, height: STAGE.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                {zones.map(z => <ZoneSlot key={z.key} zone={z} alias={channel} source={source} language={language} stopped={!!emergency} />)}
                {emergency && (() => {
                    const zone = zones.find(z => z.key === emergency.zone) ?? zones[0];
                    const pos = placeInZone(zone, emergency.design.canvas.width, emergency.design.canvas.height);
                    const link = emergency.content.link || 'https://decatron.net';
                    return (
                        <div key={`e${emergency.pieceId}`} style={{ position: 'absolute', left: pos.x, top: pos.y }}>
                            <PromoDesignRenderer design={emergency.design} content={emergency.content} vars={{ channel: emergency.channel, link, commands: '' }} resolveImage={resolve} phase="enter" />
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
