import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../../services/api';
import MyTournamentPanel from './MyTournamentPanel';
import { TournamentThemeRoot } from './broadcast';
import type { Appearance } from './theme';

// "Mi inscripción" como pagina completa en /mi-panel: destino del redirect de login
// y del login de Epic. Mismo contenido que el panel lateral, con los colores del torneo.

export default function MyTournamentPage() {
    const { channelName, editionSlug } = useParams<{ channelName: string; editionSlug: string }>();
    const [edition, setEdition] = useState<(Appearance & { name: string }) | null>(null);

    useEffect(() => {
        api.get(`/public/tournament/${channelName}/${editionSlug}`)
            .then((res) => setEdition(res.data?.edition || { name: '' }))
            .catch(() => setEdition({ name: '' }));
    }, [channelName, editionSlug]);

    useEffect(() => {
        document.documentElement.classList.add('t-scale');
        return () => document.documentElement.classList.remove('t-scale');
    }, []);

    if (!edition) return <div className="min-h-screen bg-[#080B12]" />;

    return (
        <TournamentThemeRoot appearance={edition} className="min-h-screen">
            <div className="max-w-2xl mx-auto px-4 md:px-8 py-10 md:py-16">
                <Link to={`/torneos/${channelName}/${editionSlug}`} className="inline-flex items-center gap-1.5 text-base font-semibold hover:underline" style={{ color: 'var(--t-muted)' }}>
                    <ArrowLeft className="w-4 h-4" /> {edition.name || 'Volver al torneo'}
                </Link>
                <h1 className="font-scoreboard font-black text-5xl md:text-6xl leading-none mt-3 mb-8">Mi inscripción</h1>
                <MyTournamentPanel channelName={channelName!} editionSlug={editionSlug!} />
            </div>
        </TournamentThemeRoot>
    );
}
