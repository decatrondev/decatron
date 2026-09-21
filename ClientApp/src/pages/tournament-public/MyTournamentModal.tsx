import { X } from 'lucide-react';
import MyTournamentPanel from './MyTournamentPanel';

// Modal de "Mi inscripcion" sobre la pagina principal del torneo — pedido del
// usuario (24-08-2026): antes "Inscribirme"/"Mi inscripcion" navegaban a la pagina
// /mi-panel aparte, que en pantallas 2K/4K quedaba como una columna angosta perdida
// en medio de mucho espacio vacio. Mismo ancho responsive que ya se usaba ahi
// (max-w-lg en HD, crece a 4xl:max-w-2xl / 5xl:max-w-3xl) pero ahora centrado como
// overlay, con scroll propio para no depender de la altura de la ventana.

export default function MyTournamentModal({
    channelName, editionSlug, onClose,
}: { channelName: string; editionSlug: string; onClose: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 4xl:p-8 z-50" onClick={onClose}>
            <div
                className="bg-[#0B1120] border border-[#232C42] rounded-xl w-full max-w-lg 4xl:max-w-2xl 5xl:max-w-3xl max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-5 4xl:p-7 border-b border-[#232C42] flex items-center justify-between sticky top-0 bg-[#0B1120] z-10">
                    <h2 className="font-display font-bold text-xl 4xl:text-2xl text-[#EDF0F7]">Mi inscripción</h2>
                    <button onClick={onClose} className="text-[#7C8AA6] hover:text-[#EDF0F7]">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-5 4xl:p-7">
                    <MyTournamentPanel channelName={channelName} editionSlug={editionSlug} />
                </div>
            </div>
        </div>
    );
}
