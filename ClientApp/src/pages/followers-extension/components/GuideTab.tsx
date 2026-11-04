import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Alert } from '../../../components/ds';
import { Card } from '../../../components/overlay-editor/ui';
import type { AvailablePlatforms, FollowersTab } from '../types';

interface Props {
    available: AvailablePlatforms;
    onNavigate: (tab: FollowersTab) => void;
}

/** Guía: qué registra Decatron, cada cuánto se actualiza y lo que no puede saber. Todo sale del código, nada prometido de más. */
export default function GuideTab({ available, onNavigate }: Props) {
    const { t } = useTranslation('followers');

    const step = (n: number, title: string, body: React.ReactNode) => (
        <div className="flex gap-4">
            <span className="w-8 h-8 3xl:w-10 3xl:h-10 shrink-0 rounded-full bg-ds-accent text-ds-on-accent font-black flex items-center justify-center text-sm 3xl:text-base">{n}</span>
            <div className="flex-1 min-w-0 space-y-2">
                <h4 className="font-bold text-ds-text text-sm 3xl:text-base">{title}</h4>
                <div className="text-sm 3xl:text-base text-ds-soft space-y-2">{body}</div>
            </div>
        </div>
    );
    const linkBtn = (label: string, tab: FollowersTab) => (
        <button className="underline font-bold text-ds-accent-text" onClick={() => onNavigate(tab)}>{label}</button>
    );

    return (
        <div className="space-y-6">
            {!available.twitch && <Alert tone="info" title={t('sync.noTwitchTitle')}>{t('sync.noTwitchBody')}</Alert>}
            <Card title={t('guide.title')} description={t('guide.description')}>
                <div className="space-y-6">
                    {step(1, t('guide.step1Title'), <p>{t(available.kick ? 'guide.step1BodyBoth' : 'guide.step1Body')}</p>)}
                    {available.twitch && step(2, t('guide.step2Title'), (
                        <>
                            <p>{t('guide.step2Body')}</p>
                            <p>{linkBtn(t('guide.goSync'), 'sync')}</p>
                        </>
                    ))}
                    {step(3, t('guide.step3Title'), <p>{t('guide.step3Body')}</p>)}
                    {step(4, t('guide.step4Title'), (
                        <>
                            <p>{t('guide.step4Body')}</p>
                            <p>{linkBtn(t('guide.goList'), 'list')}</p>
                        </>
                    ))}
                </div>
            </Card>

            <Card title={t('guide.limitsTitle')}>
                <ul className="list-disc pl-5 space-y-1.5 text-sm 3xl:text-base text-ds-soft">
                    <li>{t('guide.limit1')}</li>
                    <li>{t('guide.limit2')}</li>
                    {available.kick && <li>{t('guide.limitKick1')}</li>}
                    {available.kick && <li>{t('guide.limitKick2')}</li>}
                </ul>
            </Card>

            <p className="text-sm 3xl:text-base text-ds-soft">
                <Link to="/dashboard/docs/features/followers" className="underline font-bold text-ds-accent-text">{t('guide.docsLink')}</Link>
            </p>
        </div>
    );
}
