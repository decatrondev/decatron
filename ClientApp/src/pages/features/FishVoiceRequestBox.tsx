// «Solicitar una voz»: el streamer pide una voz de personaje y el admin la revisa en /admin/fish-voices.
import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import FishMyVoices from './FishMyVoices';
import { useFishVoices } from './fishVoices';

interface MyRequest {
    id: number;
    description: string;
    status: 'pending' | 'approved' | 'rejected';
    adminNote?: string | null;
}

const STATUS_LABEL: Record<MyRequest['status'], string> = {
    pending: 'En revisión',
    approved: 'Aprobada: ya está en la lista',
    rejected: 'Rechazada',
};

export default function FishVoiceRequestBox() {
    const { canAddPrivate, loading } = useFishVoices();
    const [text, setText] = useState('');
    const [list, setList] = useState<MyRequest[]>([]);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/tts/fish-voice-requests');
            setList(res.data.requests ?? []);
        } catch { /* sin lista, el formulario sigue funcionando */ }
    }, []);

    useEffect(() => { load(); }, [load]);

    const send = async () => {
        setBusy(true);
        setMsg(null);
        try {
            await api.post('/tts/fish-voice-requests', { description: text });
            setText('');
            setMsg({ ok: true, text: 'Solicitud enviada. La revisaremos pronto.' });
            await load();
        } catch (e: any) {
            setMsg({ ok: false, text: e?.response?.data?.message ?? 'No se pudo enviar la solicitud' });
        } finally {
            setBusy(false);
        }
    };

    // Rango Patrocinador o superior: busca y agrega sus propias voces en vez de solicitarlas
    if (!loading && canAddPrivate) return <FishMyVoices />;

    return (
        <div className="mt-4 rounded-xl border border-ds-border bg-ds-bg p-4 space-y-3">
            <div>
                <h3 className="text-sm font-black text-ds-text">🎭 Solicitar una voz de personaje</h3>
                <p className="text-xs text-ds-soft mt-1">
                    ¿No está la voz que quieres? Pídela aquí: escribe el nombre del personaje o pega el enlace de la voz en fish.audio.
                    Revisamos cada solicitud y, si la aprobamos, aparece en la lista para todos. Con el rango Patrocinador puedes buscar y agregar tus propias voces sin esperar.
                </p>
            </div>
            <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="Ej: la voz de Goku en español latino"
                className="w-full px-3 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text text-sm focus:ring-2 focus:ring-ds-accent outline-none"
            />
            <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="ds-btn ds-btn--primary ds-btn--sm" disabled={busy || text.trim().length < 3} onClick={send}>
                    {busy ? 'Enviando…' : 'Solicitar voz'}
                </button>
                <span className="text-xs text-ds-soft">{text.trim().length}/300</span>
                {msg && <span className={'text-xs font-bold ' + (msg.ok ? 'text-ds-ok' : 'text-ds-danger')}>{msg.text}</span>}
            </div>
            {list.length > 0 && (
                <div className="border-t border-ds-border pt-2 space-y-1">
                    <p className="text-xs font-bold text-ds-soft">Tus solicitudes</p>
                    <ul className="space-y-1">
                        {list.map(r => (
                            <li key={r.id} className="text-xs text-ds-soft">
                                <span className="text-ds-text">{r.description}</span> — {STATUS_LABEL[r.status]}
                                {r.adminNote ? `: ${r.adminNote}` : ''}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
