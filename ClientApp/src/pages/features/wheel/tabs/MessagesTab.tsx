import { RotateCcw } from 'lucide-react';
import { type MessagePack } from '../model';
import { CARD, FIELD } from '../ui';

/**
 * Los textos que la Rueda escribe en el chat.
 *
 * Cada campo arranca vacio con la base de Decatron como marcador: asi se ve que va a
 * decir el bot sin haber escrito nada, y borrar el campo es como se restaura. No hay
 * forma de dejar al bot mudo por accidente.
 */
export function MessagesTab({ pack, lang, onChange, t }: {
    pack: MessagePack;
    lang: 'es' | 'en';
    onChange: (key: string, lang: 'es' | 'en', value: string) => void;
    t: any;
}) {
    const claves = Object.keys(pack.defaults);

    return (
        <div className="space-y-4">
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-ds-border flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="font-bold text-ds-text">{t('wheel.messages.title')}</h2>
                        <p className="text-xs text-ds-soft mt-0.5">{t('wheel.messages.help')}</p>
                    </div>
                    {/* Se dice en que idioma se esta editando, pero no se deja cambiar
                        aca: eso vive en Configuracion, que es el unico sitio donde el
                        idioma de la cuenta se decide. */}
                    <p className="text-xs text-ds-soft">
                        {t('wheel.messages.editingIn', { lang: lang.toUpperCase() })}
                    </p>
                </div>

                {claves.map(key => {
                    const propio = pack.messages[key]?.[lang] ?? '';
                    const base = pack.defaults[key][lang];
                    const vars = pack.placeholders[key] ?? [];
                    const usadas = new Set([...propio.matchAll(/\{(\w+)\}/g)].map(m => m[1]));
                    const desconocidas = [...usadas].filter(v => !vars.includes(v));

                    return (
                        <div key={key} className="px-5 py-4 border-b border-ds-border last:border-0">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <p className="text-sm font-medium text-ds-text">{t(`wheel.messages.keys.${key}`)}</p>
                                {propio && (
                                    <button
                                        onClick={() => onChange(key, lang, '')}
                                        className="text-xs text-ds-soft hover:text-ds-text flex items-center gap-1"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        {t('wheel.messages.reset')}
                                    </button>
                                )}
                            </div>

                            <textarea
                                rows={2}
                                value={propio}
                                placeholder={base}
                                onChange={e => onChange(key, lang, e.target.value)}
                                className={`${FIELD} w-full resize-y`}
                            />

                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                {vars.map(v => (
                                    <button
                                        key={v}
                                        onClick={() => onChange(key, lang, `${propio || base}{${v}}`)}
                                        title={t('wheel.messages.insert')}
                                        className="ds-btn ds-btn--secondary ds-btn--sm"
                                    >
                                        {'{' + v + '}'}
                                    </button>
                                ))}
                            </div>

                            {desconocidas.length > 0 && (
                                <p className="text-xs text-ds-warn mt-2">
                                    {t('wheel.messages.unknownVars', { vars: desconocidas.map(v => `{${v}}`).join(' ') })}
                                </p>
                            )}
                        </div>
                    );
                })}
            </section>
        </div>
    );
}
