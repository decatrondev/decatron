import { BRACKET_FORMAT_LABELS, REGION_LABELS, FORTNITE_TEAM_SIZE_LABELS } from './shared';
import type { EditionInfo, Prize } from './shared';
import { SectionTitle, EmptyBlock } from './broadcast';

// Tab "Info" (rediseño de transmisión): la ficha del torneo y los premios. Los
// premios por puesto van primero y en orden, como una escalera.

export function editionFacts(edition: EditionInfo): [string, string][] {
    const isFortnite = edition.game === 'fortnite';
    const facts: ([string, string] | null)[] = [
        ['Juego', isFortnite ? 'Fortnite' : 'League of Legends'],
        [
            'Formato',
            isFortnite
                ? 'Por puntos en partidas personalizadas'
                : BRACKET_FORMAT_LABELS[edition.bracketFormat || ''] || (edition.mode === 'solo_q_climb' ? 'Climb SoloQ' : '—'),
        ],
        isFortnite && edition.teamSize
            ? ['Modalidad', FORTNITE_TEAM_SIZE_LABELS[edition.teamSize] || `${edition.teamSize}`]
            : edition.teamSize
              ? ['Equipos', edition.teamSize === 1 ? '1 contra 1' : `${edition.teamSize} contra ${edition.teamSize}`]
              : null,
        ['Región', REGION_LABELS[edition.region] || edition.region.toUpperCase()],
    ];
    return facts.filter((f): f is [string, string] => f != null);
}

function prizeAmount(p: Prize): string | null {
    if (p.amountHidden) return '???';
    if (p.amount == null) return null;
    return `$${p.amount.toLocaleString()}`;
}

export default function InfoSection({ edition, prizes }: { edition: EditionInfo; prizes: Prize[] }) {
    const ranked = prizes.filter((p) => p.scope === 'by_rank' && p.rank != null).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    const others = prizes.filter((p) => !(p.scope === 'by_rank' && p.rank != null));

    return (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-8 4xl:gap-12 items-start">
            <section>
                <SectionTitle>El torneo</SectionTitle>
                <dl className="grid grid-cols-2 gap-1.5">
                    {editionFacts(edition).map(([label, value]) => (
                        <div key={label} className="px-4 4xl:px-5 py-3 4xl:py-4" style={{ background: 'var(--t-surface)', boxShadow: 'inset 0 0 0 1px var(--t-line)' }}>
                            <dt className="text-sm 4xl:text-base" style={{ color: 'var(--t-muted)' }}>{label}</dt>
                            <dd className="font-scoreboard font-black text-xl 4xl:text-2xl leading-tight mt-0.5">{value}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            <section>
                <SectionTitle>Premios</SectionTitle>
                {prizes.length === 0 ? (
                    <EmptyBlock>El organizador todavía no publicó los premios.</EmptyBlock>
                ) : (
                    <div className="space-y-1.5">
                        {ranked.map((p, i) => (
                            <div
                                key={`r${i}`}
                                className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] 4xl:grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 4xl:px-5 py-3 4xl:py-4"
                                style={{ background: 'var(--t-surface)', boxShadow: p.rank === 1 ? 'inset 3px 0 0 var(--t-gold), inset 0 0 0 1px var(--t-line)' : 'inset 0 0 0 1px var(--t-line)' }}
                            >
                                <span className="font-scoreboard font-black text-3xl 4xl:text-4xl leading-none" style={{ color: p.rank === 1 ? 'var(--t-gold)' : 'var(--t-muted)' }}>
                                    {p.rank}.°
                                </span>
                                <span className="min-w-0">
                                    <span className="block font-semibold text-base 4xl:text-lg truncate">{p.name}</span>
                                    {p.description && <span className="block text-sm 4xl:text-base truncate" style={{ color: 'var(--t-muted)' }}>{p.description}</span>}
                                </span>
                                {prizeAmount(p) && <span className="font-scoreboard font-black text-2xl 4xl:text-3xl">{prizeAmount(p)}</span>}
                            </div>
                        ))}
                        {others.map((p, i) => (
                            <div key={`o${i}`} className="px-4 4xl:px-5 py-3 4xl:py-4" style={{ background: 'var(--t-surface)', boxShadow: 'inset 0 0 0 1px var(--t-line)' }}>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-semibold text-base 4xl:text-lg truncate">{p.name}</span>
                                    {prizeAmount(p) && <span className="font-scoreboard font-black text-2xl 4xl:text-3xl flex-shrink-0">{prizeAmount(p)}</span>}
                                </div>
                                {p.description && <p className="text-sm 4xl:text-base mt-0.5" style={{ color: 'var(--t-muted)' }}>{p.description}</p>}
                                {p.leader && (
                                    <p className="text-sm 4xl:text-base mt-1" style={{ color: 'var(--t-muted)' }}>
                                        Va ganando <strong style={{ color: 'var(--t-ink)' }}>{p.leader.displayName}</strong> con {p.leader.value}
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
