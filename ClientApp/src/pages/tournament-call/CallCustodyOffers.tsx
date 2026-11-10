import { ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CallCustodyOffer } from './content';

/**
 * Ofertas de paVos, tarjetas o regalos que gestiona y entrega el propio colaborador. Se muestran aparte y con su aviso:
 * son un dato declarado, nunca se suman a los premios disponibles ni se mezclan con el dinero.
 */
export default function CallCustodyOffers({ offers }: { offers: CallCustodyOffer[] }) {
    const { t, i18n } = useTranslation('tournament-call');
    if (!offers.length) return null;
    const format = (value: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(value);
    return <section className="call-wrap call-section" id="custody" aria-labelledby="custody-title">
        <p className="call-kicker">{t('community')}</p><h2 id="custody-title">{t('custody.publicTitle')}</h2>
        <p className="call-body">{t('custody.notice')}</p>
        <ul className="call-custody-offers">{offers.map((offer, index) => <li key={`${offer.channelUrl}:${index}`}>
            {offer.avatarUrl && <img src={offer.avatarUrl} alt="" loading="lazy" />}
            <div><strong>{offer.contributionType === 'vbucks' ? t('custody.vbucksAmount', { amount: format(offer.amount) }) : t('custody.cardAmount', { amount: format(offer.amount), currency: offer.currency })}</strong>
                <p>{t('custody.managedBy')} <a href={offer.channelUrl} target="_blank" rel="noopener noreferrer">{offer.displayName}<ArrowUpRight size={14} aria-hidden /></a></p></div>
        </li>)}</ul>
        <p className="call-small">{t('custody.declaredNotAdded')}</p>
    </section>;
}
