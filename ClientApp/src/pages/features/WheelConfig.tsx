// Rueda de la Suerte — panel de configuración (Fase 1, modo Premios).
// Ver .dev/plans/RUEDA_DE_LA_SUERTE_PLAN.md

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, CircleDot, Coins, Copy, CopyPlus, FlaskConical, History, Image as ImageIcon, Inbox, LayoutTemplate, Loader2, MessageSquare, Palette, PieChart, Play, Plus, Save, ShieldAlert, Ticket, Trash2, Wallet } from 'lucide-react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import MediaGallery from '../../components/timer/MediaGallery';
import { CANVAS_HEIGHT, CANVAS_WIDTH, resolveVisual, type SoundKey, type WheelVisual } from '../../components/wheel/visualConfig';
import LayoutEditor from '../../components/wheel/LayoutEditor';
import { type ChannelReward, type Delivery, emptySegment, type MessagePack, type Metrics, normalizeSegment, type RaffleConfig, type RaffleEntry, type Segment, type SimResult, type SoundAlertOption, type Source, type Spin, SPIN_FILTERS_VACIOS, type SpinFilters, type Tab, type ViewerWallet, type WheelSummary } from './wheel/model';
import { CARD, FIELD, Toggle } from './wheel/ui';
import { CreditsTab } from './wheel/tabs/CreditsTab';
import { MessagesTab } from './wheel/tabs/MessagesTab';
import { TestTab } from './wheel/tabs/TestTab';
import { LimitsTab } from './wheel/tabs/LimitsTab';
import { EmptyState } from './wheel/tabs/EmptyState';
import { RaffleTab } from './wheel/tabs/RaffleTab';
import { HistoryTab } from './wheel/tabs/HistoryTab';
import { WalletsTab } from './wheel/tabs/WalletsTab';
import { LookTab } from './wheel/tabs/LookTab';
import { DeliveriesTab } from './wheel/tabs/DeliveriesTab';
import { SegmentRow } from './wheel/tabs/SegmentRow';
import { WheelPreview } from './wheel/tabs/WheelPreview';

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
    const [wallets, setWallets] = useState<ViewerWallet[]>([]);
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
                            mode={wheel.mode}
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

