export type Language = 'es' | 'en';

export interface LanguageResponse {
  language: string | null;
}

export interface UpdateLanguageRequest {
  language: string;
}

export interface UpdateLanguageResponse {
  language: string;
  updated: boolean;
}

export interface LanguageContextType {
  currentLanguage: Language | null;
  isLoading: boolean;
  error: string | null;
  changeLanguage: (newLanguage: Language) => Promise<void>;
  refreshLanguage: () => Promise<void>;
}
