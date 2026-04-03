import { useState, useCallback, useRef } from 'react';
import type { WelcomeSettings, GoodbyeSettings, WelcomeConfig, WelcomeConfigApi, EditorLayout } from '../types';
import { DEFAULT_WELCOME_SETTINGS, DEFAULT_GOODBYE_SETTINGS, DEFAULT_TEMPLATE_IMAGE } from '../constants/defaults';

// Funcion pura: convierte formato interno → formato API (flat)
function configToApi(welcome: WelcomeSettings, goodbye: GoodbyeSettings): WelcomeConfigApi {
  return {
    welcomeEnabled: welcome.enabled,
    welcomeChannelId: welcome.channelId,
    welcomeMessage: welcome.message,
    welcomeEmbedColor: welcome.embedColor,
    welcomeImageMode: welcome.imageMode,
    welcomeImageUrl: welcome.imageUrl,
    welcomeShowAvatar: welcome.showAvatar,
    welcomeAutoRoleId: welcome.autoRoleId,
    welcomeDmEnabled: welcome.dmEnabled,
    welcomeDmMessage: welcome.dmMessage,
    welcomeMentionUser: welcome.mentionUser,
    goodbyeEnabled: goodbye.enabled,
    goodbyeChannelId: goodbye.channelId,
    goodbyeMessage: goodbye.message,
    goodbyeEmbedColor: goodbye.embedColor,
    goodbyeImageMode: goodbye.imageMode,
    goodbyeImageUrl: goodbye.imageUrl,
    goodbyeShowAvatar: goodbye.showAvatar,
  };
}

