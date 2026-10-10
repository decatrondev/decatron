/**
 * Timer Extension - Raffles Tab Component
 *
 * Sistema completo de sorteos y rifas con múltiples métodos de participación.
 * Integrado con la configuración global del Timer.
 */

import { useState, useEffect } from 'react';
import { Gift, Users, Award, Plus, X, RotateCcw, AlertCircle, Loader2, UserPlus, Search, Trash2, Ban, DownloadCloud, Settings2, Trophy, Filter, Clock, Zap, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import api from '../../../../../services/api';
import type { RafflesConfig } from '../../types';
import { formatDateOnlyIn, formatShortDateTimeIn } from '../../utils';

interface TimerSessionInfo {
    id: number;
    startedAt: string;
    endedAt?: string;
    initialDuration: number;
    totalAddedTime: number;
    isActive: boolean;
    totalEvents: number;
    uniqueParticipants: number;
}

interface RafflesTabProps {
    rafflesConfig: RafflesConfig;
    onRafflesConfigChange: (updates: Partial<RafflesConfig>) => void;
    /** Zona horaria configurada por el streamer (IANA, ej: "America/Lima"). */
    timeZone?: string;
}

interface Raffle {
    id: number;
    channelName: string;
    name: string;
    description?: string;
    winnersCount: number;
    status: 'open' | 'closed' | 'completed' | 'cancelled';
    configJson: string;
    createdAt: string;
    updatedAt: string;
    closedAt?: string;
    drawnAt?: string;
    createdBy: number;
    totalParticipants: number;
    totalTickets: number;
}

// ... (Resto de interfaces igual)
interface RaffleParticipant {
    id: number;
    raffleId: number;
    username: string;
    twitchUserId?: number;
    tickets: number;
    entryMethod: string;
    metadataJson?: string;
    joinedAt: string;
    isDisqualified: boolean;
    disqualificationReason?: string;
}

interface RaffleWinner {
    id: number;
    raffleId: number;
    participantId: number;
    username: string;
    position: number;
    wonAt: string;
    hasConfirmed: boolean;
    wasRerolled: boolean;
    rerollReason?: string;
}

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
        />
        <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-faint rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all border-ds-border peer-checked:bg-ds-accent"></div>
    </label>
);

