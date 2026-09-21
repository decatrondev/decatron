import React, { useEffect, useState } from 'react';
import { KeyRound, Loader2, Check, AlertTriangle } from 'lucide-react';
import api from '../../../services/api';

// Pestaña "Riot API". Separado de TournamentConfig.tsx el 15-08-2026.

interface RiotConfigResponse {
    configured: boolean;
    keyType?: string;
    isActive?: boolean;
    lastValidatedAt?: string | null;
    lastErrorAt?: string | null;
    lastErrorMessage?: string | null;
}

export default function RiotConfigPanel() {
    const [config, setConfig] = useState<RiotConfigResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [apiKey, setApiKey] = useState('');
    const [keyType, setKeyType] = useState('development');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/tournament/riot-config');
            setConfig(res.data.config);
            if (res.data.config?.keyType) setKeyType(res.data.config.keyType);
        } catch (err) {
            console.error('Error cargando config de Riot API', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        setSaved(false);
        try {
            await api.post('/admin/tournament/riot-config', { apiKey, keyType });
            setApiKey('');
            setSaved(true);
            await load();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Error guardando la key');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4 max-w-xl">
            <h2 className="text-lg 4xl:text-xl font-bold text-[#1e293b] dark:text-[#f8fafc]">Riot API</h2>

            <div className="p-4 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] space-y-2 text-sm text-[#475569] dark:text-[#94a3b8]">
                <p>
                    <strong className="text-[#1e293b] dark:text-[#f8fafc]">¿Para qué sirve?</strong> Con esta key el sistema consulta a Riot los datos reales
                    de las partidas de tus participantes: LP actual (SoloQ Climb) o el resultado de cada partida ARAM para declarar ganadores solos y armar el
                    ranking/bracket sin que vos tengas que cargar nada a mano.
                </p>
                <p>
                    <strong className="text-[#1e293b] dark:text-[#f8fafc]">¿Por qué la necesito yo?</strong> Cada canal usa su propia key — Riot no permite
                    una key compartida entre distintos organizadores, y las keys de developer tienen un límite bajo de consultas por minuto (no alcanzaría
                    para varios torneos a la vez).
                </p>
                <div>
                    <strong className="text-[#1e293b] dark:text-[#f8fafc]">Cómo conseguir una (dura 24 horas, hay que renovarla):</strong>
                    <ol className="list-decimal pl-5 mt-1 space-y-1">
                        <li>
                            Entrá a{' '}
                            <a href="https://developer.riotgames.com" target="_blank" rel="noreferrer" className="text-[#2563eb] hover:underline">
                                developer.riotgames.com
                            </a>
                            .
                        </li>
                        <li>Iniciá sesión con tu cuenta de Riot Games (la misma con la que jugás).</li>
                        <li>Si es la primera vez, te va a pedir crear una cuenta de developer (nombre, datos básicos) — es aparte de tu cuenta de juego.</li>
                        <li>
                            Una vez adentro, copiá la <strong>Development API Key</strong> que te muestra en el dashboard (empieza con "RGAPI-...").
                        </li>
                        <li>Pegala acá abajo y guardá — esa key dura 24 horas, después Riot la vence y hay que volver a copiar una nueva.</li>
                    </ol>
                </div>
                <p className="text-xs text-[#94a3b8]">
                    Si el torneo va a durar más de un día, vas a tener que volver a esta pantalla y renovar la key cada 24hs (o pedirle a Riot una key de
                    producción, que no vence).
                </p>
            </div>

            <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                Se guarda cifrada — nunca se vuelve a mostrar, si necesitas cambiarla la pegas entera de nuevo.
            </p>

            {loading ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Cargando...</p>
            ) : (
                <>
                    {config?.configured && (
                        <div className="p-3 rounded-xl bg-[#132A2A] border border-[#2563eb]/30 text-sm">
                            <p className="text-[#2563eb] font-bold flex items-center gap-1.5">
                                <Check className="w-4 h-4" /> Key configurada ({config.keyType})
                            </p>
                            {config.lastErrorMessage && (
                                <p className="text-red-600 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Ultimo error: {config.lastErrorMessage}
                                </p>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleSave} className="space-y-3">
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">API Key</label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                required
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                placeholder="RGAPI-..."
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Tipo</label>
                            <select
                                value={keyType}
                                onChange={(e) => setKeyType(e.target.value)}
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                            >
                                <option value="development">Development (se vence cada 24h)</option>
                                <option value="production">Production</option>
                            </select>
                        </div>
                        {error && (
                            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4" /> {error}
                            </p>
                        )}
                        {saved && (
                            <p className="text-sm text-[#2563eb] flex items-center gap-1">
                                <Check className="w-4 h-4" /> Guardada y verificada contra Riot
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-sm font-bold hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                            {saving ? 'Verificando contra Riot...' : 'Guardar key'}
                        </button>
                    </form>
                </>
            )}
        </div>
    );
}
