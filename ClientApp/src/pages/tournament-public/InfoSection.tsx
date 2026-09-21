import { SectionLabel, EmptyState, EDITION_STATUS_LABELS, BRACKET_FORMAT_LABELS, REGION_LABELS } from './shared';
import type { EditionInfo, Prize } from './shared';

// Tab "Info" — fusiona lo que antes vivia repartido en el rail lateral ("El
// torneo" + "Premios"), para no duplicar la misma informacion en dos lugares
// distintos de la pagina (reestructuracion 24-08-2026). Las normas volvieron a
// ser un modal aparte (RulesModal.tsx) — pedido del usuario, no van en esta tab.

export default function InfoSection({ edition, prizes }: { edition: EditionInfo; prizes: Prize[] }) {
    return (
        <div className="space-y-10 4xl:space-y-14">
            <section>
                <SectionLabel title="El torneo" accent="#E8B04B" />
                <dl className="border border-[#232C42] rounded-lg bg-[#0F1729] divide-y divide-[#232C42] overflow-hidden">
                    {[
                        ['Formato', BRACKET_FORMAT_LABELS[edition.bracketFormat || ''] || (edition.mode === 'solo_q_climb' ? 'Climb SoloQ' : '—')],
                        ['Región', REGION_LABELS[edition.region] || edition.region.toUpperCase()],
                        edition.teamSize ? ['Tamaño de equipo', edition.teamSize === 1 ? '1 vs 1' : `${edition.teamSize} vs ${edition.teamSize}`] : null,
                        ['Estado', EDITION_STATUS_LABELS[edition.status] || edition.status],
                    ].filter((row): row is [string, string] => row != null).map(([label, value]) => (
                        <div key={label} className="px-4 4xl:px-5 py-3 4xl:py-4 flex items-center justify-between gap-3">
                            <dt className="font-mono text-[11px] 4xl:text-xs uppercase tracking-wide text-[#7C8AA6]">{label}</dt>
                            <dd className="font-display font-bold text-sm 4xl:text-base text-[#EDF0F7] text-right">{value}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            <section>
                <SectionLabel title="Premios" accent="#E8B04B" />
                {prizes.length === 0 ? (
                    <EmptyState text="Todavía no hay premios cargados." />
                ) : (
                    <div className="space-y-2.5 4xl:space-y-3">
                        {prizes.map((p, i) => (
                            <div key={i} className="p-4 4xl:p-5 rounded-lg border border-[#232C42] bg-[#0F1729] hover:border-[#E8B04B]/50 hover:-translate-y-0.5 transition-all">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="font-display font-bold text-sm 4xl:text-base text-[#EDF0F7] truncate">{p.name}</p>
                                    {(p.amountHidden || p.amount != null) && (
                                        <span className="font-mono font-bold text-[#E8B04B] flex-shrink-0">
                                            {p.amountHidden ? '???' : `$${p.amount!.toLocaleString()}`}
                                        </span>
                                    )}
                                </div>
                                {p.description && <p className="font-mono text-[11px] 4xl:text-xs text-[#B8C1D6] mt-1">{p.description}</p>}
                                {p.leader && (
                                    <p className="font-mono text-[11px] 4xl:text-xs text-[#7C8AA6] mt-1">
                                        líder: <span className="text-[#3ED6C4]">{p.leader.displayName}</span> · {p.leader.value}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
