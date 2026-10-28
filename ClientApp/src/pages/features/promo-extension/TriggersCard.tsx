import { useTranslation } from 'react-i18next';
import { Card, Field, NumberInput, Select, Toggle } from '../../../components/overlay-editor/ui';
import type { OwnCard, Piece } from './types';

export interface Trigger { enabled: boolean; pieceId: number | null; delaySeconds: number }
export interface Triggers { start: Trigger; raid: Trigger }

/** Disparadores: al empezar el directo y tras una raid sale una pieza (la elegida o la siguiente de la rotación) después de unos segundos. */
export function TriggersCard({ triggers, pieces, ownCards, lang, onChange }: {
    triggers: Triggers; pieces: Piece[]; ownCards: OwnCard[]; lang: string; onChange: (next: Triggers) => void;
}) {
    const { t } = useTranslation('promo');
    const options = [
        { value: '', label: t('panel.triggers.next') },
        ...pieces.map(p => ({ value: String(p.id), label: (lang === 'en' && p.titleEn) || p.titleEs || p.bodyEs })),
        ...ownCards.filter(c => !c.hiddenByAdmin).map(c => ({ value: String(-c.id), label: `${t('panel.triggers.ownPrefix')}: ${c.title || c.body}` })),
    ];
    const set = (kind: keyof Triggers, patch: Partial<Trigger>) => onChange({ ...triggers, [kind]: { ...triggers[kind], ...patch } });

    const block = (kind: keyof Triggers) => {
        const tr = triggers[kind];
        return (
            <div className="space-y-4">
                <Toggle checked={tr.enabled} onChange={v => set(kind, { enabled: v })} label={t(`panel.triggers.${kind}.label`)} hint={t(`panel.triggers.${kind}.hint`)} />
                {tr.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label={t('panel.triggers.piece')} hint={t('panel.triggers.pieceHint')}>
                            <Select value={tr.pieceId == null ? '' : String(tr.pieceId)} onChange={v => set(kind, { pieceId: v === '' ? null : Number(v) })} options={options} />
                        </Field>
                        <Field label={t('panel.triggers.delay')} hint={t('panel.triggers.delayHint')}>
                            <div className="max-w-xs"><NumberInput value={tr.delaySeconds} min={0} max={120} step={5} onChange={v => set(kind, { delaySeconds: v })} /></div>
                        </Field>
                    </div>
                )}
            </div>
        );
    };

    return (
        <Card title={t('panel.triggers.title')} description={t('panel.triggers.description')}>
            <div className="space-y-6">
                {block('start')}
                {block('raid')}
                <p className="text-sm 3xl:text-base text-ds-soft">{t('panel.triggers.note')}</p>
            </div>
        </Card>
    );
}
