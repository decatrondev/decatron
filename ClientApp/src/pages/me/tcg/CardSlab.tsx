// Cápsula de gradeo estilo PSA — ver .dev/plans/TCG_CARTAS_COLECCIONABLES_PLAN.md
// sección 7. Es puro frontend: del nivel 1 al 9 la carta usa el MISMO arte base y lo
// único que cambia es esta cápsula con su grado, así que subir de nivel no le pide
// una ilustración nueva a nadie. El nivel 10 sí tiene arte propio, y se distingue con
// etiqueta negra, igual que el "black label" real de PSA.

/** Nomenclatura real de PSA: el número solo no dice nada, la abreviatura sí. */
const GRADE_LABELS: Record<number, string> = {
    1: 'PR',
    2: 'GOOD',
    3: 'VG',
    4: 'VG-EX',
    5: 'EX',
    6: 'EX-MT',
    7: 'NM',
    8: 'NM-MT',
    9: 'MINT',
    10: 'GEM MT',
};

export function gradeLabel(level: number): string {
    return GRADE_LABELS[level] ?? '';
}

interface Props {
    level: number;
    name: string | null;
    rarity: string | null;
    imageUrl: string | null;
    /** En grillas chicas se achica la etiqueta y se saca el texto secundario. */
    compact?: boolean;
}

export default function CardSlab({ level, name, rarity, imageUrl, compact }: Props) {
    const esGemMint = level >= 10;

    const arte = imageUrl ? (
        <img
            src={imageUrl}
            alt={name || 'carta'}
            draggable={false}
            loading="lazy"
            className="w-full aspect-[3/4] object-cover select-none bg-black/30"
        />
    ) : (
        <div className="w-full aspect-[3/4] bg-black/30 flex items-center justify-center text-[10px] text-[#64748b]">
            sin arte
        </div>
    );

    // Nivel 0: la carta todavía no fue gradeada, va suelta y sin cápsula.
    if (level <= 0) {
        return <div className="rounded-xl overflow-hidden">{arte}</div>;
    }

    return (
        <div
            className="relative rounded-lg overflow-hidden"
            style={{
                // El borde claro de arriba y el oscuro de abajo son lo que lee como
                // "acrílico" — sin eso queda un marco plano, no una cápsula.
                background: 'linear-gradient(160deg, rgba(255,255,255,0.35) 0%, rgba(203,213,225,0.15) 18%, rgba(15,23,42,0.25) 100%)',
                padding: compact ? '3px' : '5px',
                boxShadow: esGemMint
                    ? '0 0 0 1px rgba(250,204,21,0.5), 0 8px 24px rgba(0,0,0,0.55)'
                    : '0 0 0 1px rgba(255,255,255,0.18), 0 8px 24px rgba(0,0,0,0.45)',
            }}
        >
            <div className="rounded-md overflow-hidden bg-[#0b1120]">
                {/* Etiqueta */}
                <div
                    className="flex items-stretch"
                    style={{
                        background: esGemMint
                            ? 'linear-gradient(100deg, #0a0a0a 0%, #1c1917 100%)'
                            : 'linear-gradient(100deg, #f8fafc 0%, #e2e8f0 100%)',
                    }}
                >
                    <div className={`flex-1 min-w-0 ${compact ? 'px-1.5 py-1' : 'px-2.5 py-1.5'}`}>
                        <div
                            className={`font-black tracking-tight truncate ${compact ? 'text-[9px]' : 'text-[11px]'}`}
                            style={{ color: esGemMint ? '#fde68a' : '#0f172a' }}
                        >
                            {name || '???'}
                        </div>
                        {!compact && (
                            <div
                                className="text-[8px] font-bold tracking-[0.18em] uppercase"
                                style={{ color: esGemMint ? 'rgba(253,230,138,0.65)' : '#64748b' }}
                            >
                                Decatron TCG · {rarity}
                            </div>
                        )}
                    </div>

                    <div
                        className={`flex flex-col items-center justify-center shrink-0 ${compact ? 'px-1.5' : 'px-2.5'}`}
                        style={{
                            background: esGemMint
                                ? 'linear-gradient(160deg, #facc15 0%, #b45309 100%)'
                                : 'linear-gradient(160deg, #1e293b 0%, #0f172a 100%)',
                            color: esGemMint ? '#1c1917' : '#f8fafc',
                        }}
                    >
                        <span className={`font-black leading-none ${compact ? 'text-sm' : 'text-lg'}`}>{level}</span>
                        {!compact && (
                            <span className="text-[7px] font-black tracking-[0.12em] leading-none mt-0.5">
                                {gradeLabel(level)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="relative">
                    {arte}
                    {/* Reflejo diagonal del acrílico. pointer-events-none para no comerse
                        el click de la carta. */}
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background:
                                'linear-gradient(112deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 26%, transparent 45%)',
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
