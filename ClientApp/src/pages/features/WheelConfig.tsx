// Rueda de la Suerte — panel de configuración.
// Ver .dev/plans/RUEDA_DE_LA_SUERTE_PLAN.md y .dev/plans/RUEDA_ORDEN_PLAN.md
//
// Este archivo solo coordina: qué rueda está abierta y sus gajos/fuentes/mensajes, el
// despachador de guardado por pestaña y el reparto de pestañas. Cada pestaña vive en
// `wheel/tabs/`, cada responsabilidad de datos en `wheel/hooks/` y las piezas de la
// pantalla en `wheel/parts/`.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import MediaGallery from '../../components/timer/MediaGallery';
import LayoutEditor from '../../components/wheel/LayoutEditor';
import { useChannelResources } from './wheel/hooks/useChannelResources';
import type { PanelStatus } from './wheel/hooks/context';
import { useDeliveries } from './wheel/hooks/useDeliveries';
import { useRaffleAdmin } from './wheel/hooks/useRaffleAdmin';
import { useSpinHistory } from './wheel/hooks/useSpinHistory';
import { useWallets } from './wheel/hooks/useWallets';
import { useWheelVisual } from './wheel/hooks/useWheelVisual';
import {
    emptySegment, normalizeSegment,
    type MessagePack, type Segment, type SimResult, type Source, type Tab, type WheelSummary,
} from './wheel/model';
import { SegmentsTab } from './wheel/parts/SegmentsTab';
import { TabNav } from './wheel/parts/TabNav';
import { WheelHeader } from './wheel/parts/WheelHeader';
import { WheelSidebar } from './wheel/parts/WheelSidebar';
import { CreditsTab } from './wheel/tabs/CreditsTab';
import { DeliveriesTab } from './wheel/tabs/DeliveriesTab';
import { EmptyState } from './wheel/tabs/EmptyState';
import { HistoryTab } from './wheel/tabs/HistoryTab';
import { LimitsTab } from './wheel/tabs/LimitsTab';
import { LookTab } from './wheel/tabs/LookTab';
import { MessagesTab } from './wheel/tabs/MessagesTab';
import { RaffleTab } from './wheel/tabs/RaffleTab';
import { TestTab } from './wheel/tabs/TestTab';
import { WalletsTab } from './wheel/tabs/WalletsTab';
import { CARD } from './wheel/ui';

