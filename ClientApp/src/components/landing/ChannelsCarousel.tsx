import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

interface CarouselChannel {
    id: number;
    platform: 'twitch' | 'kick';
    login: string;
    displayName: string;
    avatarUrl: string;
}

function channelUrl(channel: CarouselChannel) {
    return channel.platform === 'twitch'
        ? `https://twitch.tv/${channel.login}`
        : `https://kick.com/${channel.login}`;
}

function ChannelCard({ channel }: { channel: CarouselChannel }) {
    return (
        <a
            href={channelUrl(channel)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-3 w-36 3xl:w-44 4xl:w-52 shrink-0 rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-5 3xl:p-6 4xl:p-7 hover:border-[#2563eb] hover:-translate-y-1 transition-all"
        >
            <img
                src={channel.avatarUrl}
                alt={channel.displayName}
                className="w-16 h-16 3xl:w-20 3xl:h-20 4xl:w-24 4xl:h-24 rounded-full object-cover"
                loading="lazy"
            />
            <p className="font-bold text-sm 3xl:text-base 4xl:text-lg text-[#1e293b] dark:text-[#f8fafc] truncate w-full text-center">
                {channel.displayName}
            </p>
            <span
                className={`text-[10px] 3xl:text-xs font-black uppercase tracking-wide px-2 py-0.5 3xl:px-2.5 3xl:py-1 rounded-full ${
                    channel.platform === 'twitch' ? 'bg-twitch text-white' : 'bg-kick text-black'
                }`}
            >
                {channel.platform}
            </span>
        </a>
    );
}

export default function ChannelsCarousel() {
    const { t } = useTranslation('landing');
    const [channels, setChannels] = useState<CarouselChannel[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get<CarouselChannel[]>('/channels/carousel')
            .then(res => setChannels(res.data))
            .catch(() => setChannels([]))
            .finally(() => setLoading(false));
    }, []);

    if (loading || channels.length === 0) return null;

    const track = [...channels, ...channels];

    return (
        <section className="py-16 overflow-hidden bg-white dark:bg-[#1B1C1D]">
            <h2 className="font-display text-3xl 3xl:text-4xl 4xl:text-5xl font-bold mb-10 3xl:mb-14 text-center text-[#1e293b] dark:text-[#f8fafc] px-4">
                <span className="text-[#2563eb]">&gt;</span> {t('channelsCarouselHeading')}
            </h2>
            <div className="flex gap-6 3xl:gap-8 4xl:gap-10 w-max animate-marquee">
                {track.map((channel, i) => (
                    <ChannelCard key={`${channel.platform}-${channel.id}-${i}`} channel={channel} />
                ))}
            </div>
        </section>
    );
}
