import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Field, Input } from '../../../components/ds';
import ModalShell from '../../../components/dashboard/ModalShell';
import buyerApi, { setStepUpHandler } from '../../../services/buyerApi';

// Pide el código del 2FA cuando una acción con credenciales lo exige (buyerApi lo llama y reintenta la petición).
// Un solo modal para todo el panel: se monta una vez en la pantalla principal.
export default function BuyerStepUp() {
    const { t } = useTranslation('platform');
    const [open, setOpen] = useState(false);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const waiter = useRef<{ ok: (token: string) => void; cancel: () => void } | null>(null);

    useEffect(() => {
        setStepUpHandler(() => new Promise<string>((ok, cancel) => {
            waiter.current = { ok, cancel: () => cancel(new Error('cancelled')) };
            setCode(''); setError(''); setOpen(true);
        }));
        return () => setStepUpHandler(null);
    }, []);

    const close = useCallback(() => { setOpen(false); waiter.current?.cancel(); waiter.current = null; }, []);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (busy || !code.trim()) return;
        setBusy(true); setError('');
        try {
            const r = await buyerApi.post('/platform/buyer/mfa/verify', { code });
            setOpen(false);
            waiter.current?.ok(r.data.stepUp); waiter.current = null;
        } catch (err: any) {
            const c = err?.response?.data?.code;
            setError(c === 'locked' ? t('buyer.mfa.errors.locked') : t('buyer.mfa.errors.invalid_code'));
        }
        setBusy(false);
    };

    if (!open) return null;
    return (
        <ModalShell title={t('buyer.mfa.stepUpTitle')} onClose={close}>
            <form onSubmit={submit} className="space-y-4">
                <p className="text-sm text-ds-soft leading-relaxed">{t('buyer.mfa.stepUpText')}</p>
                <Field label={t('buyer.mfa.codeLabel')} hint={t('buyer.mfa.codeHint')}>
                    <Input value={code} autoFocus autoComplete="one-time-code" inputMode="text" spellCheck={false} onChange={e => setCode(e.target.value)} />
                </Field>
                {error && <Alert tone="danger">{error}</Alert>}
                <div className="flex gap-2">
                    <Button type="submit" loading={busy} disabled={!code.trim()}>{t('buyer.mfa.verify')}</Button>
                    <Button type="button" variant="ghost" onClick={close}>{t('tenants.close')}</Button>
                </div>
            </form>
        </ModalShell>
    );
}
