import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { Alert, Badge, Button, Card, Empty, Spinner } from '../../../components/ds';
import { errorCodes, promoAdminApi } from './api';
import { errorText } from './shared';
import type { PromoOwnCardAdmin } from './types';

/** Tarjetas propias de todos los canales. El dueño oculta las que no cumplen las reglas; el streamer la sigue viendo pero no sale en su overlay. */
export function OwnCardsTab({ notify }: { notify: (ok: boolean, text: string) => void }) {
    const { t } = useTranslation('promo');
    const [cards, setCards] = useState<PromoOwnCardAdmin[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState<number | null>(null);

    const load = useCallback(async () => {
        try { setCards(await promoAdminApi.ownCards()); setFailed(false); }
        catch { setFailed(true); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const toggle = async (c: PromoOwnCardAdmin) => {
        setBusy(c.id);
        try {
            await promoAdminApi.setOwnCardHidden(c.id, !c.hiddenByAdmin);
            await load();
            notify(true, t(c.hiddenByAdmin ? 'admin.ownCards.toast.shown' : 'admin.ownCards.toast.hidden'));
        } catch (e) { notify(false, errorText(t, errorCodes(e))); }
        finally { setBusy(null); }
    };

    if (failed) return <Alert tone="danger">{t('admin.loadFailed')}</Alert>;
    if (!cards) return <div className="flex justify-center py-10"><Spinner /></div>;

    return (
        <div className="space-y-4">
            <p className="text-sm text-ds-soft max-w-2xl">{t('admin.ownCards.hint')}</p>
            {cards.length === 0 ? <Empty icon={<EyeOff />} title={t('admin.ownCards.empty')} /> : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {cards.map(c => (
                        <Card key={c.id}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-ds-text truncate">{c.title || t('admin.ownCards.noTitle')}</span>
                                        {c.hiddenByAdmin && <Badge tone="danger">{t('admin.ownCards.hiddenBadge')}</Badge>}
                                        {!c.isEnabled && <Badge>{t('admin.ownCards.off')}</Badge>}
                                    </div>
                                    {c.body && <p className="text-sm text-ds-soft break-words">{c.body}</p>}
                                    {c.linkUrl && <p className="text-xs text-ds-soft break-all">{c.linkUrl}</p>}
                                    <p className="text-xs text-ds-soft">{t('admin.ownCards.channel', { login: c.login || `#${c.userId}` })}</p>
                                </div>
                                <Button size="sm" variant="secondary" loading={busy === c.id} icon={c.hiddenByAdmin ? <Eye /> : <EyeOff />} onClick={() => toggle(c)}>
                                    {t(c.hiddenByAdmin ? 'admin.ownCards.show' : 'admin.ownCards.hide')}
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
