import { useState, useEffect } from 'react';
import { Loader2, Send } from 'lucide-react';
import api from '../../../services/api';

interface ProviderInfo {
    provider: 'resend' | 'smtp';
    resendConfigured: boolean;
    smtpConfigured: boolean;
}

export default function ProviderTab() {
    const [info, setInfo] = useState<ProviderInfo | null>(null);
    const [saving, setSaving] = useState(false);
    const [testTo, setTestTo] = useState('');
    const [testing, setTesting] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const load = async () => {
        const res = await api.get('/admin/email/provider');
        setInfo(res.data);
    };
    useEffect(() => { load().catch(() => setMsg({ ok: false, text: 'No se pudo cargar el proveedor.' })); }, []);

    const choose = async (provider: 'resend' | 'smtp') => {
        setSaving(true);
        setMsg(null);
        try {
            await api.put('/admin/email/provider', { provider });
            await load();
            setMsg({ ok: true, text: provider === 'smtp' ? 'Los correos de la plataforma salen ahora por tu servidor.' : 'Los correos de la plataforma salen ahora por Resend.' });
        } catch {
            setMsg({ ok: false, text: 'No se pudo cambiar: ese proveedor no está configurado.' });
        } finally {
            setSaving(false);
        }
    };

    const sendTest = async () => {
        setTesting(true);
        setMsg(null);
        try {
            const res = await api.post('/admin/email/preview', {
                testEmail: testTo,
                subject: 'Prueba de envío',
                htmlContent: '<p>Este es un correo de prueba del proveedor activo.</p>',
            });
            setMsg(res.data.success ? { ok: true, text: 'Enviado. Revisa la bandeja (y el spam).' } : { ok: false, text: `Falló: ${res.data.error ?? 'sin detalle'}` });
        } catch {
            setMsg({ ok: false, text: 'No se pudo enviar la prueba.' });
        } finally {
            setTesting(false);
        }
    };

    if (!info) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-ds-soft" /></div>;

    const options = [
        { id: 'resend' as const, title: 'Resend', desc: 'Servicio externo. Entrega probada, sin reputación propia que cuidar.', ok: info.resendConfigured },
        { id: 'smtp' as const, title: 'Servidor propio', desc: 'Tu servidor de correo (mail.decatron.net). La reputación del dominio se construye con tu envío.', ok: info.smtpConfigured },
    ];

    return (
        <div className="space-y-4">
            <div className="bg-ds-surface rounded-lg border border-ds-border p-5 space-y-4">
                <div>
                    <h2 className="text-xl font-bold text-ds-text">Proveedor de los correos de la plataforma</h2>
                    <p className="text-ds-soft mt-1">Aplica a los enlaces de acceso, invitaciones y avisos de la plataforma. Los correos de los clientes no pasan por aquí: usan la llave de cada cliente.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                    {options.map(o => {
                        const active = info.provider === o.id;
                        return (
                            <div key={o.id} className={`rounded-lg border p-4 ${active ? 'border-ds-accent' : 'border-ds-border'}`}>
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-ds-text">{o.title}</span>
                                    <span className={`text-sm ${o.ok ? 'text-ds-ok' : 'text-ds-warn'}`}>{o.ok ? 'Configurado' : 'Sin configurar'}</span>
                                </div>
                                <p className="text-ds-soft text-sm mt-2">{o.desc}</p>
                                <button
                                    className={active ? 'ds-btn ds-btn--secondary mt-3' : 'ds-btn ds-btn--primary mt-3'}
                                    disabled={active || !o.ok || saving}
                                    onClick={() => choose(o.id)}
                                >
                                    {active ? 'En uso' : 'Usar este'}
                                </button>
                            </div>
                        );
                    })}
                </div>
                <p className="text-ds-soft text-sm">Si el servidor propio falla al enviar un correo real, se reintenta por Resend para no perder enlaces de acceso. La prueba de abajo no hace ese reintento: muestra el error del proveedor elegido.</p>
            </div>

            <div className="bg-ds-surface rounded-lg border border-ds-border p-5 space-y-3">
                <h3 className="font-bold text-ds-text">Enviar prueba</h3>
                <div className="flex flex-wrap gap-2">
                    <input className="ds-input" style={{ minWidth: 260 }} type="email" placeholder="correo@ejemplo.com" value={testTo} onChange={e => setTestTo(e.target.value)} />
                    <button className="ds-btn ds-btn--primary" disabled={testing || !testTo} onClick={sendTest}>
                        {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar
                    </button>
                </div>
            </div>

            {msg && <div className={`rounded-lg border p-3 text-sm ${msg.ok ? 'border-ds-ok/40 text-ds-ok' : 'border-ds-danger/40 text-ds-danger'}`}>{msg.text}</div>}
        </div>
    );
}
