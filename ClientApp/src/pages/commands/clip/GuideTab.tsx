import { BookOpen, ListChecks, Music, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../../components/ds';
import { ConfigCard, hintCls } from '../../../components/dashboard/config';
import type { ClipCfg } from './useClipConfig';

// Pestaña Guía: cómo dejar !clip funcionando. Todo el texto vive en locales/{es,en}/clipcommand.json → guide.

/** Texto con `código` entre comillas invertidas dibujado como <code>. */
function Inline({ text }: { text: string }) {
    const parts = text.split(/`([^`]+)`/g);
    return <>{parts.map((p, i) => i % 2 === 1
        ? <code key={i} className="px-1.5 py-0.5 rounded bg-ds-raised text-ds-accent-text text-[0.9em] font-mono">{p}</code>
        : <span key={i}>{p}</span>)}</>;
}

export default function GuideTab(_props: { cfg: ClipCfg }) {
    const { t } = useTranslation('clipcommand');
    const examples: [string, string][] = [
        ['!clip', t('guide.ex1')],
        ['!clip 20', t('guide.ex2')],
        ['!clip 20 …', t('guide.ex3')],
        ['!clip …', t('guide.ex4')],
    ];
    const tabs: [string, string][] = [
        [t('tabs.general'), t('guide.tabGeneral')],
        [t('tabs.permissions'), t('guide.tabPermissions')],
        [t('tabs.cooldowns'), t('guide.tabCooldowns')],
        [t('tabs.messages'), t('guide.tabMessages')],
        [t('tabs.history'), t('guide.tabHistory')],
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
                <ConfigCard icon={<BookOpen />} title={t('guide.title')}>
                    <p className="text-sm text-ds-soft"><Inline text={t('guide.intro')} /></p>
                </ConfigCard>

                <ConfigCard icon={<ListChecks />} title={t('guide.stepsTitle')}>
                    <ol className="list-decimal pl-5 space-y-2 text-sm text-ds-text">
                        {[1, 2, 3, 4].map(n => <li key={n}>{t(`guide.step${n}`)}</li>)}
                    </ol>
                </ConfigCard>

                <ConfigCard icon={<Terminal />} title={t('guide.usageTitle')}>
                    <ul className="space-y-2">
                        {examples.map(([cmd, text]) => (
                            <li key={cmd} className="flex flex-wrap items-center gap-3 text-sm">
                                <code className="px-2 py-0.5 bg-ds-bg border border-ds-border rounded text-ds-accent-text font-mono">{cmd}</code>
                                <span className="text-ds-soft">{text}</span>
                            </li>
                        ))}
                    </ul>
                </ConfigCard>
            </div>

            <div className="space-y-6">
                <ConfigCard icon={<Music />} title={t('guide.limitsTitle')}>
                    <div className="space-y-3">
                        <Alert tone="info">{t('guide.limitLive')}</Alert>
                        <Alert tone="warn">{t('guide.limitMusic')}</Alert>
                        <Alert tone="info">{t('guide.limitScope')}</Alert>
                    </div>
                </ConfigCard>

                <ConfigCard icon={<BookOpen />} title={t('guide.tabsTitle')}>
                    <ul className="space-y-2 text-sm">
                        {tabs.map(([name, text]) => (
                            <li key={name}><span className="font-semibold text-ds-text">{name}:</span> <span className="text-ds-soft">{text}</span></li>
                        ))}
                    </ul>
                    <p className={`${hintCls} mt-4`}>
                        <Link to="/dashboard/docs/commands/clip" className="font-bold text-ds-accent-text hover:underline">{t('guide.docs')} →</Link>
                    </p>
                </ConfigCard>
            </div>
        </div>
    );
}
