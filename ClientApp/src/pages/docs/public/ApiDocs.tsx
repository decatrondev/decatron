import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Code2, ChevronDown, ChevronRight } from 'lucide-react';
import DocSection from '../../../components/docs/DocSection';
import CodeBlock from '../../../components/docs/CodeBlock';
import { asArray } from '../../../components/docs/DocBlocks';

// El texto vive en public/locales/{es,en}/docs-public.json → api.
interface Endpoint { m: string; p: string; d: string; s?: string | null }
interface EndpointGroup { t: string; open?: boolean; items: Endpoint[] }
interface ScopeGroup { t: string; rows: string[][] }
interface ErrorRow { 0: string; 1: string; 2: string }

function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border mb-4 overflow-hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center gap-3 p-4 text-left">
                {isOpen ? <ChevronDown className="w-5 h-5 text-ds-soft" /> : <ChevronRight className="w-5 h-5 text-ds-soft" />}
                <span className="font-bold text-ds-text">{title}</span>
            </button>
            {isOpen && <div className="px-4 pb-4">{children}</div>}
        </div>
    );
}

function EndpointCard({ e }: { e: Endpoint }) {
    return (
        <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
            <div className="flex items-center gap-3 mb-2">
                <span className="px-2 py-1 text-xs font-bold rounded bg-ds-raised text-ds-accent-text">{e.m}</span>
                <code className="text-sm font-mono text-ds-text">{e.p}</code>
            </div>
            <p className="text-sm text-ds-soft">{e.d}</p>
            {e.s && <span className="inline-block mt-2 text-xs px-2 py-1 bg-ds-surface text-ds-accent-text rounded font-mono">{e.s}</span>}
        </div>
    );
}

