import { useParams, Link } from 'react-router-dom';
import MyTournamentPanel from './MyTournamentPanel';

// Pagina completa en /mi-panel — deep link (ej. destino del redirect de login).
// El contenido en si vive en MyTournamentPanel.tsx, reusado tambien dentro del
// modal que se abre desde la pagina principal del torneo (ver
// MyTournamentModal.tsx) — extraido el 24-08-2026, ver nota ahi.

export default function MyTournamentPage() {
    const { channelName, editionSlug } = useParams<{ channelName: string; editionSlug: string }>();

    return (
        <div className="min-h-screen bg-[#0B1120] text-[#EDF0F7]">
            <div className="max-w-lg 4xl:max-w-2xl 5xl:max-w-3xl mx-auto px-5 4xl:px-8 py-12 4xl:py-20 space-y-8 4xl:space-y-12">
                <div>
                    <Link to={`/torneos/${channelName}/${editionSlug}`} className="font-mono text-[11px] text-[#7C8AA6] hover:text-[#EDF0F7]">
                        ← volver al torneo
                    </Link>
                    <h1 className="font-display font-bold text-2xl mt-2">Mi inscripción</h1>
                </div>

                <MyTournamentPanel channelName={channelName!} editionSlug={editionSlug!} />
            </div>
        </div>
    );
}
