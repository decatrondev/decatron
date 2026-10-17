import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { Copy, Download } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, Input, Spinner } from '../../../components/ds';
import buyerApi from '../../../services/buyerApi';

// Pieza F: verificación en dos pasos (TOTP), opcional. Protege guardar, cambiar o quitar credenciales (el servidor exige el código reciente).
// Los secretos y los códigos de recuperación solo se muestran al activarlos o regenerarlos: no se guardan en pantalla después.
interface Status { enabled: boolean; recoveryLeft: number; lockedSeconds: number }
type Mode = 'idle' | 'setup' | 'codes' | 'disable' | 'regen';

const BASE = '/platform/buyer/mfa';

export default function BuyerSecurity() {
    const { t } = useTranslation('platform');
    const [status, setStatus] = useState<Status | null>(null);
    const [failed, setFailed] = useState(false);
    const [mode, setMode] = useState<Mode>('idle');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [secret, setSecret] = useState('');
    const [qr, setQr] = useState('');
    const [code, setCode] = useState('');
    const [codes, setCodes] = useState<string[]>([]);
    const [note, setNote] = useState('');

    const load = useCallback(async () => {
        try { const r = await buyerApi.get(BASE); setStatus(r.data); setFailed(false); } catch { setFailed(true); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const errText = (e: any) => t(`buyer.mfa.errors.${e?.response?.data?.code}`, { defaultValue: t('buyer.mfa.errors.generic') });
    const reset = () => { setMode('idle'); setCode(''); setError(''); setSecret(''); setQr(''); };

    const start = async () => {
        setBusy(true); setError(''); setNote('');
        try {
            const r = await buyerApi.post(`${BASE}/setup`);
            setSecret(r.data.secret);
            setQr(await QRCode.toDataURL(r.data.uri, { margin: 1, width: 220 }));
            setMode('setup');
        } catch (e) { setError(errText(e)); }
        setBusy(false);
    };

    const confirm = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true); setError('');
        try {
            const r = await buyerApi.post(`${BASE}/confirm`, { code });
            setCodes(r.data.recoveryCodes); setSecret(''); setQr(''); setCode(''); setMode('codes');
            await load();
        } catch (err) { setError(errText(err)); }
        setBusy(false);
    };

    const withCode = (path: string, after: (data: any) => void) => async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true); setError('');
        try { const r = await buyerApi.post(`${BASE}/${path}`, { code }); after(r.data); setCode(''); await load(); }
        catch (err) { setError(errText(err)); }
        setBusy(false);
    };
    const disable = withCode('disable', () => { setMode('idle'); setNote(t('buyer.mfa.disabledOk')); });
    const regen = withCode('recovery-codes', d => { setCodes(d.recoveryCodes); setMode('codes'); });

    const copyCodes = () => navigator.clipboard?.writeText(codes.join('\n')).then(() => setNote(t('buyer.setup.copied'))).catch(() => { /* sin portapapeles */ });
    const downloadCodes = () => {
        const url = URL.createObjectURL(new Blob([codes.join('\n') + '\n'], { type: 'text/plain' }));
        const a = document.createElement('a'); a.href = url; a.download = 'decatron-recovery-codes.txt'; a.click(); URL.revokeObjectURL(url);
    };

    if (failed) return null; // el resto del panel muestra el error de carga
    if (!status) return <div className="text-center"><Spinner /></div>;

    const codeField = (
        <Field label={t('buyer.mfa.codeLabel')} hint={mode === 'setup' ? t('buyer.mfa.setupCodeHint') : t('buyer.mfa.codeHint')}>
            <Input value={code} autoComplete="one-time-code" inputMode="text" spellCheck={false} onChange={e => setCode(e.target.value)} />
        </Field>
    );

    return (
        <Card><div className="p-5 space-y-4">
            <div>
                <h2 className="text-lg font-bold text-ds-text">{t('buyer.mfa.title')}</h2>
                <p className="text-sm text-ds-soft mt-1 leading-relaxed">{t('buyer.mfa.help')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Badge tone={status.enabled ? 'ok' : 'warn'}>{status.enabled ? t('buyer.mfa.on') : t('buyer.mfa.off')}</Badge>
                {status.enabled && <span className="text-sm text-ds-soft">{t('buyer.mfa.recoveryLeft', { count: status.recoveryLeft })}</span>}
            </div>
            {note && <Alert tone="ok">{note}</Alert>}
            {status.lockedSeconds > 0 && <Alert tone="warn">{t('buyer.mfa.errors.locked')}</Alert>}

            {mode === 'idle' && !status.enabled && <>
                <Alert tone="info">{t('buyer.mfa.recommend')}</Alert>
                {error && <Alert tone="danger">{error}</Alert>}
                <Button loading={busy} onClick={start}>{t('buyer.mfa.enable')}</Button>
            </>}

            {mode === 'idle' && status.enabled && (
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => { setMode('regen'); setNote(''); }}>{t('buyer.mfa.regen')}</Button>
                    <Button variant="ghost" onClick={() => { setMode('disable'); setNote(''); }}>{t('buyer.mfa.disable')}</Button>
                </div>
            )}

            {mode === 'setup' && (
                <form onSubmit={confirm} className="space-y-4">
                    <p className="text-sm text-ds-soft leading-relaxed">{t('buyer.mfa.scan')}</p>
                    <div className="flex flex-wrap items-center gap-5">
                        {qr && <img src={qr} alt={t('buyer.mfa.qrAlt')} width={220} height={220} className="rounded-md bg-white p-1" />}
                        <div className="min-w-0 space-y-1">
                            <p className="text-xs text-ds-faint">{t('buyer.mfa.manual')}</p>
                            <code className="block break-all text-sm text-ds-text">{secret}</code>
                        </div>
                    </div>
                    {codeField}
                    {error && <Alert tone="danger">{error}</Alert>}
                    <div className="flex gap-2">
                        <Button type="submit" loading={busy} disabled={code.replace(/\D/g, '').length < 6}>{t('buyer.mfa.activate')}</Button>
                        <Button type="button" variant="ghost" onClick={reset}>{t('tenants.close')}</Button>
                    </div>
                </form>
            )}

            {mode === 'codes' && (
                <div className="space-y-3">
                    <Alert tone="warn">{t('buyer.mfa.codesWarning')}</Alert>
                    <ul className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-ds-text">{codes.map(c => <li key={c}>{c}</li>)}</ul>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={copyCodes}><Copy className="w-4 h-4 mr-1.5" aria-hidden />{t('tenants.copy')}</Button>
                        <Button variant="secondary" onClick={downloadCodes}><Download className="w-4 h-4 mr-1.5" aria-hidden />{t('buyer.mfa.download')}</Button>
                        <Button onClick={() => { setCodes([]); reset(); }}>{t('buyer.mfa.saved')}</Button>
                    </div>
                </div>
            )}

            {(mode === 'disable' || mode === 'regen') && (
                <form onSubmit={mode === 'disable' ? disable : regen} className="space-y-4">
                    <p className="text-sm text-ds-soft leading-relaxed">{mode === 'disable' ? t('buyer.mfa.disableText') : t('buyer.mfa.regenText')}</p>
                    {codeField}
                    {error && <Alert tone="danger">{error}</Alert>}
                    <div className="flex gap-2">
                        <Button type="submit" variant={mode === 'disable' ? 'danger' : 'primary'} loading={busy} disabled={!code.trim()}>
                            {mode === 'disable' ? t('buyer.mfa.disableConfirm') : t('buyer.mfa.regenConfirm')}
                        </Button>
                        <Button type="button" variant="ghost" onClick={reset}>{t('tenants.close')}</Button>
                    </div>
                </form>
            )}
        </div></Card>
    );
}
