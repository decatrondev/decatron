import { Zap, Users, Terminal, LayoutDashboard, ShieldCheck, ListChecks, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import DocAlert from '../../components/docs/DocAlert';
import DocSection from '../../components/docs/DocSection';
import CodeBlock from '../../components/docs/CodeBlock';

// Micro comandos = atajos que cambian la categoría del stream (MicroGameCommands en el backend).
// Fuentes: MicroCommandsController, CommandService.ProcessMicroCommand, GCommand y bot-messages.
export default function MicrocommandsDoc() {
    const { t } = useTranslation('docs');
    // Mientras el namespace carga, t() devuelve el texto de la clave: se tratan como lista vacía.
    const list = (key: string): string[] => {
        const v = t(`microCommands.${key}`, { returnObjects: true });
        return Array.isArray(v) ? (v as string[]) : [];
    };
    const rawRows = t('microCommands.chatRows', { returnObjects: true });
    const rows: string[][] = Array.isArray(rawRows) ? (rawRows as string[][]) : [];
    const isDashboard = typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard');

    return (
        <div className="space-y-8">
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-ds-bg rounded-lg flex items-center justify-center border border-ds-border">
                        <Zap className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">{t('microCommands.title')}</h1>
                        <p className="text-ds-soft">{t('microCommands.subtitle')}</p>
                    </div>
                </div>
                {isDashboard && (
                    <Link to="/commands/microcommands" className="inline-flex mt-5 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors">
                        {t('microCommands.goToPanel')}
                    </Link>
                )}
            </div>

            <DocSection title={t('microCommands.whatTitle')}>
                <p>{t('microCommands.what')}</p>
            </DocSection>

            <DocSection title={t('microCommands.howTitle')}>
                <ol className="list-decimal pl-6 space-y-2">
                    {list('how').map(step => <li key={step}>{step}</li>)}
                </ol>
                <p className="font-medium text-ds-text">{t('microCommands.example')}</p>
                <CodeBlock code={t('microCommands.exampleCode')} />
            </DocSection>

            <DocSection title={t('microCommands.whoTitle')}>
                <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 mt-1 text-ds-accent-text flex-shrink-0" />
                    <p>{t('microCommands.who')}</p>
                </div>
            </DocSection>

            <DocSection title={t('microCommands.createTitle')}>
                <h3 className="flex items-center gap-2 text-lg font-bold text-ds-text">
                    <LayoutDashboard className="w-5 h-5 text-ds-accent-text" />{t('microCommands.panelTitle')}
                </h3>
                <ol className="list-decimal pl-6 space-y-2">
                    {list('panel').map(step => <li key={step}>{step}</li>)}
                </ol>
                <DocAlert type="info">{t('microCommands.panelNote')}</DocAlert>

                <h3 className="flex items-center gap-2 text-lg font-bold text-ds-text pt-2">
                    <Terminal className="w-5 h-5 text-ds-accent-text" />{t('microCommands.chatTitle')}
                </h3>
                <p>{t('microCommands.chatIntro')}</p>
                <div className="rounded-lg border border-ds-border divide-y divide-ds-border overflow-hidden">
                    {rows.map(([cmd, desc]) => (
                        <div key={cmd} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3">
                            <code className="font-mono text-sm font-bold text-ds-accent-text sm:w-64 flex-shrink-0">{cmd}</code>
                            <span className="text-sm">{desc}</span>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t('microCommands.rulesTitle')}>
                <ul className="list-disc pl-6 space-y-2">
                    {list('rules').map(r => <li key={r}>{r}</li>)}
                </ul>
            </DocSection>

            <DocSection title={t('microCommands.panelAccessTitle')}>
                <div className="flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 mt-1 text-ds-accent-text flex-shrink-0" />
                    <p>{t('microCommands.panelAccess')}</p>
                </div>
            </DocSection>

            <DocSection title={t('microCommands.reqTitle')}>
                <div className="flex items-start gap-3">
                    <ListChecks className="w-5 h-5 mt-1 text-ds-accent-text flex-shrink-0" />
                    <ul className="list-disc pl-5 space-y-2">
                        {list('req').map(r => <li key={r}>{r}</li>)}
                    </ul>
                </div>
            </DocSection>

            <DocAlert type="tip" title={t('microCommands.countersTitle')}>
                <span className="inline-flex items-start gap-2"><Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" />{t('microCommands.counters')}</span>
            </DocAlert>
        </div>
    );
}
