import { CircleDot, Loader2, Plus, Ticket } from 'lucide-react';

/** Sin ruedas todavía: se elige el modo al crear, y ya no se puede cambiar. */
export function EmptyState({ onCreate, saving, t }: {
    onCreate: (mode: 'prizes' | 'raffle') => void;
    saving: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    return (
        <div className="bg-[#1B1C1D] rounded-xl border border-[#374151] px-8 py-14 text-center">
            <CircleDot className="w-12 h-12 text-[#E8B455] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#f8fafc]">{t('wheel.empty.title')}</h2>
            <p className="text-sm text-[#94a3b8] mt-2 max-w-md mx-auto">{t('wheel.empty.body')}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 max-w-2xl mx-auto text-left">
                <button
                    onClick={() => onCreate('prizes')}
                    disabled={saving}
                    className="p-5 bg-[#262626] hover:bg-[#2d2d2d] border border-[#374151] hover:border-blue-500 disabled:opacity-60 rounded-xl transition-colors"
                >
                    <span className="flex items-center gap-2 font-bold text-[#f8fafc]">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {t('wheel.empty.modePrizes')}
                    </span>
                    <span className="block text-xs text-[#94a3b8] mt-1.5">{t('wheel.empty.modePrizesHelp')}</span>
                </button>
                <button
                    onClick={() => onCreate('raffle')}
                    disabled={saving}
                    className="p-5 bg-[#262626] hover:bg-[#2d2d2d] border border-[#374151] hover:border-blue-500 disabled:opacity-60 rounded-xl transition-colors"
                >
                    <span className="flex items-center gap-2 font-bold text-[#f8fafc]">
                        <Ticket className="w-4 h-4" />
                        {t('wheel.empty.modeRaffle')}
                    </span>
                    <span className="block text-xs text-[#94a3b8] mt-1.5">{t('wheel.empty.modeRaffleHelp')}</span>
                </button>
            </div>
        </div>
    );
}
