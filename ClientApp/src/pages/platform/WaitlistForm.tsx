import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MailCheck } from 'lucide-react';
import { Alert, Button, Field, Input, Select } from '../../components/ds';

type Status = 'idle' | 'sending' | 'done' | 'error';

// Cloudflare Turnstile: el desafío anti-bot. Solo aparece si el servidor tiene las claves (/api/platform/config).
declare global {
    interface Window {
        turnstile?: {
            render: (el: HTMLElement, opts: Record<string, unknown>) => string;
            reset: (id?: string) => void;
            remove: (id?: string) => void;
        };
    }
}
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadTurnstile(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (window.turnstile) { resolve(); return; }
        let el = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
        if (!el) {
            el = document.createElement('script');
            el.src = TURNSTILE_SRC; el.async = true; el.defer = true; el.dataset.turnstile = '1';
            document.head.appendChild(el);
        }
        el.addEventListener('load', () => resolve());
        el.addEventListener('error', () => reject(new Error('turnstile')));
    });
}

const USE_CASES = ['own_channel', 'several_channels', 'community', 'other'] as const;
const PLATFORMS = ['', 'twitch', 'kick', 'other'] as const;

/** Formulario de la lista de espera. Llama a /api/platform/waitlist; el correo de confirmación sale del backend. */
export default function WaitlistForm() {
    const { t, i18n } = useTranslation('platform');
    const [email, setEmail] = useState('');
    const [useCase, setUseCase] = useState<(typeof USE_CASES)[number]>('own_channel');
    const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>('');
    const [trap, setTrap] = useState(''); // trampa para bots: un humano nunca la ve
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState('');
    const [siteKey, setSiteKey] = useState('');
    const [captcha, setCaptcha] = useState('');
    const boxRef = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string | undefined>(undefined);

    // ¿El servidor pide desafío? Si no hay claves configuradas, el formulario funciona sin él.
    useEffect(() => {
        let cancelled = false;
        fetch('/api/platform/config').then(r => r.ok ? r.json() : null)
            .then(c => { if (!cancelled && c?.turnstileSiteKey) setSiteKey(c.turnstileSiteKey); })
            .catch(() => { /* sin configuración: se muestra el formulario sin desafío */ });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!siteKey || !boxRef.current) return;
        let cancelled = false;
        loadTurnstile().then(() => {
            if (cancelled || !boxRef.current || !window.turnstile) return;
            widgetId.current = window.turnstile.render(boxRef.current, {
                sitekey: siteKey, theme: 'dark', language: i18n.language?.startsWith('en') ? 'en' : 'es',
                callback: (tk: string) => setCaptcha(tk),
                'expired-callback': () => setCaptcha(''),
                'error-callback': () => setCaptcha(''),
            });
        }).catch(() => setError(t('form.errorGeneric')));
        return () => { cancelled = true; if (widgetId.current) window.turnstile?.remove(widgetId.current); widgetId.current = undefined; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [siteKey]);

    // El desafío es de un solo uso: tras cualquier intento fallido se pide uno nuevo.
    const resetCaptcha = () => { setCaptcha(''); if (widgetId.current) window.turnstile?.reset(widgetId.current); };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (status === 'sending') return;
        const clean = email.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(clean)) { setError(t('form.errorInvalid')); setStatus('error'); return; }
        if (siteKey && !captcha) { setError(t('form.errorCaptcha')); setStatus('error'); return; }
        setStatus('sending'); setError('');
        try {
            const res = await fetch('/api/platform/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: clean, useCase, platform, locale: i18n.language?.startsWith('en') ? 'en' : 'es', website: trap, turnstileToken: captcha }),
            });
            if (res.ok) { setStatus('done'); return; }
            const body = await res.json().catch(() => null);
            setError(
                res.status === 429 ? t('form.errorLimit')
                : res.status === 503 && body?.code === 'busy' ? t('form.errorBusy')
                : res.status === 400 && body?.code === 'captcha' ? t('form.errorCaptcha')
                : res.status === 400 ? t('form.errorInvalid')
                : t('form.errorGeneric'));
        } catch {
            setError(t('form.errorGeneric'));
        }
        resetCaptcha();
        setStatus('error');
    };

    if (status === 'done') {
        return (
            <div className="text-center py-6" role="status">
                <MailCheck className="w-10 h-10 mx-auto text-ds-accent-text mb-4" aria-hidden />
                <h3 className="text-xl font-bold text-ds-text mb-2">{t('form.doneTitle')}</h3>
                <p className="text-ds-soft leading-relaxed">{t('form.doneText')}</p>
            </div>
        );
    }

    return (
        <form onSubmit={submit} noValidate className="space-y-5">
            <Field label={t('form.email')}>
                <Input
                    type="email" inputMode="email" autoComplete="email" required
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder={t('form.emailPlaceholder')} error={status === 'error' && !!error}
                />
            </Field>
            <div className="grid sm:grid-cols-2 gap-5">
                <Field label={t('form.useCase')}>
                    <Select value={useCase} onChange={e => setUseCase(e.target.value as typeof useCase)}>
                        {USE_CASES.map(u => <option key={u} value={u}>{t(`form.useCaseOptions.${u}`)}</option>)}
                    </Select>
                </Field>
                <Field label={`${t('form.platform')} (${t('form.optional')})`}>
                    <Select value={platform} onChange={e => setPlatform(e.target.value as typeof platform)}>
                        {PLATFORMS.map(p => <option key={p || 'none'} value={p}>{t(`form.platformOptions.${p}`)}</option>)}
                    </Select>
                </Field>
            </div>

            {/* Trampa: fuera de pantalla, sin foco y sin autocompletar */}
            <div aria-hidden style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                <label>Website<input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={e => setTrap(e.target.value)} /></label>
            </div>

            {siteKey && <div ref={boxRef} className="flex justify-center" />}

            {status === 'error' && error && <Alert tone="danger">{error}</Alert>}

            <Button type="submit" size="lg" block loading={status === 'sending'}>
                {status === 'sending' ? t('form.sending') : t('form.submit')}
            </Button>
            <p className="text-sm text-ds-faint leading-relaxed">{t('form.consent')}</p>
        </form>
    );
}
