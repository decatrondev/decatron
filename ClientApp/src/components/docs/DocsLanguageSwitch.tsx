import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../contexts/LanguageContext';
import { AVAILABLE_LANGUAGES } from '../../i18n/languages';
import type { Language } from '../../types/language';

// Selector compacto de idioma para las docs. Funciona sin sesión: el visitante elige y el
// navegador lo recuerda; con sesión, además se guarda en su cuenta (ver LanguageContext).
export default function DocsLanguageSwitch() {
    const { t } = useTranslation('docs');
    const { currentLanguage, changeLanguage } = useLanguage();

    return (
        <div
            role="group"
            aria-label={t('layout.language')}
            className="inline-flex rounded-lg border border-ds-border overflow-hidden"
        >
            {AVAILABLE_LANGUAGES.map(lang => {
                const active = currentLanguage === lang.code;
                return (
                    <button
                        key={lang.code}
                        type="button"
                        aria-pressed={active}
                        title={lang.nativeLabel}
                        onClick={() => { if (!active) changeLanguage(lang.code as Language).catch(() => {}); }}
                        className={`px-3 py-1.5 text-xs font-bold uppercase transition-colors ${
                            active
                                ? 'bg-ds-accent text-white'
                                : 'text-ds-soft hover:bg-ds-raised'
                        }`}
                    >
                        {lang.code}
                    </button>
                );
            })}
        </div>
    );
}
