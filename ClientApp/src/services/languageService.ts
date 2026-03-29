import api from './api';
import type {
  Language,
  LanguageResponse,
  UpdateLanguageRequest,
  UpdateLanguageResponse,
} from '../types/language';

/**
 * Get the current user's preferred language
 */
export const getUserLanguage = async (): Promise<LanguageResponse> => {
  try {
    const response = await api.get<LanguageResponse>('/language');
    return response.data;
  } catch (error) {
    console.error('Error fetching user language:', error);
    throw error;
  }
};

/**
 * Update the current user's preferred language
 */
export const updateUserLanguage = async (language: Language): Promise<UpdateLanguageResponse> => {
  try {
    const request: UpdateLanguageRequest = { language };
    const response = await api.put<UpdateLanguageResponse>('/language', request);
    return response.data;
  } catch (error) {
    console.error('Error updating user language:', error);
    throw error;
  }
};

/**
 * Get the list of supported languages
 */
export const getSupportedLanguages = async (): Promise<string[]> => {
  try {
    const response = await api.get<string[]>('/language/supported');
    return response.data;
  } catch (error) {
    console.error('Error fetching supported languages:', error);
    return ['es', 'en']; // Fallback
  }
};
