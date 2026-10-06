import type { RaffleConfig, Source, Tab, WheelSummary } from '../model';
import { CARD, FIELD, Toggle } from '../ui';

type Who = 'everyone' | 'mods';

/** Una fila: el comando (editable cuando se puede cambiar), quien lo usa y que hace. */
function CommandRow({ syntax, onName, who, off, offLabel, text, examples, aliases, aliasLabel, whoLabel, nameWidth, extra }: {
    /** Lo que se muestra como comando. Con `onName` es un campo; sin el, texto fijo. */
    syntax: string;
    onName?: (v: string) => void;
    who: Who;
    off?: boolean;
    offLabel?: string;
    text: string;
    examples: string[];
    aliases?: string[];
    aliasLabel?: string;
    whoLabel: string;
    nameWidth?: string;
    extra?: React.ReactNode;
}) {
    return (
        <div className={`py-4 px-5 grid grid-cols-1 lg:grid-cols-[minmax(0,20rem)_1fr] gap-x-6 gap-y-2 ${off ? 'opacity-60' : ''}`}>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
                {onName ? (
                    <input
                        type="text"
                        value={syntax}
                        onChange={e => onName(e.target.value)}
                        className={`${FIELD} ${nameWidth ?? 'w-40'} font-mono font-bold`}
                    />
                ) : (
                    <code className="font-mono text-sm 3xl:text-base font-bold text-blue-400 break-all">{syntax}</code>
                )}
                <span className={`px-2 py-0.5 rounded-full text-[10px] 3xl:text-xs font-black uppercase tracking-wide ${
                    off ? 'bg-[#374151] text-[#94a3b8]'
                        : who === 'mods' ? 'bg-amber-500/15 text-amber-300' : 'bg-green-500/15 text-green-300'
                }`}>
                    {off ? offLabel : whoLabel}
                </span>
            </div>
            <div className="min-w-0 space-y-1.5">
                <p className="text-sm 3xl:text-base text-[#cbd5e1]">{text}</p>
                {extra}
                <div className="flex flex-wrap items-center gap-1.5">
                    {examples.map(ex => (
                        <code key={ex} className="px-1.5 py-0.5 rounded bg-[#262626] font-mono text-xs 3xl:text-sm text-[#e2e8f0] break-all">{ex}</code>
                    ))}
                    {aliases && aliases.length > 0 && (
                        <span className="text-xs 3xl:text-sm text-[#94a3b8]">
                            {aliasLabel} <span className="font-mono">{aliases.join(' · ')}</span>
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Los comandos del chat de esta rueda, con los nombres REALES que tiene configurados
 * (cada rueda puede cambiarlos), quien puede usarlos y ejemplos. Hasta ahora estaban
 * escondidos dentro de "Disparadores y topes".
 *
 * Los nombres se editan aqui mismo: son los mismos campos de la rueda que ya editaba
 * Disparadores (y el comando de inscripcion del Sorteo), asi que los dos sitios
 * muestran siempre lo mismo y guardan por el mismo boton.
 */
export function CommandsTab({ wheel, onWheel, sources, raffle, onRaffle, onNavigate, t }: {
    wheel: WheelSummary;
    onWheel: (c: Partial<WheelSummary>) => void;
    sources: Source[];
    raffle: RaffleConfig | null;
    onRaffle: (c: Partial<RaffleConfig>) => void;
    onNavigate: (tab: Tab) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    const whoLabel = (w: Who) => t(`wheel.commands.who.${w}`);
    const aliasLabel = t('wheel.commands.aliases');

    if (wheel.mode === 'raffle') {
        const join = raffle?.entryCommand ?? '!djoin';
        const mod = (action: string) => `!drueda ${action}`;
        return (
            <div className="space-y-4">
                <section className={CARD}>
                    <div className="px-5 py-4 border-b border-[#374151]">
                        <h2 className="font-bold text-[#f8fafc]">{t('wheel.commands.title')}</h2>
                        <p className="text-xs 3xl:text-sm text-[#94a3b8] mt-0.5">{t('wheel.commands.raffleHelp')}</p>
                    </div>
                    <div className="divide-y divide-[#374151]">
                        <CommandRow
                            syntax={join} onName={raffle ? v => onRaffle({ entryCommand: v }) : undefined}
                            who="everyone" whoLabel={whoLabel('everyone')}
                            text={t('wheel.commands.join')} examples={[join]}
                        />
                        {(['abrir', 'cerrar', 'sortear', 'reset'] as const).map(action => (
                            <CommandRow
                                key={action}
                                syntax={mod(action)} who="mods" whoLabel={whoLabel('mods')}
                                text={t(`wheel.commands.mod.${action}`)}
                                examples={[mod(action)]}
                                aliases={action === 'abrir' ? ['open'] : action === 'cerrar' ? ['close'] : action === 'sortear' ? ['draw'] : undefined}
                                aliasLabel={aliasLabel}
                            />
                        ))}
                    </div>
                    <p className="px-5 py-3 border-t border-[#374151] text-xs 3xl:text-sm text-[#94a3b8]">{t('wheel.commands.modNote')}</p>
                </section>
            </div>
        );
    }

    const enabled = wheel.commandEnabled !== false;
    const spin = wheel.spinCommand ?? '!dgirar';
    const balance = wheel.balanceCommand ?? '!dcreditos';
    const buy = wheel.buyCommand ?? '!dcomprar';
    const buyOn = !!sources.find(s => s.source === 'deca_coins')?.isEnabled;
    const link = (tab: Tab, label: string) => (
        <button className="underline font-bold text-blue-400" onClick={() => onNavigate(tab)}>{label}</button>
    );

    return (
        <div className="space-y-4">
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151] flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                        <h2 className="font-bold text-[#f8fafc]">{t('wheel.commands.title')}</h2>
                        <p className="text-xs 3xl:text-sm text-[#94a3b8] mt-0.5 max-w-xl">{t('wheel.commands.prizesHelp')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-[#f8fafc]">{t('wheel.triggers.commands')}</span>
                        <Toggle on={enabled} onChange={v => onWheel({ commandEnabled: v })} />
                    </div>
                </div>

                <div className="divide-y divide-[#374151]">
                    <CommandRow
                        syntax={spin} onName={v => onWheel({ spinCommand: v })}
                        who="everyone" whoLabel={whoLabel('everyone')} off={!enabled} offLabel={t('wheel.commands.off')}
                        text={t('wheel.commands.spin')}
                        examples={wheel.allowMultiSpin ? [spin, `${spin} 5`] : [spin]}
                        extra={wheel.allowMultiSpin
                            ? <p className="text-sm 3xl:text-base text-[#94a3b8]">{t('wheel.commands.spinMulti', { command: spin, max: wheel.maxMultiSpin ?? 1 })}</p>
                            : <p className="text-sm 3xl:text-base text-[#94a3b8]">
                                {t('wheel.commands.spinMultiOff')} {link('limits', t('wheel.tabs.limits'))}
                            </p>}
                    />
                    <CommandRow
                        syntax={balance} onName={v => onWheel({ balanceCommand: v })}
                        who="everyone" whoLabel={whoLabel('everyone')} off={!enabled} offLabel={t('wheel.commands.off')}
                        text={t('wheel.commands.balance', { credits: wheel.creditLabel || t('wheel.commands.creditsFallback') })}
                        examples={[balance]}
                    />
                    <CommandRow
                        syntax={buy} onName={v => onWheel({ buyCommand: v })}
                        who="everyone" whoLabel={whoLabel('everyone')} off={!enabled || !buyOn}
                        offLabel={!enabled ? t('wheel.commands.off') : t('wheel.commands.sourceOff')}
                        text={t('wheel.commands.buy')}
                        examples={[`${buy} 100`]}
                        extra={!buyOn && (
                            <p className="text-sm 3xl:text-base text-amber-300/90">
                                {t('wheel.commands.buyNeedsSource')} {link('credits', t('wheel.tabs.credits'))}
                            </p>
                        )}
                    />
                </div>
            </section>
        </div>
    );
}
