import React, { useEffect, useState } from 'react';
import { Trophy, Users, UsersRound, KeyRound, ArrowUp, Shield, DollarSign, LayoutDashboard, FileText, Handshake, Swords } from 'lucide-react';
import api from '../../../services/api';
import type { TournamentEdition } from './shared';
import EditionsPanel from './EditionsPanel';
import RankingPanel from './RankingPanel';
import ParticipantsPanel from './ParticipantsPanel';
import RiotConfigPanel from './RiotConfigPanel';
import BlueShellPanel from './BlueShellPanel';
import PrizesPanel from './PrizesPanel';
import DashboardPanel from './DashboardPanel';
import RulesPanel from './RulesPanel';
import SponsorsPanel from './SponsorsPanel';
import TeamsPanel from './TeamsPanel';
import WinConditionPanel from './WinConditionPanel';

// Milestone 0/1 del modulo de Torneos — UI minima para no seguir probando a mano
// contra la API. Cubre lo que ya existe en el backend: crear/listar ediciones,
// alta manual de participantes, Riot API key, ranking, y el motor de castigos/suerte
// (cada tenant le pone su propio nombre a la mecanica, ver shellItemName/aegisMechanicName).
// Ver .dev/torneos/10-panel-admin-frontend.md para la estructura completa a futuro.
//
// Cada pestaña vive en su propio archivo (EditionsPanel, RankingPanel,
// ParticipantsPanel, RiotConfigPanel, BlueShellPanel, ...) — este archivo es
// solo el shell de tabs + el estado compartido de "que edicion esta seleccionada".

type TabId = 'dashboard' | 'editions' | 'ranking' | 'participants' | 'teams' | 'blueshell' | 'wincondition' | 'prizes' | 'rules' | 'sponsors' | 'riot';

