import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';

// Supported languages
export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// Default language
export const DEFAULT_LANGUAGE: SupportedLanguage = 'es';

// Initialize i18next
i18n
  .use(HttpBackend) // Load translations from /public/locales
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    // Language settings
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,

    // IMPORTANT: Do not initialize with a specific language
    // We will set it programmatically from the backend
    lng: undefined,

    // Namespaces (translation files)
    ns: ['common', 'settings', 'layout', 'dashboard', 'overlays', 'commands', 'analytics'],
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
