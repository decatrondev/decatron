import { CircleDot, Loader2, Plus } from 'lucide-react';

export function EmptyState({ onCreate, saving, t }: {
    onCreate: (mode: 'prizes' | 'raffle') => void;
    saving: boolean;
    t: any;
}) {
    return (
        <div className="bg-[#1B1C1D] rounded-xl border border-[#374151] px-8 py-14 text-center">
            <CircleDot className="w-12 h-12 text-[#E8B455] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#f8fafc]">{t('wheel.empty.title')}</h2>
            <p className="text-sm text-[#94a3b8] mt-2 max-w-md mx-auto">{t('wheel.empty.body')}</p>

            {/* El modo Sorteo esta construido (servicio, comandos, endpoints y pestana)
                pero NO se ofrece: el usuario decidio que no lo quiere por ahora. Para
                volver a exponerlo alcanza con dar a elegir el modo aca y en la cabecera;
                no hay nada mas que rehacer. */}
            <button
                onClick={() => onCreate('prizes')}
                disabled={saving}
                className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-bold inline-flex items-center gap-2 transition-colors"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t('wheel.empty.create')}
            </button>
        </div>
    );
}