export default function TournamentConfig() {
    const [activeTab, setActiveTab] = useState<TabId>('dashboard');
    const [editions, setEditions] = useState<TournamentEdition[]>([]);
    const [channelName, setChannelName] = useState('');
    const [loadingEditions, setLoadingEditions] = useState(true);
    const [selectedEditionId, setSelectedEditionId] = useState<number | null>(null);

    const loadEditions = async () => {
        setLoadingEditions(true);
        try {
            const res = await api.get('/admin/tournament/editions');
            setEditions(res.data.editions || []);
            if (res.data.channelName) setChannelName(res.data.channelName);
        } catch (err) {
            console.error('Error cargando ediciones de torneo', err);
        } finally {
            setLoadingEditions(false);
        }
    };

    useEffect(() => {
        loadEditions();
    }, []);

    const onChangeStatus = async (editionId: number, status: string) => {
        try {
            await api.put(`/admin/tournament/editions/${editionId}/status`, { status });
            await loadEditions();
        } catch (err) {
            console.error('Error cambiando el estado de la edicion', err);
        }
    };

    const onDeleteEdition = async (editionId: number, name: string) => {
        if (!window.confirm(`Borrar la edicion "${name}"? Se borran tambien sus participantes y todo lo trackeado. No se puede deshacer.`)) return;
        try {
            await api.delete(`/admin/tournament/editions/${editionId}`);
            if (selectedEditionId === editionId) setSelectedEditionId(null);
            await loadEditions();
        } catch (err) {
            console.error('Error borrando la edicion', err);
        }
    };

    const onSelectEdition = (id: number, goToParticipants: boolean) => {
        setSelectedEditionId(id);
        if (goToParticipants) setActiveTab('participants');
    };

    const selectedEdition = editions.find((e) => e.id === selectedEditionId) || null;
    const isAram = selectedEdition?.mode === 'aram_teams';

    // Ranking (LP de SoloQ Climb) y Castigos/Suerte (motor atado a snapshots de LP,
    // que ARAM no genera — resultados se cargan a mano) no aplican a ARAM N vs N.
    useEffect(() => {
        if (isAram && (activeTab === 'ranking' || activeTab === 'blueshell')) setActiveTab('dashboard');
        if (!isAram && activeTab === 'wincondition') setActiveTab('dashboard');
    }, [isAram, activeTab]);

    return (
        <div className="max-w-[1800px] 4xl:max-w-[2200px] 5xl:max-w-[2800px] mx-auto space-y-6 4xl:space-y-8">
            <div>
                <h1 className="text-3xl 4xl:text-4xl 5xl:text-5xl font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Trophy className="w-7 h-7 4xl:w-9 4xl:h-9 text-[#2563eb]" />
                    Torneos
                </h1>
                <p className="text-[#64748b] dark:text-[#94a3b8] mt-1 4xl:text-lg">Torneos de ARAM N vs N y SoloQ Climb.</p>
            </div>

            <div className="flex gap-1.5 4xl:gap-2 flex-wrap">
                {(
                    [
                        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4 4xl:w-5 4xl:h-5" /> },
                        { id: 'editions', label: 'Ediciones', icon: <Trophy className="w-4 h-4 4xl:w-5 4xl:h-5" /> },
                        !isAram && { id: 'ranking', label: 'Ranking', icon: <ArrowUp className="w-4 h-4 4xl:w-5 4xl:h-5" /> },
                        { id: 'participants', label: 'Participantes', icon: <Users className="w-4 h-4 4xl:w-5 4xl:h-5" /> },
                        { id: 'teams', label: 'Equipos', icon: <UsersRound className="w-4 h-4 4xl:w-5 4xl:h-5" /> },
                        !isAram && {
                            id: 'blueshell',
                            label: selectedEdition ? `${selectedEdition.shellItemName}s` : 'Castigos',
                            icon: <Shield className="w-4 h-4 4xl:w-5 4xl:h-5" />,
                        },
                        isAram && { id: 'wincondition', label: 'Condición de victoria', icon: <Swords className="w-4 h-4 4xl:w-5 4xl:h-5" /> },
                        { id: 'prizes', label: 'Premios', icon: <DollarSign className="w-4 h-4 4xl:w-5 4xl:h-5" /> },
                        { id: 'rules', label: 'Normas', icon: <FileText className="w-4 h-4 4xl:w-5 4xl:h-5" /> },
                        { id: 'sponsors', label: 'Sponsors', icon: <Handshake className="w-4 h-4 4xl:w-5 4xl:h-5" /> },
                        { id: 'riot', label: 'Riot API', icon: <KeyRound className="w-4 h-4 4xl:w-5 4xl:h-5" /> },
                    ].filter(Boolean) as { id: TabId; label: string; icon: React.ReactNode }[]
                ).map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 4xl:px-5 4xl:py-3 rounded-xl text-sm 4xl:text-base font-bold whitespace-nowrap transition-all ${
                            activeTab === tab.id
                                ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white'
                                : 'bg-[#f8fafc] dark:bg-[#262626] text-[#475569] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'editions' && (
                <EditionsPanel
                    editions={editions}
                    loadingEditions={loadingEditions}
                    selectedEditionId={selectedEditionId}
                    onSelect={onSelectEdition}
                    onChangeStatus={onChangeStatus}
                    onDelete={onDeleteEdition}
                    onCreated={loadEditions}
                />
            )}

            {activeTab === 'ranking' && <RankingPanel edition={selectedEdition} editions={editions} onSelectEdition={(id) => onSelectEdition(id, false)} />}

            {activeTab === 'participants' && (
                <ParticipantsPanel edition={selectedEdition} editions={editions} onSelectEdition={(id) => onSelectEdition(id, false)} />
            )}

            {activeTab === 'teams' && <TeamsPanel edition={selectedEdition} editions={editions} onSelectEdition={(id) => onSelectEdition(id, false)} />}

            {activeTab === 'blueshell' && (
                <BlueShellPanel
                    edition={selectedEdition}
                    editions={editions}
                    onSelectEdition={(id) => onSelectEdition(id, false)}
                    onEditionsChanged={loadEditions}
                />
            )}

            {activeTab === 'wincondition' && (
                <WinConditionPanel edition={selectedEdition} editions={editions} onSelectEdition={(id) => onSelectEdition(id, false)} />
            )}

            {activeTab === 'dashboard' && (
                <DashboardPanel edition={selectedEdition} editions={editions} onSelectEdition={(id) => onSelectEdition(id, false)} channelName={channelName} />
            )}

            {activeTab === 'prizes' && <PrizesPanel edition={selectedEdition} editions={editions} onSelectEdition={(id) => onSelectEdition(id, false)} />}

            {activeTab === 'rules' && <RulesPanel edition={selectedEdition} editions={editions} onSelectEdition={(id) => onSelectEdition(id, false)} />}

            {activeTab === 'sponsors' && <SponsorsPanel edition={selectedEdition} editions={editions} onSelectEdition={(id) => onSelectEdition(id, false)} />}

            {activeTab === 'riot' && <RiotConfigPanel />}
        </div>
    );
}