export default function WheelConfig() {
    const navigate = useNavigate();
    const { t } = useTranslation('features');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<PanelStatus>(null);

    const [wheels, setWheels] = useState<WheelSummary[]>([]);
    const [wheel, setWheel] = useState<WheelSummary | null>(null);
    const [segments, setSegments] = useState<Segment[]>([]);
    const [sources, setSources] = useState<Source[]>([]);
    const [msgPack, setMsgPack] = useState<MessagePack | null>(null);
    const [tab, setTab] = useState<Tab>('segments');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [copied, setCopied] = useState(false);
    // Dispara la celebracion sobre el preview desde el boton de la pestana Aspecto.
    // Vive aca y no en LookTab porque el preview esta en la otra columna.
    const [celebNonce, setCelebNonce] = useState(0);

    // El idioma sale de la configuracion de la cuenta, no de un selector propio de esta
    // pantalla: dos sitios donde cambiar lo mismo terminan diciendo cosas distintas.
    const { currentLanguage } = useLanguage();
    const msgLang: 'es' | 'en' = currentLanguage === 'en' ? 'en' : 'es';

    const ctx = { wheel, t, setStatus, setSaving };
    const channel = useChannelResources();
    const { visual, setVisualRaw, patchVisual, patchPointer, patchSound } = useWheelVisual();
    const raffle = useRaffleAdmin(ctx);
    const history = useSpinHistory(ctx);
    const wallets = useWallets(ctx);
    const deliveries = useDeliveries(ctx);

    // El overlay se identifica por canal + slug, sin token: es la convencion del
    // resto de overlays del proyecto y una fuente de OBS no puede llevar auth.
    const overlayUrl = wheel && channel.channelLogin
        ? `${channel.frontendUrl}/overlay/rueda?channel=${channel.channelLogin}&wheel=${wheel.slug}`
        : '';

    // Los gajos que el lienzo dibuja. Son los mismos que el preview de la columna
    // derecha: colocar la rueda mirando gajos que no son los tuyos seria colocarla
    // a ojo, que es justo lo que el editor viene a arreglar.
    const visiblesParaLienzo = segments
        .filter(sg => sg.isEnabled)
        .map(sg => ({ id: sg.id, label: sg.label || '—', color: sg.color, icon: sg.icon }));

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
            await raffle.load(id);
            setTab('raffle');
        } else {
            raffle.clear();
        }

        const mensajes = await api.get(`/wheel/wheels/${id}/messages`);
        setMsgPack({
            messages: mensajes.data.messages || {},
            defaults: mensajes.data.defaults || {},
            placeholders: mensajes.data.placeholders || {},
        });
    };

    useEffect(() => { loadWheels(); }, [loadWheels]);

    // Al entrar en Historial se piden las dos cosas de una: las tarjetas de arriba y
    // la tabla salen de endpoints distintos porque las metricas usan TODO el historial
    // y la tabla solo la ventana del tier. Son las dos consultas mas caras del panel y
    // la mayoria de las visitas no las miran, asi que no se piden al abrir la pantalla.
    const { loadSpins, loadMetrics } = history;
    const loadWallets = wallets.load;
    useEffect(() => {
        if (!wheel) return;
        if (tab === 'history') { loadSpins(wheel.id, 1, history.filters); loadMetrics(wheel.id); }
        if (tab === 'wallets') loadWallets(wallets.search);
        // Los filtros y la busqueda los dispara el propio formulario, no este efecto:
        // ponerlos en las deps pediria al servidor una consulta por cada tecla.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, wheel?.id, loadSpins, loadMetrics, loadWallets]);

    // ----------------------------------------------------------------
    // Ruedas: crear, duplicar, borrar, renombrar
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
                await raffle.load(data.wheel.id);
                setTab('raffle');
            } else {
                setSegments([0, 1, 2, 3].map(emptySegment));
                setTab('segments');
            }
            await channel.loadLimits();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            await channel.loadLimits();
            setStatus({
                kind: 'ok',
                // La copia nace apagada; si el cupo esta lleno hay que decirlo ANTES de
                // que intente encenderla y se coma un error.
                text: data.quotaFull ? t('wheel.duplicatedQuotaFull') : t('wheel.duplicated'),
            });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            setStatus({ kind: 'error', text: e?.response?.data?.message || t('wheel.status.saveFailed') });
        } finally {
            setSaving(false);
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

            await channel.loadLimits();
            setStatus({ kind: 'ok', text: t('wheel.deleted') });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            setStatus({ kind: 'error', text: e?.response?.data?.message || t('wheel.status.saveFailed') });
        }
    };

    const copyUrl = async () => {
        await navigator.clipboard.writeText(overlayUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    // ----------------------------------------------------------------
    // Guardado
    // ----------------------------------------------------------------
    const saveWheelFields = async (changes: Partial<WheelSummary>) => {
        if (!wheel) return;
        setSaving(true);
        setStatus(null);
        try {
            await api.put(`/wheel/wheels/${wheel.id}`, changes);
            // Encender o apagar mueve el cupo del tier, asi que el contador de arriba
            // quedaria mintiendo hasta la proxima recarga de la pagina.
            if (changes.isEnabled !== undefined) await channel.loadLimits();
            setStatus({ kind: 'ok', text: t('wheel.status.saved') });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setStatus({ kind: 'error', text: err?.response?.data?.message || t('wheel.status.saveFailed') });
        } finally {
            setSaving(false);
        }
    };

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setStatus({ kind: 'error', text: err?.response?.data?.message || t('wheel.status.saveFailed') });
        } finally {
            setSaving(false);
        }
    };

    // Guarda lo de la pestaña en la que estás. Un botón que guarda "todo" obliga a
    // mandar campos que no tocaste y a resolver conflictos que no existen.
    const save = async () => {
        if (tab === 'segments') return saveSegments();
        if (tab === 'credits') return saveCredits();
        if (tab === 'messages') return saveMessages();
        if (tab === 'raffle') return raffle.save();
        // El lienzo vive en el mismo jsonb que el aspecto, asi que guarda igual.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (tab === 'look' || tab === 'canvas') return saveWheelFields({ visualConfig: visual } as any);
        return saveLimits();
    };

    // ----------------------------------------------------------------
    // Ediciones locales (no tocan el servidor hasta guardar)
    // ----------------------------------------------------------------
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

    const patchMessage = (key: string, lang: 'es' | 'en', value: string) =>
        setMsgPack(prev => prev && ({
            ...prev,
            messages: { ...prev.messages, [key]: { ...(prev.messages[key] ?? { es: null, en: null }), [lang]: value } },
        }));

    // ----------------------------------------------------------------
    // Pruebas
    // ----------------------------------------------------------------
    const testSpin = async () => {
        if (!wheel) return;
        setStatus(null);
        try {
            const { data } = await api.post(`/wheel/wheels/${wheel.id}/test-spin`);
            setStatus({ kind: 'ok', text: t('wheel.status.testSpun', { label: data.result.label }) });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setStatus({ kind: 'error', text: err?.response?.data?.message || t('wheel.status.saveFailed') });
            return null;
        }
    };

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
            <WheelHeader
                wheel={wheel} wheels={wheels} tab={tab} saving={saving} limits={channel.limits}
                onBack={() => navigate('/overlays')}
                onOpen={openWheel}
                onCreate={() => createWheel('prizes')}
                onTestSpin={testSpin}
                onSave={save}
                t={t}
            />

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
                        <TabNav wheel={wheel} tab={tab} pendingCount={deliveries.pendingCount} onTab={setTab} t={t} />

                        {tab === 'segments' && (
                            <SegmentsTab
                                segments={segments} wheels={wheels} soundAlerts={channel.soundAlerts}
                                limits={channel.limits} onSegments={setSegments} t={t}
                            />
                        )}

                        {tab === 'credits' && (
                            <CreditsTab
                                wheel={wheel} sources={sources} rewards={channel.rewards} rewardsError={channel.rewardsError}
                                onWheel={patchWheel} onSource={patchSource} onSourceAt={patchSourceAt}
                                onAddReward={addReward} onRemoveAt={removeSourceAt} t={t}
                            />
                        )}

                        {tab === 'messages' && msgPack && (
                            <MessagesTab pack={msgPack} lang={msgLang} onChange={patchMessage} t={t} />
                        )}

                        {tab === 'test' && (
                            <TestTab wheel={wheel} sources={sources} rewards={channel.rewards} onSimulate={simulate} t={t} />
                        )}

                        {tab === 'limits' && (
                            <LimitsTab wheel={wheel} onWheel={patchWheel} t={t} />
                        )}

                        {tab === 'raffle' && raffle.raffle && (
                            <RaffleTab
                                config={raffle.raffle}
                                entries={raffle.entries}
                                creditLabel={wheel.creditLabel || 'creditos'}
                                saving={saving}
                                onConfig={raffle.patch}
                                onWindow={raffle.setWindow}
                                onDraw={raffle.draw}
                                onAdd={raffle.add}
                                onRemove={raffle.remove}
                                onMultiplier={raffle.setMultiplier}
                                onReset={raffle.reset}
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
                                canHideWatermark={!!channel.limits?.canHideWatermark}
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
                                spins={history.spins}
                                total={history.total}
                                page={history.page}
                                metrics={history.metrics}
                                filters={history.filters}
                                historyDays={channel.limits?.historyDays ?? -1}
                                onFilters={history.setFilters}
                                onApply={history.apply}
                                onReset={history.reset}
                                onPage={history.goToPage}
                                onExport={history.exportCsv}
                                t={t}
                            />
                        )}

                        {tab === 'wallets' && (
                            <WalletsTab
                                wallets={wallets.wallets}
                                search={wallets.search}
                                onSearch={wallets.setSearch}
                                onApply={() => wallets.load(wallets.search)}
                                onSetCredits={wallets.setCredits}
                                t={t}
                            />
                        )}

                        {tab === 'deliveries' && (
                            <DeliveriesTab
                                deliveries={deliveries.deliveries}
                                filter={deliveries.filter}
                                onFilter={deliveries.changeFilter}
                                onResolve={deliveries.resolve}
                                t={t}
                            />
                        )}
                    </div>

                    <WheelSidebar
                        wheel={wheel} wheels={wheels} segments={segments} visual={visual}
                        celebNonce={celebNonce} saving={saving} confirmDelete={confirmDelete}
                        copied={copied} overlayUrl={overlayUrl}
                        onRename={name => setWheel({ ...wheel, name })}
                        onRenameCommit={async nombre => {
                            await saveWheelFields({ name: nombre });
                            setWheels(prev => prev.map(w => (w.id === wheel.id ? { ...w, name: nombre } : w)));
                        }}
                        onToggleEnabled={async v => {
                            setWheel({ ...wheel, isEnabled: v });
                            await saveWheelFields({ isEnabled: v });
                            setWheels(prev => prev.map(w => (w.id === wheel.id ? { ...w, isEnabled: v } : w)));
                        }}
                        onDuplicate={duplicateWheel}
                        onAskDelete={() => setConfirmDelete(true)}
                        onCancelDelete={() => setConfirmDelete(false)}
                        onDelete={deleteWheel}
                        onSlug={changeSlug}
                        onCopy={copyUrl}
                        t={t}
                    />
                </div>
            )}
        </div>
    );
}