export const RafflesTab: React.FC<RafflesTabProps> = ({ rafflesConfig, onRafflesConfigChange, timeZone }) => {
    // Estado local solo para UI efímera
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [raffles, setRaffles] = useState<Raffle[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filterAll, setFilterAll] = useState(false); // Estado para ver todos o solo activos

    // ... (Estados de gestión de participantes y creación igual)
    const [selectedRaffleId, setSelectedRaffleId] = useState<number | null>(null);
    const [participants, setParticipants] = useState<RaffleParticipant[]>([]);
    const [winners, setWinners] = useState<RaffleWinner[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [participantSearch, setParticipantSearch] = useState('');
    const [manualParticipantName, setManualParticipantName] = useState('');
    const [manualParticipantTickets, setManualParticipantTickets] = useState(1);
    const [showAddParticipantForm, setShowAddParticipantForm] = useState(false);

    const [tempRaffleName, setTempRaffleName] = useState('');
    const [tempDescription, setTempDescription] = useState('');
    const [tempWinnersCount, setTempWinnersCount] = useState(1);
    const [autoImportOnCreate, setAutoImportOnCreate] = useState(true);
    const [tempConfig, setTempConfig] = useState<RafflesConfig | null>(null);
    const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);

    // Nuevos estados para selector de sesión e import avanzado
    const [availableSessions, setAvailableSessions] = useState<TimerSessionInfo[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
    const [selectedSessionIds, setSelectedSessionIds] = useState<number[]>([]);
    const [multiSessionMode, setMultiSessionMode] = useState(false);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [weightByContribution, setWeightByContribution] = useState(false);
    const [winnerCooldownDays, setWinnerCooldownDays] = useState(0);
    const [allowedSubTiers, setAllowedSubTiers] = useState<string[]>(['tier1', 'tier2', 'tier3', 'prime']);
    const [minGifts, setMinGifts] = useState(0);

    // Import modal state
    const [showImportModal, setShowImportModal] = useState(false);
    const [importForceReimport, setImportForceReimport] = useState(false);
    const [importMergeTickets, setImportMergeTickets] = useState(false);

    useEffect(() => {
        if (showCreateForm) {
            setTempConfig(JSON.parse(JSON.stringify(rafflesConfig)));
            setTempRaffleName('');
            setTempDescription('');
            setTempWinnersCount(1);
            setAutoImportOnCreate(true);
            setShowAdvancedConfig(false);
            setSelectedSessionId(null);
            setSelectedSessionIds([]);
            setMultiSessionMode(false);
            setWeightByContribution(false);
            setWinnerCooldownDays(rafflesConfig.requirements?.winnerCooldownDays ?? 0);
            setAllowedSubTiers(['tier1', 'tier2', 'tier3', 'prime']);
            setMinGifts(0);
            loadAvailableSessions();
        }
    }, [showCreateForm, rafflesConfig]);

    useEffect(() => {
        if (showImportModal) {
            setImportForceReimport(false);
            setImportMergeTickets(false);
            setSelectedSessionId(null);
            setSelectedSessionIds([]);
            setMultiSessionMode(false);
            loadAvailableSessions();
        }
    }, [showImportModal]);

    useEffect(() => {
        if (rafflesConfig.enabled) {
            loadRaffles();
        }
    }, [rafflesConfig.enabled]);

    useEffect(() => {
        if (selectedRaffleId) {
            loadRaffleDetails(selectedRaffleId);
        } else {
            setParticipants([]);
            setWinners([]);
        }
    }, [selectedRaffleId]);

    const loadAvailableSessions = async () => {
        try {
            setLoadingSessions(true);
            // Usa el endpoint del timer que ya existe y funciona
            const res = await api.get('/timer/sessions');
            setAvailableSessions(res.data.sessions || []);
        } catch (err) {
            console.warn('Error loading sessions:', err);
            setAvailableSessions([]);
        } finally {
            setLoadingSessions(false);
        }
    };

    const toggleSessionInMulti = (sessionId: number) => {
        setSelectedSessionIds(prev =>
            prev.includes(sessionId)
                ? prev.filter(id => id !== sessionId)
                : [...prev, sessionId]
        );
    };

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const loadRaffles = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/raffles');
            setRaffles(Array.isArray(response.data) ? response.data : []);
        } catch (err: any) {
            console.error('Error loading raffles:', err);
            if (err.response?.status !== 404) {
                setError(err.response?.data?.message || 'Error cargando sorteos');
            }
        } finally {
            setLoading(false);
        }
    };

    const loadRaffleDetails = async (raffleId: number) => {
        try {
            setLoadingDetails(true);
            const pRes = await api.get(`/raffles/${raffleId}/participants`);
            setParticipants(pRes.data.participants || []);
            const wRes = await api.get(`/raffles/${raffleId}/winners`);
            setWinners(wRes.data.winners || wRes.data || []);
        } catch (err: any) {
            console.error('Error loading details:', err);
            setError('Error cargando detalles del sorteo');
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleCreateRaffle = async () => {
        if (!tempRaffleName.trim()) {
            setError('El nombre del sorteo es requerido');
            return;
        }
        if (!tempConfig) return;

        try {
            setLoading(true);
            setError(null);

            // Construir config completa con los nuevos campos
            const config = {
                ...tempConfig,
                winnerCooldownDays: winnerCooldownDays,
                methods: {
                    ...tempConfig.methods,
                    bits: { ...tempConfig.methods.bits },
                    subscription: { ...tempConfig.methods.subscription, allowedTiers: allowedSubTiers },
                    giftSubscription: { ...tempConfig.methods.giftSubscription, minAmount: minGifts },
                    follow: { ...tempConfig.methods.follow },
                    weightByContribution: weightByContribution,
                },
                requirements: {
                    ...tempConfig.requirements,
                    winnerCooldownDays: winnerCooldownDays,
                }
            };

            const payload = {
                name: tempRaffleName,
                description: tempDescription || (autoImportOnCreate ? "Sorteo vinculado a sesión del timer" : undefined),
                winnersCount: tempWinnersCount,
                config: config
            };

            const res = await api.post('/raffles', payload);
            const newRaffleId = res.data?.raffle?.id;

            if (newRaffleId && autoImportOnCreate) {
                try {
                    const importPayload: any = {
                        weightByContribution: weightByContribution,
                        winnerCooldownDays: winnerCooldownDays > 0 ? winnerCooldownDays : undefined,
                        methods: {
                            bitsEnabled: tempConfig.methods.bits.enabled,
                            subsEnabled: tempConfig.methods.subscription.enabled,
                            giftSubsEnabled: tempConfig.methods.giftSubscription.enabled,
                            followsEnabled: tempConfig.methods.follow?.enabled ?? false,
                            minBits: tempConfig.methods.bits.minAmount || 0,
                            minGifts: minGifts,
                            weightByContribution: weightByContribution,
                            allowedSubTiers: allowedSubTiers,
                        }
                    };

                    if (multiSessionMode && selectedSessionIds.length > 0) {
                        importPayload.sessionIds = selectedSessionIds;
                    } else if (selectedSessionId) {
                        importPayload.sessionId = selectedSessionId;
                    }

                    const importRes = await api.post(`/raffles/${newRaffleId}/import-session`, importPayload);
                    if (importRes.data?.imported > 0) {
                        setError(null);
                    }
                } catch (importErr: any) {
                    console.warn("Auto-import:", importErr?.response?.data?.message || importErr);
                }
            }

            if (newRaffleId) {
                setSelectedRaffleId(newRaffleId);
            }

            setShowCreateForm(false);
            await loadRaffles();
        } catch (err: any) {
            console.error('Error creating raffle:', err);
            setError(err.response?.data?.message || 'Error creando sorteo');
        } finally {
            setLoading(false);
        }
    };

    const handleCloseRaffle = async (raffleId: number) => {
        try {
            setLoading(true);
            await api.post(`/raffles/${raffleId}/close`);
            await loadRaffles();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error cerrando sorteo');
        } finally {
            setLoading(false);
        }
    };

    // Función para borrar sorteo desde la lista
    const handleDeleteRaffle = async (e: React.MouseEvent, raffleId: number) => {
        e.stopPropagation(); // Evitar seleccionar al borrar
        if (!confirm('¿Estás seguro de eliminar este sorteo y todo su historial?')) return;

        try {
            setLoading(true);
            await api.delete(`/raffles/${raffleId}`);
            if (selectedRaffleId === raffleId) setSelectedRaffleId(null);
            await loadRaffles();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error eliminando sorteo');
        } finally {
            setLoading(false);
        }
    };

    const handleDrawWinners = async (raffleId: number) => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.post(`/raffles/${raffleId}/draw`, { weighted: false });

            if (response.data?.winners?.length > 0) {
                const winnerNames = response.data.winners.map((w: RaffleWinner) => w.username).join(', ');
                alert(`🎉 Ganadores: ${winnerNames}`);
            }

            await loadRaffles();
            await loadRaffleDetails(raffleId);
        } catch (err: any) {
            if (err.response?.status === 400 && err.response?.data?.message?.includes('No hay participantes')) {
                setError('⚠️ No hay participantes inscritos.');
            } else {
                setError(err.response?.data?.message || 'Error sorteando ganadores');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleReroll = async (raffleId: number) => {
        try {
            setLoading(true);
            
            // 1. Obtener lista fresca de ganadores para asegurar consistencia
            const winnersRes = await api.get(`/raffles/${raffleId}/winners`);
            const currentWinners = winnersRes.data.winners || winnersRes.data || [];

            if (!Array.isArray(currentWinners) || currentWinners.length === 0) {
                setError('No hay ganadores para re-sortear. ¡Sortea primero!');
                return;
            }

            // 2. Tomar el último ganador (el más reciente)
            // Asumimos que la API los devuelve ordenados por posición/fecha
            const lastWinner = currentWinners[currentWinners.length - 1];
            
            if (!lastWinner || !lastWinner.id) {
                setError('Error identificando al ganador a re-sortear.');
                return;
            }

            // 3. Ejecutar Reroll
            const response = await api.post(`/raffles/winners/${lastWinner.id}/reroll`, {
                reason: 'Re-roll solicitado desde UI'
            });

            if (response.data?.winner || response.data?.newWinner) {
                 const winnerName = response.data.winner?.username || response.data.newWinner?.username;
                 alert(`🔄 Nuevo ganador: ${winnerName}`);
            }

            // 4. Actualizar UI
            await loadRaffles();
            await loadRaffleDetails(raffleId);
        } catch (err: any) {
            console.error('Error rerolling:', err);
            setError(err.response?.data?.message || 'Error al intentar re-sortear.');
        } finally {
            setLoading(false);
        }
    };

    // ... (Add/Remove Participant igual)
    const handleAddParticipant = async () => {
        if (!selectedRaffleId || !manualParticipantName.trim()) return;
        try {
            setLoadingDetails(true);
            await api.post(`/raffles/${selectedRaffleId}/participants`, {
                username: manualParticipantName,
                tickets: manualParticipantTickets
            });
            setManualParticipantName('');
            setManualParticipantTickets(1);
            await loadRaffleDetails(selectedRaffleId);
            await loadRaffles(); 
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error añadiendo participante');
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleRemoveParticipant = async (participantId: number) => {
        if (!selectedRaffleId || !confirm('¿Eliminar participante?')) return;
        try {
            setLoadingDetails(true);
            await api.delete(`/raffles/${selectedRaffleId}/participants/${participantId}`);
            await loadRaffleDetails(selectedRaffleId);
            await loadRaffles(); 
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error eliminando participante');
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleImportSession = async (options?: {
        sessionId?: number;
        sessionIds?: number[];
        forceReimport?: boolean;
        mergeTickets?: boolean;
    }) => {
        if (!selectedRaffleId) return;
        try {
            setLoadingDetails(true);
            const payload: any = {};
            if (options?.sessionId) payload.sessionId = options.sessionId;
            if (options?.sessionIds && options.sessionIds.length > 0) payload.sessionIds = options.sessionIds;
            if (options?.forceReimport) payload.forceReimport = true;
            if (options?.mergeTickets) payload.mergeTickets = true;

            const res = await api.post(`/raffles/${selectedRaffleId}/import-session`, payload);
            if (res.data.success) {
                const parts = [];
                if (res.data.imported > 0) parts.push(`${res.data.imported} importados`);
                if (res.data.skippedDuplicates > 0) parts.push(`${res.data.skippedDuplicates} duplicados omitidos`);
                if (res.data.updatedTickets > 0) parts.push(`${res.data.updatedTickets} tickets actualizados`);
                if (res.data.alreadyImportedSessionIds?.length > 0) parts.push(`Sesiones ya importadas: ${res.data.alreadyImportedSessionIds.join(', ')}`);
                alert(`${res.data.message}${parts.length > 0 ? '\n\n' + parts.join('\n') : ''}`);
                await loadRaffleDetails(selectedRaffleId);
                await loadRaffles();
            }
            setShowImportModal(false);
        } catch (err: any) {
            console.error('Error importing session:', err);
            setError(err.response?.data?.message || 'Error importando participantes.');
        } finally {
            setLoadingDetails(false);
        }
    };

    // Filtro de Sorteos (Activos vs Todos)
    const displayedRaffles = raffles.filter(r => {
        if (filterAll) return true; // Mostrar todos
        return r.status === 'open' || r.status === 'closed'; // Solo activos
    });

    const filteredParticipants = participants.filter(p => p.username.toLowerCase().includes(participantSearch.toLowerCase()));

    // Helpers
    const updateTempMethod = (method: keyof RafflesConfig['methods'], updates: any) => {
        if (!tempConfig) return;
        setTempConfig({
            ...tempConfig,
            methods: { ...tempConfig.methods, [method]: { ...tempConfig.methods[method], ...updates } }
        });
    };

    const updateTempRequirements = (updates: Partial<RafflesConfig['requirements']>) => {
        if (!tempConfig) return;
        setTempConfig({
            ...tempConfig,
            requirements: { ...tempConfig.requirements, ...updates }
        });
    };

    return (
        <div className="space-y-6">
            <div className="bg-ds-bg border border-ds-border rounded-lg p-4">
                <p className="text-sm text-ds-soft">
                    ℹ️ Panel de Control de Sorteos.
                </p>
            </div>

            {error && (
                <div className="bg-ds-danger/10 border border-ds-danger/40 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-ds-danger flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-bold text-ds-danger">Error</p>
                        <p className="text-sm text-ds-danger">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="text-ds-danger">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Sistema Global Toggle */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-ds-text">🎁 Sistema de Sorteos</h3>
                        <p className="text-xs text-ds-soft mt-1">Habilitar módulo</p>
                    </div>
                    <ToggleSwitch
                        checked={rafflesConfig.enabled}
                        onChange={(checked) => onRafflesConfigChange({ enabled: checked })}
                    />
                </div>
            </div>

            {rafflesConfig.enabled && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Columna Izquierda: Lista de Sorteos */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-ds-surface rounded-lg border border-ds-border p-4 h-[600px] flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold text-ds-text">📋 Sorteos</h3>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setFilterAll(!filterAll)}
                                        className={`p-1.5 rounded transition ${filterAll ? 'bg-ds-accent/10 text-ds-accent-text' : 'bg-ds-bg text-ds-soft'}`}
                                        title={filterAll ? "Mostrando Todos" : "Mostrando Activos"}
                                    >
                                        <Filter className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setShowCreateForm(true)}
                                        className="p-1.5 bg-ds-accent text-ds-on-accent rounded hover:bg-ds-accent-hover transition"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                {loading && displayedRaffles.length === 0 && (
                                    <div className="flex justify-center py-4"><Loader2 className="animate-spin text-ds-soft" /></div>
                                )}
                                
                                {displayedRaffles.length === 0 && !loading && (
                                    <p className="text-center text-xs text-ds-soft">No hay sorteos {filterAll ? '' : 'activos'}</p>
                                )}

                                {displayedRaffles.map((raffle) => (
                                    <div 
                                        key={raffle.id}
                                        onClick={() => setSelectedRaffleId(raffle.id)}
                                        className={`p-3 rounded-lg border cursor-pointer transition-all group ${
                                            selectedRaffleId === raffle.id 
                                            ? 'bg-ds-accent/10 border-ds-accent ring-1 ring-ds-accent' 
                                            : 'bg-ds-surface border-ds-border hover:border-ds-accent'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <h4 className="font-bold text-sm text-ds-text truncate">#{raffle.id} {raffle.name}</h4>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase inline-block mt-1 ${
                                                    raffle.status === 'open' ? 'bg-ds-ok/10 text-ds-ok' : 
                                                    raffle.status === 'completed' ? 'bg-ds-accent/10 text-ds-accent-text' : 'bg-ds-danger/10 text-ds-danger'
                                                }`}>
                                                    {raffle.status}
                                                </span>
                                            </div>
                                            <button 
                                                onClick={(e) => handleDeleteRaffle(e, raffle.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-ds-soft hover:text-ds-danger hover:bg-ds-danger/10 rounded transition-all"
                                                title="Eliminar Sorteo"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="mt-2 text-xs text-ds-soft flex justify-between">
                                            <span>👥 {raffle.totalParticipants}</span>
                                            <span>🎟️ {raffle.totalTickets}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ... (Resto del componente: Columna Derecha y Modales se mantienen igual) */}
                    <div className="lg:col-span-2">
                        {selectedRaffleId ? (
                            <div className="space-y-4">
                                {/* Panel de Control */}
                                <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                                    {(() => {
                                        const raffle = raffles.find(r => r.id === selectedRaffleId);
                                        if (!raffle) return null;

                                        return (
                                            <>
                                                <div className="flex justify-between items-start mb-6">
                                                    <div>
                                                        <h2 className="text-xl font-black text-ds-text">{raffle.name}</h2>
                                                        <p className="text-sm text-ds-soft">{raffle.description || "Sin descripción"}</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {raffle.status === 'open' ? (
                                                            <button 
                                                                onClick={() => handleCloseRaffle(raffle.id)}
                                                                className="px-4 py-2 bg-ds-warn hover:bg-ds-warn text-ds-on-accent rounded-lg font-bold text-sm flex items-center gap-2"
                                                            >
                                                                <Ban className="w-4 h-4" /> Cerrar Sorteo
                                                            </button>
                                                        ) : (
                                                            <button 
                                                                onClick={() => handleDrawWinners(raffle.id)}
                                                                disabled={raffle.status === 'completed' && winners.length >= raffle.winnersCount}
                                                                className="ds-btn ds-btn--primary"
                                                            >
                                                                <Gift className="w-4 h-4" /> {winners.length > 0 ? 'Sacar Otro Ganador' : 'Sortear Ganador'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* SECCIÓN GANADORES */}
                                                {winners.length > 0 && (
                                                    <div className="mb-6 p-4 bg-ds-warn/10 border border-ds-warn/40 rounded-lg">
                                                        <h3 className="font-bold text-ds-warn mb-3 flex items-center gap-2">
                                                            <Trophy className="w-5 h-5" /> Ganadores
                                                        </h3>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            {winners.map((winner, idx) => (
                                                                <div key={winner.id} className="flex items-center gap-3 p-3 bg-ds-surface rounded-lg border border-ds-warn/40">
                                                                    <div className="w-8 h-8 rounded-full bg-ds-warn/10 flex items-center justify-center font-bold text-ds-warn">
                                                                        #{winner.position}
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <p className="font-bold text-ds-text">{winner.username}</p>
                                                                        <p className="text-xs text-ds-soft">{new Date(winner.wonAt).toLocaleTimeString()}</p>
                                                                    </div>
                                                                    {idx === winners.length - 1 && raffle.status !== 'open' && (
                                                                        <button 
                                                                            onClick={() => handleReroll(raffle.id)}
                                                                            className="p-2 text-ds-soft hover:text-ds-accent-text"
                                                                            title="Re-sortear este puesto"
                                                                        >
                                                                            <RotateCcw className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Lista de Participantes */}
                                                <div>
                                                    <div className="flex justify-between items-center mb-4">
                                                        <h3 className="font-bold text-ds-text flex items-center gap-2">
                                                            <Users className="w-4 h-4" /> 
                                                            Participantes ({participants.length})
                                                        </h3>
                                                        <div className="flex gap-2">
                                                            <div className="relative">
                                                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-ds-soft" />
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="Buscar..." 
                                                                    value={participantSearch}
                                                                    onChange={(e) => setParticipantSearch(e.target.value)}
                                                                    className="ds-input w-32 pl-9 pr-4"
                                                                />
                                                            </div>
                                                            {raffle.status === 'open' && (
                                                                <>
                                                                    <button
                                                                        onClick={() => setShowImportModal(true)}
                                                                        className="p-2 bg-ds-accent/10 hover:bg-ds-accent/10 rounded-lg text-ds-accent-text transition-colors"
                                                                        title="Importar de Sesión del Timer"
                                                                    >
                                                                        <DownloadCloud className="w-4 h-4" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setShowAddParticipantForm(!showAddParticipantForm)}
                                                                        className="ds-btn ds-btn--ghost ds-icon-btn"
                                                                        title="Añadir Manualmente"
                                                                    >
                                                                        <UserPlus className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Formulario Add Manual */}
                                                    {showAddParticipantForm && (
                                                        <div className="mb-4 p-3 bg-ds-accent/10 rounded-lg border border-ds-accent flex gap-2 items-center">
                                                            <input 
                                                                type="text" 
                                                                placeholder="Username" 
                                                                className="ds-input flex-1"
                                                                value={manualParticipantName}
                                                                onChange={e => setManualParticipantName(e.target.value)}
                                                            />
                                                            <input 
                                                                type="number" 
                                                                min="1" 
                                                                value={manualParticipantTickets} 
                                                                onChange={e => setManualParticipantTickets(Number(e.target.value))}
                                                                className="ds-input w-20" 
                                                            />
                                                            <button 
                                                                onClick={handleAddParticipant}
                                                                disabled={!manualParticipantName.trim()}
                                                                className="ds-btn ds-btn--primary ds-btn--sm"
                                                            >
                                                                Añadir
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Tabla */}
                                                    <div className="overflow-hidden rounded-lg border border-ds-border max-h-[400px] overflow-y-auto">
                                                        <table className="w-full text-sm text-left">
                                                            <thead className="bg-ds-surface text-ds-soft sticky top-0">
                                                                <tr>
                                                                    <th className="px-4 py-3">Usuario</th>
                                                                    <th className="px-4 py-3 text-center">Tickets</th>
                                                                    <th className="px-4 py-3 text-center">Método</th>
                                                                    <th className="px-4 py-3 text-right">Hora</th>
                                                                    <th className="px-4 py-3 text-center">Acciones</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-ds-border">
                                                                {loadingDetails ? (
                                                                    <tr>
                                                                        <td colSpan={5} className="px-4 py-8 text-center text-ds-soft">
                                                                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                                                            Cargando participantes...
                                                                        </td>
                                                                    </tr>
                                                                ) : filteredParticipants.length === 0 ? (
                                                                    <tr>
                                                                        <td colSpan={5} className="px-4 py-8 text-center text-ds-soft">
                                                                            No se encontraron participantes.
                                                                        </td>
                                                                    </tr>
                                                                ) : (
                                                                    filteredParticipants.map((p) => (
                                                                        <tr key={p.id} className="hover:bg-ds-surface transition-colors">
                                                                            <td className="px-4 py-3 font-medium text-ds-text">
                                                                                {p.username}
                                                                                {p.isDisqualified && <span className="ml-2 text-xs text-ds-danger font-bold">(DQ)</span>}
                                                                            </td>
                                                                            <td className="px-4 py-3 text-center">
                                                                                <span className="px-2 py-1 bg-ds-accent/10 text-ds-accent-text rounded text-xs font-bold">
                                                                                    {p.tickets}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-4 py-3 text-center text-ds-soft capitalize">{p.entryMethod}</td>
                                                                            <td className="px-4 py-3 text-right text-ds-soft text-xs">
                                                                                {new Date(p.joinedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                                            </td>
                                                                            <td className="px-4 py-3 text-center">
                                                                                <button 
                                                                                    onClick={() => handleRemoveParticipant(p.id)}
                                                                                    className="text-ds-soft hover:text-ds-danger transition-colors"
                                                                                    title="Eliminar / Descalificar"
                                                                                >
                                                                                    <Trash2 className="w-4 h-4" />
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    ))
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full min-h-[400px] flex items-center justify-center bg-ds-surface rounded-lg border border-ds-border p-6 text-center border-dashed">
                                <div>
                                    <div className="w-16 h-16 bg-ds-bg rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Award className="w-8 h-8 text-ds-soft" />
                                    </div>
                                    <h3 className="text-lg font-bold text-ds-text">Selecciona un Sorteo</h3>
                                    <p className="text-ds-soft max-w-sm mx-auto mt-2">
                                        Haz clic en un sorteo para ver sus detalles o crea uno nuevo con reglas específicas.
                                    </p>
                                    
                                    {!showCreateForm && (
                                        <button
                                            onClick={() => setShowCreateForm(true)}
                                            className="ds-btn ds-btn--primary mt-6"
                                        >
                                            Crear Nuevo Sorteo
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* MODAL CREACIÓN */}
                        {showCreateForm && tempConfig && (
                            <div className="fixed inset-0 bg-ds-input/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                                <div className="bg-ds-surface rounded-lg max-w-2xl w-full max-h-[90vh] border border-ds-border flex flex-col">
                                    <div className="p-6 border-b border-ds-border flex justify-between items-center sticky top-0 bg-ds-surface z-10 rounded-t-2xl">
                                        <h2 className="text-xl font-black text-ds-text">Nuevo Sorteo</h2>
                                        <button onClick={() => setShowCreateForm(false)} className="p-2 hover:bg-ds-bg rounded-lg">
                                            <X className="w-5 h-5 text-ds-soft" />
                                        </button>
                                    </div>

                                    <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                                        {/* Datos básicos */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-ds-soft block mb-2">Nombre del Sorteo</label>
                                                <input
                                                    type="text"
                                                    value={tempRaffleName}
                                                    onChange={(e) => setTempRaffleName(e.target.value)}
                                                    className="ds-input w-full"
                                                    placeholder="Ej: Sorteo de Key"
                                                    autoFocus
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-ds-soft block mb-2">Descripción (opcional)</label>
                                                <input
                                                    type="text"
                                                    value={tempDescription}
                                                    onChange={(e) => setTempDescription(e.target.value)}
                                                    className="ds-input w-full"
                                                    placeholder="Ej: Key de Steam para los viewers"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-bold text-ds-soft block mb-2">Ganadores</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="100"
                                                        value={tempWinnersCount}
                                                        onChange={(e) => setTempWinnersCount(Math.max(1, Math.min(100, Number(e.target.value))))}
                                                        className="ds-input w-full"
                                                    />
                                                </div>
                                                <div className="flex items-end">
                                                    <div className="w-full flex items-center gap-2 p-2 bg-ds-accent/10 rounded-lg border border-ds-accent">
                                                        <ToggleSwitch
                                                            checked={autoImportOnCreate}
                                                            onChange={setAutoImportOnCreate}
                                                        />
                                                        <span className="text-sm font-bold text-ds-accent-text">Auto-importar de Sesión</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Selector de Sesión */}
                                        {autoImportOnCreate && (
                                            <div className="border-t border-ds-border pt-4">
                                                <h3 className="text-sm font-bold text-ds-text mb-3 flex items-center gap-2">
                                                    <Clock className="w-4 h-4" /> Sesión a Importar
                                                </h3>

                                                <div className="flex items-center gap-3 mb-3">
                                                    <button
                                                        onClick={() => { setMultiSessionMode(false); setSelectedSessionId(null); setSelectedSessionIds([]); }}
                                                        className={!multiSessionMode ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}
                                                    >
                                                        Última / Una
                                                    </button>
                                                    <button
                                                        onClick={() => { setMultiSessionMode(true); setSelectedSessionId(null); }}
                                                        className={multiSessionMode ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}
                                                    >
                                                        Múltiples Sesiones
                                                    </button>
                                                </div>

                                                {loadingSessions ? (
                                                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-ds-soft" /></div>
                                                ) : availableSessions.length === 0 ? (
                                                    <p className="text-xs text-ds-soft text-center py-3">No hay sesiones disponibles</p>
                                                ) : (
                                                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                                                        {!multiSessionMode && (
                                                            <div
                                                                onClick={() => setSelectedSessionId(null)}
                                                                className={`p-2.5 rounded-lg border cursor-pointer transition text-xs ${
                                                                    selectedSessionId === null
                                                                    ? 'bg-ds-accent/10 border-ds-accent'
                                                                    : 'bg-ds-surface border-ds-border hover:border-ds-accent'
                                                                }`}
                                                            >
                                                                <span className="font-bold text-ds-text">Auto-detectar</span>
                                                                <span className="text-ds-soft ml-2">(última sesión activa o cerrada)</span>
                                                            </div>
                                                        )}
                                                        {availableSessions.map(session => {
                                                            const isSelected = multiSessionMode
                                                                ? selectedSessionIds.includes(session.id)
                                                                : selectedSessionId === session.id;

                                                            return (
                                                                <div
                                                                    key={session.id}
                                                                    onClick={() => multiSessionMode ? toggleSessionInMulti(session.id) : setSelectedSessionId(session.id)}
                                                                    className={`p-2.5 rounded-lg border cursor-pointer transition text-xs ${
                                                                        isSelected
                                                                        ? 'bg-ds-accent/10 border-ds-accent'
                                                                        : 'bg-ds-surface border-ds-border hover:border-ds-accent'
                                                                    }`}
                                                                >
                                                                    <div className="flex justify-between items-center">
                                                                        <div className="flex items-center gap-2">
                                                                            {multiSessionMode && (
                                                                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-ds-accent border-ds-accent' : 'border-ds-border'}`}>
                                                                                    {isSelected && <span className="text-ds-text text-[10px]">✓</span>}
                                                                                </div>
                                                                            )}
                                                                            <span className="font-bold text-ds-text">
                                                                                #{session.id}
                                                                                {session.isActive && <span className="ml-1.5 px-1.5 py-0.5 bg-ds-ok/10 text-ds-ok rounded text-[10px] font-bold">ACTIVA</span>}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-ds-soft">
                                                                            {formatShortDateTimeIn(session.startedAt, timeZone)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex gap-4 mt-1 text-ds-soft">
                                                                        <span>Duración: {formatDuration(session.initialDuration + session.totalAddedTime)}</span>
                                                                        <span>Eventos: {session.totalEvents}</span>
                                                                        <span>Usuarios: {session.uniqueParticipants}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {multiSessionMode && selectedSessionIds.length > 0 && (
                                                    <p className="text-xs text-ds-accent-text mt-2 font-bold">{selectedSessionIds.length} sesión(es) seleccionada(s)</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Reglas de Participación */}
                                        <div className="border-t border-ds-border pt-4">
                                            <h3 className="text-sm font-bold text-ds-text mb-4 flex items-center gap-2">
                                                <Settings2 className="w-4 h-4" /> Reglas de Participación
                                            </h3>

                                            <div className="space-y-4">
                                                {/* Bits */}
                                                <div className="p-3 bg-ds-surface rounded-lg">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-sm font-bold text-ds-text">Entrada por Bits</label>
                                                        <ToggleSwitch
                                                            checked={tempConfig.methods.bits.enabled}
                                                            onChange={c => updateTempMethod('bits', { enabled: c })}
                                                        />
                                                    </div>
                                                    {tempConfig.methods.bits.enabled && (
                                                        <div className="flex items-center gap-3 mt-2">
                                                            <span className="text-xs text-ds-soft">Mínimo:</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={tempConfig.methods.bits.minAmount || 0}
                                                                onChange={e => updateTempMethod('bits', { minAmount: Number(e.target.value) })}
                                                                className="ds-input w-24"
                                                            />
                                                            <span className="text-xs text-ds-soft">bits</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Suscripción */}
                                                <div className="p-3 bg-ds-surface rounded-lg">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-sm font-bold text-ds-text">Entrada por Suscripción</label>
                                                        <ToggleSwitch
                                                            checked={tempConfig.methods.subscription.enabled}
                                                            onChange={c => updateTempMethod('subscription', { enabled: c })}
                                                        />
                                                    </div>
                                                    {tempConfig.methods.subscription.enabled && (
                                                        <div className="mt-3">
                                                            <span className="text-xs text-ds-soft block mb-2">Tiers permitidos:</span>
                                                            <div className="flex flex-wrap gap-2">
                                                                {['tier1', 'tier2', 'tier3', 'prime'].map(tier => (
                                                                    <button
                                                                        key={tier}
                                                                        onClick={() => {
                                                                            setAllowedSubTiers(prev =>
                                                                                prev.includes(tier)
                                                                                    ? prev.filter(t => t !== tier)
                                                                                    : [...prev, tier]
                                                                            );
                                                                        }}
                                                                        className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                                                                            allowedSubTiers.includes(tier)
                                                                                ? 'bg-ds-accent/10 text-ds-accent-text border border-ds-accent '
                                                                                : 'bg-ds-bg text-ds-soft border border-ds-border '
                                                                        }`}
                                                                    >
                                                                        {tier === 'prime' ? 'Prime' : tier.replace('tier', 'Tier ')}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Gift Subs */}
                                                <div className="p-3 bg-ds-surface rounded-lg">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-sm font-bold text-ds-text">Entrada por Regalar Subs</label>
                                                        <ToggleSwitch
                                                            checked={tempConfig.methods.giftSubscription.enabled}
                                                            onChange={c => updateTempMethod('giftSubscription', { enabled: c })}
                                                        />
                                                    </div>
                                                    {tempConfig.methods.giftSubscription.enabled && (
                                                        <div className="flex items-center gap-3 mt-2">
                                                            <span className="text-xs text-ds-soft">Mínimo de gifts:</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={minGifts}
                                                                onChange={e => setMinGifts(Number(e.target.value))}
                                                                className="ds-input w-20"
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Follows */}
                                                <div className="p-3 bg-ds-surface rounded-lg">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-sm font-bold text-ds-text">Entrada por Nuevo Follow</label>
                                                        <ToggleSwitch
                                                            checked={tempConfig.methods.follow?.enabled ?? false}
                                                            onChange={c => updateTempMethod('follow', { enabled: c })}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Ponderación */}
                                                <div className="p-3 bg-ds-warn/10 rounded-lg border border-ds-warn/40">
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <label className="text-sm font-bold text-ds-text flex items-center gap-2">
                                                                <Zap className="w-4 h-4 text-ds-accent-text" /> Ponderar por Contribución
                                                            </label>
                                                            <p className="text-[11px] text-ds-soft mt-1">Más bits/gifts/tier = más tickets. Tier3 = 4x, Tier2 = 2x, cada 100 bits = +1 ticket</p>
                                                        </div>
                                                        <ToggleSwitch
                                                            checked={weightByContribution}
                                                            onChange={setWeightByContribution}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Configuración Avanzada (colapsable) */}
                                        <div className="border-t border-ds-border pt-4">
                                            <button
                                                onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                                                className="flex items-center gap-2 text-sm font-bold text-ds-soft hover:text-ds-text transition w-full"
                                            >
                                                <Shield className="w-4 h-4" />
                                                Configuración Avanzada
                                                {showAdvancedConfig ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                                            </button>

                                            {showAdvancedConfig && (
                                                <div className="space-y-4 mt-4">
                                                    {/* Restricciones */}
                                                    <div className="p-3 bg-ds-surface rounded-lg">
                                                        <h4 className="text-xs font-bold text-ds-soft mb-3 uppercase">Restricciones</h4>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-sm text-ds-soft">Excluir Moderadores</span>
                                                                <ToggleSwitch
                                                                    checked={tempConfig.requirements.excludeMods}
                                                                    onChange={c => updateTempRequirements({ excludeMods: c })}
                                                                />
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-sm text-ds-soft">Excluir VIPs</span>
                                                                <ToggleSwitch
                                                                    checked={tempConfig.requirements.excludeVips}
                                                                    onChange={c => updateTempRequirements({ excludeVips: c })}
                                                                />
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-sm text-ds-soft">Excluir Broadcaster</span>
                                                                <ToggleSwitch
                                                                    checked={tempConfig.requirements.excludeBroadcaster}
                                                                    onChange={c => updateTempRequirements({ excludeBroadcaster: c })}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Cooldown de ganadores */}
                                                    <div className="p-3 bg-ds-surface rounded-lg">
                                                        <h4 className="text-xs font-bold text-ds-soft mb-3 uppercase">Cooldown de Ganadores Recientes</h4>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm text-ds-soft">Excluir si ganaron en los últimos</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={winnerCooldownDays}
                                                                onChange={e => setWinnerCooldownDays(Number(e.target.value))}
                                                                className="ds-input w-20 text-center"
                                                            />
                                                            <span className="text-sm text-ds-soft">días</span>
                                                        </div>
                                                        <p className="text-[11px] text-ds-soft mt-2">0 = sin cooldown. Los ganadores recientes del canal no podrán participar.</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-6 border-t border-ds-border flex justify-end gap-3 bg-ds-surface rounded-b-2xl">
                                        <button
                                            onClick={() => setShowCreateForm(false)}
                                            className="px-4 py-2 text-ds-soft font-bold hover:bg-ds-bg rounded-lg transition"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleCreateRaffle}
                                            disabled={loading || !tempRaffleName.trim()}
                                            className="ds-btn ds-btn--primary"
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                            Crear Sorteo
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* MODAL IMPORTAR SESIÓN */}
                        {showImportModal && (
                            <div className="fixed inset-0 bg-ds-input/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                                <div className="bg-ds-surface rounded-lg max-w-lg w-full max-h-[80vh] border border-ds-border flex flex-col">
                                    <div className="p-5 border-b border-ds-border flex justify-between items-center">
                                        <h2 className="text-lg font-black text-ds-text flex items-center gap-2">
                                            <DownloadCloud className="w-5 h-5" /> Importar de Sesión
                                        </h2>
                                        <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-ds-bg rounded-lg">
                                            <X className="w-5 h-5 text-ds-soft" />
                                        </button>
                                    </div>

                                    <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                                        {/* Modo de selección */}
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => { setMultiSessionMode(false); setSelectedSessionIds([]); }}
                                                className={!multiSessionMode ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}
                                            >
                                                Una Sesión
                                            </button>
                                            <button
                                                onClick={() => { setMultiSessionMode(true); setSelectedSessionId(null); }}
                                                className={multiSessionMode ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}
                                            >
                                                Múltiples
                                            </button>
                                        </div>

                                        {/* Lista de sesiones */}
                                        {loadingSessions ? (
                                            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-ds-soft" /></div>
                                        ) : (
                                            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                                {!multiSessionMode && (
                                                    <div
                                                        onClick={() => setSelectedSessionId(null)}
                                                        className={`p-2.5 rounded-lg border cursor-pointer transition text-xs ${
                                                            selectedSessionId === null ? 'bg-ds-accent/10 border-ds-accent' : 'bg-ds-surface border-ds-border hover:border-ds-accent'
                                                        }`}
                                                    >
                                                        <span className="font-bold text-ds-text">Auto (última sesión)</span>
                                                    </div>
                                                )}
                                                {availableSessions.map(session => {
                                                    const isSelected = multiSessionMode ? selectedSessionIds.includes(session.id) : selectedSessionId === session.id;
                                                    return (
                                                        <div
                                                            key={session.id}
                                                            onClick={() => multiSessionMode ? toggleSessionInMulti(session.id) : setSelectedSessionId(session.id)}
                                                            className={`p-2.5 rounded-lg border cursor-pointer transition text-xs ${
                                                                isSelected ? 'bg-ds-accent/10 border-ds-accent' : 'bg-ds-surface border-ds-border hover:border-ds-accent'
                                                            }`}
                                                        >
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-bold text-ds-text">
                                                                    #{session.id}
                                                                    {session.isActive && <span className="ml-1.5 px-1.5 py-0.5 bg-ds-ok/10 text-ds-ok rounded text-[10px] font-bold">ACTIVA</span>}
                                                                </span>
                                                                <span className="text-ds-soft">{formatDateOnlyIn(session.startedAt, timeZone)}</span>
                                                            </div>
                                                            <div className="flex gap-3 mt-1 text-ds-soft">
                                                                <span>Eventos: {session.totalEvents}</span>
                                                                <span>Usuarios: {session.uniqueParticipants}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Opciones de import */}
                                        <div className="space-y-3 pt-2 border-t border-ds-border">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="text-sm font-bold text-ds-text">Forzar reimportar</span>
                                                    <p className="text-[11px] text-ds-soft">Importar aunque la sesión ya haya sido importada</p>
                                                </div>
                                                <ToggleSwitch checked={importForceReimport} onChange={setImportForceReimport} />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="text-sm font-bold text-ds-text">Sumar tickets</span>
                                                    <p className="text-[11px] text-ds-soft">Si el usuario ya existe, sumar tickets en vez de omitir</p>
                                                </div>
                                                <ToggleSwitch checked={importMergeTickets} onChange={setImportMergeTickets} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-5 border-t border-ds-border flex justify-end gap-3">
                                        <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-ds-soft font-bold hover:bg-ds-bg rounded-lg transition">
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={() => handleImportSession({
                                                sessionId: !multiSessionMode ? (selectedSessionId ?? undefined) : undefined,
                                                sessionIds: multiSessionMode ? selectedSessionIds : undefined,
                                                forceReimport: importForceReimport,
                                                mergeTickets: importMergeTickets,
                                            })}
                                            disabled={loadingDetails}
                                            className="ds-btn ds-btn--primary"
                                        >
                                            {loadingDetails ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
                                            Importar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RafflesTab;
