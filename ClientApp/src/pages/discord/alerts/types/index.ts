export interface LinkedGuild { id: number; guildId: string; guildName: string; guildIcon: string | null; }
export interface DiscordChannel { id: string; name: string; }
export interface LiveAlert {
  id: number; channelName: string; discordChannelId: string; discordChannelName: string;
  customMessage: string | null; mentionEveryone: boolean; enabled: boolean; isOwnChannel: boolean;
  thumbnailMode: string; staticThumbnailUrl: string | null;
  embedColor: string; footerText: string | null; showButton: boolean; showStartTime: boolean;
  sendMode: string; delayMinutes: number;
  updateIntervalMinutes: number; onOfflineAction: string;
}
export interface ChannelStatus {
  channelName: string; displayName: string; profileImage: string;
  isLive: boolean; game: string | null; viewers: number; thumbnail: string | null;
}
export interface SearchResult {
  login: string; displayName: string; profileImage: string;
  isLive: boolean; game: string | null; viewers: number; title: string | null; thumbnail: string | null;
}
export interface BotStatus { connected: boolean; linkedCount: number; botUser: string; }
