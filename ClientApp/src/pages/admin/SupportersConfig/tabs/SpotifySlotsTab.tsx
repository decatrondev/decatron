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
                <RefreshCw className="w-6 h-6 animate-spin text-ds-soft" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary */}
            <div className={CARD}>
                <h3 className="font-black text-ds-text text-lg mb-4">Slots de Spotify</h3>
                <div className="flex items-center gap-3 mb-3">
                    {Array.from({ length: slotInfo.total }).map((_, i) => (
                        <div
                            key={i}
                            className={`w-4 h-4 rounded-full ${i < slotInfo.used ? 'bg-[#1DB954]' : 'bg-ds-raised'}`}
                        />
                    ))}
                    <span className="text-sm font-bold text-ds-text">{slotInfo.used}/{slotInfo.total} asignados</span>
                </div>
                <div className="bg-ds-warn/10 border border-ds-warn/40 rounded-lg p-3">
                    <p className="text-xs text-ds-warn">
                        Recuerda: despues de asignar un slot, debes agregar el email del usuario manualmente en el{' '}
                        <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline hover:text-ds-warn">
                            Spotify Developer Dashboard
                        </a>
                        {' '}(User Management).
                    </p>
                </div>
            </div>

            {/* Requests table */}
            <div className={CARD}>
                <h3 className="font-black text-ds-text text-lg mb-1">Solicitudes</h3>
                <p className="text-xs text-ds-soft mb-4">
                    Arriba los cupos activos; abajo la lista de espera, ordenada por tier (fundador, premium, supporter, free) y después por fecha de pedido. La asignación sigue siendo a mano: el #1 es a quien le toca.
                </p>
                {requests.length === 0 ? (
                    <p className="text-sm text-ds-soft py-4 text-center">No hay solicitudes de slots de Spotify</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-ds-border">
                                    <th className="text-left py-2 px-3 text-ds-soft font-semibold">Puesto</th>
                                    <th className="text-left py-2 px-3 text-ds-soft font-semibold">Usuario</th>
                                    <th className="text-left py-2 px-3 text-ds-soft font-semibold">Email Spotify</th>
                                    <th className="text-left py-2 px-3 text-ds-soft font-semibold">Tier</th>
                                    <th className="text-left py-2 px-3 text-ds-soft font-semibold">Pedido</th>
                                    <th className="text-left py-2 px-3 text-ds-soft font-semibold">Estado</th>
                                    <th className="text-left py-2 px-3 text-ds-soft font-semibold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map((req) => (
                                    <tr key={req.userId} className="border-b border-ds-border/50 hover:bg-ds-bg">
                                        <td className="py-3 px-3 text-ds-text font-bold">
                                            {req.position != null ? `#${req.position}` : <span className="text-ds-soft">—</span>}
                                        </td>
                                        <td className="py-3 px-3">
                                            <div className="text-ds-text font-medium">{req.displayName}</div>
                                            <div className="text-xs text-ds-soft">{req.login}</div>
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className="text-ds-text font-mono text-xs bg-ds-bg px-2 py-1 rounded">
                                                {req.spotifyEmail}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                                                req.tier === 'fundador' ? 'bg-ds-warn/20 text-ds-warn' :
                                                req.tier === 'premium' ? 'bg-ds-accent/20 text-ds-accent-text' :
                                                req.tier === 'supporter' ? 'bg-ds-accent/20 text-ds-accent-text' :
                                                'bg-ds-raised text-ds-soft'
                                            }`}>
                                                {req.tier}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-xs text-ds-soft whitespace-nowrap">
                                            {new Date(req.requestedAt).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="py-3 px-3">
                                            {req.slotAssigned ? (
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-ds-accent" />
                                                    <span className="text-xs text-ds-ok font-medium">Activo</span>
                                                    {req.spotifyConnected && (
                                                        <span className="text-xs text-ds-soft ml-1">(conectado)</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-ds-warn" />
                                                    <span className="text-xs text-ds-warn font-medium">En espera</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-3">
                                            {req.slotAssigned ? (
                                                <button
                                                    onClick={() => handleRevoke(req.userId)}
                                                    disabled={actionLoading === req.userId}
                                                    className="px-3 py-1.5 bg-ds-danger-solid/10 border border-ds-danger/40 text-ds-danger rounded-lg text-xs font-medium hover:bg-ds-danger-solid/20 transition-colors disabled:opacity-50"
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
