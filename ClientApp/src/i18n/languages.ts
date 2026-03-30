/**
 * Language Registry — Single source of truth for available languages.
 * To add a new language:
 * 1. Create translation JSON files in /public/locales/{code}/
 * 2. Add an entry here with code, label, and flag
 * 3. That's it — the app detects it automatically
 */

export interface LanguageEntry {
  code: string;
  label: string;
  nativeLabel: string;
  flag: string;
}

export const AVAILABLE_LANGUAGES: LanguageEntry[] = [
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  // To add a new language, just add it here and create the locale files:
  // { code: 'pt', label: 'Portuguese', nativeLabel: 'Português', flag: '🇧🇷' },
  // { code: 'jp', label: 'Japanese', nativeLabel: '日本語', flag: '🇯🇵' },
  // { code: 'fr', label: 'French', nativeLabel: 'Français', flag: '🇫🇷' },
  // { code: 'de', label: 'German', nativeLabel: 'Deutsch', flag: '🇩🇪' },
  // { code: 'ko', label: 'Korean', nativeLabel: '한국어', flag: '🇰🇷' },
];

export const DEFAULT_LANGUAGE = 'es';

export const SUPPORTED_LANGUAGE_CODES = AVAILABLE_LANGUAGES.map(l => l.code);

export function getLanguageEntry(code: string): LanguageEntry | undefined {
  return AVAILABLE_LANGUAGES.find(l => l.code === code);
}
