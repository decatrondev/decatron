import type { LucideIcon } from 'lucide-react';
import {
    Megaphone, Sparkles, Gift, Star, Heart, Bell, Music, Trophy, Gamepad2, MessageSquare,
    Users, Zap, Tv, Link as LinkIcon, QrCode, Clapperboard, Mic, Languages, ShieldCheck, Coins,
} from 'lucide-react';

/** Los iconos que puede llevar una pieza. Es la misma lista que valida el servidor (PromoValidator.Icons). */
export const PROMO_ICONS: Record<string, LucideIcon> = {
    megaphone: Megaphone, sparkles: Sparkles, gift: Gift, star: Star, heart: Heart, bell: Bell, music: Music, trophy: Trophy,
    'gamepad-2': Gamepad2, 'message-square': MessageSquare, users: Users, zap: Zap, tv: Tv, link: LinkIcon, 'qr-code': QrCode,
    clapperboard: Clapperboard, mic: Mic, languages: Languages, 'shield-check': ShieldCheck, coins: Coins,
};
