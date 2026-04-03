import type { WelcomeSettings, GoodbyeSettings, WelcomeConfig, MessageVariable } from '../types';

// ============================================
// TEMPLATES DE MENSAJES
// ============================================

export const WELCOME_MESSAGE_TEMPLATES = [
  'Bienvenido {user} a {server}! Eres el miembro #{memberCount}',
  'Hey {user}! Bienvenido a {server} — ya somos {memberCount}!',
  '{user} acaba de unirse! Bienvenido a {server}!',
  'Un nuevo miembro ha llegado! Bienvenido {user} a nuestra comunidad!',
  '{user} ha entrado al servidor. Somos {memberCount} miembros!',
];

export const GOODBYE_MESSAGE_TEMPLATES = [
  '{user} se fue del servidor. Eramos {memberCount}.',
  '{user} nos ha dejado. Quedamos {memberCount} miembros.',
  'Adios {user}! Esperamos verte pronto.',
  '{user} ha abandonado {server}. Somos {memberCount}.',
];

export const DM_MESSAGE_TEMPLATES = [
  'Bienvenido a {server}! Esperamos que disfrutes tu estadia.',
  'Hey {user}! Gracias por unirte a {server}. Revisa nuestras reglas y pasa un buen rato!',
  'Bienvenido a {server}! Si tienes preguntas no dudes en preguntar.',
];

// ============================================
// VARIABLES DISPONIBLES
// ============================================

export const MESSAGE_VARIABLES: MessageVariable[] = [
  { key: '{user}', label: 'Nombre del usuario', example: 'AnthonyDeca' },
  { key: '{username}', label: 'Username (sin formato)', example: 'anthonydeca' },
  { key: '{server}', label: 'Nombre del servidor', example: 'Mi Servidor' },
  { key: '{memberCount}', label: 'Total de miembros', example: '1,234' },
];

// ============================================
// COLORES PRESET
// ============================================

export const WELCOME_COLOR_PRESETS = [
  { color: '#22c55e', label: 'Verde' },
  { color: '#2563eb', label: 'Azul' },
  { color: '#f59e0b', label: 'Amarillo' },
  { color: '#ec4899', label: 'Rosa' },
  { color: '#8b5cf6', label: 'Morado' },
  { color: '#06b6d4', label: 'Cyan' },
  { color: '#ff0000', label: 'Rojo' },
  { color: '#ffffff', label: 'Blanco' },
];

export const GOODBYE_COLOR_PRESETS = [
  { color: '#64748b', label: 'Gris' },
  { color: '#ef4444', label: 'Rojo' },
  { color: '#2563eb', label: 'Azul' },
  { color: '#f59e0b', label: 'Amarillo' },
  { color: '#6b7280', label: 'Gris oscuro' },
  { color: '#8b5cf6', label: 'Morado' },
];

// ============================================
// VALORES POR DEFECTO
// ============================================

export const DEFAULT_TEMPLATE_IMAGE = '/system-files/images/welcome-templates/gaming-neon.png';

export const DEFAULT_WELCOME_SETTINGS: WelcomeSettings = {
  enabled: false,
  channelId: null,
  message: WELCOME_MESSAGE_TEMPLATES[0],
  embedColor: '#22c55e',
  imageMode: 'custom',
  imageUrl: DEFAULT_TEMPLATE_IMAGE,
  showAvatar: true,
  autoRoleId: null,
  dmEnabled: false,
  dmMessage: 'Bienvenido a {server}! Esperamos que disfrutes tu estadia.',
  mentionUser: true,
};

export const DEFAULT_GOODBYE_SETTINGS: GoodbyeSettings = {
  enabled: false,
  channelId: null,
  message: GOODBYE_MESSAGE_TEMPLATES[0],
  embedColor: '#64748b',
  imageMode: 'custom',
  imageUrl: DEFAULT_TEMPLATE_IMAGE,
  showAvatar: true,
};

export const DEFAULT_WELCOME_CONFIG: WelcomeConfig = {
  welcome: { ...DEFAULT_WELCOME_SETTINGS },
  goodbye: { ...DEFAULT_GOODBYE_SETTINGS },
};

// ============================================
// TABS
// ============================================

export const WELCOME_TABS = [
  { id: 'welcome' as const, label: 'Bienvenida', icon: '👋' },
  { id: 'goodbye' as const, label: 'Despedida', icon: '💨' },
  { id: 'editor' as const, label: 'Editor Visual', icon: '🎨' },
  { id: 'testing' as const, label: 'Pruebas', icon: '🧪' },
];
