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
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-2xl flex items-center justify-center border border-[#e2e8f0] dark:border-[#374151]">
                        <Zap className="w-8 h-8 text-[#2563eb]" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">{t('microCommands.title')}</h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">{t('microCommands.subtitle')}</p>
                    </div>
                </div>
                {isDashboard && (
                    <Link to="/commands/microcommands" className="inline-flex mt-5 px-4 py-2 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">
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
                <p className="font-medium text-gray-900 dark:text-white">{t('microCommands.example')}</p>
                <CodeBlock code={t('microCommands.exampleCode')} />
            </DocSection>

            <DocSection title={t('microCommands.whoTitle')}>
                <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 mt-1 text-[#2563eb] flex-shrink-0" />
                    <p>{t('microCommands.who')}</p>
                </div>
            </DocSection>

            <DocSection title={t('microCommands.createTitle')}>
                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                    <LayoutDashboard className="w-5 h-5 text-[#2563eb]" />{t('microCommands.panelTitle')}
                </h3>
                <ol className="list-decimal pl-6 space-y-2">
                    {list('panel').map(step => <li key={step}>{step}</li>)}
                </ol>
                <DocAlert type="info">{t('microCommands.panelNote')}</DocAlert>

                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white pt-2">
                    <Terminal className="w-5 h-5 text-[#2563eb]" />{t('microCommands.chatTitle')}
                </h3>
                <p>{t('microCommands.chatIntro')}</p>
                <div className="rounded-xl border border-[#e2e8f0] dark:border-[#374151] divide-y divide-[#e2e8f0] dark:divide-[#374151] overflow-hidden">
                    {rows.map(([cmd, desc]) => (
                        <div key={cmd} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3">
                            <code className="font-mono text-sm font-bold text-[#2563eb] dark:text-pub-accent-hi sm:w-64 flex-shrink-0">{cmd}</code>
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
                    <ShieldCheck className="w-5 h-5 mt-1 text-[#2563eb] flex-shrink-0" />
                    <p>{t('microCommands.panelAccess')}</p>
                </div>
            </DocSection>

            <DocSection title={t('microCommands.reqTitle')}>
                <div className="flex items-start gap-3">
                    <ListChecks className="w-5 h-5 mt-1 text-[#2563eb] flex-shrink-0" />
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
