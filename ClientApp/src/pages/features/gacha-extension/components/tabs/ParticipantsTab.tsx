import React, { useState, useEffect } from 'react';
import { Users, Search, ChevronDown, ChevronUp, Package, History, DollarSign, Gift, Filter, X } from 'lucide-react';
import api from '../../../../../services/api';
import type { GachaParticipant, GachaInventory, GachaPullLog, GachaCollectionStats, RarityType } from '../../types';
import { RARITY_CONFIG, RARITY_ORDER, getRarityStars } from '../../types';

export const ParticipantsTab: React.FC = () => {
    const [participants, setParticipants] = useState<GachaParticipant[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [stats, setStats] = useState<GachaCollectionStats | null>(null);
    const [inventory, setInventory] = useState<GachaInventory[]>([]);
    const [logs, setLogs] = useState<GachaPullLog[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [donationName, setDonationName] = useState('');
    const [donationAmount, setDonationAmount] = useState('');
    const [donationMsg, setDonationMsg] = useState('');
    const [invFilter, setInvFilter] = useState<RarityType | 'all' | 'redeemed'>('all');
    const [invSearch, setInvSearch] = useState('');

    const loadParticipants = async () => {
        setLoading(true);
        try {
            const res = await api.get('/gacha/participants');
            setParticipants(res.data.participants || []);
        } catch (err) {
            console.error('Error loading participants', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadParticipants(); }, []);

    const toggleExpand = async (id: number) => {
        if (expandedId === id) { setExpandedId(null); return; }
        setExpandedId(id);
        setInvFilter('all');
        setInvSearch('');
        setDetailLoading(true);
        try {
            const [sRes, iRes, lRes] = await Promise.all([
                api.get(`/gacha/stats/${id}`),
                api.get(`/gacha/inventory/${id}`),
                api.get(`/gacha/logs/${id}`),
            ]);
            setStats(sRes.data.stats || null);
            setInventory(iRes.data.inventory || []);
            setLogs(lRes.data.logs || []);
        } catch (err) {
            console.error('Error loading participant details', err);
        } finally {
            setDetailLoading(false);
        }
    };

    const reloadDetails = async (id: number) => {
        try {
            const [sRes, iRes, lRes] = await Promise.all([
                api.get(`/gacha/stats/${id}`),
                api.get(`/gacha/inventory/${id}`),
                api.get(`/gacha/logs/${id}`),
            ]);
            setStats(sRes.data.stats || null);
            setInventory(iRes.data.inventory || []);
            setLogs(lRes.data.logs || []);
        } catch (err) {
            console.error('Error reloading details', err);
        }
    };

    const handleRedeem = async (inventoryId: number) => {
        try {
            await api.post(`/gacha/redeem/${inventoryId}`);
            if (expandedId) await reloadDetails(expandedId);
        } catch (err) {
            console.error('Error redeeming', err);
        }
    };

    const handleDonation = async () => {
        if (!donationName.trim() || !donationAmount || parseFloat(donationAmount) <= 0) return;
        try {
            await api.post('/gacha/donations', { participantName: donationName.trim(), amount: parseFloat(donationAmount) });
            setDonationMsg('Donacion registrada correctamente');
            setDonationName('');
            setDonationAmount('');
            loadParticipants();
            setTimeout(() => setDonationMsg(''), 3000);
        } catch (err: any) {
            setDonationMsg(err.response?.data?.message || 'Error al registrar donacion');
        }
    };

    const filtered = participants.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    const filteredInventory = inventory.filter(inv => {
        const rarity = (inv.item?.rarity || 'common') as RarityType;
        const name = inv.item?.name?.toLowerCase() || '';
        if (invSearch && !name.includes(invSearch.toLowerCase())) return false;
        if (invFilter === 'all') return true;
        if (invFilter === 'redeemed') return inv.isRedeemed;
        return rarity === invFilter;
    });

    return (
        <div className="space-y-6">
            {/* Donation Form */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-[#e2e8f0] dark:border-[#374151]">
                    <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl">
                        <DollarSign className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">Registrar Donacion</h2>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Cada $1 donado = 1 tiro de gacha</p>
                    </div>
                </div>
                <div className="flex gap-3 items-end flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                        <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">Nombre del participante</label>
                        <input type="text" value={donationName} onChange={e => setDonationName(e.target.value)} placeholder="usuario de twitch" className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc]" />
                    </div>
                    <div className="w-32">
                        <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">Monto ($)</label>
                        <input type="number" min={0.01} step={0.01} value={donationAmount} onChange={e => setDonationAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc]" />
                    </div>
                    <button onClick={handleDonation} disabled={!donationName.trim() || !donationAmount || parseFloat(donationAmount) <= 0} className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-xl font-bold transition-all">
                        Registrar
                    </button>
                </div>
                {donationMsg && <p className={`text-sm font-bold ${donationMsg.includes('Error') ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{donationMsg}</p>}
            </div>

            {/* Participants List */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-[#e2e8f0] dark:border-[#374151]">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">Participantes ({participants.length})</h2>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Click en un participante para ver detalles</p>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar participante..." className="pl-10 pr-4 py-2.5 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-[#1e293b] dark:text-[#f8fafc] w-48" />
                    </div>
                </div>

                {loading ? (
                    <p className="text-center text-[#64748b] dark:text-[#94a3b8] py-8">Cargando...</p>
                ) : filtered.length === 0 ? (
                    <p className="text-center text-[#64748b] dark:text-[#94a3b8] py-8">{search ? 'Sin resultados' : 'No hay participantes aun'}</p>
                ) : (
                    <div className="space-y-2">
                        {/* Header */}
                        <div className="grid grid-cols-5 gap-4 px-4 py-2 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase">
                            <span>Nombre</span><span>Total Donado</span><span>Tiros Usados</span><span>Tiros Disponibles</span><span></span>
                        </div>
                        {filtered.map(p => (
                            <div key={p.id}>
                                <div
                                    className={`grid grid-cols-5 gap-4 items-center px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                                        expandedId === p.id
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                                            : 'bg-[#f8fafc] dark:bg-[#262626] border-[#e2e8f0] dark:border-[#374151] hover:border-blue-300 dark:hover:border-blue-700'
                                    }`}
                                    onClick={() => toggleExpand(p.id)}
                                >
                                    <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{p.name}</span>
                                    <span className="text-sm text-green-600 dark:text-green-400 font-bold">${p.donationAmount.toFixed(2)}</span>
                                    <span className="text-sm text-[#1e293b] dark:text-[#f8fafc]">{p.pulls}</span>
                                    <span className="text-sm font-bold text-blue-600">{Math.floor(p.effectiveDonation)}</span>
                                    <span className="text-right">{expandedId === p.id ? <ChevronUp className="w-4 h-4 text-[#64748b] inline" /> : <ChevronDown className="w-4 h-4 text-[#64748b] inline" />}</span>
                                </div>

                                {/* Expanded */}
                                {expandedId === p.id && (
                                    <div className="mt-2 space-y-4 p-5 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] shadow-inner">
                                        {detailLoading ? (
                                            <p className="text-center text-[#64748b] dark:text-[#94a3b8] py-4">Cargando detalles...</p>
                                        ) : (
                                            <>
                                                {/* Stats */}
                                                {stats && (
                                                    <div>
                                                        <h4 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-3 flex items-center gap-2"><Package className="w-4 h-4 text-purple-500" /> Estadisticas de Coleccion</h4>
                                                        <div className="flex gap-2 flex-wrap">
                                                            <span className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold">Unicas: {stats.uniqueCards}/{stats.totalAvailable}</span>
                                                            <span className="px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold">Total cartas: {stats.totalCards}</span>
                                                            {RARITY_ORDER.map(r => {
                                                                const count = stats.byRarity[r] || 0;
                                                                if (count === 0) return null;
                                                                const cfg = RARITY_CONFIG[r];
                                                                return <span key={r} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>{cfg.label}: {count}</span>;
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Inventory */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h4 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2"><Gift className="w-4 h-4 text-green-500" /> Inventario ({inventory.length})</h4>
                                                        <div className="flex items-center gap-2">
                                                            <div className="relative">
                                                                <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748b]" />
                                                                <input type="text" value={invSearch} onChange={e => setInvSearch(e.target.value)} placeholder="Buscar item..." className="pl-8 pr-3 py-1.5 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-xs text-[#1e293b] dark:text-[#f8fafc] w-36" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {/* Rarity filters */}
                                                    <div className="flex gap-1.5 mb-3 flex-wrap">
                                                        <button onClick={() => setInvFilter('all')} className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${invFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-[#262626] text-[#64748b]'}`}>Todos</button>
                                                        {RARITY_ORDER.map(r => {
                                                            const cfg = RARITY_CONFIG[r];
                                                            return (
                                                                <button key={r} onClick={() => setInvFilter(r)} className={`px-2.5 py-1 rounded-lg text-xs font-bold transition`} style={invFilter === r ? { backgroundColor: cfg.color, color: 'white' } : { backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                                                                    {cfg.label}
                                                                </button>
                                                            );
                                                        })}
                                                        <button onClick={() => setInvFilter('redeemed')} className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${invFilter === 'redeemed' ? 'bg-green-600 text-white' : 'bg-green-50 dark:bg-green-900/20 text-green-600'}`}>Canjeados</button>
                                                    </div>

                                                    {filteredInventory.length === 0 ? (
                                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] py-3 text-center">{invSearch || invFilter !== 'all' ? 'Sin resultados con este filtro' : 'Sin items en inventario'}</p>
                                                    ) : (
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                                            {filteredInventory.map(inv => {
                                                                const rarity = (inv.item?.rarity || 'common') as RarityType;
                                                                const cfg = RARITY_CONFIG[rarity];
                                                                return (
                                                                    <div key={inv.id} className="rounded-xl border-2 overflow-hidden transition-all hover:scale-105" style={{ borderColor: cfg.border, backgroundColor: cfg.bg }}>
                                                                        {/* Image */}
                                                                        <div className="aspect-square bg-[#0f172a]/5 dark:bg-[#0f172a]/30 relative">
                                                                            {inv.item?.image ? (
                                                                                <img src={inv.item.image} alt={inv.item.name} className="w-full h-full object-cover" />
                                                                            ) : (
                                                                                <div className="w-full h-full flex items-center justify-center">
                                                                                    <Package className="w-8 h-8" style={{ color: cfg.color, opacity: 0.3 }} />
                                                                                </div>
                                                                            )}
                                                                            {/* Quantity badge */}
                                                                            {inv.quantity > 1 && (
                                                                                <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-black/70 text-white text-[10px] font-bold rounded-md">x{inv.quantity}</span>
                                                                            )}
                                                                            {/* Redeemed overlay */}
                                                                            {inv.isRedeemed && (
                                                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[1px]">
                                                                                    <span className="px-3 py-1 bg-green-600 text-white text-[10px] font-bold rounded-lg shadow-lg rotate-[-8deg] border border-green-400">CANJEADO</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {/* Info */}
                                                                        <div className="p-2 text-center">
                                                                            <p className="text-[10px] font-bold" style={{ color: cfg.color }}>{getRarityStars(rarity)}</p>
                                                                            <p className="text-xs font-bold text-[#1e293b] dark:text-[#f8fafc] truncate" title={inv.item?.name}>{inv.item?.name || `#${inv.itemId}`}</p>
                                                                            {!inv.isRedeemed && (
                                                                                <button onClick={e => { e.stopPropagation(); handleRedeem(inv.id); }} className="mt-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold transition">Canjear</button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Pull History */}
                                                <div>
                                                    <h4 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-3 flex items-center gap-2"><History className="w-4 h-4 text-orange-500" /> Historial de Pulls</h4>
                                                    {logs.length === 0 ? (
                                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] text-center py-3">Sin historial</p>
                                                    ) : (
                                                        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                                                            {logs.map(log => {
                                                                const rarity = (log.item?.rarity || 'common') as RarityType;
                                                                const cfg = RARITY_CONFIG[rarity];
                                                                return (
                                                                    <div key={log.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-[#262626] rounded-lg">
                                                                        {/* Mini image */}
                                                                        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border" style={{ borderColor: cfg.border }}>
                                                                            {log.item?.image ? (
                                                                                <img src={log.item.image} alt="" className="w-full h-full object-cover" />
                                                                            ) : (
                                                                                <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: cfg.bg }}>
                                                                                    <Package className="w-4 h-4" style={{ color: cfg.color, opacity: 0.5 }} />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-xs font-bold text-[#1e293b] dark:text-[#f8fafc] truncate">{log.item?.name || `Item #${log.itemId}`}</p>
                                                                            <p className="text-[10px]" style={{ color: cfg.color }}>{getRarityStars(rarity)} {cfg.label}</p>
                                                                        </div>
                                                                        <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] whitespace-nowrap">{new Date(log.occurredAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
