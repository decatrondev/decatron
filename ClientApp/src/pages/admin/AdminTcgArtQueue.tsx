import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, Upload, ArrowLeft, Users } from 'lucide-react';
import api from '../../services/api';

// Cola de arte pendiente — ver .dev/plans/TCG_CARTAS_COLECCIONABLES_PLAN.md sección 7.
//
// Solo aparece el nivel 10: del 1 al 9 la carta usa el arte base dentro de la cápsula
// PSA, que es puro frontend. Subir el archivo acá no es "marcar como hecho": es lo que
// COMPLETA el upgrade — las cartas que sacaron un 10 están frenadas esperándolo.
//
// No hay prompts ni seeds: la generación se hace por fuera. Acá solo hace falta ver qué
// carta es, cómo se ve hoy, y poder subir el archivo.

interface ArtQueueItem {
    id: number;
    cardId: string;
    level: number;
    status: string;
    requestedAt: string;
    cardName: string | null;
    cardRarity: string | null;
    cardElement: string | null;
    cardClass: string | null;
    referenceImageUrl: string | null;
    waitingPlayers: number;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AdminTcgArtQueue() {
    const navigate = useNavigate();
    const [items, setItems] = useState<ArtQueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/tcg/admin/art-queue');
            setItems(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error loading art queue:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleUpload = async (item: ArtQueueItem, file: File) => {
        setUploading(item.id);
        setError(null);
        try {
            // El Content-Type va explícito porque la instancia de axios tiene
            // 'application/json' como default global: sin pisarlo, el FormData se manda
            // marcado como JSON y el backend responde 415. Mismo patrón que el resto de
            // los uploads del proyecto (ver useMediaUpload del timer).
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post(`/tcg/admin/art-queue/${item.id}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            await load();
            const unlocked = res.data?.unlocked ?? 0;
            if (unlocked > 0) {
                setError(null);
                alert(`Arte subido. ${unlocked} carta(s) destrabada(s): sus dueños ya pueden confirmar el grado 10.`);
            }
        } catch (err: any) {
            console.error('Error uploading art:', err);
            setError(err?.response?.data?.error || 'No se pudo subir el archivo.');
        } finally {
            setUploading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin')} className="p-2 hover:bg-ds-raised rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5 text-ds-text" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">TCG — Cola de arte pendiente</h1>
                        <p className="text-ds-soft mt-1">
                            Cartas que sacaron grado 10 y esperan su ilustración exclusiva. Cuando subís el
                            archivo, el upgrade se completa y el jugador ya puede confirmarlo.
                        </p>
                    </div>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-2 bg-ds-bg border border-ds-border hover:border-ds-accent text-ds-text px-4 py-2 rounded-lg transition-colors"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Actualizar
                </button>
            </div>

            {error && (
                <div className="text-sm font-semibold text-ds-danger bg-ds-danger-solid/10 border border-ds-danger/40 rounded-lg px-4 py-3">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center min-h-[200px]">
                    <Loader2 className="w-8 h-8 animate-spin text-ds-accent-text" />
                </div>
            ) : items.length === 0 ? (
                <p className="text-ds-soft">
                    No hay nada pendiente. Un grado 10 sale en el 0.5% de los intentos, así que esto
                    va a estar vacío casi siempre.
                </p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((item) => (
                        <div key={item.id} className="bg-ds-bg border border-ds-border rounded-lg p-5 space-y-4">
                            <div className="flex gap-4">
                                {item.referenceImageUrl ? (
                                    <img
                                        src={item.referenceImageUrl}
                                        alt={item.cardName || 'carta'}
                                        className="w-24 aspect-[3/4] object-cover rounded-lg bg-ds-input/20 shrink-0"
                                    />
                                ) : (
                                    <div className="w-24 aspect-[3/4] rounded-lg bg-ds-input/20 shrink-0 flex items-center justify-center text-[10px] text-ds-soft">
                                        sin arte
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <div className="font-bold text-ds-text truncate">{item.cardName || '???'}</div>
                                    <div className="text-xs text-ds-soft mt-0.5">{item.cardRarity} · nivel {item.level}</div>
                                    <div className="text-xs text-ds-soft mt-0.5">{item.cardElement} · {item.cardClass}</div>
                                    <div className="text-[11px] text-ds-soft mt-2">Pedida {formatDate(item.requestedAt)}</div>
                                    {item.waitingPlayers > 0 && (
                                        <div className="text-[11px] text-ds-warn mt-1 flex items-center gap-1">
                                            <Users className="w-3 h-3" />
                                            {item.waitingPlayers} esperando
                                        </div>
                                    )}
                                </div>
                            </div>

                            <p className="text-[11px] text-ds-soft leading-relaxed">
                                Tiene que ser el mismo personaje que la referencia, evolucionado. Mismo formato
                                que las cartas base (WEBP, vertical 3:4).
                            </p>

                            <input
                                ref={(el) => { fileInputs.current[item.id] = el; }}
                                type="file"
                                accept=".webp,.png,.gif,.jpg,.jpeg"
                                className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(item, f); }}
                            />
                            <button
                                onClick={() => fileInputs.current[item.id]?.click()}
                                disabled={uploading === item.id}
                                className="w-full flex items-center justify-center gap-2 bg-ds-accent hover:bg-ds-accent-hover disabled:opacity-50 text-ds-on-accent font-bold py-2.5 rounded-lg transition-colors"
                            >
                                {uploading === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                Subir ilustración
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
