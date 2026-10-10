import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import api from '../../../services/api';

// Aviso de que estás operando el TCG de OTRO canal (con control_total sobre él).
//
// Es imprescindible: comprar sobres o mandar cartas a gradear gasta DecaCoins comprados
// con dinero real y puede destruir cartas ajenas, y nada de eso se deshace. Sin este
// cartel, la pantalla se ve idéntica a la propia.

export default function TcgContextBanner() {
    const [ctx, setCtx] = useState<{ login: string | null; isOwn: boolean } | null>(null);

    useEffect(() => {
        api.get('/tcg/context')
            .then((res) => setCtx(res.data))
            .catch(() => { /* si falla, no se muestra nada: es informativo */ });
    }, []);

    if (!ctx || ctx.isOwn) return null;

    return (
        <div className="flex items-start gap-2 rounded-lg border border-ds-warn/40 bg-ds-warn/10 px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-ds-warn shrink-0 mt-0.5" />
            <div className="text-sm">
                <p className="font-bold text-ds-warn">
                    Estás viendo el TCG de {ctx.login}, no el tuyo.
                </p>
                <p className="text-ds-warn/70 mt-0.5">
                    Lo que compres o mandes a gradear sale de sus DecaCoins y afecta sus cartas.
                    Nada de esto se puede deshacer.
                </p>
            </div>
        </div>
    );
}
