import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react';
import api from '../../../services/api';

/** «Mostrar ahora»: pide que el overlay saque esta pieza en su próxima consulta (id negativo = tarjeta propia). Misma regla que `!dpromo mostrar`. */
export function ShowNowButton({ pieceId }: { pieceId: number }) {
    const { t } = useTranslation('promo');
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

    const run = async () => {
        setBusy(true); setNote(null);
        try { await api.post(`/promo-panel/show/${pieceId}`); setNote({ ok: true, text: t('panel.showNow.ok') }); }
        catch (e) {
            const notFound = (e as { response?: { status?: number } })?.response?.status === 404;
            setNote({ ok: false, text: t(notFound ? 'panel.showNow.notFound' : 'panel.showNow.fail') });
        }
        setBusy(false);
        window.setTimeout(() => setNote(null), 5000);
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            <button className="ds-btn ds-btn--secondary ds-btn--sm" disabled={busy} onClick={run}><Play className="w-4 h-4" />{t('panel.showNow.button')}</button>
            {note && <span className={`text-xs 3xl:text-sm ${note.ok ? 'text-ds-soft' : 'text-ds-danger'}`} role="status">{note.text}</span>}
        </div>
    );
}
