import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, LogOut, PlugZap, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { isTokenExpired } from '../utils/jwt';

// Inicio de sesión de la extensión de Decatron (/extension/login). La persona entra con su cuenta de siempre; esta página pide un
// token de espectador (solo sirve para la traducción en vivo, no da acceso al panel) y se lo entrega a la extensión con un mensaje
// del navegador: un script de la extensión que solo corre en esta dirección lo guarda. Plan: .dev/plans/TRADUCCION_ACCESO_PLAN.md, Fase 2.

type Phase = 'login' | 'working' | 'ok' | 'noext' | 'error';

export default function ExtensionLogin() {
    const { t } = useTranslation('extlogin');
    const [phase, setPhase] = useState<Phase>('working');
    const [login, setLogin] = useState('');
    const [revoked, setRevoked] = useState(false);
    const busy = useRef(false);

    const hasSession = (() => { try { const k = localStorage.getItem('token'); return !!k && !isTokenExpired(k, 60); } catch { return false; } })();

    const deliver = useCallback(async () => {
        if (busy.current) return;
        busy.current = true;
        setPhase('working');
        setRevoked(false);
        try {
            const res = await api.post('/viewer-token');
            const { token, login: who, expiresAt } = res.data as { token: string; login: string; expiresAt: number };
            setLogin(who);
            // La extensión contesta con un acuse; sin él en un par de segundos, probablemente no está instalada o no está activa.
            const acked = await new Promise<boolean>(resolve => {
                const onMsg = (e: MessageEvent) => {
                    if (e.source === window && e.origin === window.location.origin && e.data?.type === 'dct-viewer-token-ack') { cleanup(); resolve(true); }
                };
                const timer = window.setTimeout(() => { cleanup(); resolve(false); }, 2500);
                const cleanup = () => { window.removeEventListener('message', onMsg); window.clearTimeout(timer); };
                window.addEventListener('message', onMsg);
                window.postMessage({ type: 'dct-viewer-token', token, login: who, expiresAt }, window.location.origin);
            });
            setPhase(acked ? 'ok' : 'noext');
        } catch {
            setPhase('error');
        } finally {
            busy.current = false;
        }
    }, []);

    useEffect(() => {
        if (!hasSession) { setPhase('login'); return; }
        void deliver();
    }, [hasSession, deliver]);

    const revokeAll = async () => {
        try { await api.post('/viewer-token/revoke'); setRevoked(true); } catch { setPhase('error'); }
    };

    const loginUrl = `/login?redirect=${encodeURIComponent('/extension/login')}`;
    const btn = 'inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold transition-colors';

    return (
        <div className="flex min-h-dvh items-center justify-center bg-pub-bg px-4 py-10 text-[#d4d4d8]">
            <main className="w-full max-w-md rounded-lg border border-pub-border bg-pub-surface p-6 sm:p-8 3xl:max-w-lg">
                <p className="font-mono text-xs uppercase tracking-widest text-pub-accent-hi/80"># {t('eyebrow')}</p>
                <h1 className="mt-1 text-2xl font-black text-white 3xl:text-3xl">{t('title')}</h1>
                <p className="mt-2 text-sm text-[#a1a1aa]">{t('intro')}</p>

                <div className="mt-6" role="status" aria-live="polite">
                    {phase === 'login' && (
                        <>
                            <p className="text-sm">{t('needLogin')}</p>
                            <a href={loginUrl} className={`${btn} mt-4 bg-pub-accent text-white hover:bg-pub-accent-hover`}>{t('login')}</a>
                        </>
                    )}
                    {phase === 'working' && <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{t('working')}</p>}
                    {phase === 'ok' && (
                        <p className="flex items-start gap-2 text-sm text-ds-ok"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" /><span>{t('ok', { login })}</span></p>
                    )}
                    {phase === 'noext' && (
                        <>
                            <p className="flex items-start gap-2 text-sm text-ds-warn"><PlugZap className="mt-0.5 h-4 w-4 flex-none" /><span>{t('noext')}</span></p>
                            <button type="button" onClick={() => void deliver()} className={`${btn} mt-4 border border-pub-border text-white hover:border-pub-accent/60`}><RefreshCw className="h-4 w-4" />{t('retry')}</button>
                        </>
                    )}
                    {phase === 'error' && (
                        <>
                            <p className="text-sm text-ds-danger">{t('error')}</p>
                            <button type="button" onClick={() => void deliver()} className={`${btn} mt-4 border border-pub-border text-white hover:border-pub-accent/60`}><RefreshCw className="h-4 w-4" />{t('retry')}</button>
                        </>
                    )}
                </div>

                {hasSession && (
                    <div className="mt-8 border-t border-pub-border pt-4">
                        <p className="text-xs text-[#71717a]">{t('revokeHint')}</p>
                        <button type="button" onClick={() => void revokeAll()} className={`${btn} mt-3 border border-pub-border text-[#d4d4d8] hover:border-pub-accent/60 hover:text-white`}><LogOut className="h-4 w-4" />{t('revoke')}</button>
                        {revoked && <p className="mt-2 text-xs text-ds-ok" role="status">{t('revoked')}</p>}
                    </div>
                )}
            </main>
        </div>
    );
}
