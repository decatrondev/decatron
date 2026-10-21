// Biblioteca de voces: todas las que puedes usar, con la muestra de las de personaje y un botón para dejarlas en el canal.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Volume2 } from 'lucide-react';
import api from '../../../../services/api';
import { Card, inputClass } from '../../../../components/overlay-editor/ui';
import { standardVoicesForLanguage, premiumVoicesForLanguage } from '../../../../components/tts/useVoiceCatalog';
import type { VoiceCatalog } from '../../../../components/tts/useVoiceCatalog';
import type { FishVoiceOption } from '../../fishVoices';
import type { SpeakChatState } from './useSpeakChatConfig';

type Kind = 'fish' | 'polly' | 'piper';

export default function LibraryTab({ sc, voiceCatalog, fishVoices }: { sc: SpeakChatState; voiceCatalog: VoiceCatalog; fishVoices: FishVoiceOption[] }) {
    const { t } = useTranslation('speakchat');
    const { config, setConfig, usage } = sc;
    const [kind, setKind] = useState<Kind>('fish');
    const [q, setQ] = useState('');
    const [playError, setPlayError] = useState(false);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    useEffect(() => () => audioRef.current?.pause(), []);

    const paid = !!usage && (usage.isUnlimited || usage.totalAvailable > 0);
    const lang = config.voice.languageCode;
    const match = (name: string) => name.toLowerCase().includes(q.trim().toLowerCase());

    const play = (url: string) => {
        setPlayError(false);
        audioRef.current?.pause();
        const a = new Audio(url);
        audioRef.current = a;
        a.play().catch(() => setPlayError(true));
    };

    // Las voces estándar y premium no traen muestra: el servidor la genera la primera vez y la guarda
    const playGenerated = async (id: string, engine: 'piper' | 'polly') => {
        setLoadingId(id); setPlayError(false);
        try {
            const res = await api.get('/tts/voice-sample', { params: { engine, voice: id, quality: engine === 'polly' ? config.voice.pollyEngine : undefined } });
            if (res.data?.url) play(res.data.url); else setPlayError(true);
        } catch { setPlayError(true); }
        finally { setLoadingId(null); }
    };

    const use = (patch: Partial<typeof config.voice>) => setConfig(c => ({ ...c, voice: { ...c.voice, ...patch } }));

    const rows: { id: string; name: string; meta: string; sample?: string | null; generate?: 'piper' | 'polly'; mine?: boolean; active: boolean; locked: boolean; onUse: () => void }[] =
        kind === 'fish'
            ? fishVoices.filter(v => match(v.name)).map(v => ({
                id: v.id, name: v.name, meta: [v.languages?.split(',').join(', '), v.author].filter(Boolean).join(' · '), sample: v.sampleUrl, mine: v.private,
                active: config.voice.engine === 'fish' && config.voice.fishVoice === v.id, locked: !paid,
                onUse: () => use({ engine: 'fish', fishVoice: v.id }),
            }))
            : kind === 'polly'
                ? premiumVoicesForLanguage(voiceCatalog, lang, config.voice.pollyEngine).filter(v => match(v.name)).map(v => ({
                    id: v.id, name: v.name, meta: `${v.languageName}${v.gender ? ` · ${v.gender === 'Female' ? 'F' : 'M'}` : ''}`,
                    generate: 'polly' as const,
                    active: config.voice.engine === 'polly' && config.voice.pollyVoice === v.id, locked: !paid,
                    onUse: () => use({ engine: 'polly', pollyVoice: v.id }),
                }))
                : standardVoicesForLanguage(voiceCatalog, lang).filter(v => match(v.name)).map(v => ({
                    id: v.id, name: v.name, meta: `${v.languageName} (${v.quality})`,
                    generate: 'piper' as const,
                    active: config.voice.engine === 'piper' && config.voice.standardVoice === v.id, locked: false,
                    onUse: () => use({ engine: 'piper', standardVoice: v.id }),
                }));

    const kinds: { id: Kind; label: string }[] = [
        { id: 'fish', label: t('v2.engine.fish') }, { id: 'polly', label: t('v2.engine.polly') }, { id: 'piper', label: t('v2.engine.piper') },
    ];

    return (
        <Card title={t('v2.library.title')} description={t('v2.library.description')}>
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('v2.library.title')}>
                    {kinds.map(k => (
                        <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} onClick={() => setKind(k.id)}
                            className={kind === k.id ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}>{k.label}</button>
                    ))}
                </div>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('v2.library.search')} aria-label={t('v2.library.search')} className={`${inputClass} sm:max-w-xs`} />
            </div>

            {kind !== 'fish' && <p className="text-xs 3xl:text-sm text-ds-soft mb-3">{t('v2.library.langNote', { lang })}</p>}
            {kind === 'fish' && <p className="text-xs 3xl:text-sm text-ds-soft mb-3">{t('v2.library.fishNote')}</p>}
            {kind !== 'fish' && <p className="text-xs 3xl:text-sm text-ds-soft mb-3">{t('v2.library.generatedNote')}</p>}
            {playError && <p className="text-xs 3xl:text-sm text-ds-danger mb-3">{t('v2.library.sampleError')}</p>}

            {rows.length === 0 ? (
                <p className="text-sm 3xl:text-base text-ds-soft">{t('v2.library.empty')}</p>
            ) : (
                <ul className="divide-y divide-ds-border">
                    {rows.map(r => (
                        <li key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm 3xl:text-base font-bold text-ds-text truncate">
                                    {r.name} {r.mine && <span className="text-xs font-normal text-ds-soft">· {t('v2.library.mine')}</span>}
                                </p>
                                <p className="text-xs 3xl:text-sm text-ds-soft">{r.meta}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {r.sample && (
                                    <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => play(r.sample!)}>
                                        <Volume2 className="w-4 h-4" /> {t('request.sample')}
                                    </button>
                                )}
                                {r.generate && (
                                    <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" disabled={loadingId === r.id} onClick={() => playGenerated(r.id, r.generate!)}>
                                        <Volume2 className="w-4 h-4" /> {loadingId === r.id ? t('v2.library.loadingSample') : t('request.sample')}
                                    </button>
                                )}
                                {r.active ? (
                                    <span className="text-xs 3xl:text-sm font-bold text-ds-ok">{t('v2.library.inUse')}</span>
                                ) : (
                                    <button type="button" className="ds-btn ds-btn--primary ds-btn--sm" disabled={r.locked} onClick={r.onUse} title={r.locked ? t('v2.voices.needCredits') : undefined}>
                                        {t('v2.library.use')}
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
