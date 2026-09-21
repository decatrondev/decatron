// Rueda de la Suerte — panel de configuración (Fase 1, modo Premios).
// Ver .dev/plans/RUEDA_DE_LA_SUERTE_PLAN.md

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft, Save, Plus, Trash2, Play, Copy, Check,
    GripVertical, Eye, EyeOff, Loader2, CircleDot, Coins, ShieldAlert, PieChart,
    FlaskConical, ArrowRight, MessageSquare, RotateCcw, Inbox, X, Ticket, Trophy,
    Palette, Image as ImageIcon, Volume2, VolumeX, History, Wallet, Download, Search, CopyPlus,
    LayoutTemplate
} from 'lucide-react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import MediaGallery from '../../components/timer/MediaGallery';
import MediaInputWithSelector from '../../components/timer/MediaInputWithSelector';
import {
    CANVAS_HEIGHT, CANVAS_WIDTH, NEEDLE_SHAPES, NEEDLE_SIDES,
    DEFAULT_PALETTE, DEFAULT_VISUAL, FONT_KEYS, FONTS, PRESENTATION_KEYS, resolveVisual,
    type NeedleShape, type NeedleSide,
    type Celebration, type Easing, type FontKey, type PresentationKey,
    type SoundKey, type SoundMode, type WheelVisual,
} from '../../components/wheel/visualConfig';
import WheelCelebration from '../../components/wheel/WheelCelebration';
import WheelFace from '../../components/wheel/WheelFace';
import { applyTemplate, TEMPLATES } from '../../components/wheel/templates';
import LayoutEditor from '../../components/wheel/LayoutEditor';
import { presentationOf, soundsFor, type Presentation } from '../../components/wheel/presentations';

const PALETTE = DEFAULT_PALETTE;

/// Los gajos de las miniaturas de plantilla. Seis y sin etiqueta: en un boton de
/// 128px el texto no se lee, y lo que se compara entre plantillas es el color y la
/// forma, no que dice cada cuna.
const MUESTRA_PLANTILLA = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1, label: '', color: null, icon: null,
}));

type PrizeType =
    | 'nothing'
    | 'coins'
    | 'free_spin'
    | 'gacha_pull'
    | 'timer_time'
    | 'timeout'
    | 'sound_alert'
    | 'manual_message';

interface Prize {
    type: PrizeType;
    params: Record<string, unknown>;
}

interface Segment {
    id: number;
    label: string;
    weight: number;
    color: string | null;
    icon: string | null;
    prize: Prize;
    isEnabled: boolean;
    effectivePercentage?: number;

    // Stock (Fase 7). null = ilimitado.
    stockTotal: number | null;
    stockPerViewer: number | null;
    stockWindow: string;
    /** Solo lectura: lo que queda de la ventana en curso. */
    stockRemaining?: number | null;
}

interface WheelSummary {
    id: number;
    name: string;
    mode: string;
    slug: string;
    isEnabled: boolean;

    // Economía y disparadores (Fase 2). Solo vienen en el detalle.
    creditLabel?: string;
    spinPrice?: number;
    isAccumulable?: boolean;
    overflowPolicy?: string;
    multiFitPolicy?: string;
    creditExpiry?: string;
    spinCommand?: string;
    balanceCommand?: string;
    buyCommand?: string;
    commandEnabled?: boolean;
    autoSpin?: boolean;
    spinCooldownSeconds?: number;
    maxSpinsPerStream?: number | null;
    maxCoinsPerHour?: number | null;

    // Reglas de giro (Fase 7).
    noRepeatScope?: string;
    pityEnabled?: boolean;
    pityThreshold?: number | null;
    allowMultiSpin?: boolean;
    maxMultiSpin?: number;
}

interface Source {
    id: number;
    source: string;
    channelPointsRewardTitle?: string | null;
    isEnabled: boolean;
    rateNumerator: number;
    rateDenominator: number;
    capPerEvent: number | null;
    /** Solo tienen efecto en gift_sub: es la unica fuente por la que llega el tier. */
    tier2Multiplier: number;
    tier3Multiplier: number;
    channelPointsRewardId: string | null;
}

type Tab = 'segments' | 'credits' | 'limits' | 'messages' | 'test' | 'deliveries'
    | 'raffle' | 'look' | 'canvas' | 'media' | 'history' | 'wallets';

/** Una fila del historial. `label` es null si el gajo se borro despues del giro. */
interface Spin {
    id: number;
    createdAt: string;
    mode: string;
    viewer: string | null;
    trigger: string;
    creditsSpent: number;
    segmentId: number | null;
    label: string | null;
    prize: { type?: string; params?: Record<string, unknown> } | null;
    deliveryStatus: string;
    raffleWinner: unknown;
}

interface SpinFilters {
    from: string;
    to: string;
    viewer: string;
    trigger: string;
    status: string;
}

const SPIN_FILTERS_VACIOS: SpinFilters = { from: '', to: '', viewer: '', trigger: 'all', status: 'all' };

interface Metrics {
    totals: {
        spins: number; spinsLast7: number; spinsLast30: number;
        pendingDeliveries: number; creditsSpent: number; coinsPaid: number;
    };
    byTrigger: { trigger: string; spins: number }[];
    distribution: {
        segmentId: number; label: string; color: string | null;
        spins: number; configuredPct: number; realPct: number;
    }[];
    luckiest: { viewer: string; spins: number; credits: number }[];
}

interface Wallet {
    viewer: string;
    credits: number;
    lifetimeCredits: number;
    spinsThisStream: number;
    lastActivityAt: string;
    lastSpinAt: string | null;
}

/// Config del modo Sorteo. Vive en su propia tabla porque son reglas del sorteo,
/// no aspecto, y una rueda de Premios no tiene ninguno de estos campos.
interface RaffleConfig {
    entryCommand: string;
    windowMode: 'manual' | 'timed' | 'always_open';
    windowSeconds: number | null;
    entryCostCredits: number;
    maxEntriesPerViewer: number;
    weightSources: Record<string, any>;
    requirements: Record<string, any>;
    winnersCount: number;
    drawMode: 'single' | 'multi' | 'remove_and_continue';
    removeWinnerFromPool: boolean;
    clearOnStreamEnd: boolean;
    isOpen: boolean;
    windowClosesAt: string | null;
    acceptingEntries: boolean;
}

interface RaffleEntry {
    id: number;
    viewer: string;
    entries: number;
    weight: number;
    breakdown: Record<string, any> | null;
    hasWon: boolean;
    wonAt: string | null;
    joinedAt: string;
}

/// Una alerta de sonido del canal, para elegirla como premio.
interface SoundAlertOption {
    id: number;
    title: string;
    enabled: boolean;
}

/// Un premio que el bot no pudo entregar y espera al streamer.
interface Delivery {
    id: number;
    wheelId: number;
    wheelName: string;
    spinId: number;
    viewer: string;
    prize: Prize | null;
    status: string;
    reason: string | null;
    notes: string | null;
    resolvedAt: string | null;
    createdAt: string;
}

interface MessagePack {
    messages: Record<string, { es: string | null; en: string | null }>;
    defaults: Record<string, { es: string; en: string }>;
    placeholders: Record<string, string[]>;
}

interface ChannelReward {
    id: string;
    title: string;
    cost: number;
}

interface SimResult {
    viewer: string;
    balanceBefore: number;
    balanceAfter: number;
    credited: boolean;
    creditsAdded: number;
    spinsOwed: number;
    spun: boolean;
    spinLabel: string | null;
}

const emptySegment = (index: number): Segment => ({
    id: 0,
    label: '',
    weight: 1,
    color: PALETTE[index % PALETTE.length],
    icon: null,
    prize: { type: 'nothing', params: {} },
    isEnabled: true,
    stockTotal: null,
    stockPerViewer: null,
    stockWindow: 'ever',
});

