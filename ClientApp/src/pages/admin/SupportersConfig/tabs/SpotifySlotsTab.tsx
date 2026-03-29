import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import type { SpotifySlotRequest } from '../types';
import { CARD } from '../constants';
import api from '../../../../services/api';

export function SpotifySlotsTab() {
    const [requests, setRequests] = useState<SpotifySlotRequest[]>([]);
    const [slotInfo, setSlotInfo] = useState({ total: 5, used: 0, available: 5 });
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    const loadData = async () => {
        try {
            const [reqRes, slotsRes] = await Promise.all([
                api.get('/nowplaying/admin/spotify-cupos'),
                api.get('/nowplaying/spotify-cupos'),
            ]);
            if (reqRes.data?.success) setRequests(reqRes.data.requests);
            if (slotsRes.data?.cupos) setSlotInfo(slotsRes.data.cupos);
        } catch (err) {
            console.error('Error loading spotify slots:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleAssign = async (userId: number) => {
        if (!confirm('Asignar cupo? Recuerda agregar el email en el Spotify Developer Dashboard (User Management) primero.')) return;
        setActionLoading(userId);
        try {
            const res = await api.post(`/nowplaying/admin/assign-cupo/${userId}`);
            if (res.data?.success) await loadData();
        } catch (err) {
            console.error('Error assigning slot:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleRevoke = async (userId: number) => {
        if (!confirm('Revocar cupo? Se desconectara Spotify del usuario.')) return;
        setActionLoading(userId);
        try {
            const res = await api.post(`/nowplaying/admin/revoke-cupo/${userId}`);
            if (res.data?.success) await loadData();
        } catch (err) {
            console.error('Error revoking slot:', err);
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-[#94a3b8]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary */}
            <div className={CARD}>
                <h3 className="font-black text-[#1e293b] dark:text-[#f8fafc] text-lg mb-4">Slots de Spotify</h3>
                <div className="flex items-center gap-3 mb-3">
                    {Array.from({ length: slotInfo.total }).map((_, i) => (
                        <div
                            key={i}
                            className={`w-4 h-4 rounded-full ${i < slotInfo.used ? 'bg-[#1DB954]' : 'bg-[#374151]'}`}
                        />
                    ))}
                    <span className="text-sm font-bold text-[#f8fafc]">{slotInfo.used}/{slotInfo.total} asignados</span>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <p className="text-xs text-amber-400">
                        Recuerda: despues de asignar un slot, debes agregar el email del usuario manualmente en el{' '}
                        <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-300">
                            Spotify Developer Dashboard
                        </a>
                        {' '}(User Management).
                    </p>
                </div>
            </div>

            {/* Requests table */}
            <div className={CARD}>
                <h3 className="font-black text-[#1e293b] dark:text-[#f8fafc] text-lg mb-4">Solicitudes</h3>
                {requests.length === 0 ? (
                    <p className="text-sm text-[#94a3b8] py-4 text-center">No hay solicitudes de slots de Spotify</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#374151]">
                                    <th className="text-left py-2 px-3 text-[#94a3b8] font-semibold">Usuario</th>
                                    <th className="text-left py-2 px-3 text-[#94a3b8] font-semibold">Email Spotify</th>
                                    <th className="text-left py-2 px-3 text-[#94a3b8] font-semibold">Tier</th>
                                    <th className="text-left py-2 px-3 text-[#94a3b8] font-semibold">Estado</th>
                                    <th className="text-left py-2 px-3 text-[#94a3b8] font-semibold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map((req) => (
                                    <tr key={req.userId} className="border-b border-[#374151]/50 hover:bg-[#262626]">
                                        <td className="py-3 px-3">
                                            <div className="text-[#f8fafc] font-medium">{req.displayName}</div>
                                            <div className="text-xs text-[#64748b]">{req.login}</div>
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className="text-[#f8fafc] font-mono text-xs bg-[#262626] px-2 py-1 rounded">
                                                {req.spotifyEmail}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                                                req.tier === 'fundador' ? 'bg-yellow-500/20 text-yellow-400' :
                                                req.tier === 'premium' ? 'bg-purple-500/20 text-purple-400' :
                                                req.tier === 'supporter' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-[#374151] text-[#94a3b8]'
                                            }`}>
                                                {req.tier}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3">
                                            {req.slotAssigned ? (
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                                    <span className="text-xs text-green-400 font-medium">Activo</span>
                                                    {req.spotifyConnected && (
                                                        <span className="text-xs text-[#64748b] ml-1">(conectado)</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                                                    <span className="text-xs text-amber-400 font-medium">Pendiente</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-3">
                                            {req.slotAssigned ? (
                                                <button
                                                    onClick={() => handleRevoke(req.userId)}
                                                    disabled={actionLoading === req.userId}
                                                    className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                                >
                                                    {actionLoading === req.userId ? 'Revocando...' : 'Revocar'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleAssign(req.userId)}
                                                    disabled={actionLoading === req.userId || slotInfo.available <= 0}
                                                    className="px-3 py-1.5 bg-[#1DB954]/10 border border-[#1DB954]/20 text-[#1DB954] rounded-lg text-xs font-medium hover:bg-[#1DB954]/20 transition-colors disabled:opacity-50"
                                                >
                                                    {actionLoading === req.userId ? 'Asignando...' : 'Asignar'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
