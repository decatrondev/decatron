import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { applySlotValues } from '../components/promo-overlay/slots';
import PromoDesignRenderer, { type Phase } from '../components/promo-overlay/PromoDesignRenderer';
import { placeInZone, STAGE, type ZonePlacement } from '../components/promo-overlay/PromoPreview';
import type { PromoContent, PromoDesign, PromoVars } from '../components/promo-overlay/types';
import { useBrand } from '../brand/BrandContext';

interface Zone extends ZonePlacement { key: string }
interface Emergency { pieceId: number; zone: string; design: PromoDesign; content: PromoContent; channel: string }
interface Shown { pieceId: number; seconds: number; scale: number; sponsored: boolean; design: PromoDesign; content: PromoContent; vars: PromoVars }

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
                        setShown({ pieceId: d.pieceId, seconds: d.seconds, scale: typeof d.scale === 'number' ? d.scale : 1, sponsored: d.sponsored === true, design: applySlotValues(d.design, d.style), content: d.content, vars });
                        await sleep(d.seconds * 1000);
                        if (!alive) return;
                        setPhase('exit');
                        await sleep(EXIT_MS);
                        if (!alive) return;
                        setShown(null);
                        wait = 1;
                    } else if (d?.wait) wait = d.wait;
                } catch { wait = 15; }
                // Se vuelve a preguntar al menos cada 4 s: así una pieza pedida con el comando del chat sale pronto aunque la zona esté en pausa larga
                await sleep(Math.min(wait, 4) * 1000);
            }
        })();
        return () => { alive = false; };
    }, [zone.key, alias, source, language, stopped]);

    if (!shown) return null;
    // La escala la elige el streamer dentro de los límites del dueño: el ancla de la zona se calcula con el tamaño ya escalado.
    const pos = placeInZone(zone, shown.design.canvas.width * shown.scale, shown.design.canvas.height * shown.scale);
    return (
        <div key={shown.pieceId} style={{ position: 'absolute', left: pos.x, top: pos.y, transform: shown.scale === 1 ? undefined : `scale(${shown.scale})`, transformOrigin: 'top left' }}>
            <PromoDesignRenderer design={shown.design} content={shown.content} vars={shown.vars} resolveImage={resolve} phase={phase} />
            {shown.sponsored && <SponsoredTag language={language} phase={phase} />}
        </div>
    );
}

/** Etiqueta fija de la publicidad de terceros: la dibuja el overlay, no la plantilla, así nadie puede quitarla ni editarla. */
function SponsoredTag({ language, phase }: { language: string; phase: Phase }) {
    return (
        <div style={{
            position: 'absolute', top: 8, right: 8, padding: '3px 10px', borderRadius: 6, pointerEvents: 'none',
            background: 'rgba(15, 18, 24, 0.82)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.35)',
            fontFamily: 'system-ui, sans-serif', fontSize: 16, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', lineHeight: 1.3,
            opacity: phase === 'exit' ? 0 : 1, transition: 'opacity 400ms ease',
        }}>{language === 'en' ? 'Ad' : 'Publicidad'}</div>
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

    // La posición de las zonas la puede cambiar el streamer desde su panel: se vuelve a leer cada 20 s para que se note sin recargar OBS.
    useEffect(() => {
        if (!channel) return;
        const id = window.setInterval(async () => {
            try {
                const d = await (await fetch(`/api/promo/resolve/${encodeURIComponent(channel)}`)).json();
                if (d?.found) setZones(prev => (JSON.stringify(prev) === JSON.stringify(d.zones) ? prev : d.zones));
            } catch { /* se reintenta en la próxima vuelta */ }
        }, 20000);
        return () => window.clearInterval(id);
    }, [channel]);

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
