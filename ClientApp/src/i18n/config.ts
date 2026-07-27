import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import { SUPPORTED_LANGUAGE_CODES, DEFAULT_LANGUAGE } from './languages';

// Re-export for backward compatibility
export const SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGE_CODES;
export type SupportedLanguage = string;

// Detectar idioma inicial de localStorage o navegador
const getInitialLng = (): string => {
  const last = localStorage.getItem('lastLanguage');
  if (last && SUPPORTED_LANGUAGE_CODES.includes(last)) return last;
  const browser = navigator.language.split('-')[0];
  return SUPPORTED_LANGUAGE_CODES.includes(browser) ? browser : DEFAULT_LANGUAGE;
};

// Initialize i18next
i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGE_CODES,

    // Usar idioma guardado en localStorage para arrancar inmediato
    lng: getInitialLng(),

    // Namespaces (translation files)
    ns: ['common', 'settings', 'layout', 'dashboard', 'overlays', 'commands', 'analytics', 'login', 'landing', 'supporters', 'tips', 'features', 'spirits'],
    defaultNS: 'common',

    // Backend options for loading translations
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    // Interpolation options
    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // React options
    react: {
      useSuspense: false, // Set to false to avoid loading states
    },

    // Debug mode
    debug: false,
  });

export default i18n;
