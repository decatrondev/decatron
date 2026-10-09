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
            className="flex flex-col items-center gap-3 w-36 3xl:w-44 4xl:w-52 shrink-0 rounded-lg border border-[#e2e8f0] dark:border-pub-border bg-white dark:bg-pub-surface p-5 3xl:p-6 4xl:p-7 hover:border-[#2563eb] hover:-translate-y-1 transition-all"
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
        <section className="relative z-10 py-20 overflow-hidden border-t border-pub-border">
            <h2 className="font-extrabold tracking-tight text-3xl 3xl:text-4xl 4xl:text-5xl mb-10 3xl:mb-14 max-w-7xl 3xl:max-w-[1600px] mx-auto px-5 sm:px-8 text-[#1e293b] dark:text-white">
                {t('channelsCarouselHeading')}
            </h2>
            <div className="flex gap-6 3xl:gap-8 4xl:gap-10 w-max animate-marquee">
                {track.map((channel, i) => (
                    <ChannelCard key={`${channel.platform}-${channel.id}-${i}`} channel={channel} />
                ))}
            </div>
        </section>
    );
}