function StepCard({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
    return (
        <div className="p-5 bg-ds-surface rounded-lg border border-ds-border">
            <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 bg-ds-accent text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{number}</span>
                <h4 className="font-bold text-ds-text">{title}</h4>
            </div>
            <div className="space-y-3">{children}</div>
        </div>
    );
}

export default function ApiDocs() {
    const { t } = useTranslation('docs-public');
    const flow = asArray<string>(t('api.flow', { returnObjects: true }));
    const scopeGroups = asArray<ScopeGroup>(t('api.scopeGroups', { returnObjects: true }));
    const scopeHead = asArray<string>(t('api.scopeHead', { returnObjects: true }));
    const endpointGroups = asArray<EndpointGroup>(t('api.endpointGroups', { returnObjects: true }));
    const errorHead = asArray<string>(t('api.errorHead', { returnObjects: true }));
    const errors = asArray<ErrorRow>(t('api.errors', { returnObjects: true }));

    return (
        <div className="space-y-8">
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center">
                        <Code2 className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">{t('api.title')}</h1>
                        <p className="text-ds-soft">{t('api.subtitle')}</p>
                    </div>
                </div>
                <p className="text-ds-soft max-w-2xl">{t('api.intro')}</p>
            </div>

            <DocSection title={t('api.quickTitle')}>
                <div className="space-y-4">
                    <StepCard number={1} title={t('api.q1.t')}>
                        <p className="text-sm text-ds-soft">{t('api.q1.p')}</p>
                        <Link to="/developer" className="text-ds-accent-text hover:underline font-medium text-sm">{t('api.q1.link')} →</Link>
                    </StepCard>
                    <StepCard number={2} title={t('api.q2.t')}>
                        <p className="text-sm text-ds-soft">{t('api.q2.p')}</p>
                        <CodeBlock language="url" code={t('api.q2.code')} />
                    </StepCard>
                    <StepCard number={3} title={t('api.q3.t')}>
                        <p className="text-sm text-ds-soft">{t('api.q3.p')}</p>
                        <CodeBlock language="bash" code={t('api.q3.code')} />
                        <p className="text-sm text-ds-soft">{t('api.q3.resp')}</p>
                        <CodeBlock language="json" code={t('api.q3.json')} />
                    </StepCard>
                    <StepCard number={4} title={t('api.q4.t')}>
                        <p className="text-sm text-ds-soft">{t('api.q4.p')}</p>
                        <CodeBlock language="bash" code={t('api.q4.code')} />
                    </StepCard>
                </div>
            </DocSection>

            <DocSection title={t('api.authTitle')}>
                <p className="text-ds-soft mb-4">{t('api.authIntro')}</p>
                <div className="p-4 bg-ds-surface rounded-lg border border-ds-border mb-4">
                    <h4 className="font-bold text-ds-text mb-4">{t('api.flowTitle')}</h4>
                    <div className="space-y-3">
                        {flow.map((step, i) => (
                            <div key={step} className="flex items-start gap-3">
                                <span className="w-6 h-6 bg-ds-accent text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                                <p className="text-sm text-ds-soft">{step}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <CollapsibleSection title={t('api.pkceTitle')}>
                    <p className="text-sm text-ds-soft mb-3">{t('api.pkceIntro')}</p>
                    <CodeBlock language="javascript" code={t('api.pkceCode')} />
                </CollapsibleSection>
                <CollapsibleSection title={t('api.refreshTitle')}>
                    <p className="text-sm text-ds-soft mb-3">{t('api.refreshIntro')}</p>
                    <CodeBlock language="bash" code={t('api.refreshCode')} />
                </CollapsibleSection>
                <CollapsibleSection title={t('api.revokeTitle')}>
                    <p className="text-sm text-ds-soft mb-3">{t('api.revokeIntro')}</p>
                    <CodeBlock language="bash" code={t('api.revokeCode')} />
                </CollapsibleSection>
            </DocSection>

            <DocSection title={t('api.scopesTitle')}>
                <p className="text-ds-soft mb-6">{t('api.scopesIntro')}</p>
                {scopeGroups.map(g => (
                    <div key={g.t} className="mb-6">
                        <h3 className="text-lg font-bold text-ds-text mb-3">{g.t}</h3>
                        <div className="rounded-lg border border-ds-border overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-ds-bg border-b border-ds-border">
                                        {scopeHead.map(h => <th key={h} className="px-4 py-3 text-left text-sm font-bold text-ds-text">{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ds-border">
                                    {asArray<string[]>(g.rows).map(r => (
                                        <tr key={r[0]}>
                                            <td className="px-4 py-3 text-sm"><code className="text-ds-accent-text font-mono">{r[0]}</code></td>
                                            <td className="px-4 py-3 text-sm text-ds-soft">{r[1]}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </DocSection>

            <DocSection title={t('api.endpointsTitle')}>
                {endpointGroups.map(g => (
                    <CollapsibleSection key={g.t} title={g.t} defaultOpen={!!g.open}>
                        <div className="space-y-3">{asArray<Endpoint>(g.items).map(e => <EndpointCard key={e.p} e={e} />)}</div>
                    </CollapsibleSection>
                ))}
            </DocSection>

            <DocSection title={t('api.errorsTitle')}>
                <div className="rounded-lg border border-ds-border overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-ds-bg border-b border-ds-border">
                                {errorHead.map(h => <th key={h} className="px-4 py-3 text-left text-sm font-bold text-ds-text">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ds-border">
                            {errors.map(r => (
                                <tr key={r[0]}>
                                    <td className="px-4 py-3 text-sm font-bold text-ds-text">{r[0]}</td>
                                    <td className="px-4 py-3 text-sm"><code className="font-mono text-ds-accent-text">{r[1]}</code></td>
                                    <td className="px-4 py-3 text-sm text-ds-soft">{r[2]}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>

            <DocSection title={t('api.limitsTitle')}>
                <p className="text-ds-soft">{t('api.limits')}</p>
            </DocSection>

            <div className="bg-ds-surface border border-ds-border rounded-lg p-8 text-center">
                <h2 className="text-2xl font-black text-ds-text mb-4">{t('api.helpTitle')}</h2>
                <p className="text-ds-soft mb-6">{t('api.helpText')}</p>
                <Link to="/docs/faq" className="ds-btn ds-btn--primary ds-btn--lg">{t('api.helpButton')}</Link>
            </div>
        </div>
    );
}
