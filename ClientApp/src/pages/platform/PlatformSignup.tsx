import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MailCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, Button, Field, Input } from '../../components/ds';
import PlatformShell from './PlatformShell';
import { useTurnstile } from './useTurnstile';

type Status = 'idle' | 'sending' | 'done' | 'error';
type SlugState = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid' | 'reserved';

// Mismas reglas que PlatformSlug (backend): 3-30, a-z 0-9 y guion; sin guion al inicio/fin ni dobles.
const SLUG_RX = /^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$/;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-').slice(0, 30);

/** Registro del comprador en decatron.top: el tenant se crea cuando confirma el correo. */
export default function PlatformSignup() {
    const { t, i18n } = useTranslation('platform');
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [slugState, setSlugState] = useState<SlugState>('idle');
    const [trap, setTrap] = useState('');
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState('');
    const captcha = useTurnstile();
    // ¿Registro abierto o solo para personas aprobadas? Se avisa antes de que escriban; si no se sabe, no se muestra nada.
    const [approval, setApproval] = useState(false);
    useEffect(() => { fetch('/api/platform/signup/mode').then(r => r.ok ? r.json() : null).then(d => setApproval(d?.mode === 'approval')).catch(() => { /* sin aviso */ }); }, []);

    // Disponibilidad del subdominio en vivo (con pausa para no preguntar en cada tecla).
    useEffect(() => {
        if (!slug) { setSlugState('idle'); return; }
        if (slug.length < 3 || !SLUG_RX.test(slug)) { setSlugState('invalid'); return; }
        setSlugState('checking');
        const id = setTimeout(() => {
            fetch(`/api/platform/signup/slug?slug=${encodeURIComponent(slug)}`).then(r => r.ok ? r.json() : null).then(d => {
                if (!d) { setSlugState('idle'); return; }
                setSlugState(d.available ? 'ok' : d.reason === 'reserved' ? 'reserved' : d.reason === 'taken' ? 'taken' : 'invalid');
            }).catch(() => setSlugState('idle'));
        }, 400);
        return () => clearTimeout(id);
    }, [slug]);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (status === 'sending') return;
        const cleanEmail = email.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(cleanEmail)) { setError(t('signup.errorEmail')); setStatus('error'); return; }
        if (name.trim().length < 2) { setError(t('signup.errorName')); setStatus('error'); return; }
        if (slugState !== 'ok') { setError(t('signup.errorSlug')); setStatus('error'); return; }
        if (captcha.enabled && !captcha.token) { setError(t('form.errorCaptcha')); setStatus('error'); return; }
        setStatus('sending'); setError('');
        try {
            const res = await fetch('/api/platform/signup', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: cleanEmail, projectName: name.trim(), slug, locale: i18n.language?.startsWith('en') ? 'en' : 'es', website: trap, turnstileToken: captcha.token }),
            });
            if (res.ok) { setStatus('done'); return; }
            const body = await res.json().catch(() => null);
            setError(
                res.status === 429 ? t('form.errorLimit')
                : res.status === 503 && body?.code === 'busy' ? t('form.errorBusy')
                : body?.code === 'captcha' ? t('form.errorCaptcha')
                : body?.code === 'slug_taken' ? t('signup.slugTaken')
                : body?.code?.startsWith('slug_') ? t('signup.errorSlug')
                : body?.code === 'invalid_email' ? t('signup.errorEmail')
                : body?.code === 'invalid_name' ? t('signup.errorName')
                : t('form.errorGeneric'));
        } catch {
            setError(t('form.errorGeneric'));
        }
        captcha.reset();
        setStatus('error');
    };

    const hint: Record<SlugState, string> = {
        idle: t('signup.slugHint'), checking: t('signup.slugChecking'), ok: t('signup.slugOk'),
        taken: t('signup.slugTaken'), invalid: t('signup.slugInvalid'), reserved: t('signup.slugReserved'),
    };

    return (
        <PlatformShell showNav={false}>
            <div className="max-w-lg mx-auto px-5 py-16">
                {status === 'done' ? (
                    <div className="text-center py-6" role="status">
                        <MailCheck className="w-10 h-10 mx-auto text-ds-accent-text mb-4" aria-hidden />
                        <h1 className="text-2xl font-extrabold text-ds-text mb-2">{t('signup.doneTitle')}</h1>
                        <p className="text-ds-soft leading-relaxed">{approval ? t('signup.doneTextApproval') : t('signup.doneText')}</p>
                        {approval && <p className="mt-4"><Link to="/#lista" className="text-ds-accent-text hover:underline">{t('signup.waitlistLink')}</Link></p>}
                    </div>
                ) : (
                    <form onSubmit={submit} noValidate className="space-y-5">
                        <div>
                            <h1 className="text-3xl font-extrabold text-ds-text">{t('signup.title')}</h1>
                            <p className="text-ds-soft mt-2 leading-relaxed">{t('signup.text')}</p>
                        </div>
                        {approval && <Alert tone="info">{t('signup.approvalNotice')} <Link to="/#lista" className="underline">{t('signup.waitlistLink')}</Link></Alert>}
                        <Field label={t('signup.name')}>
                            <Input value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder={t('signup.namePlaceholder')} />
                        </Field>
                        <Field label={t('signup.slug')} hint={hint[slugState]}>
                            <div className="flex items-center gap-2">
                                <Input value={slug} maxLength={30} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                                    onChange={e => setSlug(slugify(e.target.value))} placeholder="mi-proyecto"
                                    error={slugState === 'taken' || slugState === 'invalid' || slugState === 'reserved'} />
                                <span className="text-ds-soft text-sm whitespace-nowrap">.decatron.top</span>
                            </div>
                        </Field>
                        <Field label={t('form.email')}>
                            <Input type="email" inputMode="email" autoComplete="email" required value={email}
                                onChange={e => setEmail(e.target.value)} placeholder={t('form.emailPlaceholder')} />
                        </Field>

                        <div aria-hidden style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                            <label>Website<input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={e => setTrap(e.target.value)} /></label>
                        </div>

                        {captcha.enabled && <div ref={captcha.boxRef} className="flex justify-center" />}
                        {status === 'error' && error && <Alert tone="danger">{error}</Alert>}
                        <Button type="submit" size="lg" block loading={status === 'sending'}>
                            {status === 'sending' ? t('form.sending') : t('signup.submit')}
                        </Button>
                        <p className="text-sm text-ds-faint leading-relaxed">{t('signup.consent')}</p>
                    </form>
                )}
            </div>
        </PlatformShell>
    );
}
