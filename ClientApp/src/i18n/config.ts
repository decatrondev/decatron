import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import { SUPPORTED_LANGUAGE_CODES, DEFAULT_LANGUAGE } from './languages';

// Re-export for backward compatibility
export const SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGE_CODES;
export type SupportedLanguage = string;

// Initialize i18next
i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGE_CODES,

    // IMPORTANT: Do not initialize with a specific language
    // We will set it programmatically from the backend
    lng: undefined,

    // Namespaces (translation files)
    ns: ['common', 'settings', 'layout', 'dashboard', 'overlays', 'commands', 'analytics', 'login', 'landing', 'supporters', 'tips', 'features'],
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
