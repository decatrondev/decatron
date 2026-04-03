export type LevelsTabType = 'general' | 'levels' | 'roles' | 'achievements' | 'store' | 'seasonal' | 'rankcard' | 'moderation' | 'testing';

export interface LevelsConfig {
  enabled: boolean;
  difficultyPreset: string;
  customMultiplier: number;
  xpMin: number;
  xpMax: number;
  cooldownSeconds: number;
  maxXpPerHour: number;
  minMessageLength: number;
  excludedChannels: string[];
  nightModeEnabled: boolean;
  nightModeMultiplier: number;
  levelupChannelId: string | null;
  achievementChannelId: string | null;
}

export interface XpRole {
  id: number;
  levelRequired: number;
  roleName: string;
  roleColor: string;
  discordRoleId: string | null;
  position: number;
  createdInDiscord: boolean;
}

export interface XpBoost {
  id: number;
  multiplier: number;
  activatedByUsername: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  isExpired: boolean;
}

export interface XpUser {
  userId: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  totalMessages: number;
  streakDays: number;
  lastXpAt: string | null;
}

export interface LevelsStats {
  totalUsers: number;
  avgLevel: number;
  totalMessages: number;
}

export interface ActiveBoost {
  multiplier: number;
  activatedByUsername: string;
  startsAt: string;
  expiresAt: string;
}

export interface LinkedGuild {
  id: number;
  guildId: string;
  guildName: string;
  guildIcon: string | null;
}

export interface DiscordChannel {
  id: string;
  name: string;
}