export const useWelcomeConfig = () => {
  const [welcomeConfig, setWelcomeConfig] = useState<WelcomeSettings>({ ...DEFAULT_WELCOME_SETTINGS });
  const [goodbyeConfig, setGoodbyeConfig] = useState<GoodbyeSettings>({ ...DEFAULT_GOODBYE_SETTINGS });
  const [editorLayout, setEditorLayout] = useState<EditorLayout | null>(null);
  const [welcomeGeneratedImage, setWelcomeGeneratedImage] = useState<string | null>(null);
  const [goodbyeGeneratedImage, setGoodbyeGeneratedImage] = useState<string | null>(null);

  // Refs para siempre tener la version mas reciente (evita stale closures)
  const welcomeRef = useRef(welcomeConfig);
  const goodbyeRef = useRef(goodbyeConfig);
  const editorLayoutRef = useRef(editorLayout);
  const welcomeGenRef = useRef(welcomeGeneratedImage);
  const goodbyeGenRef = useRef(goodbyeGeneratedImage);
  welcomeRef.current = welcomeConfig;
  goodbyeRef.current = goodbyeConfig;
  editorLayoutRef.current = editorLayout;
  welcomeGenRef.current = welcomeGeneratedImage;
  goodbyeGenRef.current = goodbyeGeneratedImage;

  const updateWelcomeConfig = useCallback((updates: Partial<WelcomeSettings>) => {
    setWelcomeConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const updateGoodbyeConfig = useCallback((updates: Partial<GoodbyeSettings>) => {
    setGoodbyeConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const getCompleteConfig = useCallback((): WelcomeConfig => ({
    welcome: welcomeRef.current,
    goodbye: goodbyeRef.current,
  }), []);

  const updateEditorLayout = useCallback((layout: EditorLayout) => {
    setEditorLayout(layout);
  }, []);

  // Usa refs para SIEMPRE devolver datos actuales, sin importar closures
  const toApiFormat = useCallback((): WelcomeConfigApi => {
    const api = configToApi(welcomeRef.current, goodbyeRef.current);
    api.editorLayout = editorLayoutRef.current ? JSON.stringify(editorLayoutRef.current) : null;
    api.welcomeGeneratedImage = welcomeGenRef.current;
    api.goodbyeGeneratedImage = goodbyeGenRef.current;
    return api;
  }, []);

  const loadConfig = useCallback((apiConfig: Partial<WelcomeConfigApi>) => {
    // Si no tiene imagen configurada, usar template por defecto
    const wImageUrl = apiConfig.welcomeImageUrl || DEFAULT_TEMPLATE_IMAGE;
    const wImageMode = apiConfig.welcomeImageUrl ? (apiConfig.welcomeImageMode as WelcomeSettings['imageMode']) ?? 'custom' : 'custom';
    const gImageUrl = apiConfig.goodbyeImageUrl || DEFAULT_TEMPLATE_IMAGE;
    const gImageMode = apiConfig.goodbyeImageUrl ? (apiConfig.goodbyeImageMode as GoodbyeSettings['imageMode']) ?? 'custom' : 'custom';

    setWelcomeConfig({
      enabled: apiConfig.welcomeEnabled ?? DEFAULT_WELCOME_SETTINGS.enabled,
      channelId: apiConfig.welcomeChannelId ?? DEFAULT_WELCOME_SETTINGS.channelId,
      message: apiConfig.welcomeMessage ?? DEFAULT_WELCOME_SETTINGS.message,
      embedColor: apiConfig.welcomeEmbedColor ?? DEFAULT_WELCOME_SETTINGS.embedColor,
      imageMode: wImageMode,
      imageUrl: wImageUrl,
      showAvatar: apiConfig.welcomeShowAvatar ?? DEFAULT_WELCOME_SETTINGS.showAvatar,
      autoRoleId: apiConfig.welcomeAutoRoleId ?? DEFAULT_WELCOME_SETTINGS.autoRoleId,
      dmEnabled: apiConfig.welcomeDmEnabled ?? DEFAULT_WELCOME_SETTINGS.dmEnabled,
      dmMessage: apiConfig.welcomeDmMessage ?? DEFAULT_WELCOME_SETTINGS.dmMessage,
      mentionUser: apiConfig.welcomeMentionUser ?? DEFAULT_WELCOME_SETTINGS.mentionUser,
    });

    setGoodbyeConfig({
      enabled: apiConfig.goodbyeEnabled ?? DEFAULT_GOODBYE_SETTINGS.enabled,
      channelId: apiConfig.goodbyeChannelId ?? DEFAULT_GOODBYE_SETTINGS.channelId,
      message: apiConfig.goodbyeMessage ?? DEFAULT_GOODBYE_SETTINGS.message,
      embedColor: apiConfig.goodbyeEmbedColor ?? DEFAULT_GOODBYE_SETTINGS.embedColor,
      imageMode: gImageMode,
      imageUrl: gImageUrl,
      showAvatar: apiConfig.goodbyeShowAvatar ?? DEFAULT_GOODBYE_SETTINGS.showAvatar,
    });

    // Cargar layout del editor
    if (apiConfig.editorLayout) {
      try {
        setEditorLayout(JSON.parse(apiConfig.editorLayout));
      } catch { /* ignore invalid JSON */ }
    }

    // Cargar imagenes generadas (string vacio = sin imagen)
    setWelcomeGeneratedImage(apiConfig.welcomeGeneratedImage || null);
    setGoodbyeGeneratedImage(apiConfig.goodbyeGeneratedImage || null);
  }, []);

  const resetToDefaults = useCallback(() => {
    setWelcomeConfig({ ...DEFAULT_WELCOME_SETTINGS });
    setGoodbyeConfig({ ...DEFAULT_GOODBYE_SETTINGS });
  }, []);

  return {
    welcomeConfig,
    goodbyeConfig,
    editorLayout,
    welcomeGeneratedImage,
    goodbyeGeneratedImage,
    updateWelcomeConfig,
    updateGoodbyeConfig,
    updateEditorLayout,
    setWelcomeGeneratedImage,
    setGoodbyeGeneratedImage,
    getCompleteConfig,
    toApiFormat,
    loadConfig,
    resetToDefaults,
  };
};
