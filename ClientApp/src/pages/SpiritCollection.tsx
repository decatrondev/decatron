import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bot } from 'lucide-react';
import api from '../services/api';
import SpiritCard, { type SpriteCollectionItem } from '../components/spirits/SpiritCard';
import '../components/spirits/spirits.css';
import { BrandMark } from '../brand/BrandMark';
import { useSpiritFilters } from '../components/spirits/useSpiritFilters';
import {
    PublicShell, PageTitle, ProgressPanel, SpiritFilterBar, SpiritGridBox, EmptyNotice,
    linkButton, primaryButton,
} from '../components/spirits/PublicSpiritsKit';

export default function SpiritCollection() {
    const { username } = useParams<{ username: string }>();
    const { t } = useTranslation('spirits');

    const [collection, setCollection] = useState<SpriteCollectionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!username) return;
        setLoading(true);
        api.get(`/fortnite/collection/${username}`)
            .then(r => {
                setCollection(r.data.collection ?? []);
                setLoading(false);
            })
            .catch(err => {
                if (err.response?.status === 404) setNotFound(true);
                setLoading(false);
            });
    }, [username]);

    const f = useSpiritFilters(collection);

    const brand = <BrandMark slot="spirits-header" fallback={<><Bot className="w-6 h-6" /><span>Decatron</span></>} />;
    const actions = (
        <>
            <Link to="/sprites" className={linkButton}>{t('collection.see_catalog')}</Link>
            <a href="/login" className={primaryButton}>{t('public.track')}</a>
        </>
    );

    if (notFound) return (
        <PublicShell brand={brand} actions={actions}>
            <PageTitle eyebrow={t('collection.not_found_title')} title={`@${username}`} />
            <EmptyNotice title={t('collection.not_found_desc', { username })} />
            <Link to="/sprites" className={`${primaryButton} inline-block mt-6`}>{t('collection.see_all')}</Link>
        </PublicShell>
    );

    return (
        <PublicShell brand={brand} actions={actions}>
            <PageTitle eyebrow={t('collection.collected_by')} title={`@${username}`} />

            {loading ? (
                <p className="font-mono text-sm 3xl:text-base text-[#71717a] animate-pulse">...</p>
            ) : (
                <>
                    <ProgressPanel items={collection} />
                    <SpiritFilterBar f={f} items={collection} />

                    {f.filtered.length === 0 ? (
                        <EmptyNotice title={t('no_spirits')} />
                    ) : (
                        <SpiritGridBox>
                            {f.filtered.map(item => <SpiritCard key={item.sprite.id} item={item} />)}
                        </SpiritGridBox>
                    )}

                    <section className="mt-12 rounded-lg border border-pub-border bg-pub-surface p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-5">
                        <div className="flex-1 text-center sm:text-left">
                            <p className="text-lg 3xl:text-xl font-black text-white">{t('public.cta_title')}</p>
                            <p className="text-sm 3xl:text-base text-[#a1a1aa] mt-1">{t('public.cta_body')}</p>
                        </div>
                        <a href="/login" className={`${primaryButton} whitespace-nowrap`}>{t('public.cta_button')}</a>
                    </section>
                </>
            )}
        </PublicShell>
    );
}
