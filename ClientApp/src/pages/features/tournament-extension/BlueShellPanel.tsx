import React, { useEffect, useState } from 'react';
import { Shield, Sparkles, Check, AlertTriangle, Loader2, Zap, Pencil } from 'lucide-react';
import api from '../../../services/api';
import { EditionPicker } from './shared';
import type { TournamentEdition } from './shared';

// Milestone 1 — motor de castigos/suerte (nombre interno de desarrollo; cada canal le
// pone su propio nombre a la mecanica via edition.shellItemName/aegisMechanicName, no
// se usa el nombre de ningun producto de terceros en ningun texto de cara al usuario).
// Ver .dev/torneos/04-motor-blue-shell-aegis.md.
// El "lanzar" de acá es admin-only (no hay login de participante real todavia, fase 5) —
// pensado para pruebas y para que el organizador pueda operar el sistema manualmente.

interface PunishmentType {
    id: number;
    name: string;
    allowsReverse: boolean;
}

interface ShellTrigger {
    id: number;
    name: string;
    conditionType: string;
    thresholdValue: number;
    shellsGranted: number;
    isActive: boolean;
}

interface BlueShellRules {
    maxInventory: number;
    throwBlockWindowMinutes: number;
    disableLastNHours: number;
    dailyDropEnabled: boolean;
    dailyDropChallengeTemplate: string | null;
}

interface InventoryRow {
    participantId: number;
    displayName: string;
    count: number;
    totalObtained: number;
    totalThrown: number;
    totalReceived: number;
}

interface ShellEvent {
    id: number;
    type: string;
    sourceName: string;
    targetName: string | null;
    triggerName: string | null;
    punishmentName: string | null;
    wasReverse: boolean;
    wasLostFull: boolean;
    fulfilledAt: string | null;
    createdAt: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
    obtained: 'Obtenida',
    thrown: 'Lanzada',
    received: 'Recibida',
    fulfilled: 'Cumplida',
    stolen: 'Robada',
};