export default function WheelConfig() {
    const navigate = useNavigate();
    const { t } = useTranslation('features');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

    const [wheels, setWheels] = useState<WheelSummary[]>([]);
    const [wheel, setWheel] = useState<WheelSummary | null>(null);
    const [segments, setSegments] = useState<Segment[]>([]);
    const [sources, setSources] = useState<Source[]>([]);
    const [tab, setTab] = useState<Tab>('segments');
    const [rewards, setRewards] = useState<ChannelReward[]>([]);
    const [rewardsError, setRewardsError] = useState(false);
    const [msgPack, setMsgPack] = useState<MessagePack | null>(null);
    const [soundAlerts, setSoundAlerts] = useState<SoundAlertOption[]>([]);
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [deliveryFilter, setDeliveryFilter] = useState<'pending' | 'all'>('pending');
    const [raffle, setRaffle] = useState<RaffleConfig | null>(null);
    const [raffleEntries, setRaffleEntries] = useState<RaffleEntry[]>([]);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [visualRaw, setVisualRaw] = useState<unknown>(null);
    // Dispara la celebracion sobre el preview desde el boton de la pestana Aspecto.
    // Vive aca y no en LookTab porque el preview esta en la otra columna.
    const [celebNonce, setCelebNonce] = useState(0);

    // Fase 6. Se cargan al entrar en su pestaña y no al abrir la pantalla: son las
    // dos consultas mas caras del panel y la mayoria de las visitas no las miran.
    const [spins, setSpins] = useState<Spin[]>([]);
    const [spinsTotal, setSpinsTotal] = useState(0);
    const [spinsPage, setSpinsPage] = useState(1);
    const [spinFilters, setSpinFilters] = useState<SpinFilters>(SPIN_FILTERS_VACIOS);
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [walletSearch, setWalletSearch] = useState('');

    // Igual que en el overlay: lo que el streamer no configuro se cae al default de
    // Decatron. Asi el preview muestra lo mismo que se vera en OBS incluso con una
    // rueda recien creada, que no tiene ni una clave guardada.
    const visual: WheelVisual = useMemo(() => resolveVisual(visualRaw), [visualRaw]);

    const patchVisual = (cambios: Partial<WheelVisual>) =>
        setVisualRaw({ ...visual, ...cambios });

    const patchPointer = (cambios: Partial<WheelVisual['pointer']>) =>
        setVisualRaw({ ...visual, pointer: { ...visual.pointer, ...cambios } });

    const patchSound = (key: SoundKey, cambios: Partial<WheelVisual['sounds'][SoundKey]>) =>
        setVisualRaw({ ...visual, sounds: { ...visual.sounds, [key]: { ...visual.sounds[key], ...cambios } } });

    // Los gajos que el lienzo dibuja. Son los mismos que el preview de la columna
    // derecha: colocar la rueda mirando gajos que no son los tuyos seria colocarla
    // a ojo, que es justo lo que el editor viene a arreglar.
    const visiblesParaLienzo = useMemo(
        () => segments
            .filter(sg => sg.isEnabled)
            .map(sg => ({ id: sg.id, label: sg.label || '—', color: sg.color, icon: sg.icon })),
        [segments],
    );
    const [limits, setLimits] = useState<{ tier: string; maxWheels: number; maxSegments: number; wheels: number; wheelsTotal: number; canHideWatermark: boolean; historyDays: number } | null>(null);

    // El idioma sale de la configuracion de la cuenta, no de un selector propio de esta
    // pantalla: dos sitios donde cambiar lo mismo terminan diciendo cosas distintas.
    const { currentLanguage } = useLanguage();
    const msgLang: 'es' | 'en' = currentLanguage === 'en' ? 'en' : 'es';
    const [copied, setCopied] = useState(false);
    const [frontendUrl, setFrontendUrl] = useState(window.location.origin);
    const [channelLogin, setChannelLogin] = useState('');

    // El overlay se identifica por canal + slug, sin token: es la convencion del
    // resto de overlays del proyecto y una fuente de OBS no puede llevar auth.
    const overlayUrl = wheel && channelLogin
        ? `${frontendUrl}/overlay/rueda?channel=${channelLogin}&wheel=${wheel.slug}`
        : '';

    // ----------------------------------------------------------------
    // Carga
    // ----------------------------------------------------------------
    const loadWheels = useCallback(async () => {
        try {
            const { data } = await api.get('/wheel/wheels');
            const list: WheelSummary[] = data.wheels || [];
            setWheels(list);
            if (list.length > 0) await openWheel(list[0].id);
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.loadFailed') });
        } finally {
            setLoading(false);
        }
        // openWheel es estable dentro de este componente
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [t]);

    const openWheel = async (id: number) => {
        // Una confirmacion de borrado abierta no puede sobrevivir al cambio de rueda:
        // el siguiente clic borraria una rueda distinta de la que se pregunto.
        setConfirmDelete(false);
        const [detalle, fuentes] = await Promise.all([
            api.get(`/wheel/wheels/${id}`),
            api.get(`/wheel/wheels/${id}/sources`),
        ]);
        setWheel(detalle.data.wheel);
        setSegments((detalle.data.segments || []).map(normalizeSegment));
        setVisualRaw(detalle.data.wheel?.visualConfig ?? null);
        setSources(fuentes.data.sources || []);

        // Una rueda de Sorteo no tiene creditos ni gajos que editar, pero si un pool.
        if (detalle.data.wheel?.mode === 'raffle') {
            await loadRaffle(id);
            setTab('raffle');
        } else {
            setRaffle(null);
            setRaffleEntries([]);
        }

        const mensajes = await api.get(`/wheel/wheels/${id}/messages`);
        setMsgPack({
            messages: mensajes.data.messages || {},
            defaults: mensajes.data.defaults || {},
            placeholders: mensajes.data.placeholders || {},
        });
    };

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

    // La bandeja es del canal entero, no de la rueda abierta: al streamer le importa
    // que le debe a su gente, no en cual de sus ruedas salio.
    const loadDeliveries = useCallback(async (filtro: 'pending' | 'all') => {
        try {
            const { data } = await api.get('/wheel/deliveries', { params: { status: filtro } });
            if (data?.success) {
                setDeliveries(data.data || []);
                setPendingCount(data.pendingCount ?? 0);
            }
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.loadFailed') });
        }
    }, [t]);

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

    const loadSpins = useCallback(async (wheelId: number, page: number, filtros: SpinFilters) => {
        try {
            const { data } = await api.get(`/wheel/wheels/${wheelId}/spins`, {
                params: {
                    page, pageSize: 50,
                    from: filtros.from || undefined,
                    to: filtros.to || undefined,
                    viewer: filtros.viewer || undefined,
                    trigger: filtros.trigger,
                    status: filtros.status,
                },
            });
            if (data?.success) {
                setSpins(data.items || []);
                setSpinsTotal(data.total ?? 0);
                setSpinsPage(data.page ?? 1);
            }
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.loadFailed') });
        }
    }, [t]);

    const loadMetrics = useCallback(async (wheelId: number) => {
        try {
            const { data } = await api.get(`/wheel/wheels/${wheelId}/metrics`);
            if (data?.success) setMetrics(data);
        } catch {
            // Sin metricas el historial se sigue viendo, que es lo que se vino a ver.
        }
    }, []);

    const loadWallets = useCallback(async (search: string) => {
        try {
            const { data } = await api.get('/wheel/wallets', { params: { search: search || undefined } });
            if (data?.success) setWallets(data.items || []);
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.loadFailed') });
        }
    }, [t]);

    useEffect(() => {
        loadWheels(); loadFrontendInfo(); loadRewards(); loadSoundAlerts();
        loadDeliveries('pending'); loadLimits();
    }, [loadWheels, loadFrontendInfo, loadRewards, loadSoundAlerts, loadDeliveries, loadLimits]);

    // Al entrar en Historial se piden las dos cosas de una: las tarjetas de arriba y
    // la tabla salen de endpoints distintos porque las metricas usan TODO el historial
    // y la tabla solo la ventana del tier.
    useEffect(() => {
        if (!wheel) return;
        if (tab === 'history') { loadSpins(wheel.id, 1, spinFilters); loadMetrics(wheel.id); }
        if (tab === 'wallets') loadWallets(walletSearch);
        // Los filtros y la busqueda los dispara el propio formulario, no este efecto:
        // ponerlos en las deps pediria al servidor una consulta por cada tecla.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, wheel?.id, loadSpins, loadMetrics, loadWallets]);

    const loadRaffle = async (id: number) => {
        try {
            const { data } = await api.get(`/wheel/wheels/${id}/raffle`);
            if (data?.success) {
                setRaffle(data.config);
                setRaffleEntries(data.entries || []);
            }
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.loadFailed') });
        }
    };

    const patchRaffle = (changes: Partial<RaffleConfig>) =>
        setRaffle(prev => (prev ? { ...prev, ...changes } : prev));

    const saveRaffle = async () => {
        if (!wheel || !raffle) return;
        setSaving(true);
        setStatus(null);
        try {
            const { data } = await api.put(`/wheel/wheels/${wheel.id}/raffle`, raffle);
            // El backend recalcula los pesos del pool al cambiar los multiplicadores:
            // sin eso, tocar un peso no afectaria a nadie que ya estuviera inscrito.
            await loadRaffle(wheel.id);
            setStatus({
                kind: 'ok',
                text: data?.recalculated > 0
                    ? t('wheel.raffle.savedRecalc', { count: data.recalculated })
                    : t('wheel.status.saved'),
            });
        } catch (e: any) {
            setStatus({ kind: 'error', text: e?.response?.data?.message || t('wheel.status.saveFailed') });
        } finally {
            setSaving(false);
        }
    };

    const raffleWindow = async (open: boolean) => {
        if (!wheel) return;
        try {
            await api.post(`/wheel/wheels/${wheel.id}/raffle/window`, { open });
            await loadRaffle(wheel.id);
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.saveFailed') });
        }
    };

    const raffleDraw = async () => {
        if (!wheel) return;
        setSaving(true);
        try {
            const { data } = await api.post(`/wheel/wheels/${wheel.id}/raffle/draw`);
            await loadRaffle(wheel.id);
            setStatus({ kind: 'ok', text: t('wheel.raffle.drawn', { winners: (data.winners || []).join(', ') }) });
        } catch (e: any) {
            const reason = e?.response?.data?.reason;
            setStatus({
                kind: 'error',
                text: reason === 'PoolInsuficiente' || reason === 'PoolVacio'
                    ? t('wheel.raffle.needTwo')
                    : t('wheel.status.saveFailed'),
            });
        } finally {
            setSaving(false);
        }
    };

    const raffleAdd = async (viewer: string) => {
        if (!wheel || !viewer.trim()) return;
        try {
            await api.post(`/wheel/wheels/${wheel.id}/raffle/entries`, { viewer: viewer.trim() });
            await loadRaffle(wheel.id);
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.saveFailed') });
        }
    };

    const raffleRemove = async (viewer: string) => {
        if (!wheel) return;
        try {
            await api.delete(`/wheel/wheels/${wheel.id}/raffle/entries/${encodeURIComponent(viewer)}`);
            await loadRaffle(wheel.id);
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.saveFailed') });
        }
    };

    const raffleMultiplier = async (viewer: string, multiplier: number) => {
        if (!wheel) return;
        try {
            await api.put(`/wheel/wheels/${wheel.id}/raffle/entries/${encodeURIComponent(viewer)}/multiplier`, { multiplier });
            await loadRaffle(wheel.id);
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.saveFailed') });
        }
    };

    const raffleReset = async () => {
        if (!wheel) return;
        try {
            await api.post(`/wheel/wheels/${wheel.id}/raffle/reset`);
            await loadRaffle(wheel.id);
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.saveFailed') });
        }
    };

    // Borrar una rueda se lleva por delante su historial de giros y sus entregas
    // pendientes (las tablas cuelgan de wheels con ON DELETE CASCADE). Por eso la
    // confirmacion dice que se pierde, en vez de preguntar "estas seguro?" a secas.
    const deleteWheel = async () => {
        if (!wheel) return;
        setSaving(true);
        setStatus(null);
        try {
            await api.delete(`/wheel/wheels/${wheel.id}`);

            const quedan = wheels.filter(w => w.id !== wheel.id);
            setWheels(quedan);
            setConfirmDelete(false);

            if (quedan.length > 0) {
                await openWheel(quedan[0].id);
            } else {
                setWheel(null);
                setSegments([]);
            }

            await loadLimits();
            setStatus({ kind: 'ok', text: t('wheel.deleted') });
        } catch (e: any) {
            setStatus({ kind: 'error', text: e?.response?.data?.message || t('wheel.status.saveFailed') });
        } finally {
            setSaving(false);
        }
    };

    const resolveDelivery = async (id: number, status: 'done' | 'cancelled' | 'pending') => {
        try {
            await api.put(`/wheel/deliveries/${id}`, { status });
            await loadDeliveries(deliveryFilter);
            setStatus({ kind: 'ok', text: t('wheel.deliveries.saved') });
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.saveFailed') });
        }
    };

    // ----------------------------------------------------------------
    // Acciones
    // ----------------------------------------------------------------
    const createWheel = async (mode: 'prizes' | 'raffle' = 'prizes') => {
        setSaving(true);
        setStatus(null);
        try {
            const { data } = await api.post('/wheel/wheels', {
                name: mode === 'raffle' ? t('wheel.defaults.raffleName') : t('wheel.defaults.name'),
                mode,
            });
            setWheels(prev => [...prev, data.wheel]);
            setWheel(data.wheel);

            // Una rueda de Sorteo no tiene gajos que editar: sus gajos son la gente.
            if (mode === 'raffle') {
                setSegments([]);
                await loadRaffle(data.wheel.id);
                setTab('raffle');
            } else {
                setSegments([0, 1, 2, 3].map(emptySegment));
                setTab('segments');
            }
            await loadLimits();
        } catch (e: any) {
            // El mensaje del tope lo escribe el backend con el numero real del tier;
            // reescribirlo aca seria mantener el mismo texto en dos sitios.
            setStatus({ kind: 'error', text: e?.response?.data?.message || t('wheel.status.createFailed') });
        } finally {
            setSaving(false);
        }
    };

    const duplicateWheel = async () => {
        if (!wheel) return;
        setSaving(true);
        try {
            const { data } = await api.post(`/wheel/wheels/${wheel.id}/duplicate`, {});
            setWheels(prev => [...prev, data.wheel]);
            await openWheel(data.wheel.id);
            await loadLimits();
            setStatus({
                kind: 'ok',
                // La copia nace apagada; si el cupo esta lleno hay que decirlo ANTES de
                // que intente encenderla y se coma un error.
                text: data.quotaFull ? t('wheel.duplicatedQuotaFull') : t('wheel.duplicated'),
            });
        } catch (e: any) {
            setStatus({ kind: 'error', text: e?.response?.data?.message || t('wheel.status.saveFailed') });
        } finally {
            setSaving(false);
        }
    };

    const changeSlug = async (nuevo: string) => {
        if (!wheel || !nuevo.trim() || nuevo.trim() === wheel.slug) return;
        try {
            const { data } = await api.put(`/wheel/wheels/${wheel.id}/slug`, { slug: nuevo.trim() });
            setWheel({ ...wheel, slug: data.slug });
            setWheels(prev => prev.map(w => (w.id === wheel.id ? { ...w, slug: data.slug } : w)));
            setStatus({
                kind: 'ok',
                text: data.adjusted ? t('wheel.slugAdjusted', { slug: data.slug }) : t('wheel.slugChanged'),
            });
        } catch (e: any) {
            setStatus({ kind: 'error', text: e?.response?.data?.message || t('wheel.status.saveFailed') });
        }
    };

    /**
     * Descarga el CSV. Va por `api` y no por un `<a href>` directo porque el
     * endpoint pide sesion: un enlace suelto llegaria sin credenciales y bajaria
     * el HTML del login con extension .csv.
     */
    const exportSpins = async () => {
        if (!wheel) return;
        try {
            const res = await api.get(`/wheel/wheels/${wheel.id}/spins/export`, {
                params: {
                    from: spinFilters.from || undefined,
                    to: spinFilters.to || undefined,
                    viewer: spinFilters.viewer || undefined,
                    trigger: spinFilters.trigger,
                    status: spinFilters.status,
                },
                responseType: 'blob',
            });
            const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `rueda-${wheel.slug}-giros.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.loadFailed') });
        }
    };

    const setWalletCredits = async (viewer: string, credits: number) => {
        try {
            await api.put(`/wheel/wallets/${encodeURIComponent(viewer)}`, { credits });
            setWallets(prev => prev.map(w => w.viewer === viewer ? { ...w, credits } : w));
            setStatus({ kind: 'ok', text: t('wheel.status.saved') });
        } catch (e: any) {
            setStatus({ kind: 'error', text: e?.response?.data?.message || t('wheel.status.saveFailed') });
        }
    };

    // Guarda lo de la pestaña en la que estás. Un botón que guarda "todo" obliga a
    // mandar campos que no tocaste y a resolver conflictos que no existen.
    const save = async () => {
        if (tab === 'segments') return saveSegments();
        if (tab === 'credits') return saveCredits();
        if (tab === 'messages') return saveMessages();
        if (tab === 'raffle') return saveRaffle();
        // El lienzo vive en el mismo jsonb que el aspecto, asi que guarda igual.
        if (tab === 'look' || tab === 'canvas') return saveWheelFields({ visualConfig: visual } as any);
        return saveLimits();
    };

    const saveWheelFields = async (changes: Partial<WheelSummary>) => {
        if (!wheel) return;
        setSaving(true);
        setStatus(null);
        try {
            await api.put(`/wheel/wheels/${wheel.id}`, changes);
            // Encender o apagar mueve el cupo del tier, asi que el contador de arriba
            // quedaria mintiendo hasta la proxima recarga de la pagina.
            if (changes.isEnabled !== undefined) await loadLimits();
            setStatus({ kind: 'ok', text: t('wheel.status.saved') });
        } catch (err: any) {
            setStatus({ kind: 'error', text: err?.response?.data?.message || t('wheel.status.saveFailed') });
        } finally {
            setSaving(false);
        }
    };

    const saveCredits = async () => {
        if (!wheel) return;
        setSaving(true);
        setStatus(null);
        try {
            await api.put(`/wheel/wheels/${wheel.id}/sources`, sources);
            await api.put(`/wheel/wheels/${wheel.id}`, {
                creditLabel: wheel.creditLabel,
                spinPrice: wheel.spinPrice,
                isAccumulable: wheel.isAccumulable,
                overflowPolicy: wheel.overflowPolicy,
                multiFitPolicy: wheel.multiFitPolicy,
                creditExpiry: wheel.creditExpiry,
            });
            setStatus({ kind: 'ok', text: t('wheel.status.saved') });
        } catch (err: any) {
            setStatus({ kind: 'error', text: err?.response?.data?.message || t('wheel.status.saveFailed') });
        } finally {
            setSaving(false);
        }
    };

    const saveMessages = async () => {
        if (!wheel || !msgPack) return;
        setSaving(true);
        setStatus(null);
        try {
            await api.put(`/wheel/wheels/${wheel.id}/messages`, msgPack.messages);
            setStatus({ kind: 'ok', text: t('wheel.status.saved') });
        } catch (err: any) {
            setStatus({ kind: 'error', text: err?.response?.data?.message || t('wheel.status.saveFailed') });
        } finally {
            setSaving(false);
        }
    };

    const patchMessage = (key: string, lang: 'es' | 'en', value: string) =>
        setMsgPack(prev => prev && ({
            ...prev,
            messages: { ...prev.messages, [key]: { ...(prev.messages[key] ?? { es: null, en: null }), [lang]: value } },
        }));

    const saveLimits = () => saveWheelFields({
        spinCommand: wheel?.spinCommand,
        balanceCommand: wheel?.balanceCommand,
        buyCommand: wheel?.buyCommand,
        commandEnabled: wheel?.commandEnabled,
        autoSpin: wheel?.autoSpin,
        spinCooldownSeconds: wheel?.spinCooldownSeconds,
        maxSpinsPerStream: wheel?.maxSpinsPerStream ?? null,
        maxCoinsPerHour: wheel?.maxCoinsPerHour ?? null,
        noRepeatScope: wheel?.noRepeatScope,
        pityEnabled: wheel?.pityEnabled,
        pityThreshold: wheel?.pityThreshold ?? null,
        allowMultiSpin: wheel?.allowMultiSpin,
        maxMultiSpin: wheel?.maxMultiSpin,
    });

    const patchWheel = (changes: Partial<WheelSummary>) =>
        setWheel(prev => (prev ? { ...prev, ...changes } : prev));

    // Las cuatro fuentes fijas se ubican por nombre; las de puntos de canal, por
    // indice, porque puede haber varias filas de la misma fuente.
    const patchSource = (name: string, changes: Partial<Source>) =>
        setSources(prev => prev.map(s => (s.source === name ? { ...s, ...changes } : s)));

    const patchSourceAt = (index: number, changes: Partial<Source>) =>
        setSources(prev => prev.map((s, i) => (i === index ? { ...s, ...changes } : s)));

    const addReward = () =>
        setSources(prev => [...prev, {
            id: 0, source: 'channel_points', isEnabled: true,
            rateNumerator: 100, rateDenominator: 1, capPerEvent: null,
            tier2Multiplier: 1, tier3Multiplier: 1,
            channelPointsRewardId: null, channelPointsRewardTitle: null,
        }]);

    const removeSourceAt = (index: number) =>
        setSources(prev => prev.filter((_, i) => i !== index));

    const saveSegments = async () => {
        if (!wheel) return;
        setSaving(true);
        setStatus(null);
        try {
            const { data } = await api.put(`/wheel/wheels/${wheel.id}/segments`, segments.map(s => ({
                id: s.id,
                label: s.label,
                weight: s.weight,
                color: s.color,
                icon: s.icon,
                prize: s.prize,
                isEnabled: s.isEnabled,
            })));
            setSegments((data.segments || []).map(normalizeSegment));
            setStatus({ kind: 'ok', text: t('wheel.status.saved') });
        } catch (err: any) {
            setStatus({ kind: 'error', text: err?.response?.data?.message || t('wheel.status.saveFailed') });
        } finally {
            setSaving(false);
        }
    };

    const testSpin = async () => {
        if (!wheel) return;
        setStatus(null);
        try {
            const { data } = await api.post(`/wheel/wheels/${wheel.id}/test-spin`);
            setStatus({ kind: 'ok', text: t('wheel.status.testSpun', { label: data.result.label }) });
        } catch (err: any) {
            setStatus({ kind: 'error', text: err?.response?.data?.message || t('wheel.status.testFailed') });
        }
    };

    const simulate = async (source: string, amount: number, viewerLogin: string, rewardId?: string | null) => {
        if (!wheel) return null;
        setStatus(null);
        try {
            const { data } = await api.post(`/wheel/wheels/${wheel.id}/simulate`, {
                source, amount, viewerLogin, rewardId: rewardId || null,
            });
            return data as SimResult;
        } catch (err: any) {
            setStatus({ kind: 'error', text: err?.response?.data?.message || t('wheel.status.saveFailed') });
            return null;
        }
    };

    const copyUrl = async () => {
        await navigator.clipboard.writeText(overlayUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    // ----------------------------------------------------------------
    // Edición de gajos
    // ----------------------------------------------------------------
    const patch = (index: number, changes: Partial<Segment>) =>
        setSegments(prev => prev.map((s, i) => (i === index ? { ...s, ...changes } : s)));

    const move = (index: number, delta: number) => {
        const to = index + delta;
        if (to < 0 || to >= segments.length) return;
        setSegments(prev => {
            const next = [...prev];
            [next[index], next[to]] = [next[to], next[index]];
            return next;
        });
    };

    // Los % del panel se recalculan mientras se escribe; el servidor los vuelve a
    // calcular al guardar, pero esperar al guardado para ver el efecto de un peso
    // hace imposible ajustar la rueda.
    const percentages = useMemo(() => {
        const activos = segments.filter(s => s.isEnabled && s.weight > 0);
        const total = activos.reduce((sum, s) => sum + Number(s.weight || 0), 0);
        return segments.map(s =>
            !s.isEnabled || s.weight <= 0 || total <= 0 ? 0 : (Number(s.weight) / total) * 100
        );
    }, [segments]);

    // ----------------------------------------------------------------
    // Render
    // ----------------------------------------------------------------
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        // El ancho crece por tramos en vez de quedarse en un tope fijo: 1400px en un
        // monitor 4K dejan mas de la mitad de la pantalla vacia, y a ancho completo las
        // filas de gajos se estiran tanto que el ojo pierde de que fila viene cada campo.
        <div className="space-y-6 w-full max-w-[1400px] 2xl:max-w-[1760px] min-[2600px]:max-w-[2200px] mx-auto">
            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/overlays')}
                        className="p-3 bg-[#1B1C1D] rounded-xl border border-[#374151] hover:bg-[#262626] transition-colors"
                        aria-label={t('wheel.back')}
                    >
                        <ArrowLeft className="w-5 h-5 text-[#94a3b8]" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                            <CircleDot className="w-6 h-6 text-[#E8B455]" />
                            {t('wheel.title')}
                        </h1>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-0.5">{t('wheel.subtitle')}</p>
                    </div>
                </div>

                {wheel && (
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Selector de rueda y creacion. Sin esto, un canal que ya tenia
                            una rueda no tenia NINGUNA forma de crear otra ni de cambiar
                            entre las suyas: el boton de crear vivia solo en el estado
                            vacio, asi que el modo Sorteo era inalcanzable. */}
                        {wheels.length > 1 && (
                            <select
                                value={wheel.id}
                                onChange={e => openWheel(Number(e.target.value))}
                                className={FIELD}
                                aria-label={t('wheel.pickWheel')}
                            >
                                {wheels.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        )}

                        {/* El tope del tier se muestra siempre, no solo al chocarse con
                            el: saber que te quedan 0 de 2 antes de intentarlo es la
                            diferencia entre un limite y una sorpresa. */}
                        {limits && (
                            <span className="text-xs text-[#64748b] dark:text-[#94a3b8] tabular-nums">
                                {limits.maxWheels < 0
                                    ? t('wheel.quota.unlimited')
                                    : t('wheel.quota.count', { used: limits.wheels, max: limits.maxWheels })}
                            </span>
                        )}

                        <button
                            onClick={() => createWheel('prizes')}
                            disabled={saving || !!(limits && limits.maxWheels >= 0 && limits.wheels >= limits.maxWheels)}
                            className="px-4 py-2.5 bg-[#1B1C1D] border border-[#374151] hover:bg-[#262626] disabled:opacity-40 text-[#f8fafc] rounded-xl transition-colors flex items-center gap-2 font-bold"
                            title={limits && limits.maxWheels >= 0 && limits.wheels >= limits.maxWheels
                                ? t('wheel.quota.reached', { max: limits.maxWheels })
                                : t('wheel.newWheel')}
                        >
                            <Plus className="w-4 h-4" />
                            {t('wheel.newWheel')}
                        </button>

                        {/* Probar giro solo tiene sentido editando los gajos: es lo que
                            deja ver como quedo la rueda. En Creditos o en Topes no hay
                            nada que mirar en el overlay. */}
                        {tab === 'segments' && (
                            <button
                                onClick={testSpin}
                                className="px-5 py-2.5 bg-[#1B1C1D] border border-[#374151] hover:bg-[#262626] text-[#f8fafc] rounded-xl transition-colors flex items-center gap-2 font-bold"
                            >
                                <Play className="w-4 h-4" />
                                {t('wheel.testSpin')}
                            </button>
                        )}
                        {/* Entregas, Historial y Billeteras no tienen nada que guardar
                            en bloque: cada fila se resuelve o se edita sola. Antes el
                            boton estaba en Entregas y, al caer por el `else` final del
                            despachador, guardaba los topes sin decirlo. */}
                        {!['test', 'deliveries', 'history', 'wallets'].includes(tab) && (
                        <button
                            onClick={save}
                            disabled={saving}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl transition-colors flex items-center gap-2 font-bold"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {t('wheel.save')}
                        </button>
                        )}
                    </div>
                )}
            </header>

            {status && (
                <div className={`px-4 py-3 rounded-xl border text-sm font-medium ${
                    status.kind === 'ok'
                        ? 'bg-green-500/10 border-green-500/40 text-green-300'
                        : 'bg-red-500/10 border-red-500/40 text-red-300'
                }`}>
                    {status.text}
                </div>
            )}

            {!wheel ? (
                <EmptyState onCreate={createWheel} saving={saving} t={t} />
            ) : (
                /* `minmax(0,1fr)` y no `1fr`: una pista `1fr` no baja de su contenido
                   minimo, asi que un hijo ancho ensancha la rejilla entera en vez de
                   encogerse. Era la mitad del scroll horizontal. La columna del preview
                   crece en pantallas grandes, donde 360px se ven diminutos. */
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
                  <div className="space-y-4 min-w-0">
                    {/* Las pestanas ENVUELVEN. Con `flex` a secas y diez botones que no
                        se pueden encoger (icono + etiqueta), el ancho minimo de esta
                        barra rondaba los 1200px y arrastraba a toda la pagina: era la
                        otra mitad del scroll horizontal. `basis` da el punto de corte. */}
                    <nav className="flex flex-wrap gap-1 bg-[#1B1C1D] border border-[#374151] rounded-xl p-1">
                        {/* Las pestanas dependen del modo: una rueda de Sorteo no tiene
                            gajos ni creditos, y una de Premios no tiene pool. Mostrar
                            las siete siempre seria ofrecer pantallas que no aplican. */}
                        {(wheel.mode === 'raffle'
                            ? ([
                                ['raffle', Ticket, t('wheel.tabs.raffle')],
                                ['look', Palette, t('wheel.tabs.look')],
                                ['canvas', LayoutTemplate, t('wheel.tabs.canvas')],
                                ['media', ImageIcon, t('wheel.tabs.media')],
                                ['messages', MessageSquare, t('wheel.tabs.messages')],
                                // Sin Billeteras: una rueda de Sorteo no cobra creditos.
                                ['history', History, t('wheel.tabs.history')],
                            ] as const)
                            : ([
                                ['segments', PieChart, t('wheel.tabs.segments')],
                                ['look', Palette, t('wheel.tabs.look')],
                                ['canvas', LayoutTemplate, t('wheel.tabs.canvas')],
                                ['media', ImageIcon, t('wheel.tabs.media')],
                                ['credits', Coins, t('wheel.tabs.credits')],
                                ['limits', ShieldAlert, t('wheel.tabs.limits')],
                                ['messages', MessageSquare, t('wheel.tabs.messages')],
                                ['test', FlaskConical, t('wheel.tabs.test')],
                                ['deliveries', Inbox, pendingCount > 0
                                    ? `${t('wheel.tabs.deliveries')} (${pendingCount})`
                                    : t('wheel.tabs.deliveries')],
                                ['history', History, t('wheel.tabs.history')],
                                ['wallets', Wallet, t('wheel.tabs.wallets')],
                            ] as const)
                        ).map(([key, Icon, label]) => (
                            <button
                                key={key}
                                onClick={() => setTab(key as Tab)}
                                className={`px-3 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
                                    tab === key ? 'bg-blue-600 text-white' : 'text-[#94a3b8] hover:bg-[#262626]'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                            </button>
                        ))}
                    </nav>

                    {tab === 'credits' && (
                        <CreditsTab
                            wheel={wheel} sources={sources} rewards={rewards} rewardsError={rewardsError}
                            onWheel={patchWheel} onSource={patchSource} onSourceAt={patchSourceAt}
                            onAddReward={addReward} onRemoveAt={removeSourceAt} t={t}
                        />
                    )}

                    {tab === 'messages' && msgPack && (
                        <MessagesTab pack={msgPack} lang={msgLang} onChange={patchMessage} t={t} />
                    )}

                    {tab === 'test' && (
                        <TestTab wheel={wheel} sources={sources} rewards={rewards} onSimulate={simulate} t={t} />
                    )}

                    {tab === 'limits' && (
                        <LimitsTab wheel={wheel} onWheel={patchWheel} t={t} />
                    )}

                    {tab === 'raffle' && raffle && (
                        <RaffleTab
                            config={raffle}
                            entries={raffleEntries}
                            creditLabel={wheel.creditLabel || 'creditos'}
                            saving={saving}
                            onConfig={patchRaffle}
                            onWindow={raffleWindow}
                            onDraw={raffleDraw}
                            onAdd={raffleAdd}
                            onRemove={raffleRemove}
                            onMultiplier={raffleMultiplier}
                            onReset={raffleReset}
                            t={t}
                        />
                    )}

                    {tab === 'look' && (
                        <LookTab
                            visual={visual}
                            onVisual={patchVisual}
                            onPointer={patchPointer}
                            onSound={patchSound}
                            canHideWatermark={!!limits?.canHideWatermark}
                            onTestCelebration={() => setCelebNonce(n => n + 1)}
                            t={t}
                        />
                    )}

                    {tab === 'canvas' && (
                        <section className={CARD}>
                            <div className="px-5 py-4 border-b border-[#374151]">
                                <h2 className="font-bold text-[#f8fafc]">{t('wheel.canvas.title')}</h2>
                                <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.canvas.help')}</p>
                            </div>
                            <div className="p-5">
                                <LayoutEditor
                                    visual={visual}
                                    onVisual={patchVisual}
                                    segments={visiblesParaLienzo}
                                    t={t}
                                />
                            </div>
                        </section>
                    )}

                    {tab === 'media' && (
                        <section className={CARD}>
                            <div className="px-5 py-4 border-b border-[#374151]">
                                <h2 className="font-bold text-[#f8fafc]">{t('wheel.media.title')}</h2>
                                <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.media.help')}</p>
                            </div>
                            <div className="p-5">
                                {/* La biblioteca de medios que ya existe, no una nueva.
                                    La cuota de almacenamiento es la global del tier: la
                                    rueda no tiene una aparte. */}
                                <MediaGallery selectedCategory="wheel" />
                            </div>
                        </section>
                    )}

                    {tab === 'history' && (
                        <HistoryTab
                            spins={spins}
                            total={spinsTotal}
                            page={spinsPage}
                            metrics={metrics}
                            filters={spinFilters}
                            historyDays={limits?.historyDays ?? -1}
                            onFilters={setSpinFilters}
                            onApply={() => wheel && loadSpins(wheel.id, 1, spinFilters)}
                            onReset={() => {
                                setSpinFilters(SPIN_FILTERS_VACIOS);
                                if (wheel) loadSpins(wheel.id, 1, SPIN_FILTERS_VACIOS);
                            }}
                            onPage={p => wheel && loadSpins(wheel.id, p, spinFilters)}
                            onExport={exportSpins}
                            t={t}
                        />
                    )}

                    {tab === 'wallets' && (
                        <WalletsTab
                            wallets={wallets}
                            search={walletSearch}
                            onSearch={setWalletSearch}
                            onApply={() => loadWallets(walletSearch)}
                            onSetCredits={setWalletCredits}
                            t={t}
                        />
                    )}

                    {tab === 'deliveries' && (
                        <DeliveriesTab
                            deliveries={deliveries}
                            filter={deliveryFilter}
                            onFilter={f => { setDeliveryFilter(f); loadDeliveries(f); }}
                            onResolve={resolveDelivery}
                            t={t}
                        />
                    )}

                    {tab === 'segments' && (
                    <section className="bg-[#1B1C1D] rounded-xl border border-[#374151] overflow-hidden">
                        <div className="px-5 py-4 border-b border-[#374151] flex items-center justify-between">
                            <h2 className="font-bold text-[#f8fafc]">{t('wheel.segments.title')}</h2>
                            <button
                                onClick={() => setSegments(prev => [...prev, emptySegment(prev.length)])}
                                disabled={!!(limits && limits.maxSegments >= 0 && segments.length >= limits.maxSegments)}
                                title={limits && limits.maxSegments >= 0 && segments.length >= limits.maxSegments
                                    ? t('wheel.quota.segmentsReached', { max: limits.maxSegments })
                                    : undefined}
                                className="px-3 py-1.5 text-sm bg-[#262626] hover:bg-[#333] disabled:opacity-40 border border-[#374151] text-[#f8fafc] rounded-lg flex items-center gap-1.5 font-medium transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                {t('wheel.segments.add')}
                            </button>
                        </div>

                        <div className="divide-y divide-[#374151]">
                            {segments.map((seg, i) => (
                                <SegmentRow
                                    key={`${seg.id}-${i}`}
                                    segment={seg}
                                    percentage={percentages[i]}
                                    onChange={changes => patch(i, changes)}
                                    onRemove={() => setSegments(prev => prev.filter((_, j) => j !== i))}
                                    onMoveUp={() => move(i, -1)}
                                    onMoveDown={() => move(i, 1)}
                                    wheels={wheels}
                                    soundAlerts={soundAlerts}
                                    t={t}
                                />
                            ))}
                        </div>

                        {segments.length < 2 && (
                            <p className="px-5 py-4 text-sm text-[#94a3b8]">{t('wheel.segments.needTwo')}</p>
                        )}
                    </section>
                    )}
                  </div>

                    <aside className="space-y-4 min-w-0 lg:sticky lg:top-4 xl:top-8">
                        {/* El nombre de la rueda. Hasta ahora se creaba con un nombre por
                            defecto y no habia forma de cambiarlo: con varias ruedas por
                            canal, el selector de arriba mostraba varias "Mi rueda". */}
                        <div className="bg-[#1B1C1D] rounded-xl border border-[#374151] p-4 space-y-2">
                            <h3 className="font-bold text-[#f8fafc] text-sm">{t('wheel.nameTitle')}</h3>
                            <input
                                type="text"
                                maxLength={80}
                                value={wheel.name}
                                onChange={e => setWheel({ ...wheel, name: e.target.value })}
                                onBlur={async e => {
                                    const nombre = e.target.value.trim();
                                    if (!nombre || nombre === wheels.find(w => w.id === wheel.id)?.name) return;
                                    await saveWheelFields({ name: nombre });
                                    setWheels(prev => prev.map(w => (w.id === wheel.id ? { ...w, name: nombre } : w)));
                                }}
                                className={`${FIELD} w-full`}
                            />
                            {/* El slug NO sigue al nombre a proposito: es la URL que el
                                streamer ya pego en su escena de OBS, y cambiarla sola le
                                romperia el overlay sin avisar. */}
                            <p className="text-xs text-[#64748b]">{t('wheel.nameHelp')}</p>

                            {/* Encendido/apagado. Es lo que consume el cupo del tier, asi
                                que sin este control el streamer no podria gestionar sus
                                ruedas: no tendria como apagar una para encender otra. */}
                            <div className="flex items-center justify-between pt-2 border-t border-[#374151]">
                                <div>
                                    <p className="text-sm font-medium text-[#f8fafc]">{t('wheel.enabled')}</p>
                                    <p className="text-xs text-[#64748b]">{t('wheel.enabledHelp')}</p>
                                </div>
                                <Toggle
                                    on={wheel.isEnabled}
                                    onChange={async v => {
                                        setWheel({ ...wheel, isEnabled: v });
                                        await saveWheelFields({ isEnabled: v });
                                        setWheels(prev => prev.map(w => (w.id === wheel.id ? { ...w, isEnabled: v } : w)));
                                    }}
                                />
                            </div>

                            <div className="pt-2 border-t border-[#374151]">
                                {confirmDelete ? (
                                    <div className="space-y-2">
                                        <p className="text-xs text-red-300">{t('wheel.deleteConfirm', { name: wheel.name })}</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={deleteWheel}
                                                disabled={saving}
                                                className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-sm font-bold transition-colors"
                                            >
                                                {t('wheel.deleteYes')}
                                            </button>
                                            <button
                                                onClick={() => setConfirmDelete(false)}
                                                className="flex-1 px-3 py-2 bg-[#262626] border border-[#374151] text-[#f8fafc] rounded-lg text-sm font-medium hover:bg-[#333] transition-colors"
                                            >
                                                {t('wheel.deleteNo')}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                    <button
                                        onClick={duplicateWheel}
                                        disabled={saving}
                                        className="w-full px-3 py-2 mb-1 text-sm bg-[#262626] hover:bg-[#333] disabled:opacity-50 border border-[#374151] text-[#f8fafc] rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <CopyPlus className="w-4 h-4" />
                                        {t('wheel.duplicate')}
                                    </button>
                                    <button
                                        onClick={() => setConfirmDelete(true)}
                                        className="w-full px-3 py-2 text-sm text-[#64748b] hover:text-red-400 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        {t('wheel.delete')}
                                    </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <WheelPreview segments={segments} visual={visual} celebNonce={celebNonce} t={t} />

                        <div className="bg-[#1B1C1D] rounded-xl border border-[#374151] p-4 space-y-2">
                            <h3 className="font-bold text-[#f8fafc] text-sm">{t('wheel.overlayUrl.title')}</h3>
                            <p className="text-xs text-[#94a3b8]">{t('wheel.overlayUrl.help')}</p>
                            {/* El slug se edita ACA, junto a la URL que forma, y no en
                                el bloque del nombre: cambiarlo rompe la escena de OBS
                                que el streamer ya guardo, asi que tiene que ver la URL
                                mientras lo toca. */}
                            <div className="flex items-center gap-2 pb-1">
                                <span className="text-xs text-[#64748b] shrink-0">{t('wheel.slugLabel')}</span>
                                <input
                                    defaultValue={wheel.slug}
                                    key={wheel.slug}
                                    onBlur={e => changeSlug(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                    className={`${FIELD} flex-1 text-xs`}
                                />
                            </div>
                            <p className="text-xs text-amber-300/80">{t('wheel.slugWarning')}</p>

                            <div className="flex items-center gap-2">
                                <code className="flex-1 px-3 py-2 bg-[#262626] border border-[#374151] rounded-lg text-xs text-[#cbd5e1] truncate">
                                    {overlayUrl}
                                </code>
                                <button
                                    onClick={copyUrl}
                                    className="p-2 bg-[#262626] hover:bg-[#333] border border-[#374151] rounded-lg transition-colors"
                                    aria-label={t('wheel.overlayUrl.copy')}
                                >
                                    {copied
                                        ? <Check className="w-4 h-4 text-green-400" />
                                        : <Copy className="w-4 h-4 text-[#94a3b8]" />}
                                </button>
                            </div>

                            {/* Solo cuando hay lienzo. Con el reparto automatico la
                                rueda se acomoda a cualquier tamano de fuente y decirlo
                                seria pedirle al streamer que arregle algo que no pasa;
                                con coordenadas fijas, es la unica forma de que se entere
                                antes de verlo corrido en un directo. */}
                            {visual.layout && (
                                <p className="text-xs text-amber-300/80">
                                    {t('wheel.canvas.obsSize', { width: CANVAS_WIDTH, height: CANVAS_HEIGHT })}
                                </p>
                            )}
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}

// --------------------------------------------------------------------
// Piezas
// --------------------------------------------------------------------

const CARD = 'bg-[#1B1C1D] rounded-xl border border-[#374151]';

/// Alto maximo del preview de la columna derecha. Se aplica como tope del ANCHO
/// (`alto x proporcion`) para que la forma la siga decidiendo la presentacion.
const ALTO_PREVIEW = 340;
const FIELD = 'px-3 py-2 bg-[#262626] border border-[#374151] rounded-lg text-[#f8fafc] text-sm focus:outline-none focus:border-blue-500';

function Row({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
    return (
        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-[#374151] last:border-0">
            <div className="min-w-0">
                <p className="text-sm font-medium text-[#f8fafc]">{label}</p>
                {help && <p className="text-xs text-[#94a3b8] mt-0.5 max-w-md">{help}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">{children}</div>
        </div>
    );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
    // La bolita necesita `left-0.5` explicito: sin el arrancaba donde el navegador
    // decidiera (con el padding por defecto del <button> encima) y al desplazarse se
    // salia de la pildora. Por lo mismo el boton lleva p-0 y shrink-0.
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => onChange(!on)}
            className={`relative w-11 h-6 p-0 shrink-0 rounded-full transition-colors ${on ? 'bg-blue-600' : 'bg-[#374151]'}`}
        >
            <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    on ? 'translate-x-5' : 'translate-x-0'
                }`}
            />
        </button>
    );
}

/**
 * De dónde salen los créditos y cuánto vale cada aporte.
 *
 * La tasa se edita como fracción y no como decimal porque así se guarda: "1 sub =
 * 500 fichas" y "100 bits = 1 ficha" son la misma estructura y no hay redondeo que
 * discuta con el saldo del espectador.
 */
function CreditsTab({ wheel, sources, rewards, rewardsError, onWheel, onSource, onSourceAt, onAddReward, onRemoveAt, t }: {
    wheel: WheelSummary;
    sources: Source[];
    rewards: ChannelReward[];
    rewardsError: boolean;
    onWheel: (c: Partial<WheelSummary>) => void;
    onSource: (name: string, c: Partial<Source>) => void;
    onSourceAt: (index: number, c: Partial<Source>) => void;
    onAddReward: () => void;
    onRemoveAt: (index: number) => void;
    t: any;
}) {
    return (
        <div className="space-y-4">
            <section className={CARD}>
                <h2 className="px-5 py-4 border-b border-[#374151] font-bold text-[#f8fafc]">{t('wheel.credits.title')}</h2>

                <Row label={t('wheel.credits.label')} help={t('wheel.credits.labelHelp')}>
                    <input
                        type="text"
                        value={wheel.creditLabel ?? ''}
                        onChange={e => onWheel({ creditLabel: e.target.value })}
                        className={`${FIELD} w-40`}
                    />
                </Row>

                <Row label={t('wheel.credits.price')} help={t('wheel.credits.priceHelp')}>
                    <input
                        type="number"
                        min={1}
                        value={wheel.spinPrice ?? 100}
                        onChange={e => onWheel({ spinPrice: Number(e.target.value) })}
                        className={`${FIELD} w-28`}
                    />
                </Row>

                <Row label={t('wheel.credits.accumulable')} help={t('wheel.credits.accumulableHelp')}>
                    <Toggle on={!!wheel.isAccumulable} onChange={v => onWheel({ isAccumulable: v })} />
                </Row>

                {!wheel.isAccumulable && (
                    <Row label={t('wheel.credits.overflow')} help={t('wheel.credits.overflowHelp')}>
                        <select
                            value={wheel.overflowPolicy ?? 'discard'}
                            onChange={e => onWheel({ overflowPolicy: e.target.value })}
                            className={FIELD}
                        >
                            <option value="discard">{t('wheel.credits.overflowDiscard')}</option>
                            <option value="cheapest_spins">{t('wheel.credits.overflowKeep')}</option>
                        </select>
                    </Row>
                )}

                {/* "viewer_choice" no esta en la lista a proposito: la columna y el
                    modelo lo aceptan, pero el flujo de que el espectador elija cuanto
                    gastar no existe todavia y el servicio lo trata como most_spins.
                    Vuelve al selector cuando se construya de verdad. */}
                <Row label={t('wheel.credits.multiFit')} help={t('wheel.credits.multiFitHelp')}>
                    <select
                        value={wheel.multiFitPolicy === 'most_expensive' ? 'most_expensive' : 'most_spins'}
                        onChange={e => onWheel({ multiFitPolicy: e.target.value })}
                        className={FIELD}
                    >
                        <option value="most_spins">{t('wheel.credits.multiMost')}</option>
                        <option value="most_expensive">{t('wheel.credits.multiExpensive')}</option>
                        <option value="viewer_choice">{t('wheel.credits.multiChoice')}</option>
                    </select>
                </Row>

                <Row label={t('wheel.credits.expiry')} help={t('wheel.credits.expiryHelp')}>
                    <select
                        value={wheel.creditExpiry ?? 'never'}
                        onChange={e => onWheel({ creditExpiry: e.target.value })}
                        className={FIELD}
                    >
                        <option value="never">{t('wheel.credits.expiryNever')}</option>
                        <option value="stream_end">{t('wheel.credits.expiryStream')}</option>
                    </select>
                </Row>
            </section>

            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151]">
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.sources.title')}</h2>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.sources.help')}</p>
                </div>

                {sources.map((src, i) => src.source === 'channel_points' ? null : (
                    <div key={src.source} className={`px-5 py-4 border-b border-[#374151] ${src.isEnabled ? '' : 'opacity-60'}`}>
                        <div className="flex flex-wrap items-center gap-3">
                            <Toggle on={src.isEnabled} onChange={v => onSource(src.source, { isEnabled: v })} />
                            <span className="font-medium text-[#f8fafc] w-36">{t(`wheel.sources.${src.source}`)}</span>

                            <span className="text-xs text-[#94a3b8]">{t('wheel.sources.forEvery')}</span>
                            <input
                                type="number" min={1}
                                value={src.rateDenominator}
                                onChange={e => onSource(src.source, { rateDenominator: Math.max(1, Number(e.target.value)) })}
                                className={`${FIELD} w-20`}
                                aria-label={t('wheel.sources.perUnits')}
                            />
                            <span className="text-xs text-[#94a3b8]">{t(`wheel.sources.unit_${src.source}`)}</span>
                            <ArrowRight className="w-4 h-4 text-[#64748b]" />
                            <input
                                type="number" min={1}
                                value={src.rateNumerator}
                                onChange={e => onSource(src.source, { rateNumerator: Math.max(1, Number(e.target.value)) })}
                                className={`${FIELD} w-24`}
                                aria-label={t('wheel.sources.credits')}
                            />
                            <span className="text-xs text-[#94a3b8]">{wheel.creditLabel}</span>

                            <label className="flex items-center gap-2 text-xs text-[#94a3b8] ml-auto">
                                {t('wheel.sources.cap')}
                                <input
                                    type="number" min={1}
                                    value={src.capPerEvent ?? ''}
                                    placeholder={t('wheel.sources.noCap')}
                                    onChange={e => onSource(src.source, { capPerEvent: e.target.value ? Number(e.target.value) : null })}
                                    className={`${FIELD} w-28`}
                                />
                            </label>
                        </div>

                        {/* Solo los subs de regalo: es la unica fuente por la que
                            Twitch manda el tier. Por el chat no llega — el badge de
                            sub trae los meses, no el tier. */}
                        {src.source === 'gift_sub' && (
                            <div className="px-5 pb-4 flex flex-wrap items-center gap-3">
                                <span className="text-xs text-[#94a3b8]">{t('wheel.sources.tierMultiplier')}</span>
                                <label className="flex items-center gap-1.5 text-xs text-[#94a3b8]">
                                    {t('wheel.sources.tier2')}
                                    <input
                                        type="number" min={1} max={10} step={0.25}
                                        value={src.tier2Multiplier}
                                        onChange={e => onSource(src.source, { tier2Multiplier: Number(e.target.value) || 1 })}
                                        className={`${FIELD} w-20`}
                                    />
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-[#94a3b8]">
                                    {t('wheel.sources.tier3')}
                                    <input
                                        type="number" min={1} max={10} step={0.25}
                                        value={src.tier3Multiplier}
                                        onChange={e => onSource(src.source, { tier3Multiplier: Number(e.target.value) || 1 })}
                                        className={`${FIELD} w-20`}
                                    />
                                </label>
                                <span className="text-xs text-[#64748b]">{t('wheel.sources.tierHelp')}</span>
                            </div>
                        )}
                    </div>
                ))}
            </section>

            {/* Los puntos de canal van aparte: no es una tasa, es una lista de
                recompensas, y cada una da lo suyo. Un canje es un evento, no una
                cantidad, asi que "por cada N" no significa nada aca. */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151] flex items-center justify-between gap-4">
                    <div>
                        <h2 className="font-bold text-[#f8fafc]">{t('wheel.rewards.title')}</h2>
                        <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.rewards.help')}</p>
                    </div>
                    <button
                        onClick={onAddReward}
                        className="px-3 py-1.5 text-sm bg-[#262626] hover:bg-[#333] border border-[#374151] text-[#f8fafc] rounded-lg flex items-center gap-1.5 font-medium transition-colors flex-shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                        {t('wheel.rewards.add')}
                    </button>
                </div>

                {rewardsError && (
                    <p className="px-5 py-4 text-sm text-amber-300 bg-amber-500/10">{t('wheel.rewards.loadFailed')}</p>
                )}

                {sources.filter(s2 => s2.source === 'channel_points').length === 0 ? (
                    <p className="px-5 py-6 text-sm text-[#94a3b8]">{t('wheel.rewards.empty')}</p>
                ) : sources.map((src, i) => src.source !== 'channel_points' ? null : (
                    <div key={`cp-${i}`} className={`px-5 py-4 border-b border-[#374151] last:border-0 flex flex-wrap items-center gap-3 ${src.isEnabled ? '' : 'opacity-60'}`}>
                        <Toggle on={src.isEnabled} onChange={v => onSourceAt(i, { isEnabled: v })} />

                        <select
                            value={src.channelPointsRewardId ?? ''}
                            onChange={e => {
                                const r = rewards.find(x => x.id === e.target.value);
                                onSourceAt(i, {
                                    channelPointsRewardId: e.target.value || null,
                                    channelPointsRewardTitle: r?.title ?? null,
                                });
                            }}
                            className={`${FIELD} flex-1 min-w-[220px]`}
                        >
                            <option value="">{t('wheel.rewards.choose')}</option>
                            {rewards.map(r => (
                                <option key={r.id} value={r.id}>{r.title} — {r.cost}</option>
                            ))}
                            {/* Una recompensa borrada del canal seguiria guardada acá; se
                                muestra igual para que se vea por que esa fila no dispara. */}
                            {src.channelPointsRewardId && !rewards.some(r => r.id === src.channelPointsRewardId) && (
                                <option value={src.channelPointsRewardId}>
                                    {src.channelPointsRewardTitle || src.channelPointsRewardId} {t('wheel.rewards.missing')}
                                </option>
                            )}
                        </select>

                        <ArrowRight className="w-4 h-4 text-[#64748b]" />
                        <input
                            type="number" min={1}
                            value={src.rateNumerator}
                            onChange={e => onSourceAt(i, { rateNumerator: Math.max(1, Number(e.target.value)) })}
                            className={`${FIELD} w-28`}
                            aria-label={t('wheel.sources.credits')}
                        />
                        <span className="text-xs text-[#94a3b8]">{wheel.creditLabel}</span>

                        <button
                            onClick={() => onRemoveAt(i)}
                            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors ml-auto"
                            aria-label={t('wheel.rewards.remove')}
                        >
                            <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                    </div>
                ))}
            </section>
        </div>
    );
}

/**
 * Los textos que la Rueda escribe en el chat.
 *
 * Cada campo arranca vacio con la base de Decatron como marcador: asi se ve que va a
 * decir el bot sin haber escrito nada, y borrar el campo es como se restaura. No hay
 * forma de dejar al bot mudo por accidente.
 */
function MessagesTab({ pack, lang, onChange, t }: {
    pack: MessagePack;
    lang: 'es' | 'en';
    onChange: (key: string, lang: 'es' | 'en', value: string) => void;
    t: any;
}) {
    const claves = Object.keys(pack.defaults);

    return (
        <div className="space-y-4">
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151] flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="font-bold text-[#f8fafc]">{t('wheel.messages.title')}</h2>
                        <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.messages.help')}</p>
                    </div>
                    {/* Se dice en que idioma se esta editando, pero no se deja cambiar
                        aca: eso vive en Configuracion, que es el unico sitio donde el
                        idioma de la cuenta se decide. */}
                    <p className="text-xs text-[#94a3b8]">
                        {t('wheel.messages.editingIn', { lang: lang.toUpperCase() })}
                    </p>
                </div>

                {claves.map(key => {
                    const propio = pack.messages[key]?.[lang] ?? '';
                    const base = pack.defaults[key][lang];
                    const vars = pack.placeholders[key] ?? [];
                    const usadas = new Set([...propio.matchAll(/\{(\w+)\}/g)].map(m => m[1]));
                    const desconocidas = [...usadas].filter(v => !vars.includes(v));

                    return (
                        <div key={key} className="px-5 py-4 border-b border-[#374151] last:border-0">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <p className="text-sm font-medium text-[#f8fafc]">{t(`wheel.messages.keys.${key}`)}</p>
                                {propio && (
                                    <button
                                        onClick={() => onChange(key, lang, '')}
                                        className="text-xs text-[#94a3b8] hover:text-[#f8fafc] flex items-center gap-1"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        {t('wheel.messages.reset')}
                                    </button>
                                )}
                            </div>

                            <textarea
                                rows={2}
                                value={propio}
                                placeholder={base}
                                onChange={e => onChange(key, lang, e.target.value)}
                                className={`${FIELD} w-full resize-y`}
                            />

                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                {vars.map(v => (
                                    <button
                                        key={v}
                                        onClick={() => onChange(key, lang, `${propio || base}{${v}}`)}
                                        title={t('wheel.messages.insert')}
                                        className="px-2 py-0.5 rounded bg-[#262626] border border-[#374151] text-xs font-mono text-[#94a3b8] hover:text-[#E8B455] hover:border-[#E8B455]/40 transition-colors"
                                    >
                                        {'{' + v + '}'}
                                    </button>
                                ))}
                            </div>

                            {desconocidas.length > 0 && (
                                <p className="text-xs text-amber-300 mt-2">
                                    {t('wheel.messages.unknownVars', { vars: desconocidas.map(v => `{${v}}`).join(' ') })}
                                </p>
                            )}
                        </div>
                    );
                })}
            </section>
        </div>
    );
}

/**
 * Vista de pruebas: dispara un aporte real contra la rueda.
 *
 * No es un ensayo. El backend corre la MISMA función que el handler de EventSub, así
 * que esto acredita de verdad, gasta de verdad y gira de verdad en el overlay. Es lo
 * unico que sirve para responder "¿funciona si me donan bits?" sin esperar a que
 * alguien done.
 */
function TestTab({ wheel, sources, rewards, onSimulate, t }: {
    wheel: WheelSummary;
    sources: Source[];
    rewards: ChannelReward[];
    onSimulate: (source: string, amount: number, viewer: string, rewardId?: string | null) => Promise<SimResult | null>;
    t: any;
}) {
    const [source, setSource] = useState('bits');
    const [amount, setAmount] = useState(100);
    const [viewer, setViewer] = useState('');
    const [rewardId, setRewardId] = useState('');
    const [running, setRunning] = useState(false);
    const [log, setLog] = useState<Array<SimResult & { source: string; amount: number; at: string }>>([]);

    const configuradas = sources.filter(s2 => s2.isEnabled);
    const fuenteActiva = source === 'channel_points'
        ? configuradas.some(s2 => s2.source === 'channel_points' && s2.channelPointsRewardId === rewardId)
        : configuradas.some(s2 => s2.source === source);

    const run = async () => {
        setRunning(true);
        const r = await onSimulate(source, source === 'channel_points' ? 1 : amount, viewer, rewardId);
        if (r) setLog(prev => [{ ...r, source, amount, at: new Date().toLocaleTimeString() }, ...prev].slice(0, 8));
        setRunning(false);
    };

    return (
        <div className="space-y-4">
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151]">
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.test.title')}</h2>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.test.help')}</p>
                </div>

                <div className="px-5 py-5 space-y-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs text-[#94a3b8]">{t('wheel.test.source')}</span>
                            <select value={source} onChange={e => setSource(e.target.value)} className={`${FIELD} w-48`}>
                                <option value="bits">{t('wheel.sources.bits')}</option>
                                <option value="gift_sub">{t('wheel.sources.gift_sub')}</option>
                                <option value="donation">{t('wheel.sources.donation')}</option>
                                <option value="channel_points">{t('wheel.sources.channel_points')}</option>
                            </select>
                        </label>

                        {source === 'channel_points' ? (
                            <label className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
                                <span className="text-xs text-[#94a3b8]">{t('wheel.test.reward')}</span>
                                <select value={rewardId} onChange={e => setRewardId(e.target.value)} className={FIELD}>
                                    <option value="">{t('wheel.rewards.choose')}</option>
                                    {rewards.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                                </select>
                            </label>
                        ) : (
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs text-[#94a3b8]">{t(`wheel.test.amount_${source}`)}</span>
                                <input
                                    type="number" min={1} value={amount}
                                    onChange={e => setAmount(Math.max(1, Number(e.target.value)))}
                                    className={`${FIELD} w-32`}
                                />
                            </label>
                        )}

                        <label className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
                            <span className="text-xs text-[#94a3b8]">{t('wheel.test.viewer')}</span>
                            <input
                                type="text" value={viewer}
                                onChange={e => setViewer(e.target.value)}
                                placeholder={t('wheel.test.viewerPlaceholder')}
                                className={FIELD}
                            />
                        </label>

                        <button
                            onClick={run}
                            disabled={running || (source === 'channel_points' && !rewardId)}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-bold flex items-center gap-2 transition-colors"
                        >
                            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                            {t('wheel.test.run')}
                        </button>
                    </div>

                    {!fuenteActiva && (
                        <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
                            {t('wheel.test.sourceOff')}
                        </p>
                    )}

                    <p className="text-xs text-[#94a3b8]">{t('wheel.test.warning')}</p>
                </div>
            </section>

            {log.length > 0 && (
                <section className={CARD}>
                    <h2 className="px-5 py-4 border-b border-[#374151] font-bold text-[#f8fafc]">{t('wheel.test.results')}</h2>
                    {log.map((r, i) => (
                        <div key={i} className="px-5 py-4 border-b border-[#374151] last:border-0">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <span className="text-sm font-medium text-[#f8fafc]">
                                    {t(`wheel.sources.${r.source}`)} · {r.viewer}
                                </span>
                                <span className="text-xs text-[#64748b] tabular-nums">{r.at}</span>
                            </div>

                            {!r.credited ? (
                                <p className="text-sm text-amber-300">{t('wheel.test.notCredited')}</p>
                            ) : (
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                                    <span className="text-[#94a3b8]">
                                        {t('wheel.test.credited')}{' '}
                                        <strong className="text-[#E8B455] tabular-nums">+{r.creditsAdded}</strong>
                                    </span>
                                    <span className="text-[#94a3b8] tabular-nums">
                                        {r.balanceBefore} <ArrowRight className="w-3 h-3 inline text-[#64748b]" /> {r.balanceAfter}
                                    </span>
                                    <span className="text-[#94a3b8]">
                                        {t('wheel.test.spinsOwed', { count: r.spinsOwed })}
                                    </span>
                                    {r.spun
                                        ? <span className="text-green-400 font-medium">{t('wheel.test.spun', { label: r.spinLabel })}</span>
                                        : <span className="text-[#64748b]">{t('wheel.test.notSpun')}</span>}
                                </div>
                            )}
                        </div>
                    ))}
                </section>
            )}
        </div>
    );
}

/** Cómo se dispara el giro y qué frenos tiene. */
function LimitsTab({ wheel, onWheel, t }: {
    wheel: WheelSummary;
    onWheel: (c: Partial<WheelSummary>) => void;
    t: any;
}) {
    return (
        <div className="space-y-4">
            <section className={CARD}>
                <h2 className="px-5 py-4 border-b border-[#374151] font-bold text-[#f8fafc]">{t('wheel.triggers.title')}</h2>

                <Row label={t('wheel.triggers.commands')} help={t('wheel.triggers.commandsHelp')}>
                    <Toggle on={wheel.commandEnabled !== false} onChange={v => onWheel({ commandEnabled: v })} />
                </Row>

                {wheel.commandEnabled !== false && (
                    <>
                        <Row label={t('wheel.triggers.spinCommand')}>
                            <input
                                type="text"
                                value={wheel.spinCommand ?? '!dgirar'}
                                onChange={e => onWheel({ spinCommand: e.target.value })}
                                className={`${FIELD} w-40 font-mono`}
                            />
                        </Row>
                        <Row label={t('wheel.triggers.balanceCommand')}>
                            <input
                                type="text"
                                value={wheel.balanceCommand ?? '!dcreditos'}
                                onChange={e => onWheel({ balanceCommand: e.target.value })}
                                className={`${FIELD} w-40 font-mono`}
                            />
                        </Row>

                        {/* El de compra solo hace algo si la fuente deca_coins esta
                            encendida; el interruptor de la fuente es el que manda y
                            por eso este comando no tiene el suyo. */}
                        <Row label={t('wheel.triggers.buyCommand')} help={t('wheel.triggers.buyCommandHelp')}>
                            <input
                                value={wheel.buyCommand ?? '!dcomprar'}
                                onChange={e => onWheel({ buyCommand: e.target.value })}
                                className={`${FIELD} w-40 font-mono`}
                            />
                        </Row>
                    </>
                )}

                <Row label={t('wheel.triggers.autoSpin')} help={t('wheel.triggers.autoSpinHelp')}>
                    <Toggle on={!!wheel.autoSpin} onChange={v => onWheel({ autoSpin: v })} />
                </Row>
            </section>

            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151]">
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.limits.title')}</h2>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.limits.help')}</p>
                </div>

                <Row label={t('wheel.limits.cooldown')} help={t('wheel.limits.cooldownHelp')}>
                    <input
                        type="number" min={0}
                        value={wheel.spinCooldownSeconds ?? 0}
                        onChange={e => onWheel({ spinCooldownSeconds: Number(e.target.value) })}
                        className={`${FIELD} w-24`}
                    />
                    <span className="text-xs text-[#94a3b8]">{t('wheel.limits.seconds')}</span>
                </Row>

                <Row label={t('wheel.limits.maxPerStream')} help={t('wheel.limits.maxPerStreamHelp')}>
                    <input
                        type="number" min={1}
                        value={wheel.maxSpinsPerStream ?? ''}
                        placeholder={t('wheel.limits.noLimit')}
                        onChange={e => onWheel({ maxSpinsPerStream: e.target.value ? Number(e.target.value) : null })}
                        className={`${FIELD} w-28`}
                    />
                </Row>

                <Row label={t('wheel.limits.maxCoins')} help={t('wheel.limits.maxCoinsHelp')}>
                    <input
                        type="number" min={1}
                        value={wheel.maxCoinsPerHour ?? ''}
                        placeholder={t('wheel.limits.noLimit')}
                        onChange={e => onWheel({ maxCoinsPerHour: e.target.value ? Number(e.target.value) : null })}
                        className={`${FIELD} w-28`}
                    />
                </Row>
            </section>

            {/* --- reglas del sorteo (Fase 7) --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151]">
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.rules.title')}</h2>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.rules.help')}</p>
                </div>

                <Row label={t('wheel.rules.noRepeat')} help={t('wheel.rules.noRepeatHelp')}>
                    <select
                        value={wheel.noRepeatScope ?? 'off'}
                        onChange={e => onWheel({ noRepeatScope: e.target.value })}
                        className={FIELD}
                    >
                        <option value="off">{t('wheel.rules.noRepeatOff')}</option>
                        <option value="per_viewer">{t('wheel.rules.noRepeatViewer')}</option>
                        <option value="global">{t('wheel.rules.noRepeatGlobal')}</option>
                    </select>
                </Row>

                <Row label={t('wheel.rules.pity')} help={t('wheel.rules.pityHelp')}>
                    <Toggle on={!!wheel.pityEnabled} onChange={v => onWheel({ pityEnabled: v })} />
                    {wheel.pityEnabled && (
                        <>
                            <span className="text-xs text-[#94a3b8] mx-3">{t('wheel.rules.pityAfter')}</span>
                            <input
                                type="number" min={1} max={100}
                                value={wheel.pityThreshold ?? ''}
                                placeholder="10"
                                onChange={e => onWheel({ pityThreshold: e.target.value ? Number(e.target.value) : null })}
                                className={`${FIELD} w-20`}
                            />
                        </>
                    )}
                </Row>

                <Row label={t('wheel.rules.multi')} help={t('wheel.rules.multiHelp')}>
                    <Toggle on={!!wheel.allowMultiSpin} onChange={v => onWheel({ allowMultiSpin: v })} />
                    {wheel.allowMultiSpin && (
                        <>
                            <span className="text-xs text-[#94a3b8] mx-3">{t('wheel.rules.multiMax')}</span>
                            <input
                                type="number" min={1} max={100}
                                value={wheel.maxMultiSpin ?? 10}
                                onChange={e => onWheel({ maxMultiSpin: Number(e.target.value) || 1 })}
                                className={`${FIELD} w-20`}
                            />
                        </>
                    )}
                </Row>

                {wheel.allowMultiSpin && (
                    <p className="px-5 pb-4 text-xs text-[#64748b]">
                        {t('wheel.rules.multiNote', { command: wheel.spinCommand || '!dgirar' })}
                    </p>
                )}
            </section>
        </div>
    );
}

function EmptyState({ onCreate, saving, t }: {
    onCreate: (mode: 'prizes' | 'raffle') => void;
    saving: boolean;
    t: any;
}) {
    return (
        <div className="bg-[#1B1C1D] rounded-xl border border-[#374151] px-8 py-14 text-center">
            <CircleDot className="w-12 h-12 text-[#E8B455] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#f8fafc]">{t('wheel.empty.title')}</h2>
            <p className="text-sm text-[#94a3b8] mt-2 max-w-md mx-auto">{t('wheel.empty.body')}</p>

            {/* El modo Sorteo esta construido (servicio, comandos, endpoints y pestana)
                pero NO se ofrece: el usuario decidio que no lo quiere por ahora. Para
                volver a exponerlo alcanza con dar a elegir el modo aca y en la cabecera;
                no hay nada mas que rehacer. */}
            <button
                onClick={() => onCreate('prizes')}
                disabled={saving}
                className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-bold inline-flex items-center gap-2 transition-colors"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t('wheel.empty.create')}
            </button>
        </div>
    );
}

