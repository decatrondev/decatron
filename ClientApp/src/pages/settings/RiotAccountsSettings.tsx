import React, { useEffect, useState } from 'react';
import { Loader2, Check, AlertTriangle, Plus, Trash2, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import { REGION_LABELS } from '../tournament-public/shared';

// Cuentas de Riot vinculadas a nivel de cuenta de plataforma — pedido explicito del
// usuario (15-08-2026): "en el panel de cada quien debe vincular su cuenta de riot
// en settings", con soporte para varias (smurfs, otro server), cada una verificada
// por separado. Reutilizable en cualquier torneo (se elige cual usar al
// inscribirse, ver MyTournamentPage). Backend: RiotAccountController
// (api/me/riot-accounts).

interface RiotAccount {
    id: number;
    riotId: string;
    riotTagLine: string;
    region: string;
    verified: boolean;
    verificationPending: boolean;
    verificationChallengeIconId: number | null;
}

const REGIONS = [
    { value: 'euw1', label: 'EUW' }, { value: 'eun1', label: 'EUNE' }, { value: 'na1', label: 'NA' },
    { value: 'la1', label: 'LAN' }, { value: 'la2', label: 'LAS' }, { value: 'br1', label: 'BR' },
    { value: 'kr', label: 'KR' }, { value: 'jp1', label: 'JP' }, { value: 'oc1', label: 'OCE' },
    { value: 'tr1', label: 'TR' }, { value: 'ru', label: 'RU' },
];

const DDRAGON_VERSION = '14.23.1';
const iconUrl = (id: number) => `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${id}.png`;

export default function RiotAccountsSettings() {
    const [accounts, setAccounts] = useState<RiotAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [riotId, setRiotId] = useState('');
    const [riotTagLine, setRiotTagLine] = useState('');
    const [region, setRegion] = useState('euw1');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [verifyingId, setVerifyingId] = useState<number | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/me/riot-accounts');
            setAccounts(res.data.accounts || []);
        } catch (err) {
            console.error('Error cargando cuentas de Riot', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            await api.post('/me/riot-accounts', { riotId, riotTagLine, region });
            setRiotId(''); setRiotTagLine('');
            setShowForm(false);
            await load();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Error vinculando la cuenta');
        } finally {
            setSaving(false);
        }
    };

    const handleVerify = async (id: number) => {
        setVerifyingId(id);
        setError('');
        try {
            await api.post(`/me/riot-accounts/${id}/verify`);
            await load();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Todavía no coincide el icono');
        } finally {
            setVerifyingId(null);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('¿Desvincular esta cuenta de Riot?')) return;
        try {
            await api.delete(`/me/riot-accounts/${id}`);
            await load();
        } catch (err) {
            console.error('Error desvinculando cuenta', err);
        }
    };

    return (
        <div className="p-4 bg-gray-50 dark:bg-[#222324] rounded-lg border border-[#e2e8f0] dark:border-[#374151] space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <div className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Cuentas de Riot Games</div>
                    <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                        Puedes vincular varias (smurfs, otro server) — al inscribirte a un torneo eliges cuál usar.
                    </div>
                </div>
                <button onClick={() => setShowForm(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8]">
                    <Plus className="w-4 h-4" /> Vincular cuenta
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleAdd} className="p-3 rounded-lg bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Riot ID</label>
                            <input value={riotId} onChange={e => setRiotId(e.target.value)} required placeholder="Faker"
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Tag</label>
                            <input value={riotTagLine} onChange={e => setRiotTagLine(e.target.value)} required placeholder="KR1"
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Región</label>
                            <select value={region} onChange={e => setRegion(e.target.value)}
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm">
                                {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                    </div>
                    {error && <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {error}</p>}
                    <button type="submit" disabled={saving}
                        className="px-4 py-2 rounded-lg bg-[#16a34a] text-white text-sm font-bold hover:bg-[#15803d] disabled:opacity-50 flex items-center gap-1.5">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Vincular
                    </button>
                </form>
            )}

            {loading ? (
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Cargando...</p>
            ) : accounts.length === 0 ? (
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Todavía no vinculaste ninguna cuenta.</p>
            ) : (
                <div className="space-y-2">
                    {accounts.map(a => (
                        <div key={a.id} className="p-3 rounded-lg bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{a.riotId}#{a.riotTagLine}</span>
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] uppercase">{REGION_LABELS[a.region] || a.region}</span>
                                    {a.verified && <ShieldCheck className="w-4 h-4 text-green-600 dark:text-green-400" />}
                                </div>
                                <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg text-[#94a3b8] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            {!a.verified && a.verificationChallengeIconId != null && (
                                <div className="mt-2 pt-2 border-t border-[#e2e8f0] dark:border-[#374151] flex items-center gap-3">
                                    <img src={iconUrl(a.verificationChallengeIconId)} alt="Icono de verificación" className="w-10 h-10 rounded-full border-2 border-[#2563eb]" />
                                    <div className="flex-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
                                        Pon este icono de invocador en el cliente de League y confirma.
                                    </div>
                                    <button onClick={() => handleVerify(a.id)} disabled={verifyingId === a.id}
                                        className="px-3 py-1.5 rounded-lg bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-1">
                                        {verifyingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                        Confirmar
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    {error && <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {error}</p>}
                </div>
            )}
        </div>
    );
}
