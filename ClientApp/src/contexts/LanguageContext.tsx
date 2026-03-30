import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Language, LanguageContextType } from '../types/language';
import { getUserLanguage, updateUserLanguage } from '../services/languageService';
import { SUPPORTED_LANGUAGE_CODES, DEFAULT_LANGUAGE } from '../i18n/languages';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState<Language | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch user's preferred language from the backend
   */
  const refreshLanguage = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // User not logged in
        // Use last known language from localStorage, or browser language as fallback
        const lastLanguage = localStorage.getItem('lastLanguage') as Language | null;
        const browserLang = navigator.language.split('-')[0];
        const lang = lastLanguage || (SUPPORTED_LANGUAGE_CODES.includes(browserLang) ? browserLang : DEFAULT_LANGUAGE);
        setCurrentLanguage(lang);
        await i18n.changeLanguage(lang);
        return;
      }

      // Clear any i18next localStorage to prevent conflicts
      // The database is the single source of truth for logged-in users
      localStorage.removeItem('i18nextLng');

      const response = await getUserLanguage();
      const lang = (response.language || DEFAULT_LANGUAGE) as Language;

      // Store last language for when user logs out
      localStorage.setItem('lastLanguage', lang);

      setCurrentLanguage(lang);
      await i18n.changeLanguage(lang);
    } catch (err) {
      console.error('Error fetching user language:', err);
      // Fallback to last known or Spanish on error
      const lastLanguage = localStorage.getItem('lastLanguage') as Language | null;
      const fallbackLang = lastLanguage || DEFAULT_LANGUAGE;
      setCurrentLanguage(fallbackLang);
      await i18n.changeLanguage(fallbackLang);
    }
  }, [i18n]);

  /**
   * Change the user's preferred language
   */
  const changeLanguage = useCallback(async (newLanguage: Language) => {
    setIsLoading(true);
    setError(null);

    try {
      // Update in backend (this is the source of truth)
      await updateUserLanguage(newLanguage);

      // Store last language for persistence across logout/login
      localStorage.setItem('lastLanguage', newLanguage);

      // Update in i18next
      await i18n.changeLanguage(newLanguage);

      // Update local state
      setCurrentLanguage(newLanguage);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error changing language:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [i18n]);

  /**
   * Initialize language on mount
   */
  useEffect(() => {
    refreshLanguage();
  }, [refreshLanguage]);

  const value: LanguageContextType = {
    currentLanguage,
    isLoading,
    error,
    changeLanguage,
    refreshLanguage,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

/**
 * Hook to use the language context
 */
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
