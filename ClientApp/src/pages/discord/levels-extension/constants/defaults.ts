import type { LevelsConfig, LevelsTabType } from '../types';

export const DEFAULT_LEVELS_CONFIG: LevelsConfig = {
  enabled: true,
  difficultyPreset: 'normal',
  customMultiplier: 1.0,
  xpMin: 15,
  xpMax: 25,
  cooldownSeconds: 60,
  maxXpPerHour: 500,
  minMessageLength: 5,
  excludedChannels: [],
  nightModeEnabled: false,
  nightModeMultiplier: 1.5,
  levelupChannelId: null,
  achievementChannelId: null,
};

export const DIFFICULTY_PRESETS = [
  { value: 'easy', label: 'Facil — Suben rapido (30% menos XP requerido)', multiplier: 0.7 },
  { value: 'normal', label: 'Normal — Equilibrado', multiplier: 1.0 },
  { value: 'hard', label: 'Dificil — Suben lento (50% mas XP requerido)', multiplier: 1.5 },
  { value: 'hardcore', label: 'Hardcore — Muy lento (doble XP requerido)', multiplier: 2.0 },
];

export const LEVELS_TABS: { id: LevelsTabType; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'levels', label: 'Niveles', icon: '📊' },
  { id: 'roles', label: 'Roles', icon: '🎭' },
  { id: 'achievements', label: 'Achievements', icon: '🏆' },
  { id: 'store', label: 'Store', icon: '🛒' },
  { id: 'seasonal', label: 'Seasonal', icon: '📅' },
  { id: 'rankcard', label: 'Rank Card', icon: '🎨' },
  { id: 'moderation', label: 'Moderacion', icon: '🔧' },
  { id: 'testing', label: 'Pruebas', icon: '🧪' },
];
