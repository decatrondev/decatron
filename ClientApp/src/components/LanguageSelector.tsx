import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import type { Language } from '../types/language';

interface LanguageSelectorProps {
  variant?: 'dropdown' | 'radio';
  showLabel?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'radio',
  showLabel = true,
}) => {
  const { t } = useTranslation('settings');
  const { currentLanguage, changeLanguage, isLoading } = useLanguage();
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState(false);

  const languages: Array<{ code: Language; label: string; flag: string }> = [
    { code: 'es', label: t('language.spanish'), flag: '🇪🇸' },
    { code: 'en', label: t('language.english'), flag: '🇬🇧' },
  ];

  const handleLanguageChange = async (newLanguage: Language) => {
    if (newLanguage === currentLanguage) return;

    setLocalError(null);
    setLocalSuccess(false);

    try {
      await changeLanguage(newLanguage);
      setLocalSuccess(true);
      setTimeout(() => setLocalSuccess(false), 3000);
    } catch (error) {
      setLocalError(t('language.changeError'));
      setTimeout(() => setLocalError(null), 5000);
    }
  };

  if (variant === 'dropdown') {
    return (
      <div className="space-y-2">
        {showLabel && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('language.label')}
          </label>
        )}
        <select
          value={currentLanguage || 'es'}
          onChange={(e) => handleLanguageChange(e.target.value as Language)}
          disabled={isLoading}
          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.label}
            </option>
          ))}
        </select>
        {isLoading && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('language.updating')}</p>
        )}
        {localSuccess && (
          <p className="text-sm text-green-600 dark:text-green-400">{t('language.changeSuccess')}</p>
        )}
        {localError && (
          <p className="text-sm text-red-600 dark:text-red-400">{localError}</p>
        )}
      </div>
    );
  }

  // Radio button variant (default)
  return (
    <div className="space-y-3">
      {showLabel && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('language.label')}
        </label>
      )}
      <div className="space-y-2">
        {languages.map((lang) => (
          <div key={lang.code} className="flex items-center">
            <input
              type="radio"
              id={`lang-${lang.code}`}
              name="language"
              value={lang.code}
              checked={currentLanguage === lang.code}
              onChange={() => handleLanguageChange(lang.code)}
              disabled={isLoading}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <label
              htmlFor={`lang-${lang.code}`}
              className="ml-3 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
            >
              <span className="text-xl">{lang.flag}</span>
              <span>{lang.label}</span>
              {currentLanguage === lang.code && (
                <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                  ({t('language.currentLanguage')})
                </span>
              )}
            </label>
          </div>
        ))}
      </div>
      {isLoading && (
        <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
          {t('language.updating')}
        </p>
      )}
      {localSuccess && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-3">
          <p className="text-sm text-green-800 dark:text-green-200">{t('language.changeSuccess')}</p>
        </div>
      )}
      {localError && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
          <p className="text-sm text-red-800 dark:text-red-200">{localError}</p>
        </div>
      )}
    </div>
  );
};
