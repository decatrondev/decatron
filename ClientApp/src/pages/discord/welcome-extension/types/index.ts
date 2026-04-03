// ============================================
// TIPOS PARA SISTEMA DE WELCOME/GOODBYE DISCORD
// ============================================

// Modos de imagen para el embed
export type ImageMode = 'avatar' | 'custom' | 'none';

// Tipo de mensaje (welcome o goodbye)
export type MessageType = 'welcome' | 'goodbye';

// Tab activo
export type WelcomeTabType = 'welcome' | 'goodbye' | 'editor' | 'testing';

// ============================================
// CONFIGURACION DE WELCOME
// ============================================

export interface WelcomeSettings {
  enabled: boolean;
  channelId: string | null;
  message: string;
  embedColor: string;
  imageMode: ImageMode;
  imageUrl: string | null;
  showAvatar: boolean;
  autoRoleId: string | null;
  dmEnabled: boolean;
  dmMessage: string | null;
  mentionUser: boolean;
}

// ============================================
// CONFIGURACION DE GOODBYE
// ============================================

export interface GoodbyeSettings {
  enabled: boolean;
  channelId: string | null;
  message: string;
  embedColor: string;
  imageMode: ImageMode;
  imageUrl: string | null;
  showAvatar: boolean;
}

// ============================================
// CONFIGURACION COMPLETA
// ============================================

export interface WelcomeConfig {
  welcome: WelcomeSettings;
  goodbye: GoodbyeSettings;
}

// ============================================
// DATOS DEL SERVIDOR
// ============================================

export interface DiscordChannel {
  id: string;
  name: string;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: string;
}

export interface LinkedGuild {
  id: number;
  guildId: string;
  guildName: string;
  guildIcon: string | null;
}

// ============================================
// PROPS DE COMPONENTES
// ============================================

export interface WelcomeTabProps {
  config: WelcomeSettings;
  onConfigChange: (updates: Partial<WelcomeSettings>) => void;
  channels: DiscordChannel[];
  roles: DiscordRole[];
  guildName: string;
}

export interface GoodbyeTabProps {
  config: GoodbyeSettings;
  onConfigChange: (updates: Partial<GoodbyeSettings>) => void;
  channels: DiscordChannel[];
  guildName: string;
}

export interface TestingTabProps {
  welcomeEnabled: boolean;
  goodbyeEnabled: boolean;
  welcomeChannelId: string | null;
  goodbyeChannelId: string | null;
  guildId: string;
  guildName: string;
}

export interface EmbedPreviewProps {
  message: string;
  embedColor: string;
  imageMode: ImageMode;
  imageUrl: string | null;
  showAvatar: boolean;
  guildName: string;
  mentionUser?: boolean;
  type: MessageType;
}

// ============================================
// VARIABLES DISPONIBLES
// ============================================

export interface MessageVariable {
  key: string;
  label: string;
  example: string;
}

// ============================================
// FORMATO API (flat, como lo espera el backend)
// ============================================

// Posiciones de elementos en el editor visual
export interface EditorElementLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  enabled: boolean;
}

export interface EditorLayout {
  elements: Record<string, EditorElementLayout>;
}

export interface WelcomeConfigApi {
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string;
  welcomeEmbedColor: string;
  welcomeImageMode: string;
  welcomeImageUrl: string | null;
  welcomeShowAvatar: boolean;
  welcomeAutoRoleId: string | null;
  welcomeDmEnabled: boolean;
  welcomeDmMessage: string | null;
  welcomeMentionUser: boolean;
  goodbyeEnabled: boolean;
  goodbyeChannelId: string | null;
  goodbyeMessage: string;
  goodbyeEmbedColor: string;
  goodbyeImageMode: string;
  goodbyeImageUrl: string | null;
  goodbyeShowAvatar: boolean;
  editorLayout?: string | null;
  welcomeGeneratedImage?: string | null;
  goodbyeGeneratedImage?: string | null;
}
