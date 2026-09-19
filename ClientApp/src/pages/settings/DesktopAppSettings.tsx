import { useCallback, useEffect, useState } from 'react';
import { Monitor, Loader2, Trash2, Download, Copy, Check, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDesktopDownload } from '../../hooks/useDesktopDownload';
import api from '../../services/api';

interface Device {
    id: number;
    name: string;
    appVersion?: string | null;
    platform?: string | null;
    createdAt: string;
    lastSeenAt?: string | null;
}


/**
 * Tarjeta "Decatron Desktop" en Ajustes → Integraciones: genera el código de
 * vinculación de un solo uso que pide la app de escritorio y lista las PCs ya
 * vinculadas (con revocación). La app y sus módulos (traducción en vivo, etc.)
 * comparten esta vinculación.
 */
export default function DesktopAppSettings() {
    const { t } = useTranslation(['settings']);
    const download = useDesktopDownload();
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [code, setCode] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<Date | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/desktop/devices');
            setDevices(res.data ?? []);
        } catch {
            setDevices([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Cuenta regresiva del código y refresco de la lista mientras está vigente
    // (así se ve la PC aparecer en cuanto la app canjea el código).
    useEffect(() => {
        if (!expiresAt) return;
        const id = setInterval(() => {
            const left = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000));
            setSecondsLeft(left);
            if (left % 5 === 0) load();
            if (left === 0) { setCode(null); setExpiresAt(null); }
        }, 1000);
        return () => clearInterval(id);
    }, [expiresAt, load]);

    const generate = async () => {
        setGenerating(true); setError(null); setCopied(false);
        try {
            const res = await api.post('/desktop/devices/link-code');
            setCode(res.data.code);
            setExpiresAt(new Date(res.data.expiresAt));
        } catch (e: any) {
            setError(e?.response?.data?.message || t('settings:desktop.errorCode'));
        } finally {
            setGenerating(false);
        }
    };

    const copy = async () => {
        if (!code) return;
        try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* sin clipboard */ }
    };

    const revoke = async (d: Device) => {
        if (!confirm(t('settings:desktop.confirmRevoke', { name: d.name }))) return;
        try {
            await api.delete(`/desktop/devices/${d.id}`);
            setDevices(prev => prev.filter(x => x.id !== d.id));
        } catch {
            setError(t('settings:desktop.errorRevoke'));
        }
    };

    const fmtSeen = (iso?: string | null) => {
        if (!iso) return t('settings:desktop.neverSeen');
        const diff = Date.now() - new Date(iso).getTime();
        if (diff < 60_000) return t('settings:desktop.justNow');
        if (diff < 3_600_000) return t('settings:desktop.minutesAgo', { n: Math.round(diff / 60_000) });
        if (diff < 86_400_000) return t('settings:desktop.hoursAgo', { n: Math.round(diff / 3_600_000) });
        return new Date(iso).toLocaleDateString();
    };

    return (
        <div className="p-4 bg-gray-50 dark:bg-[#222324] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#9146FF] text-white flex items-center justify-center">
                        <Monitor className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Decatron Desktop</div>
                        <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">{t('settings:desktop.description')}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <a href={download.url} target="_blank" rel="noreferrer" title={download.version ? `v${download.version}` : undefined}
                       className="px-3 py-2 text-sm rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc] hover:bg-gray-100 dark:hover:bg-[#2a2b2d] flex items-center gap-2">
                        <Download className="w-4 h-4" /> {download.label}
                    </a>
                    <button onClick={generate} disabled={generating}
                            className="px-3 py-2 text-sm rounded-lg bg-[#9146FF] hover:bg-[#a970ff] text-white font-semibold flex items-center gap-2 disabled:opacity-50">
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Monitor className="w-4 h-4" />}
                        {t('settings:desktop.linkButton')}
                    </button>
                </div>
            </div>

            {code && (
                <div className="mt-4 p-4 rounded-lg bg-white dark:bg-[#1B1C1D] border border-[#9146FF]/40">
                    <div className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-2">{t('settings:desktop.codeHint')}</div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono text-3xl font-black tracking-widest text-[#1e293b] dark:text-[#f8fafc] select-all">{code}</span>
                        <button onClick={copy} className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] hover:bg-gray-100 dark:hover:bg-[#2a2b2d]" title={t('settings:desktop.copy')}>
                            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <span className="text-xs text-[#94a3b8]">
                            {t('settings:desktop.expiresIn', { m: Math.floor(secondsLeft / 60), s: String(secondsLeft % 60).padStart(2, '0') })}
                        </span>
                    </div>
                </div>
            )}

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

            <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">{t('settings:desktop.linkedDevices')}</div>
                    <button onClick={load} className="p-1 text-[#94a3b8] hover:text-[#1e293b] dark:hover:text-white" title={t('settings:desktop.refresh')}>
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
                {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-[#94a3b8]" />
                ) : devices.length === 0 ? (
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{t('settings:desktop.noDevices')}</p>
                ) : (
                    <ul className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                        {devices.map(d => (
                            <li key={d.id} className="py-2 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-medium text-[#1e293b] dark:text-[#f8fafc] truncate">{d.name}</div>
                                    <div className="text-xs text-[#94a3b8]">
                                        {[d.platform, d.appVersion ? `v${d.appVersion}` : null].filter(Boolean).join(' · ')}
                                        {(d.platform || d.appVersion) ? ' · ' : ''}
                                        {t('settings:desktop.lastSeen')}: {fmtSeen(d.lastSeenAt)}
                                    </div>
                                </div>
                                <button onClick={() => revoke(d)} className="p-1 rounded hover:bg-red-600 text-red-500 hover:text-white transition-all" title={t('settings:desktop.revoke')}>
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