/// Los parametros con los que arranca cada tipo de premio. Un premio recien
/// elegido tiene que ser valido sin que el streamer toque nada mas: un gajo
/// guardado a medias es un premio que no se entrega.
function defaultPrizeParams(tipo: PrizeType): Record<string, unknown> {
    switch (tipo) {
        case 'coins':          return { amount: 100 };
        case 'free_spin':      return { count: 1 };
        case 'gacha_pull':     return { count: 1, pull_type: 'coins' };
        case 'timer_time':     return { seconds: 60 };
        case 'timeout':        return { target: 'spinner', seconds: 30 };
        case 'sound_alert':    return { sound_alert_id: 0 };
        case 'manual_message': return { template: '' };
        default:               return {};
    }
}

const PARAM_FIELD = 'px-2 py-2 bg-[#262626] border border-[#374151] rounded-lg text-[#f8fafc] text-sm focus:outline-none focus:border-blue-500';

/// Los parametros del premio del gajo, uno por tipo. Van en la misma fila que el
/// selector: el streamer ve el premio entero de un vistazo sin abrir nada.
function PrizeParams({ prize, onChange, wheels, soundAlerts, t }: {
    prize: Prize;
    onChange: (params: Record<string, unknown>) => void;
    wheels: WheelSummary[];
    soundAlerts: SoundAlertOption[];
    t: any;
}) {
    const p = prize.params;
    const set = (cambios: Record<string, unknown>) => onChange({ ...p, ...cambios });

    switch (prize.type) {
        case 'coins':
            return (
                <input
                    type="number" min={1}
                    value={Number(p.amount ?? 100)}
                    onChange={e => set({ amount: Number(e.target.value) })}
                    className={`w-24 ${PARAM_FIELD}`}
                    aria-label={t('wheel.prizes.coinsAmount')}
                />
            );

        case 'free_spin':
            return (
                <>
                    <input
                        type="number" min={1} max={20}
                        value={Number(p.count ?? 1)}
                        onChange={e => set({ count: Number(e.target.value) })}
                        className={`w-20 ${PARAM_FIELD}`}
                        aria-label={t('wheel.prizes.spinCount')}
                    />
                    {/* Regalar giros de OTRA rueda del canal solo tiene sentido si hay
                        mas de una; con una sola el selector seria una linea muerta. */}
                    {wheels.length > 1 && (
                        <select
                            value={Number(p.wheel_id ?? 0)}
                            onChange={e => set({ wheel_id: Number(e.target.value) })}
                            className={PARAM_FIELD}
                            aria-label={t('wheel.prizes.spinWheel')}
                        >
                            <option value={0}>{t('wheel.prizes.spinSameWheel')}</option>
                            {wheels.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    )}
                </>
            );

        case 'gacha_pull':
            return (
                <>
                    <input
                        type="number" min={1} max={20}
                        value={Number(p.count ?? 1)}
                        onChange={e => set({ count: Number(e.target.value) })}
                        className={`w-20 ${PARAM_FIELD}`}
                        aria-label={t('wheel.prizes.pullCount')}
                    />
                    <select
                        value={String(p.pull_type ?? 'coins')}
                        onChange={e => set({ pull_type: e.target.value })}
                        className={PARAM_FIELD}
                        aria-label={t('wheel.prizes.pullType')}
                    >
                        <option value="coins">{t('wheel.prizes.pullCoins')}</option>
                        <option value="donation">{t('wheel.prizes.pullDonation')}</option>
                    </select>
                </>
            );

        case 'timer_time':
            return (
                <label className="flex items-center gap-2 text-xs text-[#94a3b8]">
                    <input
                        type="number" min={1}
                        value={Number(p.seconds ?? 60)}
                        onChange={e => set({ seconds: Number(e.target.value) })}
                        className={`w-24 ${PARAM_FIELD}`}
                        aria-label={t('wheel.prizes.seconds')}
                    />
                    {t('wheel.prizes.seconds')}
                </label>
            );

        case 'timeout':
            return (
                <>
                    <select
                        value={String(p.target ?? 'spinner')}
                        onChange={e => set({ target: e.target.value })}
                        className={PARAM_FIELD}
                        aria-label={t('wheel.prizes.timeoutTarget')}
                    >
                        <option value="spinner">{t('wheel.prizes.targetSpinner')}</option>
                        <option value="random_chatter">{t('wheel.prizes.targetRandom')}</option>
                    </select>
                    <label className="flex items-center gap-2 text-xs text-[#94a3b8]">
                        <input
                            type="number" min={1} max={1209600}
                            value={Number(p.seconds ?? 30)}
                            onChange={e => set({ seconds: Number(e.target.value) })}
                            className={`w-24 ${PARAM_FIELD}`}
                            aria-label={t('wheel.prizes.seconds')}
                        />
                        {t('wheel.prizes.seconds')}
                    </label>
                </>
            );

        case 'sound_alert':
            return soundAlerts.length === 0 ? (
                <span className="text-xs text-amber-300">{t('wheel.prizes.noSoundAlerts')}</span>
            ) : (
                <select
                    value={Number(p.sound_alert_id ?? 0)}
                    onChange={e => set({ sound_alert_id: Number(e.target.value) })}
                    className={`flex-1 min-w-[160px] ${PARAM_FIELD}`}
                    aria-label={t('wheel.prizes.soundAlert')}
                >
                    <option value={0}>{t('wheel.prizes.pickSoundAlert')}</option>
                    {soundAlerts.map(a => (
                        <option key={a.id} value={a.id}>
                            {a.title}{a.enabled ? '' : ` — ${t('wheel.prizes.alertOff')}`}
                        </option>
                    ))}
                </select>
            );

        case 'manual_message':
            return (
                <input
                    type="text"
                    value={String(p.template ?? '')}
                    onChange={e => set({ template: e.target.value })}
                    placeholder={t('wheel.prizes.templatePlaceholder')}
                    className={`flex-1 min-w-[160px] ${PARAM_FIELD}`}
                />
            );

        default:
            return null;
    }
}

/// La pestana del modo Sorteo: reglas, ventana de inscripcion, pool y sorteo.
/// Todo en una porque el streamer la opera EN VIVO — abrir, ver entrar gente y
/// sortear son tres cosas seguidas, y repartirlas en pestanas obligaria a navegar
/// mientras el chat espera.
function RaffleTab({
    config, entries, creditLabel, saving,
    onConfig, onWindow, onDraw, onAdd, onRemove, onMultiplier, onReset, t,
}: {
    config: RaffleConfig;
    entries: RaffleEntry[];
    creditLabel: string;
    saving: boolean;
    onConfig: (c: Partial<RaffleConfig>) => void;
    onWindow: (open: boolean) => void;
    onDraw: () => void;
    onAdd: (viewer: string) => void;
    onRemove: (viewer: string) => void;
    onMultiplier: (viewer: string, mult: number) => void;
    onReset: () => void;
    t: any;
}) {
    const [nuevo, setNuevo] = useState('');

    const pool = entries.filter(e => !e.hasWon);
    const ganadores = entries.filter(e => e.hasWon);
    const pesoTotal = pool.reduce((acc, e) => acc + Number(e.weight || 0), 0);

    const fuentes = config.weightSources || {};
    const reqs = config.requirements || {};

    const setFuente = (nombre: string, cambios: Record<string, unknown>) =>
        onConfig({ weightSources: { ...fuentes, [nombre]: { ...(fuentes[nombre] || {}), ...cambios } } });

    const setReq = (nombre: string, valor: unknown) =>
        onConfig({ requirements: { ...reqs, [nombre]: valor } });

    return (
        <div className="space-y-4">
            {/* --- barra de operacion en vivo --- */}
            <section className={CARD}>
                <div className="px-5 py-4 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${config.acceptingEntries ? 'bg-green-400' : 'bg-[#4b5563]'}`} />
                            <h2 className="font-bold text-[#f8fafc]">
                                {config.acceptingEntries ? t('wheel.raffle.open') : t('wheel.raffle.closed')}
                            </h2>
                        </div>
                        <p className="text-xs text-[#94a3b8] mt-0.5">
                            {t('wheel.raffle.poolCount', { count: pool.length })}
                            {config.windowClosesAt && config.acceptingEntries && (
                                <> · {t('wheel.raffle.closesAt', { time: new Date(config.windowClosesAt).toLocaleTimeString() })}</>
                            )}
                        </p>
                    </div>

                    {/* always_open no tiene nada que abrir ni cerrar: la ventana la
                        decide la configuracion, no un boton. */}
                    {config.windowMode !== 'always_open' && (
                        <button
                            onClick={() => onWindow(!config.acceptingEntries)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                                config.acceptingEntries
                                    ? 'bg-[#262626] border border-[#374151] text-[#f8fafc] hover:bg-[#333]'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                        >
                            {config.acceptingEntries ? t('wheel.raffle.close') : t('wheel.raffle.openIt')}
                        </button>
                    )}

                    <button
                        onClick={onDraw}
                        disabled={saving || pool.length < 2}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                        title={pool.length < 2 ? t('wheel.raffle.needTwo') : undefined}
                    >
                        <Trophy className="w-4 h-4" />
                        {t('wheel.raffle.draw')}
                    </button>

                    <button
                        onClick={onReset}
                        className="px-3 py-2 text-sm text-[#94a3b8] hover:text-[#f8fafc] transition-colors"
                    >
                        {t('wheel.raffle.reset')}
                    </button>
                </div>
            </section>

            {/* --- reglas --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151]">
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.raffle.rulesTitle')}</h2>
                </div>

                <Row label={t('wheel.raffle.entryCommand')} help={t('wheel.raffle.entryCommandHelp')}>
                    <input
                        type="text"
                        value={config.entryCommand}
                        onChange={e => onConfig({ entryCommand: e.target.value })}
                        className={`${FIELD} w-40`}
                    />
                </Row>

                <Row label={t('wheel.raffle.windowMode')} help={t('wheel.raffle.windowModeHelp')}>
                    <select
                        value={config.windowMode}
                        onChange={e => onConfig({ windowMode: e.target.value as RaffleConfig['windowMode'] })}
                        className={FIELD}
                    >
                        <option value="manual">{t('wheel.raffle.windowManual')}</option>
                        <option value="timed">{t('wheel.raffle.windowTimed')}</option>
                        <option value="always_open">{t('wheel.raffle.windowAlways')}</option>
                    </select>
                </Row>

                {config.windowMode === 'timed' && (
                    <Row label={t('wheel.raffle.windowSeconds')} help={t('wheel.raffle.windowSecondsHelp')}>
                        <input
                            type="number" min={10}
                            value={config.windowSeconds ?? 120}
                            onChange={e => onConfig({ windowSeconds: Number(e.target.value) })}
                            className={`${FIELD} w-28`}
                        />
                    </Row>
                )}

                <Row label={t('wheel.raffle.maxEntries')} help={t('wheel.raffle.maxEntriesHelp')}>
                    <input
                        type="number" min={1} max={100}
                        value={config.maxEntriesPerViewer}
                        onChange={e => onConfig({ maxEntriesPerViewer: Number(e.target.value) })}
                        className={`${FIELD} w-24`}
                    />
                </Row>

                <Row label={t('wheel.raffle.entryCost')} help={t('wheel.raffle.entryCostHelp', { credits: creditLabel })}>
                    <input
                        type="number" min={0}
                        value={config.entryCostCredits}
                        onChange={e => onConfig({ entryCostCredits: Number(e.target.value) })}
                        className={`${FIELD} w-28`}
                    />
                </Row>
            </section>

            {/* --- requisitos --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151]">
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.raffle.reqTitle')}</h2>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.raffle.reqHelp')}</p>
                </div>

                <Row label={t('wheel.raffle.subsOnly')}>
                    <Toggle on={!!reqs.subsOnly} onChange={v => setReq('subsOnly', v)} />
                </Row>

                <Row label={t('wheel.raffle.followersOnly')}>
                    <Toggle on={!!reqs.followersOnly} onChange={v => setReq('followersOnly', v)} />
                </Row>

                <Row label={t('wheel.raffle.minWatchtime')} help={t('wheel.raffle.minWatchtimeHelp')}>
                    <input
                        type="number" min={0}
                        value={Number(reqs.minWatchtimeMinutes ?? 0)}
                        onChange={e => setReq('minWatchtimeMinutes', Number(e.target.value))}
                        className={`${FIELD} w-24`}
                    />
                </Row>
            </section>

            {/* --- pesos --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151]">
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.raffle.weightTitle')}</h2>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.raffle.weightHelp')}</p>
                </div>

                <Row label={t('wheel.raffle.wWatchtime')} help={t('wheel.raffle.wWatchtimeHelp')}>
                    <Toggle on={!!fuentes.watchtime?.enabled} onChange={v => setFuente('watchtime', { enabled: v })} />
                    {fuentes.watchtime?.enabled && (
                        <>
                            <input
                                type="number" min={1}
                                value={Number(fuentes.watchtime?.minutesPerPoint ?? 60)}
                                onChange={e => setFuente('watchtime', { minutesPerPoint: Number(e.target.value) })}
                                className={`${FIELD} w-24 ml-3`}
                                aria-label={t('wheel.raffle.wMinutes')}
                            />
                            <span className="text-xs text-[#94a3b8] ml-2">{t('wheel.raffle.wMinutes')}</span>
                            <span className="text-xs text-[#94a3b8] ml-3">{t('wheel.raffle.wMax')}</span>
                            <input
                                type="number" min={1} step={0.5}
                                value={Number(fuentes.watchtime?.max ?? 5)}
                                onChange={e => setFuente('watchtime', { max: Number(e.target.value) })}
                                className={`${FIELD} w-20 ml-2`}
                                aria-label={t('wheel.raffle.wMax')}
                            />
                        </>
                    )}
                </Row>

                <Row label={t('wheel.raffle.wSub')} help={t('wheel.raffle.wSubHelp')}>
                    <Toggle on={!!fuentes.subscriber?.enabled} onChange={v => setFuente('subscriber', { enabled: v })} />
                    {fuentes.subscriber?.enabled && (
                        <>
                            <span className="text-xs text-[#94a3b8] ml-3">x</span>
                            <input
                                type="number" min={1} step={0.5}
                                value={Number(fuentes.subscriber?.multiplier ?? 2)}
                                onChange={e => setFuente('subscriber', { multiplier: Number(e.target.value) })}
                                className={`${FIELD} w-20 ml-2`}
                            />
                        </>
                    )}
                </Row>

                <Row label={t('wheel.raffle.wTier')} help={t('wheel.raffle.wTierHelp')}>
                    <Toggle on={!!fuentes.supporterTier?.enabled} onChange={v => setFuente('supporterTier', { enabled: v })} />
                    {fuentes.supporterTier?.enabled && (
                        <div className="flex items-center gap-2 ml-3 flex-wrap">
                            {(['supporter', 'premium', 'fundador'] as const).map(tier => (
                                <label key={tier} className="flex items-center gap-1.5 text-xs text-[#94a3b8]">
                                    {tier}
                                    <input
                                        type="number" min={1} step={0.5}
                                        value={Number(fuentes.supporterTier?.[tier] ?? 1)}
                                        onChange={e => setFuente('supporterTier', { [tier]: Number(e.target.value) })}
                                        className={`${FIELD} w-16`}
                                    />
                                </label>
                            ))}
                        </div>
                    )}
                </Row>

                <Row label={t('wheel.raffle.wCoins')} help={t('wheel.raffle.wCoinsHelp')}>
                    <Toggle on={!!fuentes.coins?.enabled} onChange={v => setFuente('coins', { enabled: v })} />
                    {fuentes.coins?.enabled && (
                        <>
                            <input
                                type="number" min={1}
                                value={Number(fuentes.coins?.coinsPerPoint ?? 1000)}
                                onChange={e => setFuente('coins', { coinsPerPoint: Number(e.target.value) })}
                                className={`${FIELD} w-28 ml-3`}
                                aria-label={t('wheel.raffle.wCoinsPer')}
                            />
                            <span className="text-xs text-[#94a3b8] ml-2">{t('wheel.raffle.wCoinsPer')}</span>
                            <span className="text-xs text-[#94a3b8] ml-3">{t('wheel.raffle.wMax')}</span>
                            <input
                                type="number" min={1} step={0.5}
                                value={Number(fuentes.coins?.max ?? 5)}
                                onChange={e => setFuente('coins', { max: Number(e.target.value) })}
                                className={`${FIELD} w-20 ml-2`}
                                aria-label={t('wheel.raffle.wMax')}
                            />
                        </>
                    )}
                </Row>
            </section>

            {/* --- como se sortea --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151]">
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.raffle.drawTitle')}</h2>
                </div>

                <Row label={t('wheel.raffle.drawMode')} help={t('wheel.raffle.drawModeHelp')}>
                    <select
                        value={config.drawMode}
                        onChange={e => onConfig({ drawMode: e.target.value as RaffleConfig['drawMode'] })}
                        className={FIELD}
                    >
                        <option value="single">{t('wheel.raffle.drawSingle')}</option>
                        <option value="multi">{t('wheel.raffle.drawMulti')}</option>
                        <option value="remove_and_continue">{t('wheel.raffle.drawContinue')}</option>
                    </select>
                </Row>

                {config.drawMode !== 'single' && (
                    <Row label={t('wheel.raffle.winnersCount')} help={t('wheel.raffle.winnersCountHelp')}>
                        <input
                            type="number" min={1} max={50}
                            value={config.winnersCount}
                            onChange={e => onConfig({ winnersCount: Number(e.target.value) })}
                            className={`${FIELD} w-24`}
                        />
                    </Row>
                )}

                {/* remove_and_continue saca al ganador por definicion: el toggle ahi
                    seria una opcion que no hace nada. */}
                {config.drawMode !== 'remove_and_continue' && (
                    <Row label={t('wheel.raffle.removeWinner')} help={t('wheel.raffle.removeWinnerHelp')}>
                        <Toggle on={config.removeWinnerFromPool} onChange={v => onConfig({ removeWinnerFromPool: v })} />
                    </Row>
                )}

                <Row label={t('wheel.raffle.clearOnEnd')} help={t('wheel.raffle.clearOnEndHelp')}>
                    <Toggle on={config.clearOnStreamEnd} onChange={v => onConfig({ clearOnStreamEnd: v })} />
                </Row>
            </section>

            {/* --- el pool --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151] flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="font-bold text-[#f8fafc]">{t('wheel.raffle.poolTitle')}</h2>
                        <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.raffle.poolHelp')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={nuevo}
                            onChange={e => setNuevo(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { onAdd(nuevo); setNuevo(''); } }}
                            placeholder={t('wheel.raffle.addPlaceholder')}
                            className={`${FIELD} w-44`}
                        />
                        <button
                            onClick={() => { onAdd(nuevo); setNuevo(''); }}
                            className="px-3 py-2 bg-[#262626] hover:bg-[#333] border border-[#374151] text-[#f8fafc] rounded-lg text-sm font-medium transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {pool.length === 0 ? (
                    <p className="px-5 py-8 text-sm text-[#94a3b8] text-center">{t('wheel.raffle.poolEmpty')}</p>
                ) : (
                    <div className="divide-y divide-[#374151]">
                        {pool.map(e => {
                            // La probabilidad real, que es lo unico que el espectador
                            // percibe. Sin esto el peso es un numero sin significado.
                            const prob = pesoTotal > 0 ? (Number(e.weight) / pesoTotal) * 100 : 0;
                            return (
                                <div key={e.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                                    <span className="font-medium text-[#f8fafc] flex-1 min-w-[120px]">@{e.viewer}</span>

                                    <span className="text-xs text-[#94a3b8]">
                                        {t('wheel.raffle.tickets', { count: e.entries })}
                                    </span>

                                    <span className="text-sm font-bold tabular-nums text-[#E8B455] w-16 text-right">
                                        {prob.toFixed(1)}%
                                    </span>

                                    <label className="flex items-center gap-1.5 text-xs text-[#94a3b8]">
                                        x
                                        <input
                                            type="number" min={0.1} step={0.5}
                                            defaultValue={Number(e.breakdown?.manual ?? 1)}
                                            onBlur={ev => {
                                                const v = Number(ev.target.value);
                                                if (v > 0 && v !== Number(e.breakdown?.manual ?? 1)) onMultiplier(e.viewer, v);
                                            }}
                                            className={`${FIELD} w-16`}
                                            title={t('wheel.raffle.manualMult')}
                                        />
                                    </label>

                                    <button
                                        onClick={() => onRemove(e.viewer)}
                                        className="p-2 text-[#64748b] hover:text-red-400 transition-colors"
                                        aria-label={t('wheel.raffle.removeEntry')}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {ganadores.length > 0 && (
                    <div className="px-5 py-4 border-t border-[#374151]">
                        <p className="text-xs font-bold text-[#94a3b8] mb-2">{t('wheel.raffle.winnersTitle')}</p>
                        <div className="flex flex-wrap gap-2">
                            {ganadores.map(g => (
                                <span key={g.id} className="px-2.5 py-1 bg-green-500/10 border border-green-500/40 text-green-300 rounded-lg text-xs font-medium">
                                    @{g.viewer}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}

/// Los nombres propios de cada familia. No se traducen — "Bebas Neue" se llama
/// igual en los dos idiomas. La unica que si se traduce es la del sistema, que no
/// es una familia sino "la que traiga el equipo".
const FONT_NAMES: Record<Exclude<FontKey, 'system'>, string> = {
    inter: 'Inter',
    chakra: 'Chakra Petch',
    outfit: 'Outfit',
    fredoka: 'Fredoka',
    bebas: 'Bebas Neue',
    luckiest: 'Luckiest Guy',
    press: 'Press Start 2P',
    jetbrains: 'JetBrains Mono',
};

/// La pestana Historial: las metricas arriba y la tabla de giros abajo.
///
/// Son dos fuentes distintas a proposito. Las tarjetas usan TODO el historial
/// porque una distribucion calculada sobre una ventana recortada le mentiria al
/// streamer sobre su propia rueda; la tabla usa solo lo que su tier deja ver.
function HistoryTab({ spins, total, page, metrics, filters, historyDays, onFilters, onApply, onReset, onPage, onExport, t }: {
    spins: Spin[];
    total: number;
    page: number;
    metrics: Metrics | null;
    filters: SpinFilters;
    /** -1 = sin limite. */
    historyDays: number;
    onFilters: (f: SpinFilters) => void;
    onApply: () => void;
    onReset: () => void;
    onPage: (p: number) => void;
    onExport: () => void;
    t: any;
}) {
    const paginas = Math.max(1, Math.ceil(total / 50));
    const set = (cambios: Partial<SpinFilters>) => onFilters({ ...filters, ...cambios });

    return (
        <div className="space-y-4">
            {metrics && (
                <>
                    <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {([
                            [t('wheel.history.mSpins'), metrics.totals.spins],
                            [t('wheel.history.mLast7'), metrics.totals.spinsLast7],
                            [t('wheel.history.mLast30'), metrics.totals.spinsLast30],
                            [t('wheel.history.mCredits'), metrics.totals.creditsSpent],
                            [t('wheel.history.mCoins'), metrics.totals.coinsPaid],
                            [t('wheel.history.mPending'), metrics.totals.pendingDeliveries],
                        ] as const).map(([label, valor]) => (
                            <div key={label} className="bg-[#1B1C1D] border border-[#374151] rounded-xl px-4 py-3">
                                <p className="text-xs text-[#94a3b8]">{label}</p>
                                <p className="text-2xl font-bold text-[#f8fafc] tabular-nums">{valor.toLocaleString()}</p>
                            </div>
                        ))}
                    </section>

                    <section className={CARD}>
                        <div className="px-5 py-4 border-b border-[#374151]">
                            <h2 className="font-bold text-[#f8fafc]">{t('wheel.history.distTitle')}</h2>
                            <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.history.distHelp')}</p>
                        </div>
                        <div className="p-5 space-y-3">
                            {metrics.distribution.map(d => (
                                <div key={d.segmentId}>
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="text-[#f8fafc] font-medium truncate">{d.label}</span>
                                        <span className="text-[#94a3b8] tabular-nums ml-3 shrink-0">
                                            {d.spins} · {d.realPct.toFixed(1)}% / {d.configuredPct.toFixed(1)}%
                                        </span>
                                    </div>
                                    {/* Dos barras y no una: la de arriba es lo que salio y
                                        la fina de abajo lo configurado. Superponerlas
                                        obligaria a adivinar cual es cual. */}
                                    <div className="h-2 bg-[#262626] rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full"
                                            style={{ width: `${Math.min(100, d.realPct)}%`, background: d.color || '#E8B455' }}
                                        />
                                    </div>
                                    <div className="h-1 bg-[#262626] rounded-full overflow-hidden mt-0.5">
                                        <div className="h-full bg-[#64748b] rounded-full" style={{ width: `${Math.min(100, d.configuredPct)}%` }} />
                                    </div>
                                </div>
                            ))}
                            {metrics.totals.spins < 30 && (
                                <p className="text-xs text-[#64748b] pt-1">{t('wheel.history.fewSpins')}</p>
                            )}
                        </div>
                    </section>

                    {metrics.luckiest.length > 0 && (
                        <section className={CARD}>
                            <div className="px-5 py-4 border-b border-[#374151]">
                                <h2 className="font-bold text-[#f8fafc]">{t('wheel.history.luckiest')}</h2>
                            </div>
                            <div className="p-5 flex flex-wrap gap-2">
                                {metrics.luckiest.map(l => (
                                    <span key={l.viewer} className="px-2.5 py-1 bg-[#262626] border border-[#374151] rounded-lg text-xs text-[#cbd5e1]">
                                        @{l.viewer} · {t('wheel.history.spinsN', { count: l.spins })}
                                    </span>
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}

            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151] flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="font-bold text-[#f8fafc]">{t('wheel.history.title')}</h2>
                        <p className="text-xs text-[#94a3b8] mt-0.5">
                            {historyDays < 0
                                ? t('wheel.history.windowAll')
                                : t('wheel.history.window', { days: historyDays })}
                        </p>
                    </div>
                    <button
                        onClick={onExport}
                        className="px-3 py-2 bg-[#262626] hover:bg-[#333] border border-[#374151] text-[#f8fafc] rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        {t('wheel.history.export')}
                    </button>
                </div>

                <div className="px-5 py-4 border-b border-[#374151] flex flex-wrap items-end gap-3">
                    <label className="text-xs text-[#94a3b8]">
                        {t('wheel.history.from')}
                        <input type="date" value={filters.from} onChange={e => set({ from: e.target.value })} className={`${FIELD} block mt-1`} />
                    </label>
                    <label className="text-xs text-[#94a3b8]">
                        {t('wheel.history.to')}
                        <input type="date" value={filters.to} onChange={e => set({ to: e.target.value })} className={`${FIELD} block mt-1`} />
                    </label>
                    <label className="text-xs text-[#94a3b8]">
                        {t('wheel.history.viewer')}
                        <input
                            value={filters.viewer}
                            onChange={e => set({ viewer: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && onApply()}
                            placeholder={t('wheel.history.viewerPlaceholder')}
                            className={`${FIELD} block mt-1 w-44`}
                        />
                    </label>
                    <label className="text-xs text-[#94a3b8]">
                        {t('wheel.history.trigger')}
                        <select value={filters.trigger} onChange={e => set({ trigger: e.target.value })} className={`${FIELD} block mt-1`}>
                            <option value="all">{t('wheel.history.any')}</option>
                            <option value="command">{t('wheel.history.trCommand')}</option>
                            <option value="panel">{t('wheel.history.trPanel')}</option>
                            <option value="auto">{t('wheel.history.trAuto')}</option>
                            <option value="raffle_draw">{t('wheel.history.trRaffle')}</option>
                        </select>
                    </label>
                    <label className="text-xs text-[#94a3b8]">
                        {t('wheel.history.delivery')}
                        <select value={filters.status} onChange={e => set({ status: e.target.value })} className={`${FIELD} block mt-1`}>
                            <option value="all">{t('wheel.history.any')}</option>
                            <option value="delivered">{t('wheel.history.stDelivered')}</option>
                            <option value="pending">{t('wheel.history.stPending')}</option>
                            <option value="failed">{t('wheel.history.stFailed')}</option>
                        </select>
                    </label>
                    <button onClick={onApply} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                        {t('wheel.history.apply')}
                    </button>
                    <button onClick={onReset} className="px-3 py-2 text-sm text-[#94a3b8] hover:text-[#f8fafc] transition-colors">
                        {t('wheel.history.clear')}
                    </button>
                </div>

                {spins.length === 0 ? (
                    <p className="px-5 py-8 text-sm text-[#64748b] text-center">{t('wheel.history.empty')}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-[#94a3b8] border-b border-[#374151]">
                                    <th className="px-5 py-2 font-medium">{t('wheel.history.colWhen')}</th>
                                    <th className="px-3 py-2 font-medium">{t('wheel.history.colViewer')}</th>
                                    <th className="px-3 py-2 font-medium">{t('wheel.history.colResult')}</th>
                                    <th className="px-3 py-2 font-medium">{t('wheel.history.colTrigger')}</th>
                                    <th className="px-3 py-2 font-medium text-right">{t('wheel.history.colCredits')}</th>
                                    <th className="px-5 py-2 font-medium">{t('wheel.history.colDelivery')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {spins.map(sp => (
                                    <tr key={sp.id} className="border-b border-[#262626] last:border-0">
                                        <td className="px-5 py-2 text-[#cbd5e1] whitespace-nowrap">
                                            {new Date(sp.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-[#cbd5e1]">{sp.viewer ? `@${sp.viewer}` : '—'}</td>
                                        <td className="px-3 py-2 text-[#f8fafc]">
                                            {/* El gajo puede haberse borrado despues del giro; el
                                                tipo del premio viene del snapshot y sobrevive igual. */}
                                            {sp.label ?? <span className="text-[#64748b] italic">{t('wheel.history.deletedSegment')}</span>}
                                            {sp.prize?.type && (
                                                <span className="text-xs text-[#64748b] ml-2">{sp.prize.type}</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-[#94a3b8]">{sp.trigger}</td>
                                        <td className="px-3 py-2 text-[#cbd5e1] text-right tabular-nums">{sp.creditsSpent}</td>
                                        <td className="px-5 py-2">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                sp.deliveryStatus === 'delivered' ? 'bg-green-500/10 text-green-300'
                                                : sp.deliveryStatus === 'pending' ? 'bg-amber-500/10 text-amber-300'
                                                : 'bg-red-500/10 text-red-300'
                                            }`}>
                                                {t(`wheel.history.st${sp.deliveryStatus === 'delivered' ? 'Delivered'
                                                    : sp.deliveryStatus === 'pending' ? 'Pending' : 'Failed'}`)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {paginas > 1 && (
                    <div className="px-5 py-3 border-t border-[#374151] flex items-center justify-between text-sm">
                        <span className="text-xs text-[#94a3b8]">{t('wheel.history.pageOf', { page, pages: paginas, total })}</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => onPage(page - 1)}
                                disabled={page <= 1}
                                className="px-3 py-1.5 bg-[#262626] disabled:opacity-40 border border-[#374151] text-[#f8fafc] rounded-lg text-xs"
                            >
                                {t('wheel.history.prev')}
                            </button>
                            <button
                                onClick={() => onPage(page + 1)}
                                disabled={page >= paginas}
                                className="px-3 py-1.5 bg-[#262626] disabled:opacity-40 border border-[#374151] text-[#f8fafc] rounded-lg text-xs"
                            >
                                {t('wheel.history.next')}
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}

/// La pestana Billeteras: el saldo de creditos de cada espectador, editable.
///
/// Las billeteras son del CANAL y no de la rueda — el espectador aporta una vez y
/// gasta donde quiera — asi que esta tabla no cambia al cambiar de rueda.
function WalletsTab({ wallets, search, onSearch, onApply, onSetCredits, t }: {
    wallets: Wallet[];
    search: string;
    onSearch: (s: string) => void;
    onApply: () => void;
    onSetCredits: (viewer: string, credits: number) => void;
    t: any;
}) {
    const [editando, setEditando] = useState<string | null>(null);
    const [valor, setValor] = useState('');

    return (
        <section className={CARD}>
            <div className="px-5 py-4 border-b border-[#374151]">
                <h2 className="font-bold text-[#f8fafc]">{t('wheel.wallets.title')}</h2>
                <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.wallets.help')}</p>
            </div>

            <div className="px-5 py-4 border-b border-[#374151] flex items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                    <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        value={search}
                        onChange={e => onSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && onApply()}
                        placeholder={t('wheel.wallets.searchPlaceholder')}
                        className={`${FIELD} w-full pl-9`}
                    />
                </div>
                <button onClick={onApply} className="px-3 py-2 bg-[#262626] hover:bg-[#333] border border-[#374151] text-[#f8fafc] rounded-lg text-sm font-medium transition-colors">
                    {t('wheel.wallets.search')}
                </button>
            </div>

            {wallets.length === 0 ? (
                <p className="px-5 py-8 text-sm text-[#64748b] text-center">{t('wheel.wallets.empty')}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-[#94a3b8] border-b border-[#374151]">
                                <th className="px-5 py-2 font-medium">{t('wheel.wallets.colViewer')}</th>
                                <th className="px-3 py-2 font-medium text-right">{t('wheel.wallets.colCredits')}</th>
                                <th className="px-3 py-2 font-medium text-right">{t('wheel.wallets.colLifetime')}</th>
                                <th className="px-3 py-2 font-medium">{t('wheel.wallets.colLastActivity')}</th>
                                <th className="px-5 py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {wallets.map(w => (
                                <tr key={w.viewer} className="border-b border-[#262626] last:border-0">
                                    <td className="px-5 py-2 text-[#f8fafc]">@{w.viewer}</td>
                                    <td className="px-3 py-2 text-right">
                                        {editando === w.viewer ? (
                                            <input
                                                type="number" min={0} autoFocus
                                                value={valor}
                                                onChange={e => setValor(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') { onSetCredits(w.viewer, Math.max(0, Number(valor) || 0)); setEditando(null); }
                                                    if (e.key === 'Escape') setEditando(null);
                                                }}
                                                className={`${FIELD} w-24 text-right`}
                                            />
                                        ) : (
                                            <span className="text-[#f8fafc] font-medium tabular-nums">{w.credits}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right text-[#94a3b8] tabular-nums">{w.lifetimeCredits}</td>
                                    <td className="px-3 py-2 text-[#94a3b8] whitespace-nowrap">
                                        {new Date(w.lastActivityAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-5 py-2 text-right">
                                        {editando === w.viewer ? (
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => { onSetCredits(w.viewer, Math.max(0, Number(valor) || 0)); setEditando(null); }}
                                                    className="text-xs text-green-400 hover:text-green-300"
                                                >
                                                    {t('wheel.wallets.save')}
                                                </button>
                                                <button onClick={() => setEditando(null)} className="text-xs text-[#64748b] hover:text-[#94a3b8]">
                                                    {t('wheel.wallets.cancel')}
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setEditando(w.viewer); setValor(String(w.credits)); }}
                                                className="text-xs text-[#94a3b8] hover:text-[#f8fafc]"
                                            >
                                                {t('wheel.wallets.edit')}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="px-5 py-3 border-t border-[#374151] text-xs text-[#64748b]">
                {t('wheel.wallets.lifetimeNote')}
            </p>
        </section>
    );
}

/// La pestana Aspecto: colores, cubo, tipografia, tiempos del giro y sonidos.
///
/// El preview vive en la columna de al lado y usa el MISMO componente que el
/// overlay, asi que cada cambio de color o de imagen se ve al instante sin tener
/// que abrir OBS.
function LookTab({ visual, onVisual, onPointer, onSound, canHideWatermark, onTestCelebration, t }: {
    visual: WheelVisual;
    onVisual: (c: Partial<WheelVisual>) => void;
    onPointer: (c: Partial<WheelVisual['pointer']>) => void;
    onSound: (k: SoundKey, c: Partial<WheelVisual['sounds'][SoundKey]>) => void;
    canHideWatermark: boolean;
    onTestCelebration: () => void;
    t: any;
}) {
    const fondoTransparente = visual.background === 'transparent';
    // La presentacion decide que controles tienen sentido. Un ajuste que no hace
    // nada es peor que un ajuste que falta: el streamer lo mueve, no pasa nada y
    // asume que la feature esta rota.
    const pres: Presentation = presentationOf(visual);

    return (
        <div className="space-y-4">
            {/* --- presentacion --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151]">
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.look.presentationTitle')}</h2>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.look.presentationHelp')}</p>
                </div>

                <Row label={t('wheel.look.presentation')} help={t('wheel.look.presentationRowHelp')}>
                    <select
                        value={visual.presentation}
                        onChange={e => onVisual({ presentation: e.target.value as PresentationKey })}
                        className={FIELD}
                        disabled={PRESENTATION_KEYS.length < 2}
                    >
                        {PRESENTATION_KEYS.map(k => (
                            <option key={k} value={k}>{t(`wheel.look.pres_${k}`)}</option>
                        ))}
                    </select>
                    {PRESENTATION_KEYS.length < 2 && (
                        <span className="text-xs text-[#64748b] ml-3">{t('wheel.look.presentationOnlyOne')}</span>
                    )}
                </Row>
            </section>

            {/* --- plantillas ---
                Un aspecto entero de un clic. No tocan el lienzo ni la presentacion:
                ver el comentario de cabecera de `templates.ts`. Como el aspecto no
                se guarda hasta pulsar Guardar, probarse una y salir no deja rastro. */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151]">
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.look.templatesTitle')}</h2>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.look.templatesHelp')}</p>
                </div>

                <div className="px-5 py-4 flex flex-wrap gap-3">
                    {TEMPLATES.map(tpl => (
                        <button
                            key={tpl.key}
                            onClick={() => onVisual(applyTemplate(visual, tpl))}
                            className="w-32 rounded-xl border border-[#374151] bg-[#262626] hover:border-blue-500 transition-colors p-2 text-center"
                            title={t(`wheel.look.tpl_${tpl.key}`)}
                        >
                            {/* La miniatura la dibuja el MISMO componente que el overlay,
                                con la plantilla ya aplicada: lo que se ve en el boton es
                                literalmente lo que va a salir. */}
                            <div className="aspect-square">
                                <WheelFace
                                    segments={MUESTRA_PLANTILLA}
                                    visual={applyTemplate(visual, tpl)}
                                />
                            </div>
                            <span className="block text-xs font-medium text-[#cbd5e1] mt-1.5">
                                {t(`wheel.look.tpl_${tpl.key}`)}
                            </span>
                        </button>
                    ))}
                </div>
            </section>

            {/* --- el puntero ---
                Solo si la presentacion tiene alguno, y solo los controles de SU
                clase: forma y lado son de la aguja, grosor y puntas del visor. La
                carta y la bola no muestran nada — la bola es su propia marca y la
                carta no sortea a la vista. */}
            {pres.pointer !== 'none' && (
                <section className={CARD}>
                    <div className="px-5 py-4 border-b border-[#374151]">
                        <h2 className="font-bold text-[#f8fafc]">{t('wheel.look.pointerTitle')}</h2>
                        <p className="text-xs text-[#94a3b8] mt-0.5">
                            {pres.pointer === 'needle'
                                ? t('wheel.look.pointerHelpNeedle')
                                : t('wheel.look.pointerHelpViewer')}
                        </p>
                    </div>

                    <Row label={t('wheel.look.pointerHidden')} help={t('wheel.look.pointerHiddenHelp')}>
                        <Toggle on={visual.pointer.hidden} onChange={v => onPointer({ hidden: v })} />
                    </Row>

                    {!visual.pointer.hidden && (
                        <>
                            {pres.pointer === 'needle' && (
                                <>
                                    <Row label={t('wheel.look.pointerShape')} help={t('wheel.look.pointerShapeHelp')}>
                                        <select
                                            value={visual.pointer.shape}
                                            onChange={e => onPointer({ shape: e.target.value as NeedleShape })}
                                            className={FIELD}
                                        >
                                            {NEEDLE_SHAPES.map(k => (
                                                <option key={k} value={k}>{t(`wheel.look.shape_${k}`)}</option>
                                            ))}
                                        </select>
                                    </Row>

                                    <Row label={t('wheel.look.pointerSide')} help={t('wheel.look.pointerSideHelp')}>
                                        <select
                                            value={visual.pointer.side}
                                            onChange={e => onPointer({ side: e.target.value as NeedleSide })}
                                            className={FIELD}
                                        >
                                            {NEEDLE_SIDES.map(k => (
                                                <option key={k} value={k}>{t(`wheel.look.side_${k}`)}</option>
                                            ))}
                                        </select>
                                    </Row>
                                </>
                            )}

                            {pres.pointer === 'viewer' && (
                                <>
                                    <Row label={t('wheel.look.pointerThickness')} help={t('wheel.look.pointerThicknessHelp')}>
                                        <input
                                            type="number" min={1} max={14}
                                            value={visual.pointer.thickness}
                                            onChange={e => onPointer({ thickness: Number(e.target.value) || 1 })}
                                            className={`${FIELD} w-24`}
                                        />
                                    </Row>

                                    <Row label={t('wheel.look.pointerCaps')} help={t('wheel.look.pointerCapsHelp')}>
                                        <Toggle on={visual.pointer.caps} onChange={v => onPointer({ caps: v })} />
                                    </Row>
                                </>
                            )}

                            <Row label={t('wheel.look.pointerSize')} help={t('wheel.look.pointerSizeHelp')}>
                                <input
                                    type="range" min={0.4} max={3} step={0.1}
                                    value={visual.pointer.size}
                                    onChange={e => onPointer({ size: Number(e.target.value) })}
                                    className="w-40 accent-[#E8B455]"
                                />
                                <span className="text-xs text-[#94a3b8] ml-3 tabular-nums">{visual.pointer.size.toFixed(1)}x</span>
                            </Row>

                            <Row label={t('wheel.look.pointerColor')} help={t('wheel.look.pointerColorHelp')}>
                                <input
                                    type="color"
                                    value={visual.pointer.color ?? visual.accent}
                                    onChange={e => onPointer({ color: e.target.value })}
                                    className="w-10 h-10 rounded-lg bg-transparent border border-[#374151] cursor-pointer"
                                />
                                {visual.pointer.color && (
                                    <button
                                        onClick={() => onPointer({ color: null })}
                                        className="text-xs text-[#94a3b8] hover:text-[#f8fafc] ml-3"
                                    >
                                        {t('wheel.look.pointerColorReset')}
                                    </button>
                                )}
                            </Row>
                        </>
                    )}
                </section>
            )}

            {/* --- colores --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151]">
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.look.colorsTitle')}</h2>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.look.colorsHelp')}</p>
                </div>

                {([
                    ['accent', t('wheel.look.accent'), t('wheel.look.accentHelp')],
                    ['ink', t('wheel.look.ink'), t('wheel.look.inkHelp')],
                    ['bone', t('wheel.look.bone'), t('wheel.look.boneHelp')],
                ] as const).map(([campo, label, help]) => (
                    <Row key={campo} label={label} help={help}>
                        <input
                            type="color"
                            value={visual[campo]}
                            onChange={e => onVisual({ [campo]: e.target.value } as Partial<WheelVisual>)}
                            className="w-10 h-10 rounded-lg bg-transparent border border-[#374151] cursor-pointer"
                        />
                        <code className="text-xs text-[#64748b] ml-2">{visual[campo]}</code>
                    </Row>
                ))}

                <Row label={t('wheel.look.background')} help={t('wheel.look.backgroundHelp')}>
                    <Toggle
                        on={fondoTransparente}
                        onChange={v => onVisual({ background: v ? 'transparent' : '#12101B' })}
                    />
                    <span className="text-xs text-[#94a3b8] ml-3">{t('wheel.look.transparent')}</span>
                    {!fondoTransparente && (
                        <input
                            type="color"
                            value={visual.background}
                            onChange={e => onVisual({ background: e.target.value })}
                            className="w-10 h-10 rounded-lg bg-transparent border border-[#374151] cursor-pointer ml-3"
                        />
                    )}
                    {/* El color se elige aca; DONDE se pinta es del lienzo. Antes se
                        pintaba la pantalla entera, que tapaba la escena del streamer
                        de lado a lado. Sin lienzo, se pinta solo alrededor de la rueda. */}
                    {!fondoTransparente && (
                        <p className="text-xs text-[#64748b] mt-2 basis-full">{t('wheel.look.backgroundBoxNote')}</p>
                    )}
                </Row>

                {/* La marca de agua solo se puede apagar desde premium. El backend lo
                    fuerza igual al guardar: esconder el toggle no es una regla. */}
                <Row label={t('wheel.look.watermark')} help={canHideWatermark ? t('wheel.look.watermarkHelp') : t('wheel.look.watermarkLocked')}>
                    {canHideWatermark ? (
                        <Toggle on={visual.showWatermark} onChange={v => onVisual({ showWatermark: v })} />
                    ) : (
                        <span className="text-xs text-[#64748b]">{t('wheel.look.watermarkAlwaysOn')}</span>
                    )}
                </Row>

                <div className="px-5 py-4 border-t border-[#374151]">
                    <p className="text-sm font-medium text-[#f8fafc]">{t('wheel.look.palette')}</p>
                    <p className="text-xs text-[#94a3b8] mt-0.5 mb-3">{t('wheel.look.paletteHelp')}</p>
                    <div className="flex flex-wrap items-center gap-2">
                        {visual.palette.map((c, i) => (
                            <div key={i} className="relative">
                                <input
                                    type="color"
                                    value={c}
                                    onChange={e => {
                                        const p = [...visual.palette];
                                        p[i] = e.target.value;
                                        onVisual({ palette: p });
                                    }}
                                    className="w-10 h-10 rounded-lg bg-transparent border border-[#374151] cursor-pointer"
                                />
                                {/* Con un solo color la paleta deja de poder rotar entre
                                    gajos, asi que el ultimo no se puede quitar. */}
                                {visual.palette.length > 1 && (
                                    <button
                                        onClick={() => onVisual({ palette: visual.palette.filter((_, j) => j !== i) })}
                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#262626] border border-[#374151] rounded-full text-[10px] text-[#94a3b8] hover:text-red-400 leading-none"
                                        aria-label={t('wheel.look.paletteRemove')}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            onClick={() => onVisual({ palette: [...visual.palette, '#E8B455'] })}
                            className="w-10 h-10 rounded-lg border border-dashed border-[#374151] text-[#64748b] hover:text-[#f8fafc] hover:border-[#4b5563] transition-colors"
                            aria-label={t('wheel.look.paletteAdd')}
                        >
                            +
                        </button>
                    </div>
                </div>
            </section>

            {/* --- cubo central --- */}
            {pres.parts.centerImage && (
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151]">
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.look.centerTitle')}</h2>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.look.centerHelp')}</p>
                </div>
                <div className="p-5">
                    {/* Sale de la biblioteca de medios compartida, no de un subidor
                        propio de la rueda: la cuota es la global del tier. */}
                    <MediaInputWithSelector
                        value={visual.centerImage || ''}
                        onChange={v => onVisual({ centerImage: v || null })}
                        label={t('wheel.look.centerImage')}
                        placeholder={t('wheel.look.centerPlaceholder')}
                        allowedTypes={['image', 'gif']}
                    />

                    {visual.centerImage && (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <span className="text-xs text-[#94a3b8]">{t('wheel.look.centerSize')}</span>
                            <input
                                type="range" min={20} max={140} step={2}
                                value={visual.centerImageSize}
                                onChange={e => onVisual({ centerImageSize: Number(e.target.value) })}
                                className="w-48"
                            />
                            <span className="text-xs text-[#94a3b8] tabular-nums w-10">
                                {visual.centerImageSize}
                            </span>
                            <button
                                onClick={() => onVisual({ centerImage: null })}
                                className="text-xs text-[#64748b] hover:text-red-400 transition-colors ml-auto"
                            >
                                {t('wheel.look.centerClear')}
                            </button>
                        </div>
                    )}
                </div>
            </section>
            )}

            {/* --- tipografia --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151]">
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.look.typoTitle')}</h2>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.look.typoHelp')}</p>
                </div>

                <Row label={t('wheel.look.font')} help={t('wheel.look.fontHelp')}>
                    <select
                        value={visual.font}
                        onChange={e => onVisual({ font: e.target.value as FontKey })}
                        className={FIELD}
                        // Cada opcion se dibuja con su propia letra: elegir tipografia
                        // por el nombre obliga a probarlas una por una.
                    >
                        {FONT_KEYS.map(k => (
                            <option key={k} value={k} style={{ fontFamily: FONTS[k].stack }}>
                                {k === 'system' ? t('wheel.look.fontSystem') : FONT_NAMES[k]}
                            </option>
                        ))}
                    </select>
                </Row>

                <Row label={t('wheel.look.fontWeight')} help={t('wheel.look.fontWeightHelp')}>
                    {FONTS[visual.font].weights.length > 1 ? (
                        <select
                            value={visual.fontWeight}
                            onChange={e => onVisual({ fontWeight: Number(e.target.value) })}
                            className={FIELD}
                        >
                            {FONTS[visual.font].weights.map(w => (
                                <option key={w} value={w}>{w}</option>
                            ))}
                        </select>
                    ) : (
                        // Una familia de un solo peso no ofrece un selector de un item:
                        // parece roto. Se dice que esa letra viene con un grosor solo.
                        <span className="text-xs text-[#64748b]">{t('wheel.look.fontOneWeight')}</span>
                    )}
                </Row>

                <Row label={t('wheel.look.textScale')} help={t('wheel.look.textScaleHelp')}>
                    <input
                        type="range" min={0.5} max={2} step={0.05}
                        value={visual.textScale}
                        onChange={e => onVisual({ textScale: Number(e.target.value) })}
                        className="w-40 accent-[#E8B455]"
                    />
                    <span className="text-xs text-[#94a3b8] ml-3 tabular-nums w-12 inline-block">
                        {Math.round(visual.textScale * 100)}%
                    </span>
                </Row>

                <Row label={t('wheel.look.textUppercase')} help={t('wheel.look.textUppercaseHelp')}>
                    <Toggle on={visual.textUppercase} onChange={v => onVisual({ textUppercase: v })} />
                </Row>

                <Row label={t('wheel.look.textColor')} help={t('wheel.look.textColorHelp')}>
                    <Toggle
                        on={visual.textColor === null}
                        onChange={v => onVisual({ textColor: v ? null : visual.ink })}
                    />
                    <span className="text-xs text-[#94a3b8] ml-3">{t('wheel.look.followsInk')}</span>
                    {visual.textColor !== null && (
                        <input
                            type="color"
                            value={visual.textColor}
                            onChange={e => onVisual({ textColor: e.target.value })}
                            className="ml-3 w-11 h-9 bg-transparent border border-[#374151] rounded-lg cursor-pointer align-middle"
                        />
                    )}
                </Row>

                <Row label={t('wheel.look.textOutline')} help={t('wheel.look.textOutlineHelp')}>
                    <input
                        type="range" min={0} max={6} step={0.5}
                        value={visual.textOutline}
                        onChange={e => onVisual({ textOutline: Number(e.target.value) })}
                        className="w-40 accent-[#E8B455]"
                    />
                    <span className="text-xs text-[#94a3b8] ml-3 tabular-nums w-12 inline-block">
                        {visual.textOutline === 0 ? t('wheel.look.outlineOff') : visual.textOutline}
                    </span>
                    {visual.textOutline > 0 && (
                        <input
                            type="color"
                            value={visual.textOutlineColor ?? visual.bone}
                            onChange={e => onVisual({ textOutlineColor: e.target.value })}
                            className="ml-3 w-11 h-9 bg-transparent border border-[#374151] rounded-lg cursor-pointer align-middle"
                            aria-label={t('wheel.look.textOutlineColor')}
                        />
                    )}
                </Row>
            </section>

            {/* --- movimiento --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151]">
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.look.motionTitle')}</h2>
                </div>

                {pres.motion.spinSeconds && (
                <Row label={t('wheel.look.spinSeconds')} help={t('wheel.look.spinSecondsHelp')}>
                    <input
                        type="number" min={1} max={20} step={0.2}
                        value={visual.spinSeconds}
                        onChange={e => onVisual({ spinSeconds: Number(e.target.value) })}
                        className={`${FIELD} w-24`}
                    />
                </Row>
                )}

                {pres.motion.turns && (
                <Row label={t('wheel.look.turns')} help={t('wheel.look.turnsHelp')}>
                    <input
                        type="number" min={1} max={12}
                        value={visual.turns}
                        onChange={e => onVisual({ turns: Number(e.target.value) })}
                        className={`${FIELD} w-24`}
                    />
                </Row>
                )}

                {pres.motion.easing && (
                <Row label={t('wheel.look.easing')} help={t('wheel.look.easingHelp')}>
                    <select
                        value={visual.easing}
                        onChange={e => onVisual({ easing: e.target.value as Easing })}
                        className={FIELD}
                    >
                        <option value="quint">{t('wheel.look.easingQuint')}</option>
                        <option value="cubic">{t('wheel.look.easingCubic')}</option>
                        <option value="expo">{t('wheel.look.easingExpo')}</option>
                    </select>
                </Row>
                )}

                <Row label={t('wheel.look.revealSeconds')} help={t('wheel.look.revealSecondsHelp')}>
                    <input
                        type="number" min={1} max={30} step={0.5}
                        value={visual.revealSeconds}
                        onChange={e => onVisual({ revealSeconds: Number(e.target.value) })}
                        className={`${FIELD} w-24`}
                    />
                </Row>

                <Row label={t('wheel.look.celebration')} help={t('wheel.look.celebrationHelp')}>
                    <select
                        value={visual.celebration}
                        onChange={e => onVisual({ celebration: e.target.value as Celebration })}
                        className={FIELD}
                    >
                        <option value="confetti">{t('wheel.look.celebConfetti')}</option>
                        <option value="flash">{t('wheel.look.celebFlash')}</option>
                        <option value="none">{t('wheel.look.celebNone')}</option>
                    </select>
                    {visual.celebration !== 'none' && (
                        <button
                            type="button"
                            onClick={onTestCelebration}
                            className="ml-3 px-3 py-2 bg-[#262626] hover:bg-[#333] border border-[#374151] text-[#f8fafc] rounded-lg text-sm font-medium transition-colors align-middle"
                        >
                            {t('wheel.look.celebTest')}
                        </button>
                    )}
                </Row>
            </section>

            {/* --- sonidos --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151] flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="font-bold text-[#f8fafc]">{t('wheel.look.soundsTitle')}</h2>
                        <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.look.soundsHelp')}</p>
                    </div>
                    <button
                        onClick={() => onVisual({ sounds: DEFAULT_VISUAL.sounds })}
                        className="px-3 py-1.5 text-sm bg-[#262626] hover:bg-[#333] border border-[#374151] text-[#f8fafc] rounded-lg flex items-center gap-1.5 font-medium transition-colors flex-shrink-0"
                    >
                        <RotateCcw className="w-4 h-4" />
                        {t('wheel.look.soundsRestore')}
                    </button>
                </div>

                <Row label={t('wheel.look.masterVolume')}>
                    <input
                        type="range" min={0} max={1} step={0.05}
                        value={visual.sounds.master}
                        onChange={e => onVisual({ sounds: { ...visual.sounds, master: Number(e.target.value) } })}
                        className="w-40"
                    />
                    <span className="text-xs text-[#94a3b8] ml-3 tabular-nums w-10">
                        {Math.round(visual.sounds.master * 100)}%
                    </span>
                </Row>

                {soundsFor(pres).map(key => {
                    const cfg = visual.sounds[key];
                    // spin_tick no admite sonido propio: se reproduce en bucle rapido
                    // mientras la rueda gira y un sample con cola suena espantoso
                    // repetido treinta veces por segundo. Silenciarlo si se puede.
                    const soloDefault = key === 'spin_tick';

                    return (
                        <div key={key} className="px-5 py-4 border-t border-[#374151] space-y-3">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex-1 min-w-[160px]">
                                    <p className="text-sm font-medium text-[#f8fafc]">{t(`wheel.look.sound_${key}`)}</p>
                                    <p className="text-xs text-[#94a3b8] mt-0.5">
                                        {soloDefault ? t('wheel.look.tickOnlyDefault') : t(`wheel.look.soundWhen_${key}`)}
                                    </p>
                                </div>

                                <select
                                    value={cfg.mode}
                                    onChange={e => onSound(key, { mode: e.target.value as SoundMode })}
                                    className={FIELD}
                                >
                                    <option value="default">{t('wheel.look.modeDefault')}</option>
                                    <option value="mute">{t('wheel.look.modeMute')}</option>
                                    {!soloDefault && <option value="custom">{t('wheel.look.modeCustom')}</option>}
                                </select>

                                {cfg.mode === 'mute'
                                    ? <VolumeX className="w-4 h-4 text-[#64748b]" />
                                    : <Volume2 className="w-4 h-4 text-[#94a3b8]" />}

                                {cfg.mode !== 'mute' && (
                                    <>
                                        <input
                                            type="range" min={0} max={1} step={0.05}
                                            value={cfg.volume ?? 1}
                                            onChange={e => onSound(key, { volume: Number(e.target.value) })}
                                            className="w-28"
                                            aria-label={t('wheel.look.volume')}
                                        />
                                        <span className="text-xs text-[#94a3b8] tabular-nums w-10">
                                            {Math.round((cfg.volume ?? 1) * 100)}%
                                        </span>
                                    </>
                                )}
                            </div>

                            {cfg.mode === 'custom' && !soloDefault && (
                                <MediaInputWithSelector
                                    value={cfg.url || ''}
                                    onChange={v => onSound(key, { url: v || null })}
                                    label={t('wheel.look.soundFile')}
                                    placeholder={t('wheel.look.soundPlaceholder')}
                                    allowedTypes={['audio']}
                                />
                            )}
                        </div>
                    );
                })}
            </section>
        </div>
    );
}

/// La bandeja de entregas pendientes: lo que el bot no pudo entregar solo y espera
/// al streamer. El motivo lo escribe el bot, para que se vea si hay algo que
/// arreglar (el bot no es mod, el timer estaba detenido) o solo hay que cumplirlo.
function DeliveriesTab({ deliveries, filter, onFilter, onResolve, t }: {
    deliveries: Delivery[];
    filter: 'pending' | 'all';
    onFilter: (f: 'pending' | 'all') => void;
    onResolve: (id: number, status: 'done' | 'cancelled' | 'pending') => void;
    t: any;
}) {
    return (
        <section className="bg-[#1B1C1D] rounded-xl border border-[#374151] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#374151] flex items-center justify-between gap-4">
                <div>
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.deliveries.title')}</h2>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.deliveries.help')}</p>
                </div>
                <div className="flex gap-1 bg-[#262626] rounded-lg p-1 flex-shrink-0">
                    {(['pending', 'all'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => onFilter(f)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                                filter === f ? 'bg-blue-600 text-white' : 'text-[#94a3b8] hover:text-[#f8fafc]'
                            }`}
                        >
                            {t(`wheel.deliveries.filter_${f}`)}
                        </button>
                    ))}
                </div>
            </div>

            {deliveries.length === 0 ? (
                <p className="px-5 py-8 text-sm text-[#94a3b8] text-center">{t('wheel.deliveries.empty')}</p>
            ) : (
                <div className="divide-y divide-[#374151]">
                    {deliveries.map(d => (
                        <div key={d.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
                            <div className="flex-1 min-w-[200px]">
                                <p className="text-sm text-[#f8fafc]">
                                    <span className="font-bold">@{d.viewer}</span>
                                    <span className="text-[#64748b]"> · {d.wheelName}</span>
                                </p>
                                <p className="text-xs text-[#94a3b8] mt-0.5">
                                    {describePrize(d.prize, t)}
                                </p>
                                {d.reason && (
                                    <p className="text-xs text-amber-300/80 mt-0.5">{d.reason}</p>
                                )}
                            </div>

                            <span className="text-xs text-[#64748b] tabular-nums">
                                {new Date(d.createdAt).toLocaleString()}
                            </span>

                            {d.status === 'pending' ? (
                                <div className="flex gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => onResolve(d.id, 'done')}
                                        className="px-3 py-1.5 text-xs font-bold bg-green-600/20 text-green-300 border border-green-600/40 rounded-lg hover:bg-green-600/30 transition-colors flex items-center gap-1.5"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        {t('wheel.deliveries.markDone')}
                                    </button>
                                    <button
                                        onClick={() => onResolve(d.id, 'cancelled')}
                                        className="px-3 py-1.5 text-xs font-bold bg-[#262626] text-[#94a3b8] border border-[#374151] rounded-lg hover:text-[#f8fafc] transition-colors flex items-center gap-1.5"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                        {t('wheel.deliveries.cancel')}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => onResolve(d.id, 'pending')}
                                    className="px-3 py-1.5 text-xs font-medium text-[#64748b] hover:text-[#f8fafc] transition-colors flex-shrink-0"
                                    title={t('wheel.deliveries.reopenHelp')}
                                >
                                    {t(`wheel.deliveries.status_${d.status}`)} · {t('wheel.deliveries.reopen')}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

/// El premio en una linea legible. La bandeja tiene que decir QUE se debe entregar,
/// no un JSON.
function describePrize(prize: Prize | null, t: any): string {
    if (!prize) return t('wheel.prizes.nothing');
    const p = prize.params || {};

    switch (prize.type) {
        case 'coins':          return `${p.amount ?? 0} coins`;
        case 'free_spin':      return t('wheel.deliveries.descFreeSpin', { count: p.count ?? 1 });
        case 'gacha_pull':     return t('wheel.deliveries.descGachaPull', { count: p.count ?? 1 });
        case 'timer_time':     return t('wheel.deliveries.descTimerTime', { seconds: p.seconds ?? 0 });
        case 'timeout':        return t('wheel.deliveries.descTimeout', { seconds: p.seconds ?? 0 });
        case 'sound_alert':    return t('wheel.prizes.soundAlert');
        case 'manual_message': return String(p.template || t('wheel.prizes.manualMessage'));
        default:               return t('wheel.prizes.nothing');
    }
}

function SegmentRow({ segment, percentage, onChange, onRemove, onMoveUp, onMoveDown, wheels, soundAlerts, t }: {
    segment: Segment;
    percentage: number;
    onChange: (changes: Partial<Segment>) => void;
    onRemove: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    wheels: WheelSummary[];
    soundAlerts: SoundAlertOption[];
    t: any;
}) {
    return (
        <div className={`px-5 py-4 flex flex-wrap items-center gap-3 ${segment.isEnabled ? '' : 'opacity-50'}`}>
            <div className="flex flex-col">
                <button onClick={onMoveUp} className="text-[#64748b] hover:text-[#f8fafc] leading-none" aria-label={t('wheel.segments.moveUp')}>▴</button>
                <GripVertical className="w-4 h-4 text-[#374151]" />
                <button onClick={onMoveDown} className="text-[#64748b] hover:text-[#f8fafc] leading-none" aria-label={t('wheel.segments.moveDown')}>▾</button>
            </div>

            <input
                type="color"
                value={segment.color || '#E8B455'}
                onChange={e => onChange({ color: e.target.value })}
                className="w-9 h-9 rounded-lg bg-transparent border border-[#374151] cursor-pointer"
                aria-label={t('wheel.segments.color')}
            />

            <input
                type="text"
                value={segment.label}
                onChange={e => onChange({ label: e.target.value })}
                placeholder={t('wheel.segments.labelPlaceholder')}
                // Con tope: en un monitor grande la etiqueta se comia todo el ancho
                // sobrante y empujaba peso, premio y parametros tan lejos que dejaba
                // de leerse que esos campos son de esta fila.
                className="flex-1 min-w-[160px] max-w-[28rem] px-3 py-2 bg-[#262626] border border-[#374151] rounded-lg text-[#f8fafc] text-sm focus:outline-none focus:border-blue-500"
            />

            <label className="flex items-center gap-2 text-xs text-[#94a3b8]">
                {t('wheel.segments.weight')}
                <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={segment.weight}
                    onChange={e => onChange({ weight: Number(e.target.value) })}
                    className="w-20 px-2 py-2 bg-[#262626] border border-[#374151] rounded-lg text-[#f8fafc] text-sm focus:outline-none focus:border-blue-500"
                />
            </label>

            <span className="w-16 text-right text-sm font-bold tabular-nums text-[#E8B455]">
                {percentage.toFixed(1)}%
            </span>

            <select
                value={segment.prize.type}
                onChange={e => onChange({ prize: { type: e.target.value as PrizeType, params: defaultPrizeParams(e.target.value as PrizeType) } })}
                className="px-2 py-2 bg-[#262626] border border-[#374151] rounded-lg text-[#f8fafc] text-sm focus:outline-none focus:border-blue-500"
            >
                <option value="nothing">{t('wheel.prizes.nothing')}</option>
                <option value="coins">{t('wheel.prizes.coins')}</option>
                <option value="free_spin">{t('wheel.prizes.freeSpin')}</option>
                <option value="gacha_pull">{t('wheel.prizes.gachaPull')}</option>
                <option value="timer_time">{t('wheel.prizes.timerTime')}</option>
                <option value="timeout">{t('wheel.prizes.timeout')}</option>
                <option value="sound_alert">{t('wheel.prizes.soundAlert')}</option>
                <option value="manual_message">{t('wheel.prizes.manualMessage')}</option>
            </select>

            <PrizeParams
                prize={segment.prize}
                onChange={params => onChange({ prize: { type: segment.prize.type, params } })}
                wheels={wheels}
                soundAlerts={soundAlerts}
                t={t}
            />

            {/* Apagar y borrar van juntos y pegados al extremo derecho: cuando la fila
                envuelve en una columna angosta, dos iconos sueltos empezando una linea
                nueva parecen un error de maquetacion. */}
            <div className="flex items-center gap-1 ml-auto">
                <button
                    onClick={() => onChange({ isEnabled: !segment.isEnabled })}
                    className="p-2 hover:bg-[#262626] rounded-lg transition-colors"
                    aria-label={segment.isEnabled ? t('wheel.segments.disable') : t('wheel.segments.enable')}
                >
                    {segment.isEnabled
                        ? <Eye className="w-4 h-4 text-[#94a3b8]" />
                        : <EyeOff className="w-4 h-4 text-[#64748b]" />}
                </button>

                <button
                    onClick={onRemove}
                    className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                    aria-label={t('wheel.segments.remove')}
                >
                    <Trash2 className="w-4 h-4 text-red-400" />
                </button>
            </div>

            {/* Stock. Va en su propia linea y detras de un interruptor porque la
                mayoria de los gajos son ilimitados: cuatro campos vacios en cada fila
                harian ilegible la lista entera por una funcion que casi nadie usa. */}
            <div className="basis-full flex flex-wrap items-center gap-2 pl-1 pt-1">
                <button
                    onClick={() => onChange({
                        stockTotal: segment.stockTotal == null ? 1 : null,
                        stockPerViewer: segment.stockTotal == null ? segment.stockPerViewer : null,
                    })}
                    className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        segment.stockTotal == null
                            ? 'bg-[#262626] border-[#374151] text-[#64748b] hover:text-[#94a3b8]'
                            : 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                    }`}
                >
                    {segment.stockTotal == null ? t('wheel.stock.off') : t('wheel.stock.on')}
                </button>

                {segment.stockTotal != null && (
                    <>
                        <label className="text-xs text-[#94a3b8] flex items-center gap-1.5">
                            {t('wheel.stock.total')}
                            <input
                                type="number" min={1}
                                value={segment.stockTotal}
                                onChange={e => onChange({ stockTotal: Math.max(1, Number(e.target.value) || 1) })}
                                className={`${FIELD} w-20`}
                            />
                        </label>

                        <label className="text-xs text-[#94a3b8] flex items-center gap-1.5">
                            {t('wheel.stock.perViewer')}
                            <input
                                type="number" min={1}
                                value={segment.stockPerViewer ?? ''}
                                placeholder={t('wheel.stock.noLimit')}
                                onChange={e => onChange({ stockPerViewer: e.target.value ? Number(e.target.value) : null })}
                                className={`${FIELD} w-20`}
                            />
                        </label>

                        <label className="text-xs text-[#94a3b8] flex items-center gap-1.5">
                            {t('wheel.stock.window')}
                            <select
                                value={segment.stockWindow}
                                onChange={e => onChange({ stockWindow: e.target.value })}
                                className={FIELD}
                            >
                                <option value="ever">{t('wheel.stock.wEver')}</option>
                                <option value="stream">{t('wheel.stock.wStream')}</option>
                                <option value="day">{t('wheel.stock.wDay')}</option>
                            </select>
                        </label>

                        {segment.stockRemaining != null && (
                            <span className="text-xs text-[#64748b]">
                                {t('wheel.stock.remaining', { n: segment.stockRemaining })}
                            </span>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

/**
 * La misma rueda que verá el streamer en OBS, dibujada acá para que pueda ajustar
 * colores y textos sin tener que ir a mirar la escena.
 */
function WheelPreview({ segments, visual, celebNonce, t }: {
    segments: Segment[];
    visual: WheelVisual;
    /** Cada incremento reproduce la celebracion sobre el preview. */
    celebNonce: number;
    t: any;
}) {
    const visibles = segments.filter(s => s.isEnabled);

    // Con menos de dos gajos no hay rueda que dibujar, pero desaparecer sin decir
    // nada deja un hueco mudo justo donde el streamer espera ver su rueda — y en una
    // rueda recien creada, que nace sin gajos, ese es el primer estado que ve.
    if (visibles.length < 2) {
        return (
            <div className="rounded-xl border border-dashed border-[#374151] p-6 text-center">
                <p className="text-xs text-[#94a3b8]">{t('wheel.look.previewNeedsSegments')}</p>
            </div>
        );
    }

    const pres = presentationOf(visual);

    return (
        <div
            className="relative rounded-xl border border-[#374151] p-4 flex justify-center overflow-hidden"
            // El fondo del preview imita el del overlay. Con fondo transparente se
            // muestra un tablero de ajedrez, que es como se ve en OBS: pintarlo de
            // gris haria creer que la rueda trae un fondo que no tiene.
            style={visual.background === 'transparent'
                ? {
                    backgroundColor: '#1B1C1D',
                    backgroundImage:
                        'linear-gradient(45deg, #262626 25%, transparent 25%, transparent 75%, #262626 75%),' +
                        'linear-gradient(45deg, #262626 25%, transparent 25%, transparent 75%, #262626 75%)',
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 8px 8px',
                }
                : { background: visual.background }}
        >
            {/* La MISMA presentacion que dibuja el overlay, en reposo: si el preview
                usara su propia copia, mostraria algo distinto de lo que va a salir en
                pantalla, que es justo lo que un preview no puede permitirse. La forma
                del lienzo tambien sale de ella, asi que una tira horizontal se
                previsualiza como tira sin tocar nada de aca. */}
            <div
                className="relative"
                // El preview CRECE con la columna en vez de quedarse clavado: ocupa el
                // ancho disponible y el alto sale de la proporcion. El tope se pone en
                // el ancho (`alto maximo x proporcion`) y no en el alto, porque asi la
                // forma la sigue mandando la presentacion: un carrete no estira la
                // columna y una tira no sale deformada al toparse con el maximo.
                style={{
                    aspectRatio: String(pres.aspect),
                    width: '100%',
                    maxWidth: `${(ALTO_PREVIEW * pres.aspect).toFixed(1)}px`,
                    marginInline: 'auto',
                }}
            >
                <pres.Component
                    segments={visibles.map(sg => ({ id: sg.id, label: sg.label || '—', color: sg.color, icon: sg.icon }))}
                    visual={visual}
                    spin={null}
                    phase="idle"
                    onSound={() => { }}
                    onFinished={() => { }}
                />
            </div>

            {/* El mismo componente que el overlay, en el mismo alto relativo: lo que se
                ve aca al pulsar "probar" es la celebracion de verdad, encogida. */}
            <WheelCelebration visual={visual} nonce={celebNonce} seconds={3} />
        </div>
    );
}


function normalizeSegment(s: any): Segment {
    return {
        id: s.id ?? 0,
        label: s.label ?? '',
        weight: Number(s.weight ?? 1),
        color: s.color ?? null,
        icon: s.icon ?? null,
        prize: s.prize && typeof s.prize === 'object' ? s.prize : { type: 'nothing', params: {} },
        isEnabled: s.isEnabled ?? true,
        effectivePercentage: s.effectivePercentage,
        stockTotal: s.stockTotal ?? null,
        stockPerViewer: s.stockPerViewer ?? null,
        stockWindow: s.stockWindow ?? 'ever',
        stockRemaining: s.stockRemaining ?? null,
    };
}
