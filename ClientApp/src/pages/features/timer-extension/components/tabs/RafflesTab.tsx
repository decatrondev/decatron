/**
 * Timer Extension - Raffles Tab Component
 *
 * Sistema completo de sorteos y rifas con múltiples métodos de participación.
 * Integrado con la configuración global del Timer.
 */

import { useState, useEffect } from 'react';
import { Gift, Users, Award, Plus, X, RotateCcw, AlertCircle, Loader2, UserPlus, Search, Trash2, Ban, DownloadCloud, Settings2, Trophy, Filter } from 'lucide-react';
import api from '../../../../../services/api';
import type { RafflesConfig } from '../../types';

interface RafflesTabProps {
    rafflesConfig: RafflesConfig;
    onRafflesConfigChange: (updates: Partial<RafflesConfig>) => void;
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
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#94a3b8] dark:peer-focus:ring-[#64748b] rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#64748b]"></div>
    </label>
);

export const RafflesTab: React.FC<RafflesTabProps> = ({ rafflesConfig, onRafflesConfigChange }) => {
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
    const [tempWinnersCount, setTempWinnersCount] = useState(1);
    const [autoImportOnCreate, setAutoImportOnCreate] = useState(true);
    const [tempConfig, setTempConfig] = useState<RafflesConfig | null>(null);

    // ... (Resto de useEffects igual)
    useEffect(() => {
        if (showCreateForm) {
            setTempConfig(JSON.parse(JSON.stringify(rafflesConfig))); 
            setTempRaffleName('');
            setTempWinnersCount(1);
            setAutoImportOnCreate(true);
        }
    }, [showCreateForm, rafflesConfig]);

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

            const payload = {
                name: tempRaffleName,
                description: autoImportOnCreate ? "Sorteo vinculado a sesión activa" : undefined,
                winnersCount: tempWinnersCount,
                configJson: JSON.stringify(tempConfig) 
            };

            const res = await api.post('/raffles', payload);
            const newRaffleId = res.data?.raffle?.id;
            
            if (newRaffleId) {
                if (autoImportOnCreate) {
                    try {
                        await api.post(`/raffles/${newRaffleId}/import-session`);
                    } catch (importErr) {
                        console.warn("Auto-import failed/skipped", importErr);
                    }
                }
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

    const handleImportSession = async () => {
        if (!selectedRaffleId) return;
        try {
            setLoadingDetails(true);
            const res = await api.post(`/raffles/${selectedRaffleId}/import-session`);
            if (res.data.success) {
                alert(`✅ ${res.data.message}`);
                await loadRaffleDetails(selectedRaffleId);
                await loadRaffles();
            }
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
            <div className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4">
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                    ℹ️ Panel de Control de Sorteos.
                </p>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-bold text-red-800 dark:text-red-200">Error</p>
                        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="text-red-600 dark:text-red-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Sistema Global Toggle */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">🎁 Sistema de Sorteos</h3>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">Habilitar módulo</p>
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
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 shadow-lg h-[600px] flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">📋 Sorteos</h3>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setFilterAll(!filterAll)}
                                        className={`p-1.5 rounded transition ${filterAll ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}
                                        title={filterAll ? "Mostrando Todos" : "Mostrando Activos"}
                                    >
                                        <Filter className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setShowCreateForm(true)}
                                        className="p-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                {loading && displayedRaffles.length === 0 && (
                                    <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-400" /></div>
                                )}
                                
                                {displayedRaffles.length === 0 && !loading && (
                                    <p className="text-center text-xs text-gray-400">No hay sorteos {filterAll ? '' : 'activos'}</p>
                                )}

                                {displayedRaffles.map((raffle) => (
                                    <div 
                                        key={raffle.id}
                                        onClick={() => setSelectedRaffleId(raffle.id)}
                                        className={`p-3 rounded-xl border cursor-pointer transition-all group ${
                                            selectedRaffleId === raffle.id 
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 ring-1 ring-blue-500' 
                                            : 'bg-gray-50 dark:bg-[#262626] border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <h4 className="font-bold text-sm text-[#1e293b] dark:text-[#f8fafc] truncate">#{raffle.id} {raffle.name}</h4>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase inline-block mt-1 ${
                                                    raffle.status === 'open' ? 'bg-green-100 text-green-700' : 
                                                    raffle.status === 'completed' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {raffle.status}
                                                </span>
                                            </div>
                                            <button 
                                                onClick={(e) => handleDeleteRaffle(e, raffle.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                                title="Eliminar Sorteo"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
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
                                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                    {(() => {
                                        const raffle = raffles.find(r => r.id === selectedRaffleId);
                                        if (!raffle) return null;

                                        return (
                                            <>
                                                <div className="flex justify-between items-start mb-6">
                                                    <div>
                                                        <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">{raffle.name}</h2>
                                                        <p className="text-sm text-gray-500">{raffle.description || "Sin descripción"}</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {raffle.status === 'open' ? (
                                                            <button 
                                                                onClick={() => handleCloseRaffle(raffle.id)}
                                                                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-sm flex items-center gap-2"
                                                            >
                                                                <Ban className="w-4 h-4" /> Cerrar Sorteo
                                                            </button>
                                                        ) : (
                                                            <button 
                                                                onClick={() => handleDrawWinners(raffle.id)}
                                                                disabled={raffle.status === 'completed' && winners.length >= raffle.winnersCount}
                                                                className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm flex items-center gap-2"
                                                            >
                                                                <Gift className="w-4 h-4" /> {winners.length > 0 ? 'Sacar Otro Ganador' : 'Sortear Ganador'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* SECCIÓN GANADORES */}
                                                {winners.length > 0 && (
                                                    <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-700 rounded-xl">
                                                        <h3 className="font-bold text-yellow-800 dark:text-yellow-400 mb-3 flex items-center gap-2">
                                                            <Trophy className="w-5 h-5" /> Ganadores
                                                        </h3>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            {winners.map((winner, idx) => (
                                                                <div key={winner.id} className="flex items-center gap-3 p-3 bg-white dark:bg-[#1B1C1D] rounded-lg shadow-sm border border-yellow-100 dark:border-yellow-800/30">
                                                                    <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-800 flex items-center justify-center font-bold text-yellow-700 dark:text-yellow-300">
                                                                        #{winner.position}
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{winner.username}</p>
                                                                        <p className="text-xs text-gray-500">{new Date(winner.wonAt).toLocaleTimeString()}</p>
                                                                    </div>
                                                                    {idx === winners.length - 1 && raffle.status !== 'open' && (
                                                                        <button 
                                                                            onClick={() => handleReroll(raffle.id)}
                                                                            className="p-2 text-gray-400 hover:text-blue-500"
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
                                                        <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                                            <Users className="w-4 h-4" /> 
                                                            Participantes ({participants.length})
                                                        </h3>
                                                        <div className="flex gap-2">
                                                            <div className="relative">
                                                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="Buscar..." 
                                                                    value={participantSearch}
                                                                    onChange={(e) => setParticipantSearch(e.target.value)}
                                                                    className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-[#262626] border border-gray-200 dark:border-gray-700 rounded-lg text-sm w-32 focus:w-48 transition-all"
                                                                />
                                                            </div>
                                                            {raffle.status === 'open' && (
                                                                <>
                                                                    <button 
                                                                        onClick={handleImportSession}
                                                                        className="p-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/50 rounded-lg text-blue-600 dark:text-blue-300 transition-colors"
                                                                        title="Importar de Sesión Activa"
                                                                    >
                                                                        <DownloadCloud className="w-4 h-4" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setShowAddParticipantForm(!showAddParticipantForm)}
                                                                        className="p-2 bg-gray-100 dark:bg-[#262626] hover:bg-gray-200 rounded-lg text-gray-600 dark:text-gray-300"
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
                                                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex gap-2 items-center">
                                                            <input 
                                                                type="text" 
                                                                placeholder="Username" 
                                                                className="flex-1 px-3 py-1.5 rounded border text-sm bg-white dark:bg-[#262626] dark:border-gray-700 dark:text-white"
                                                                value={manualParticipantName}
                                                                onChange={e => setManualParticipantName(e.target.value)}
                                                            />
                                                            <input 
                                                                type="number" 
                                                                min="1" 
                                                                value={manualParticipantTickets} 
                                                                onChange={e => setManualParticipantTickets(Number(e.target.value))}
                                                                className="w-20 px-3 py-1.5 rounded border text-sm bg-white dark:bg-[#262626] dark:border-gray-700 dark:text-white" 
                                                            />
                                                            <button 
                                                                onClick={handleAddParticipant}
                                                                disabled={!manualParticipantName.trim()}
                                                                className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-bold disabled:opacity-50"
                                                            >
                                                                Añadir
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Tabla */}
                                                    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 max-h-[400px] overflow-y-auto">
                                                        <table className="w-full text-sm text-left">
                                                            <thead className="bg-gray-50 dark:bg-[#262626] text-gray-500 dark:text-gray-400 sticky top-0">
                                                                <tr>
                                                                    <th className="px-4 py-3">Usuario</th>
                                                                    <th className="px-4 py-3 text-center">Tickets</th>
                                                                    <th className="px-4 py-3 text-center">Método</th>
                                                                    <th className="px-4 py-3 text-right">Hora</th>
                                                                    <th className="px-4 py-3 text-center">Acciones</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                                {loadingDetails ? (
                                                                    <tr>
                                                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                                                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                                                            Cargando participantes...
                                                                        </td>
                                                                    </tr>
                                                                ) : filteredParticipants.length === 0 ? (
                                                                    <tr>
                                                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                                                            No se encontraron participantes.
                                                                        </td>
                                                                    </tr>
                                                                ) : (
                                                                    filteredParticipants.map((p) => (
                                                                        <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-[#262626]/50 transition-colors">
                                                                            <td className="px-4 py-3 font-medium text-[#1e293b] dark:text-[#f8fafc]">
                                                                                {p.username}
                                                                                {p.isDisqualified && <span className="ml-2 text-xs text-red-500 font-bold">(DQ)</span>}
                                                                            </td>
                                                                            <td className="px-4 py-3 text-center">
                                                                                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-bold">
                                                                                    {p.tickets}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-4 py-3 text-center text-gray-500 capitalize">{p.entryMethod}</td>
                                                                            <td className="px-4 py-3 text-right text-gray-500 text-xs">
                                                                                {new Date(p.joinedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                                            </td>
                                                                            <td className="px-4 py-3 text-center">
                                                                                <button 
                                                                                    onClick={() => handleRemoveParticipant(p.id)}
                                                                                    className="text-gray-400 hover:text-red-500 transition-colors"
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
                            <div className="h-full min-h-[400px] flex items-center justify-center bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 text-center border-dashed">
                                <div>
                                    <div className="w-16 h-16 bg-gray-100 dark:bg-[#262626] rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Award className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">Selecciona un Sorteo</h3>
                                    <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-2">
                                        Haz clic en un sorteo para ver sus detalles o crea uno nuevo con reglas específicas.
                                    </p>
                                    
                                    {!showCreateForm && (
                                        <button
                                            onClick={() => setShowCreateForm(true)}
                                            className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg transition-transform hover:scale-105"
                                        >
                                            Crear Nuevo Sorteo
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* MODAL CREACIÓN (Content scrollable fixed) */}
                        {showCreateForm && tempConfig && (
                            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700 flex flex-col">
                                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center sticky top-0 bg-white dark:bg-[#1B1C1D] z-10">
                                        <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">Nuevo Sorteo</h2>
                                        <button onClick={() => setShowCreateForm(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-[#262626] rounded-lg">
                                            <X className="w-5 h-5 text-gray-500" />
                                        </button>
                                    </div>
                                    
                                    <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Nombre del Sorteo</label>
                                                <input
                                                    type="text"
                                                    value={tempRaffleName}
                                                    onChange={(e) => setTempRaffleName(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                                    placeholder="Ej: Sorteo de Key"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Ganadores</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={tempWinnersCount}
                                                        onChange={(e) => setTempWinnersCount(Number(e.target.value))}
                                                        className="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                                    />
                                                </div>
                                                <div className="flex-1 pt-6">
                                                    <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                                        <ToggleSwitch 
                                                            checked={autoImportOnCreate}
                                                            onChange={setAutoImportOnCreate}
                                                        />
                                                        <span className="text-sm font-bold text-blue-800 dark:text-blue-300">Auto-importar de Sesión</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                                            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                                                <Settings2 className="w-4 h-4" /> Reglas de Participación (Específicas)
                                            </h3>
                                            
                                            <div className="space-y-4">
                                                <div className="p-3 bg-gray-50 dark:bg-[#262626] rounded-xl">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <label className="text-sm font-bold dark:text-white">Entrada por Bits</label>
                                                        <ToggleSwitch 
                                                            checked={tempConfig.methods.bits.enabled} 
                                                            onChange={c => updateTempMethod('bits', { enabled: c })} 
                                                        />
                                                    </div>
                                                    {tempConfig.methods.bits.enabled && (
                                                        <div className="flex items-center gap-3 mt-2">
                                                            <span className="text-xs text-gray-500">Mínimo:</span>
                                                            <input 
                                                                type="number" 
                                                                value={tempConfig.methods.bits.minAmount}
                                                                onChange={e => updateTempMethod('bits', { minAmount: Number(e.target.value) })}
                                                                className="w-24 px-2 py-1 rounded border text-sm bg-white dark:bg-[#1B1C1D] dark:border-gray-600 dark:text-white"
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="p-3 bg-gray-50 dark:bg-[#262626] rounded-xl">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <label className="text-sm font-bold dark:text-white">Entrada por Suscripción</label>
                                                        <ToggleSwitch 
                                                            checked={tempConfig.methods.subscription.enabled} 
                                                            onChange={c => updateTempMethod('subscription', { enabled: c })} 
                                                        />
                                                    </div>
                                                </div>

                                                <div className="p-3 bg-gray-50 dark:bg-[#262626] rounded-xl">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <label className="text-sm font-bold dark:text-white">Entrada por Regalar Subs</label>
                                                        <ToggleSwitch 
                                                            checked={tempConfig.methods.giftSubscription.enabled} 
                                                            onChange={c => updateTempMethod('giftSubscription', { enabled: c })} 
                                                        />
                                                    </div>
                                                </div>

                                                
                                                {/* Follows */}
                                                <div className="p-3 bg-gray-50 dark:bg-[#262626] rounded-xl">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <label className="text-sm font-bold dark:text-white">Entrada por Nuevo Follow</label>
                                                        <ToggleSwitch 
                                                            checked={tempConfig.methods.follow?.enabled ?? false} 
                                                            onChange={c => updateTempMethod('follow', { enabled: c })} 
                                                        />
                                                    </div>
                                                </div>

                                                {/* Exclusiones */}
<div className="p-3 bg-gray-50 dark:bg-[#262626] rounded-xl">
                                                    <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase">Restricciones</h4>
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm dark:text-gray-300">Excluir Moderadores</span>
                                                            <ToggleSwitch 
                                                                checked={tempConfig.requirements.excludeMods} 
                                                                onChange={c => updateTempRequirements({ excludeMods: c })} 
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm dark:text-gray-300">Excluir VIPs</span>
                                                            <ToggleSwitch 
                                                                checked={tempConfig.requirements.excludeVips} 
                                                                onChange={c => updateTempRequirements({ excludeVips: c })} 
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-white dark:bg-[#1B1C1D]">
                                        <button 
                                            onClick={() => setShowCreateForm(false)}
                                            className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 dark:hover:bg-[#262626] rounded-lg transition"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleCreateRaffle}
                                            disabled={loading || !tempRaffleName.trim()}
                                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg flex items-center gap-2"
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                            Crear Sorteo
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
