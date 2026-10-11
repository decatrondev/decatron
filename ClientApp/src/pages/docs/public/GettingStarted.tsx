import { ArrowRight, CheckCircle, Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DocAlert from '../../../components/docs/DocAlert';
import { asArray } from '../../../components/docs/DocBlocks';

// El texto vive en public/locales/{es,en}/docs-public.json → start.
interface Item { t: string; d: string }

export default function GettingStarted() {
    const { t } = useTranslation('docs-public');
    const req = asArray<string>(t('start.req', { returnObjects: true }));
    const items = asArray<Item>(t('start.s2.items', { returnObjects: true }));
    const obsSteps = asArray<string>(t('start.s4.steps', { returnObjects: true }));

    return (
        <div className="space-y-8">
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <h1 className="text-4xl font-black text-ds-text mb-4">{t('start.title')}</h1>
                <p className="text-xl text-ds-soft">{t('start.subtitle')}</p>
            </div>

            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <h2 className="text-2xl font-black text-ds-text mb-4">{t('start.reqTitle')}</h2>
                <ul className="space-y-3">
                    {req.map((text, i) => (
                        <li key={text} className="flex items-center gap-3">
                            <CheckCircle className={`w-5 h-5 flex-shrink-0 ${i === 2 ? 'text-ds-soft' : 'text-ds-ok'}`} />
                            <span className="text-ds-soft">
                                {text}
                                {i === 2 && <span className="ml-2 text-xs bg-ds-bg px-2 py-0.5 rounded">{t('start.optional')}</span>}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-black text-ds-text">{t('start.stepsTitle')}</h2>

                <Step number={1} title={t('start.s1.t')} description={t('start.s1.d')}>
                    <div className="mt-4 space-y-4">
                        <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors">
                            {t('start.s1.btn')}
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <DocAlert type="info">{t('start.s1.note')}</DocAlert>
                    </div>
                </Step>

                <Step number={2} title={t('start.s2.t')} description={t('start.s2.d')}>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {items.map(it => (
                            <div key={it.t} className="bg-ds-bg rounded-lg p-4 border border-ds-border">
                                <h4 className="font-bold text-ds-text mb-1">{it.t}</h4>
                                <p className="text-sm text-ds-soft">{it.d}</p>
                            </div>
                        ))}
                    </div>
                </Step>

                <Step number={3} title={t('start.s3.t')} description={t('start.s3.d')}>
                    <div className="mt-4 space-y-4">
                        <CommandExample command="!title" response={t('start.s3.ok')} label={t('start.s3.command')} responseLabel={t('start.s3.response')} copyTitle={t('start.s3.copy')} />
                        <DocAlert type="success" title={t('start.s3.alertTitle')}>{t('start.s3.alert')}</DocAlert>
                    </div>
                </Step>

                <Step number={4} title={t('start.s4.t')} description={t('start.s4.d')}>
                    <div className="mt-4 space-y-4">
                        <p className="text-ds-soft">{t('start.s4.intro')}</p>
                        <ol className="space-y-3 ml-4">
                            {obsSteps.map((s, i) => (
                                <li key={s} className="flex items-start gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 bg-ds-accent text-white rounded-full flex items-center justify-center text-sm font-bold">{i + 1}</span>
                                    <span className="text-ds-soft">{s}</span>
                                </li>
                            ))}
                        </ol>
                        <DocAlert type="tip" title={t('start.s4.tipTitle')}>{t('start.s4.tip')}</DocAlert>
                    </div>
                </Step>
            </div>

            <div className="bg-ds-surface border border-ds-border rounded-lg p-8 text-ds-text">
                <h2 className="text-2xl font-black mb-4">{t('start.nextTitle')}</h2>
                <p className="text-ds-soft mb-6">{t('start.next')}</p>
                <div className="flex flex-wrap gap-4">
                    <Link to="/docs/features" className="ds-btn ds-btn--primary ds-btn--lg">
                        {t('start.nextFeatures')}
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                    <Link to="/docs/commands/default" className="ds-btn ds-btn--secondary ds-btn--lg">{t('start.nextCommands')}</Link>
                </div>
            </div>
        </div>
    );
}

function Step({ number, title, description, children }: { number: number; title: string; description: string; children?: React.ReactNode }) {
    return (
        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-ds-accent text-white rounded-full flex items-center justify-center font-black text-xl">{number}</div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-ds-text mb-2">{title}</h3>
                    <p className="text-ds-soft">{description}</p>
                    {children}
                </div>
            </div>
        </div>
    );
}

function CommandExample({ command, response, label, responseLabel, copyTitle }: { command: string; response: string; label: string; responseLabel: string; copyTitle: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(command);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="bg-ds-bg rounded-lg p-4 border border-ds-border mb-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-ds-soft">{label}</span>
                <button onClick={handleCopy} className="p-1 hover:bg-ds-raised rounded transition-colors" title={copyTitle}>
                    {copied ? <Check className="w-4 h-4 text-ds-ok" /> : <Copy className="w-4 h-4 text-ds-soft" />}
                </button>
            </div>
            <code className="block text-ds-accent-text font-mono text-lg mb-3">{command}</code>
            <div className="text-sm font-medium text-ds-soft mb-1">{responseLabel}</div>
            <code className="block text-ds-text font-mono">{response}</code>
        </div>
    );
}