export default function BlueShellPanel({
    edition,
    editions,
    onSelectEdition,
    onEditionsChanged,
}: {
    edition: TournamentEdition | null;
    editions: TournamentEdition[];
    onSelectEdition: (id: number) => void;
    onEditionsChanged: () => void;
}) {
    const [punishments, setPunishments] = useState<PunishmentType[]>([]);
    const [triggers, setTriggers] = useState<ShellTrigger[]>([]);
    const [rules, setRules] = useState<BlueShellRules | null>(null);
    const [inventory, setInventory] = useState<InventoryRow[]>([]);
    const [events, setEvents] = useState<ShellEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const loadAll = async (editionId: number) => {
        setLoading(true);
        try {
            const [catalogsRes, rulesRes, invRes, eventsRes] = await Promise.all([
                api.get(`/admin/tournament/editions/${editionId}/blueshell/catalogs`),
                api.get(`/admin/tournament/editions/${editionId}/blueshell/rules`),
                api.get(`/admin/tournament/editions/${editionId}/blueshell/inventory`),
                api.get(`/admin/tournament/editions/${editionId}/blueshell/events`),
            ]);
            setPunishments(catalogsRes.data.punishments || []);
            setTriggers(catalogsRes.data.triggers || []);
            setRules(rulesRes.data.rules || null);
            setInventory(invRes.data.inventory || []);
            setEvents(eventsRes.data.events || []);
        } catch (err) {
            console.error('Error cargando el sistema de castigos', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (edition) loadAll(edition.id);
    }, [edition?.id]);

    if (!edition) {
        return <EditionPicker editions={editions} onSelectEdition={onSelectEdition} />;
    }

    const handleSeed = async () => {
        setSeeding(true);
        setMessage(null);
        try {
            await api.post(`/admin/tournament/editions/${edition.id}/blueshell/seed-defaults`);
            setMessage({ ok: true, text: 'Catalogos y reglas por defecto cargados' });
            await loadAll(edition.id);
        } catch (err: any) {
            setMessage({ ok: false, text: err?.response?.data?.message || 'Error sembrando valores por defecto' });
        } finally {
            setSeeding(false);
        }
    };

    const handleFulfill = async (eventId: number) => {
        try {
            await api.post(`/admin/tournament/blueshell/events/${eventId}/fulfill`);
            await loadAll(edition.id);
        } catch (err) {
            console.error('Error marcando como cumplido', err);
        }
    };

    const hasCatalogs = punishments.length > 0 && triggers.length > 0 && rules != null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg 4xl:text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[#2563eb]" /> {edition.shellItemName}s / {edition.aegisMechanicName} — {edition.name}
                </h2>
                {!hasCatalogs && (
                    <button
                        onClick={handleSeed}
                        disabled={seeding}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-sm font-bold hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-50"
                    >
                        {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Sembrar valores por defecto
                    </button>
                )}
            </div>

            <MechanicNamesForm edition={edition} onSaved={onEditionsChanged} />

            {message && (
                <p className={`text-sm flex items-center gap-1 ${message.ok ? 'text-[#2563eb]' : 'text-red-600 dark:text-red-400'}`}>
                    {message.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {message.text}
                </p>
            )}

            {!hasCatalogs && !loading && (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">
                    Esta edicion todavia no tiene catalogo de castigos, triggers ni reglas — apreta "Sembrar valores por defecto" para cargar un set inicial (9
                    castigos, 8 triggers, cooldowns y reverse por rango de posicion) que despues podes editar o borrar libremente.
                </p>
            )}

            {loading ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Cargando...</p>
            ) : (
                hasCatalogs && (
                    <>
                        <RulesSummary rules={rules!} />
                        <InventoryTable rows={inventory} />
                        {inventory.length >= 2 && punishments.length > 0 && (
                            <ThrowShellForm
                                editionId={edition.id}
                                itemName={edition.shellItemName}
                                participants={inventory}
                                punishments={punishments}
                                onDone={() => loadAll(edition.id)}
                            />
                        )}
                        <EventsLog events={events} onFulfill={handleFulfill} />
                        <TriggersList triggers={triggers} />
                    </>
                )
            )}
        </div>
    );
}

function RulesSummary({ rules }: { rules: BlueShellRules }) {
    return (
        <div className="p-4 4xl:p-6 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626]">
            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">Reglas activas</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                <div>
                    <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{rules.maxInventory}</span> max. inventario
                </div>
                <div>
                    <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{rules.throwBlockWindowMinutes}min</span> bloqueo post-partida
                </div>
                <div>
                    <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{rules.disableLastNHours}h</span> apagado antes del cierre
                </div>
                <div>
                    <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{rules.dailyDropEnabled ? 'Activado' : 'Desactivado'}</span> drop diario
                </div>
            </div>
        </div>
    );
}

function InventoryTable({ rows }: { rows: InventoryRow[] }) {
    return (
        <div>
            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">Inventarios</h3>
            {rows.length === 0 ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Sin participantes en esta edicion todavia.</p>
            ) : (
                <div className="space-y-1.5">
                    {rows.map((r) => (
                        <div key={r.participantId} className="flex items-center justify-between p-3 rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                            <span className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{r.displayName}</span>
                            <div className="flex items-center gap-3 text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                                <span>obtenidas {r.totalObtained}</span>
                                <span>lanzadas {r.totalThrown}</span>
                                <span>recibidas {r.totalReceived}</span>
                                <span className="font-black text-[#2563eb] text-sm">{r.count} en inventario</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ThrowShellForm({
    editionId,
    itemName,
    participants,
    punishments,
    onDone,
}: {
    editionId: number;
    itemName: string;
    participants: InventoryRow[];
    punishments: PunishmentType[];
    onDone: () => void;
}) {
    const [sourceId, setSourceId] = useState<number | ''>('');
    const [targetId, setTargetId] = useState<number | ''>('');
    const [punishmentId, setPunishmentId] = useState<number | ''>('');
    const [throwing, setThrowing] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

    const handleThrow = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sourceId || !targetId || !punishmentId) return;
        setThrowing(true);
        setResult(null);
        try {
            const res = await api.post(`/admin/tournament/editions/${editionId}/blueshell/throw`, {
                sourceParticipantId: sourceId,
                targetParticipantId: targetId,
                punishmentTypeId: punishmentId,
            });
            setResult({ ok: true, text: res.data.wasReverse ? '¡Reverse! El castigo volvio al lanzador' : 'Lanzada correctamente' });
            onDone();
        } catch (err: any) {
            setResult({ ok: false, text: err?.response?.data?.message || 'Error lanzando la shell' });
        } finally {
            setThrowing(false);
        }
    };

    return (
        <form onSubmit={handleThrow} className="p-4 4xl:p-6 rounded-xl border border-[#e2e8f0] dark:border-[#374151] space-y-3">
            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#2563eb]" /> Lanzar {itemName} (admin — sin login de participante todavia)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                    value={sourceId}
                    onChange={(e) => setSourceId(Number(e.target.value) || '')}
                    className="px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                >
                    <option value="">Quien lanza...</option>
                    {participants.map((p) => (
                        <option key={p.participantId} value={p.participantId} disabled={p.count <= 0}>
                            {p.displayName} ({p.count})
                        </option>
                    ))}
                </select>
                <select
                    value={targetId}
                    onChange={(e) => setTargetId(Number(e.target.value) || '')}
                    className="px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                >
                    <option value="">A quien...</option>
                    {participants.map((p) => (
                        <option key={p.participantId} value={p.participantId}>
                            {p.displayName}
                        </option>
                    ))}
                </select>
                <select
                    value={punishmentId}
                    onChange={(e) => setPunishmentId(Number(e.target.value) || '')}
                    className="px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                >
                    <option value="">Que castigo...</option>
                    {punishments.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
                        </option>
                    ))}
                </select>
            </div>
            {result && (
                <p className={`text-sm flex items-center gap-1 ${result.ok ? 'text-[#2563eb]' : 'text-red-600 dark:text-red-400'}`}>
                    {result.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {result.text}
                </p>
            )}
            <button
                type="submit"
                disabled={throwing || !sourceId || !targetId || !punishmentId}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-sm font-bold hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-50 flex items-center gap-1.5"
            >
                {throwing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Lanzar
            </button>
        </form>
    );
}

function EventsLog({ events, onFulfill }: { events: ShellEvent[]; onFulfill: (id: number) => void }) {
    return (
        <div>
            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">Log de eventos</h3>
            {events.length === 0 ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">
                    Sin eventos todavia — se generan solos cuando el poller trackea partidas que cumplen algun trigger.
                </p>
            ) : (
                <div className="space-y-1.5">
                    {events.map((e) => (
                        <div key={e.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8]">
                                    {EVENT_TYPE_LABELS[e.type] || e.type}
                                </span>
                                <span className="text-[#1e293b] dark:text-[#f8fafc]">
                                    {e.sourceName}
                                    {e.targetName ? ` → ${e.targetName}` : ''}
                                </span>
                                {e.triggerName && <span className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">({e.triggerName})</span>}
                                {e.punishmentName && <span className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">— {e.punishmentName}</span>}
                                {e.wasReverse && <span className="text-xs text-amber-600 dark:text-amber-400 font-bold">REVERSE</span>}
                                {e.wasLostFull && <span className="text-xs text-red-600 dark:text-red-400">inventario lleno</span>}
                            </div>
                            {e.type === 'thrown' && !e.fulfilledAt && (
                                <button
                                    onClick={() => onFulfill(e.id)}
                                    className="text-xs px-2 py-1 rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]"
                                >
                                    Marcar cumplido
                                </button>
                            )}
                            {e.fulfilledAt && <span className="text-xs text-[#2563eb]">cumplido</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function MechanicNamesForm({ edition, onSaved }: { edition: TournamentEdition; onSaved: () => void }) {
    const [editing, setEditing] = useState(false);
    const [shellItemName, setShellItemName] = useState(edition.shellItemName);
    const [aegisMechanicName, setAegisMechanicName] = useState(edition.aegisMechanicName);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setShellItemName(edition.shellItemName);
        setAegisMechanicName(edition.aegisMechanicName);
    }, [edition.id, edition.shellItemName, edition.aegisMechanicName]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put(`/admin/tournament/editions/${edition.id}/mechanic-names`, { shellItemName, aegisMechanicName });
            setEditing(false);
            onSaved();
        } catch (err) {
            console.error('Error guardando los nombres', err);
        } finally {
            setSaving(false);
        }
    };

    if (!editing) {
        return (
            <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb]"
            >
                <Pencil className="w-3.5 h-3.5" /> Esta mecanica es tuya — ponele tu propio nombre en vez de "Ficha de Castigo" / "Factor Suerte"
            </button>
        );
    }

    return (
        <form onSubmit={handleSave} className="p-4 4xl:p-6 rounded-xl border border-[#e2e8f0] dark:border-[#374151] space-y-3">
            <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                Nombre propio de tu torneo para cada mecanica — se usa en toda la UI y en los mensajes del sistema.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Nombre del item que se lanza como castigo</label>
                    <input
                        value={shellItemName}
                        onChange={(e) => setShellItemName(e.target.value)}
                        maxLength={60}
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Nombre de la mecanica de suerte de LP</label>
                    <input
                        value={aegisMechanicName}
                        onChange={(e) => setAegisMechanicName(e.target.value)}
                        maxLength={60}
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                    />
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-sm font-bold hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-50 flex items-center gap-1.5"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Guardar
                </button>
                <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] text-sm font-bold hover:bg-[#e2e8f0] dark:hover:bg-[#374151]"
                >
                    Cancelar
                </button>
            </div>
        </form>
    );
}

function TriggersList({ triggers }: { triggers: ShellTrigger[] }) {
    return (
        <details className="text-sm">
            <summary className="cursor-pointer font-bold text-[#1e293b] dark:text-[#f8fafc]">Triggers de obtencion ({triggers.length})</summary>
            <div className="mt-2 space-y-1 text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                {triggers.map((t) => (
                    <div key={t.id}>
                        {t.name} — otorga {t.shellsGranted} ficha(s){!t.isActive && ' (inactivo)'}
                    </div>
                ))}
            </div>
        </details>
    );
}
