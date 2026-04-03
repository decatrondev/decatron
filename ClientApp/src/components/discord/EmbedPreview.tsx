import type { EmbedPreviewProps } from '../../pages/discord/welcome-extension/types';

const SAMPLE_DATA = {
  welcome: { user: 'NuevoUser', username: 'nuevouser', memberCount: '1,234' },
  goodbye: { user: 'ExUser', username: 'exuser', memberCount: '1,233' },
};

function formatMessage(message: string, type: 'welcome' | 'goodbye', guildName: string): string {
  const data = SAMPLE_DATA[type];
  return message
    .replace(/\{user\}/g, data.user)
    .replace(/\{username\}/g, data.username)
    .replace(/\{server\}/g, guildName)
    .replace(/\{memberCount\}/g, data.memberCount);
}

/**
 * EmbedPreview — Replica EXACTAMENTE lo que WelcomeHandler.cs envia a Discord.
 * Estructura: mention (fuera) → embed(color bar + description + image + thumbnail + footer)
 * NO tiene author ni title — solo lo que BuildEmbed() genera.
 */
export default function EmbedPreview({
  message, embedColor, imageMode, imageUrl, showAvatar, guildName, mentionUser, type,
}: EmbedPreviewProps) {
  const formattedMessage = formatMessage(message, type, guildName);
  const sampleUser = SAMPLE_DATA[type];

  return (
    <div className="bg-[#313338] rounded-xl p-3">
      {/* Bot header */}
      <div className="flex gap-2.5 mb-2">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">D</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[#f2f3f5] font-medium text-sm">Decatron</span>
            <span className="bg-[#5865f2] text-white text-[9px] font-bold px-1 py-0.5 rounded">BOT</span>
            <span className="text-[#949ba4] text-[10px]">Hoy a las {new Date().getHours()}:{String(new Date().getMinutes()).padStart(2, '0')}</span>
          </div>

          {/* Mention (fuera del embed, como texto del mensaje) */}
          {mentionUser && (
            <p className="text-[13px] mt-0.5">
              <span className="text-[#dee0fc] bg-[#414675]/60 rounded px-0.5">@{sampleUser.user}</span>
            </p>
          )}

          {/* Embed */}
          <div className="flex rounded-[4px] overflow-hidden mt-1.5 max-w-full">
            {/* Color bar */}
            <div className="w-1 flex-shrink-0" style={{ backgroundColor: embedColor }} />

            {/* Embed body */}
            <div className="bg-[#2b2d31] py-2 px-3 flex-1 min-w-0">
              {/* Description + Thumbnail row */}
              <div className="flex gap-3">
                {/* Description (mensaje) */}
                <div className="flex-1 min-w-0">
                  <p className="text-[#dbdee1] text-[13px] leading-[1.375]">
                    {formattedMessage}
                  </p>
                </div>

                {/* Thumbnail (avatar pequeño, arriba derecha) */}
                {showAvatar && (
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-[80px] h-[80px] rounded-[3px] bg-gradient-to-br from-[#5865f2] to-[#3b82f6] flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">
                        {sampleUser.user.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Image (grande, debajo del texto) */}
              {imageMode === 'custom' && imageUrl && (
                <div className="mt-2 rounded-[3px] overflow-hidden">
                  <img
                    src={imageUrl}
                    alt=""
                    className="w-full max-h-[200px] object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
              {imageMode === 'avatar' && (
                <div className="mt-2 rounded-[3px] overflow-hidden">
                  <div className="w-full h-[120px] bg-[#1e1f22] flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#5865f2] to-[#3b82f6] flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">
                        {sampleUser.user.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-[#3f4147]">
                <span className="text-[#949ba4] text-[11px]">{guildName} • Decatron Bot</span>
                <span className="text-[#4e5058] text-[11px]">•</span>
                <span className="text-[#949ba4] text-[11px]">Hoy a las {new Date().getHours()}:{String(new Date().getMinutes()).padStart(2, '0')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
