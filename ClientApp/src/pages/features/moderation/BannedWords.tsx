import { Alert } from '../../../components/ds';
import { FilterSwitch } from './filterSwitch';
import { ModerationPage, PageLoading, StatusText } from './parts';
import { AddWordCard, StatsRow, TestCard, WordList } from './bannedwords/WordsCards';
import { ImmunityCard, StrikesCard } from './bannedwords/PolicyCards';
import { useBannedWords } from './bannedwords/useBannedWords';

/** Palabras prohibidas: lista, severidades, inmunidades, mensajes del bot y escala de strikes. */
export default function BannedWords() {
    const s = useBannedWords();
    const { filter } = s;

    if (!s.permissionsLoading && !s.hasMinimumLevel('moderation')) {
        return null;
    }

    return (
        <ModerationPage
            wide
            title="Palabras Prohibidas"
            subtitle="Sistema completo de moderación de palabras y frases prohibidas"
            toast={s.toast}
            actions={filter.enabled !== null && (
                <div className="flex items-center gap-3">
                    <StatusText on={filter.enabled} />
                    <FilterSwitch on={filter.enabled} disabled={filter.saving} onChange={filter.toggle} label="Activar el filtro de palabras prohibidas" />
                </div>
            )}
        >
            {filter.enabled === false && (
                <Alert tone="warn">El filtro está apagado: el bot no sanciona ninguna palabra de la lista hasta que lo actives.</Alert>
            )}

            {s.loading ? <PageLoading /> : (
                <div className="space-y-6">
                    <StatsRow s={s} />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <AddWordCard s={s} />
                        <WordList s={s} />
                    </div>
                    <TestCard s={s} />
                    <ImmunityCard s={s} />
                    <StrikesCard s={s} />
                </div>
            )}
        </ModerationPage>
    );
}
