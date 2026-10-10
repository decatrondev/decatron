import React, { useEffect, useState } from 'react';
import { Loader2, Check, AlertTriangle, Plus, Trash2, ShieldCheck } from 'lucide-react';
import api from '../../services/api';

// Cuentas de Epic (Fortnite) vinculadas a nivel de cuenta de plataforma — se usan
// para inscribirse a torneos de Fortnite (.dev/torneos/15-fortnite.md F1). Viven en
// linked_game_accounts (game = fortnite), las mismas que usa Game Overlays.
// Con el login oficial de Epic (aprobado 2026-09-29) la cuenta queda verificada;
// la carga por nombre sigue disponible y queda sin verificar.

interface LinkedAccount {
    id: number;
    game: string;
    provider: string;
    externalName: string;
}

export default function EpicAccountsSettings() {
    const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [epicAvailable, setEpicAvailable] = useState(false);
    const [redirecting, setRedirecting] = useState(false);
    // Resultado de la vuelta desde Epic (?epic=ok|error&reason=...).
    const [epicResult] = useState(() => {
        const q = new URLSearchParams(window.location.search);
        const epic = q.get('epic');
        return epic ? { ok: epic === 'ok', reason: q.get('reason') } : null;
    });

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/me/game-accounts');
            setAccounts((res.data.accounts || []).filter((a: LinkedAccount) => a.game === 'fortnite'));
        } catch (err) {
            console.error('Error cargando cuentas de Epic', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        api.get('/me/epic/status').then((res) => setEpicAvailable(!!res.data.available)).catch(() => {});
    }, []);

    const loginWithEpic = async () => {
        setRedirecting(true);
        setError('');
        try {
            const res = await api.get('/me/epic/login-url', { params: { returnTo: '/settings' } });
            window.location.href = res.data.url;
        } catch (err: any) {
            setError(err?.response?.data?.message || 'No se pudo abrir el inicio de sesión de Epic');
            setRedirecting(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            await api.post('/me/game-accounts', { game: 'fortnite', name: name.trim() });
            setName('');
            setShowForm(false);
            await load();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'No se pudo vincular la cuenta');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('¿Desvincular esta cuenta de Epic?')) return;
        setError('');
        try {
            await api.delete(`/me/game-accounts/${id}`);
            await load();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'No se pudo desvincular la cuenta');
        }
    };

    return (
        <div className="p-4 bg-ds-bg rounded-lg border border-ds-border space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="font-bold text-ds-text">Cuentas de Epic Games (Fortnite)</div>
                    <div className="text-sm text-ds-soft">
                        Para inscribirte a torneos de Fortnite.{' '}
                        {epicAvailable
                            ? 'Vincúlala con tu inicio de sesión de Epic para que quede verificada.'
                            : 'Por ahora quedan sin verificar.'}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    {epicAvailable && (
                        <button
                            onClick={loginWithEpic}
                            disabled={redirecting}
                            className="ds-btn ds-btn--primary ds-btn--sm"
                        >
                            {redirecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Vincular con Epic Games
                        </button>
                    )}
                    <button
                        onClick={() => setShowForm((v) => !v)}
                        className={
                            epicAvailable
                                ? 'ds-btn ds-btn--secondary ds-btn--sm'
                                : 'ds-btn ds-btn--primary ds-btn--sm'
                        }
                    >
                        <Plus className="w-4 h-4" /> {epicAvailable ? 'Solo con el nombre' : 'Vincular cuenta'}
                    </button>
                </div>
            </div>

            {epicResult && (
                <p className={`text-sm flex items-center gap-1 ${epicResult.ok ? 'text-ds-ok' : 'text-ds-danger'}`}>
                    {epicResult.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {epicResult.ok ? 'Cuenta de Epic vinculada y verificada.' : epicResult.reason || 'No se pudo vincular la cuenta de Epic.'}
                </p>
            )}

            {showForm && (
                <form
                    onSubmit={handleAdd}
                    className="p-3 rounded-lg bg-ds-surface border border-ds-border flex flex-col md:flex-row md:items-end gap-3"
                >
                    <div className="flex-1">
                        <label className="text-xs font-bold text-ds-soft">Nombre de Epic (el que se ve en Fortnite)</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            placeholder="Nombre de Epic"
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-ds-border bg-ds-surface text-ds-text text-sm"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={saving || !name.trim()}
                        className="ds-btn ds-btn--primary"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Vincular
                    </button>
                </form>
            )}

            {loading ? (
                <p className="text-sm text-ds-soft">Cargando...</p>
            ) : accounts.length === 0 ? (
                <p className="text-sm text-ds-soft">Todavía no vinculaste ninguna cuenta.</p>
            ) : (
                <div className="space-y-2">
                    {accounts.map((a) => {
                        const verified = a.provider === 'epic';
                        return (
                            <div
                                key={a.id}
                                className="p-3 rounded-lg bg-ds-surface border border-ds-border flex items-center justify-between gap-3"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-bold text-ds-text truncate">{a.externalName}</span>
                                    {verified ? (
                                        <ShieldCheck className="w-4 h-4 text-ds-ok flex-shrink-0" />
                                    ) : (
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-ds-warn/10 text-ds-warn flex-shrink-0">
                                            sin verificar
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDelete(a.id)}
                                    className="p-1.5 rounded-lg text-ds-soft hover:text-ds-danger flex-shrink-0"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
            {error && (
                <p className="text-sm text-ds-danger flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> {error}
                </p>
            )}
        </div>
    );
}
