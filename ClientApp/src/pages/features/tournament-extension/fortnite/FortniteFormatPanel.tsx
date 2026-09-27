import React, { useEffect, useState } from 'react';
import { Settings2, Loader2 } from 'lucide-react';
import api from '../../../../services/api';
import { EditionPicker } from '../shared';
import type { TournamentEdition } from '../shared';
import type { FortniteFormat } from './types';
import PointsRulesCard from './PointsRulesCard';
import StructureCard from './StructureCard';

// Pestaña "Formato" de las ediciones de Fortnite (.dev/torneos/15-fortnite.md F2):
// reglas de puntos arriba y la estructura (equipos, grupos, sesiones) abajo.

export default function FortniteFormatPanel({
    edition,
    editions,
    onSelectEdition,
}: {
    edition: TournamentEdition | null;
    editions: TournamentEdition[];
    onSelectEdition: (id: number) => void;
}) {
    const [data, setData] = useState<FortniteFormat | null>(null);
    const [error, setError] = useState('');

    const load = async (editionId: number) => {
        setError('');
        try {
            const res = await api.get(`/admin/tournament/editions/${editionId}/fortnite`);
            setData(res.data);
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Error cargando el formato');
        }
    };

    useEffect(() => {
        setData(null);
        if (edition) load(edition.id);
    }, [edition?.id]);

    if (!edition) return <EditionPicker editions={editions} onSelectEdition={onSelectEdition} />;
    if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
    if (!data) return <Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" />;

    return (
        <div className="space-y-6 4xl:space-y-8">
            <div>
                <h2 className="text-lg 4xl:text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-[#2563eb]" /> Formato — {edition.name}
                </h2>
                <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                    Cómo se cuentan los puntos y cómo se organiza el torneo. Los resultados de cada partida se cargan más adelante, en el día de partida.
                </p>
            </div>
            <PointsRulesCard editionId={edition.id} teamSize={data.teamSize} initial={data.config} presets={data.presets} onSaved={() => load(edition.id)} />
            <StructureCard editionId={edition.id} data={data} onChanged={() => load(edition.id)} />
        </div>
    );
}
