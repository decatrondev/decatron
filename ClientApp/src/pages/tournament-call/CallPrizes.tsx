import { useTranslation } from 'react-i18next';
import type { PublicContribution } from './contributions';

export default function CallPrizes({ contributions }: { contributions: PublicContribution[] }) {
    const { t, i18n } = useTranslation('tournament-call');
    const monetary = contributions.filter(c => c.kind === 'money');
    const totals = monetary.reduce<Record<string, number>>((sum, item) => ({ ...sum, [item.currency]: (sum[item.currency] ?? 0) + item.amount }), {});
    const format = (amount: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(amount);
    return <div className="call-confirmed-prizes">
        {Object.keys(totals).length > 0 && <div className="call-prize-values">{Object.entries(totals).map(([currency, amount]) => <div key={currency}><span className="call-big">{format(amount)}</span><strong>{currency}</strong><p>{t('funding.availableCash')}</p></div>)}</div>}
        {!contributions.length && <p className="call-body">{t('funding.noConfirmed')}</p>}
        {contributions.length > 0 && <ul className="call-prize-ledger">{contributions.map((item, index) => <li key={index}>
            <p className="call-kicker">{t(`funding.kinds.${item.kind}`)}</p><h3>{i18n.language.startsWith('en') ? item.descriptionEn : item.descriptionEs}</h3>
            <strong>{format(item.amount)} {item.kind === 'item' ? t('funding.units') : item.currency}</strong>
            <p>{t('funding.contributedBy')} {item.displayName ? item.channelUrl ? <a href={item.channelUrl} target="_blank" rel="noopener noreferrer">{item.displayName}</a> : item.displayName : t('funding.anonymous')}</p>
            <p>{t('funding.custodian')}: {item.custodian}</p><p>{t('funding.deliveredBy')}: {item.deliveredBy}</p>
        </li>)}</ul>}
        <p className="call-small mt-6">{t('funding.declaredBase')}</p>
        <p className="call-small">{t('distributionPending')}</p>
    </div>;
}
