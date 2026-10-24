/**
 * GuideTab - Primera pestaña del panel: pasos para dejar el giveaway funcionando y qué hacer cuando alguien no responde.
 */

import React, { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Info, AlertTriangle } from 'lucide-react';
import { TabShell } from './SettingsExtras';
import type { GiveawayTabType } from '../../types';

interface GuideTabProps {
    onNavigate: (tab: GiveawayTabType) => void;
    /** Comando raíz configurado (por defecto !giveaway) */
    root: string;
}

/** Reemplaza cada {{nombre}} del texto traducido por un nodo (enlace a una pestaña o un comando). */
function fill(text: string, parts: Record<string, ReactNode>): ReactNode[] {
    return text.split(/(\{\{\w+\}\})/g).map((chunk, i) => {
        const m = chunk.match(/^\{\{(\w+)\}\}$/);
        return m && parts[m[1]] !== undefined ? <React.Fragment key={i}>{parts[m[1]]}</React.Fragment> : <React.Fragment key={i}>{chunk}</React.Fragment>;
    });
}

export const GuideTab: React.FC<GuideTabProps> = ({ onNavigate, root }) => {
    const { t } = useTranslation('features');
    const g = (k: string) => t(`giveaway.guide.${k}`);
    const tabName = (id: GiveawayTabType) => t(`giveaway.tabs.${id}`);

    const link = (id: GiveawayTabType) => (
        <button type="button" className="underline text-ds-accent-text font-semibold" onClick={() => onNavigate(id)}>{tabName(id)}</button>
    );
    const cmd = (text: string) => <code className="text-ds-accent-text">{text}</code>;

    const parts: Record<string, ReactNode> = {
        create: link('create'), requirements: link('requirements'), weights: link('weights'), platforms: link('platforms'),
        participants: link('participants'), overlay: link('overlay'), commands: link('commands'),
        start: cmd(`${root} start`), choose: cmd(`${root} choose`), reroll: cmd(`${root} reroll`),
        rerollUser: cmd(`${root} reroll @user`), finish: cmd(`${root} finish`),
    };

    const steps: [string, string][] = [['s1t', 's1b'], ['s2t', 's2b'], ['s3t', 's3b'], ['s4t', 's4b'], ['s5t', 's5b'], ['s6t', 's6b']];

    return (
        <TabShell icon={<BookOpen className="w-6 h-6 text-ds-text" />} title={g('title')} subtitle={g('subtitle')}>
            <div className="space-y-6">
                {steps.map(([title, body], i) => (
                    <div key={title} className="flex gap-4">
                        <span className="w-8 h-8 3xl:w-10 3xl:h-10 shrink-0 rounded-full bg-ds-accent text-ds-on-accent font-black flex items-center justify-center text-sm 3xl:text-base">{i + 1}</span>
                        <div className="flex-1 min-w-0 space-y-1">
                            <h4 className="font-bold text-ds-text text-sm 3xl:text-base">{g(title)}</h4>
                            <p className="text-sm 3xl:text-base text-ds-soft">{fill(g(body), parts)}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="space-y-3">
                {[
                    { icon: <Info className="w-5 h-5 text-ds-accent-text shrink-0" />, title: 'noteSettingsTitle', body: 'noteSettings' },
                    { icon: <Info className="w-5 h-5 text-ds-accent-text shrink-0" />, title: 'noteCommandsTitle', body: 'noteCommands' },
                    { icon: <AlertTriangle className="w-5 h-5 text-ds-warn shrink-0" />, title: 'noteDebugTitle', body: 'noteDebug' },
                ].map((n) => (
                    <div key={n.title} className="flex gap-3 rounded-lg border border-ds-border bg-ds-raised p-4">
                        {n.icon}
                        <div>
                            <p className="font-bold text-ds-text text-sm 3xl:text-base">{g(n.title)}</p>
                            <p className="text-sm 3xl:text-base text-ds-soft">{fill(g(n.body), parts)}</p>
                        </div>
                    </div>
                ))}
            </div>
        </TabShell>
    );
};
