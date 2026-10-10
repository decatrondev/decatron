import { Gamepad2, Ban, BarChart3, Clock, Download, FlaskConical, Flag, ListMusic, Music, PartyPopper, Scale, TrafficCone, Timer, Zap, Bell, BookOpen, Dices, Eye, Megaphone, Target, TrendingUp, Wrench, Bot, Clapperboard, ClipboardList, FolderOpen, Gift, Image, MessageCircle, MessagesSquare, Monitor, Palette, Plug, Settings, Shield, Shuffle, Smile, Sparkles, Type, Upload, type LucideIcon } from 'lucide-react';

// Las pestañas de las pantallas de overlays guardan un emoji como identificador del icono. Aquí se dibuja el icono
// de la librería (hereda el color del texto de la pestaña) en vez del emoji a color. Un emoji sin pareja se muestra tal cual.
const ICONS: Record<string, LucideIcon> = {
    '📚': BookOpen, '⚙️': Settings, '🫧': MessageCircle, '💬': MessagesSquare, '🔀': Shuffle, '😀': Smile, '🛡️': Shield,
    '🎨': Palette, '🔤': Type, '✨': Sparkles, '🖥️': Monitor, '🎁': Gift, '📁': FolderOpen, '🔌': Plug, '🖼️': Image,
    '🎬': Clapperboard, '📊': BarChart3, '👁️': Eye, '🔔': Bell, '📢': Megaphone, '🎯': Target, '🎲': Dices, '🔧': Wrench, '📈': TrendingUp, '⚡': Zap, '🎮': Gamepad2, '🏁': Flag, '⏱️': Timer, '🕒': Clock, '🎵': Music, '🚦': TrafficCone, '⛔': Ban, '🎶': ListMusic, '⬇️': Download, '⚖️': Scale, '🧪': FlaskConical, '🎉': PartyPopper, '🤖': Bot, '⬆️': Upload, '📋': ClipboardList,
};

export default function TabIcon({ emoji }: { emoji: string }) {
    const Icon = ICONS[emoji];
    return Icon ? <Icon className="inline w-4 h-4 -mt-0.5 mr-1.5" aria-hidden /> : <>{emoji} </>;
}
