import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import decatronLockup from './assets/decatron-lockup.png';
import ThemeToggle from './components/ThemeToggle';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import SafeRoute from './components/SafeRoute';
import Index from './pages/Index';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import CommandsHub from './pages/commands/CommandsHub';
import DefaultCommands from './pages/commands/DefaultCommands';
import MicroCommands from './pages/commands/MicroCommands';
import CustomCommands from './pages/commands/CustomCommands';
import ScriptingList from './pages/commands/ScriptingList';
import ScriptingEditor from './pages/commands/ScriptingEditor';
import WatchtimeConfig from './pages/commands/WatchtimeConfig';
import RuletaConfig from './pages/commands/RuletaConfig';
import PublicCommandsConfig from './pages/commands/PublicCommandsConfig';
import FeaturesHub from './pages/features/FeaturesHub';
import ModerationHub from './pages/features/ModerationHub';
import Timers from './pages/features/Timers';
import Overlays from './pages/features/Overlays';
import ShoutoutConfig from './pages/features/ShoutoutConfig';
import TimerConfig from './pages/features/TimerConfig';
import GiveawayConfig from './pages/features/GiveawayConfig';
import GoalsConfig from './pages/features/GoalsConfig';
import EventAlertsConfig from './pages/features/EventAlertsConfig';
import BannedWords from './pages/features/moderation/BannedWords';
import LinksFilter from './pages/features/moderation/LinksFilter';
import ModerationCommands from './pages/features/moderation/ModerationCommands';
import SpamFilters from './pages/features/moderation/SpamFilters';
import RaidProtection from './pages/features/moderation/RaidProtection';
import ModerationHistory from './pages/features/moderation/ModerationHistory';
import BotList from './pages/features/BotList';
import ChatOverlay from './pages/ChatOverlay';
import ChannelEmotes from './pages/features/ChannelEmotes';
import ChannelEmotesPublic from './pages/ChannelEmotesPublic';
import ChatOverlayConfig from './pages/features/ChatOverlayConfig';
import SoundAlerts from './pages/features/SoundAlerts';
import DecatronAIConfig from './pages/features/DecatronAIConfig';
import LiveTranslationConfig from './pages/features/LiveTranslationConfig';
import LolCoachConfig from './pages/features/LolCoachConfig';
import DecatronChat from './pages/features/DecatronChat';
import TipsConfig from './pages/features/TipsConfig';
import AdminHub from './pages/admin/AdminHub';
import AdminEconomy from './pages/admin/AdminEconomy';
import AdminTcg from './pages/admin/AdminTcg';
import AdminTcgArtQueue from './pages/admin/AdminTcgArtQueue';
import DecatronAIAdmin from './pages/admin/DecatronAIAdmin';
import DecatronChatAdmin from './pages/admin/DecatronChatAdmin';
import AdminDonations from './pages/admin/Donations/index';
import Finance from './pages/admin/Finance';
import EmailManagement from './pages/admin/EmailManagement/index';
import DevDocs from './pages/admin/DevDocs';
import TtsLab from './pages/admin/TtsLab';
import DesignGuide from './pages/admin/DesignGuide';
import TtsCreditsAdmin from './pages/admin/TtsCreditsAdmin';
import LiveTranslationAdmin from './pages/admin/LiveTranslationAdmin';
import AiCostsAdmin from './pages/admin/AiCostsAdmin';
import ProjectAnalysis from './pages/admin/ProjectAnalysis';
import AdminFortnite from './pages/admin/AdminFortnite';
import LogoGuide from './pages/admin/LogoGuide';
import GameOverlayPromosAdmin from './pages/admin/GameOverlayPromosAdmin';
import LiveOverlay from './pages/LiveOverlay';
import LiveOverlays from './pages/features/LiveOverlays';
import SupportersConfig from './pages/admin/SupportersConfig/index';
import ChannelsVisibility from './pages/admin/ChannelsVisibility';
import AdminMods from './pages/admin/AdminMods';
import SupportersPublic from './pages/SupportersPublic';
import Credits from './pages/Credits';
import PublicCommandsPage from './pages/PublicCommandsPage';
import SongRequestPublicPage from './pages/SongRequestPublicPage';
import SongRequestPlaylistPage from './pages/SongRequestPlaylistPage';
import SongRequestOverlay from './pages/SongRequestOverlay';
import SongRequestConfig from './pages/features/SongRequestConfig';
import TranslatePublic from './pages/TranslatePublic';
import TournamentPublicPage from './pages/TournamentPublicPage';
import MyTournamentPage from './pages/tournament-public/MyTournamentPage';
import TournamentOverlayPage from './pages/TournamentOverlayPage';
import TournamentEmbedRankingPage from './pages/TournamentEmbedRankingPage';
import GachaConfig from './pages/features/gacha-extension/GachaConfig';
import TournamentConfig from './pages/features/tournament-extension/TournamentConfig';
import GachaOverlay from './pages/GachaOverlay';
import GameOverlay from './pages/GameOverlay';
import GameOverlayDemo from './pages/GameOverlayDemo';
// three.js solo se carga en las rutas de mascotas
const PetsDemo = lazy(() => import('./pages/PetsDemo'));
const PetsConfig = lazy(() => import('./pages/features/PetsConfig'));
const PetsOverlay = lazy(() => import('./pages/PetsOverlay'));
import WheelOverlay from './pages/WheelOverlay';
import GachaCollection from './pages/GachaCollection';
import GachaRanking from './pages/GachaRanking';
import MeGacha from './pages/me/MeGacha';
import Analytics from './pages/analytics/Analytics';
import Followers from './pages/Followers';
import ShoutoutOverlay from './pages/ShoutoutOverlay';
import SoundAlertsOverlay from './pages/SoundAlertsOverlay';
import TimerOverlay from './pages/TimerOverlay';
import GiveawayOverlay from './pages/GiveawayOverlay';
import GoalsOverlay from './pages/GoalsOverlay';
import EventAlertsOverlay from './pages/EventAlertsOverlay';
import TipsOverlay from './pages/TipsOverlay';
import NowPlayingOverlay from './pages/NowPlayingOverlay';
import SpeakChatOverlay from './pages/SpeakChatOverlay';
import SpeakChat from './pages/features/SpeakChat';
import NowPlayingConfig from './pages/features/NowPlayingConfig';
import GameOverlays from './pages/features/GameOverlays';
import WheelConfig from './pages/features/WheelConfig';
import TipsDonate from './pages/TipsDonate';
import TipsPrivacy from './pages/TipsPrivacy';
import TipsTerms from './pages/TipsTerms';
import DocsLayout from './pages/docs/DocsLayout';
import DocsHome from './pages/docs/DocsHome';
import VariablesDoc from './pages/docs/VariablesDoc';
import DefaultCommandsDoc from './pages/docs/DefaultCommandsDoc';
import CustomCommandsDoc from './pages/docs/CustomCommandsDoc';
import MicrocommandsDoc from './pages/docs/MicrocommandsDoc';
import ScriptingCommandsDoc from './pages/docs/ScriptingCommandsDoc';
import ShoutoutOverlayDoc from './pages/docs/ShoutoutOverlayDoc';
import GachaOverlayDoc from './pages/docs/GachaOverlayDoc';
import { SongRequestDoc } from './pages/docs/SongRequestDoc';
import { WheelDoc } from './pages/docs/WheelDoc';
import { TournamentDoc } from './pages/docs/TournamentDoc';
// Public docs
import About from './pages/docs/public/About';
import GettingStarted from './pages/docs/public/GettingStarted';
import Features from './pages/docs/public/Features';
import FAQ from './pages/docs/public/FAQ';
// Private docs
import PrivateDocsLayout from './pages/docs/private/PrivateDocsLayout';
import DashboardDocsHome from './pages/docs/private/DashboardDocsHome';
import OverlaysGuide from './pages/docs/private/overlays/OverlaysGuide';
import TimerDoc from './pages/docs/private/features/TimerDoc';
import EventAlertsDoc from './pages/docs/private/features/EventAlertsDoc';
import GiveawayDoc from './pages/docs/private/features/GiveawayDoc';
import SoundAlertsDoc from './pages/docs/private/features/SoundAlertsDoc';
import TipsDoc from './pages/docs/private/features/TipsDoc';
import ShoutoutDoc from './pages/docs/private/features/ShoutoutDoc';
import { ModerationDoc } from './pages/docs/private/features/ModerationDoc';
import { TranslationDoc } from './pages/docs/private/features/TranslationDoc';
import { DiscordDoc } from './pages/docs/private/features/DiscordDoc';
import { SpiritsDoc } from './pages/docs/private/features/SpiritsDoc';
import { ChatEmotesDoc } from './pages/docs/private/features/ChatEmotesDoc';
import { SpeakChatDoc } from './pages/docs/private/features/SpeakChatDoc';
import { CreditsDoc } from './pages/docs/private/features/CreditsDoc';
import { PlansDoc } from './pages/docs/private/features/PlansDoc';
import { KickDoc } from './pages/docs/private/features/KickDoc';
import { AccountsDoc } from './pages/docs/private/features/AccountsDoc';
import { CoachDoc } from './pages/docs/private/features/CoachDoc';
import AnalyticsDoc from './pages/docs/private/features/AnalyticsDoc';
import FollowersDoc from './pages/docs/private/features/FollowersDoc';
import AIDoc from './pages/docs/private/features/AIDoc';
import NowPlayingDoc from './pages/docs/private/features/NowPlayingDoc';
import GameOverlaysDoc from './pages/docs/private/features/GameOverlaysDoc';
import LiveOverlayDoc from './pages/docs/private/features/LiveOverlayDoc';
import PetsDoc from './pages/docs/private/features/PetsDoc';
import DecatronChatDoc from './pages/docs/private/features/DecatronChatDoc';
import DeveloperPortalDoc from './pages/docs/private/features/DeveloperPortalDoc';
import GachaDoc from './pages/docs/private/features/GachaDoc';
import SettingsDoc from './pages/docs/private/settings/SettingsDoc';
import { AccountDoc } from './pages/docs/private/settings/AccountDoc';
import { ChatCommandsDoc } from './pages/docs/private/features/ChatCommandsDoc';
import PermissionsDoc from './pages/docs/private/settings/PermissionsDoc';
import GachaLogin from './pages/gacha/GachaLogin';
import GachaTerms from "./pages/gacha/GachaTerms";
import GachaSuccess from './pages/gacha/GachaSuccess';
// Developer Portal & OAuth
import DiscordConfig from './pages/discord/DiscordConfig';
import DiscordAlerts from './pages/discord/DiscordAlerts';
import DiscordWelcome from './pages/discord/DiscordWelcome';
import DiscordLevels from './pages/discord/DiscordLevels';
import DeveloperPortal from './pages/developer/DeveloperPortal';
import ApplicationCreate from './pages/developer/ApplicationCreate';
import ApplicationEdit from './pages/developer/ApplicationEdit';
import ApiReference from './pages/developer/ApiReference';
import OAuthAuthorizePage from './pages/oauth/OAuthAuthorizePage';
import ApiDocs from './pages/docs/public/ApiDocs';
import LegalLayout from './pages/legal/LegalLayout';
import TerminosPage from './pages/legal/TerminosPage';
import PrivacidadPage from './pages/legal/PrivacidadPage';
import DevolucionesPage from './pages/legal/DevolucionesPage';
import LibroReclamacionesPage from './pages/legal/LibroReclamacionesPage';
import MeOverview from './pages/me/MeOverview';
import MeAccount from './pages/me/MeAccount';
import MeCoins from './pages/me/MeCoins';
import TcgHub from './pages/me/tcg/TcgHub';
import TcgShop from './pages/me/tcg/TcgShop';
import TcgOpen from './pages/me/tcg/TcgOpen';
import TcgClaim from './pages/me/tcg/TcgClaim';
import TcgCollection from './pages/me/tcg/TcgCollection';
import TcgCardDetail from './pages/me/tcg/TcgCardDetail';
import TcgDex from './pages/me/tcg/TcgDex';
import TcgStats from './pages/me/tcg/TcgStats';
import MeBilling from './pages/me/MeBilling';
import MeInvoices from './pages/me/MeInvoices';
import SpritesGallery from './pages/SpritesGallery';
import SpiritCollection from './pages/SpiritCollection';
import MySpiritCollection from './pages/me/MySpiritCollection';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './components/ui/Toast';
import './i18n/config'; // Initialize i18next
import { BrandProvider } from './brand/BrandContext';
import { BrandMark } from './brand/BrandMark';
import BrandAdmin from './pages/admin/BrandAdmin';
import GlobalEmotesAdmin from './pages/admin/GlobalEmotesAdmin';
import GlobalEmotesPublic from './pages/GlobalEmotesPublic';
import OverlayAutoUpdate from './components/OverlayAutoUpdate';
import PreviewBanner from './design/PreviewBanner';

function App() {
    return (
        <BrowserRouter>
            <BrandProvider>
            <ToastProvider>
                <PermissionsProvider>
                    <LanguageProvider>
                        <PreviewBanner />
                        <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/translate" element={<><PublicNav /><TranslatePublic /></>} />

                {/* Overlay Routes - No layout for OBS */}
                <Route path="/overlay/chat" element={<SafeRoute name="Chat Overlay"><ChatOverlay /></SafeRoute>} />
                <Route path="/overlay/shoutout" element={<SafeRoute name="Shoutout Overlay"><ShoutoutOverlay /></SafeRoute>} />
                <Route path="/overlay/soundalerts" element={<SafeRoute name="Sound Alerts Overlay"><SoundAlertsOverlay /></SafeRoute>} />
                <Route path="/overlay/timer" element={<SafeRoute name="Timer Overlay"><TimerOverlay /></SafeRoute>} />
                <Route path="/overlay/giveaway" element={<SafeRoute name="Giveaway Overlay"><GiveawayOverlay /></SafeRoute>} />
                <Route path="/overlay/goals" element={<SafeRoute name="Goals Overlay"><GoalsOverlay /></SafeRoute>} />
                <Route path="/overlay/event-alerts" element={<SafeRoute name="Event Alerts Overlay"><EventAlertsOverlay /></SafeRoute>} />
                <Route path="/overlay/pets" element={<SafeRoute name="Pets Overlay"><Suspense fallback={null}><PetsOverlay /></Suspense></SafeRoute>} />
                <Route path="/overlay/tips" element={<SafeRoute name="Tips Overlay"><TipsOverlay /></SafeRoute>} />
                <Route path="/overlay/now-playing" element={<SafeRoute name="Now Playing Overlay"><NowPlayingOverlay /></SafeRoute>} />
                <Route path="/overlay/songrequest" element={<SafeRoute name="Song Request Overlay"><SongRequestOverlay /></SafeRoute>} />
                <Route path="/overlay/speak-chat" element={<SafeRoute name="Speak Chat Overlay"><SpeakChatOverlay /></SafeRoute>} />
                <Route path="/overlay/gacha" element={<SafeRoute name="Gacha Overlay"><GachaOverlay /></SafeRoute>} />
                <Route path="/overlay/rueda" element={<SafeRoute name="Wheel Overlay"><WheelOverlay /></SafeRoute>} />
                <Route path="/overlay/games" element={<SafeRoute name="Game Overlay"><GameOverlay /></SafeRoute>} />
                <Route path="/overlay/live" element={<SafeRoute name="Live Match Overlay"><LiveOverlay /></SafeRoute>} />
                <Route path="/demo/game-overlay" element={<SafeRoute name="Game Overlay Demo"><GameOverlayDemo /></SafeRoute>} />

                {/* Public Gacha Collection - No authentication required */}
                <Route path="/gacha/collection" element={<SafeRoute name="Gacha Collection"><GachaCollection /></SafeRoute>} />
                <Route path="/gacha/ranking" element={<SafeRoute name="Gacha Ranking"><GachaRanking /></SafeRoute>} />

                {/* Public Spirit Tracker - No authentication required */}
                <Route path="/sprites" element={<SafeRoute name="Sprites Gallery"><SpritesGallery /></SafeRoute>} />
                <Route path="/sprites/:username" element={<SafeRoute name="Spirit Collection"><SpiritCollection /></SafeRoute>} />

                {/* Public Supporters Page - No authentication required */}
                <Route path="/supporters" element={<SupportersPublic />} />

                {/* Public Commands Page - No authentication required */}
                <Route path="/commands/:channelName" element={<PublicCommandsPage />} />
                <Route path="/emotes/global" element={<SafeRoute name="Global Emotes Public"><GlobalEmotesPublic /></SafeRoute>} />
                <Route path="/emotes/:channelName" element={<SafeRoute name="Channel Emotes"><ChannelEmotesPublic /></SafeRoute>} />
                <Route path="/sr/:channelName" element={<SafeRoute name="Song Request Queue"><SongRequestPublicPage /></SafeRoute>} />
                <Route path="/sr/:channelName/p/:code" element={<SafeRoute name="Song Request Playlist"><SongRequestPlaylistPage /></SafeRoute>} />
                <Route path="/torneos/:channelName/:editionSlug" element={<SafeRoute name="Tournament Public"><TournamentPublicPage /></SafeRoute>} />
                <Route path="/torneos/:channelName/:editionSlug/mi-panel" element={<SafeRoute name="My Tournament"><MyTournamentPage /></SafeRoute>} />
                <Route path="/overlay/torneo/:token" element={<SafeRoute name="Tournament Overlay"><TournamentOverlayPage /></SafeRoute>} />
                <Route path="/embed/torneo/:channelName/:editionSlug/ranking" element={<SafeRoute name="Tournament Embed"><TournamentEmbedRankingPage /></SafeRoute>} />

                {/* Public Tips/Donation Pages - No authentication required */}
                <Route path="/tip/privacy" element={<TipsPrivacy />} />
                <Route path="/tip/terms" element={<TipsTerms />} />
                <Route path="/tip/:channelName" element={<TipsDonate />} />
                <Route path="/donate/:channelName" element={<TipsDonate />} />

                {/* Public Gacha Routes - No authentication required */}
                <Route path="/gacha/login" element={<><PublicNav /><GachaLogin /></>} />

                {/* OAuth Authorization Page */}
                <Route path="/oauth/authorize" element={<OAuthAuthorizePage />} />

                {/* Legal Pages */}
                <Route element={<LegalLayout />}>
                    <Route path="/terminos" element={<TerminosPage />} />
                    <Route path="/privacidad" element={<PrivacidadPage />} />
                    <Route path="/devoluciones" element={<DevolucionesPage />} />
                    <Route path="/libro-reclamaciones" element={<LibroReclamacionesPage />} />
                </Route>

                {/* Public Documentation Routes */}
                <Route path="/docs" element={<DocsLayout />}>
                    <Route index element={<DocsHome />} />
                    <Route path="about" element={<About />} />
                    <Route path="getting-started" element={<GettingStarted />} />
                    <Route path="features" element={<Features />} />
                    <Route path="faq" element={<FAQ />} />
                    <Route path="api" element={<ApiDocs />} />
                    <Route path="variables" element={<VariablesDoc />} />
                    <Route path="commands/default" element={<DefaultCommandsDoc />} />
                    <Route path="commands/custom" element={<CustomCommandsDoc />} />
                    <Route path="commands/microcommands" element={<MicrocommandsDoc />} />
                    <Route path="commands/scripting" element={<ScriptingCommandsDoc />} />
                    <Route path="overlays/shoutout" element={<ShoutoutOverlayDoc />} />
                    <Route path="overlays/gacha" element={<GachaOverlayDoc />} />
                    <Route path="song-request" element={<SongRequestDoc page="overview" scope="public" />} />
                    <Route path="wheel" element={<WheelDoc page="overview" scope="public" />} />
                    <Route path="tournaments" element={<TournamentDoc page="overview" scope="public" />} />
                    <Route path="moderation" element={<ModerationDoc page="overview" scope="public" />} />
                    <Route path="translation" element={<TranslationDoc page="overview" scope="public" />} />
                    <Route path="discord" element={<DiscordDoc page="overview" scope="public" />} />
                    <Route path="spirits" element={<SpiritsDoc page="overview" scope="public" />} />
                    <Route path="chat" element={<ChatEmotesDoc page="overview" scope="public" />} />
                    <Route path="speak-chat" element={<SpeakChatDoc page="overview" scope="public" />} />
                    <Route path="credits" element={<CreditsDoc page="overview" scope="public" />} />
                    <Route path="plans" element={<PlansDoc page="overview" scope="public" />} />
                    <Route path="kick" element={<KickDoc page="overview" scope="public" />} />
                    <Route path="game-accounts" element={<AccountsDoc page="overview" scope="public" />} />
                    <Route path="lol-coach" element={<CoachDoc page="overview" scope="public" />} />
                    <Route path="account" element={<AccountDoc page="overview" scope="public" />} />
                    <Route path="coins" element={<CreditsDoc page="coinsOverview" scope="public" />} />
                </Route>

                {/* Protected Routes */}
                <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route path="dashboard" element={<SafeRoute name="Dashboard"><Dashboard /></SafeRoute>} />

                    {/* Hub Pages */}
                    <Route path="commands" element={<SafeRoute name="Commands"><CommandsHub /></SafeRoute>} />
                    <Route path="features" element={<SafeRoute name="Features"><FeaturesHub /></SafeRoute>} />
                    <Route path="admin" element={<SafeRoute name="Admin"><AdminHub /></SafeRoute>} />
                    <Route path="moderation" element={<SafeRoute name="Moderation"><ModerationHub /></SafeRoute>} />

                    {/* Rutas de Comandos */}
                    <Route path="commands/default" element={<SafeRoute name="Default Commands"><DefaultCommands /></SafeRoute>} />
                    <Route path="commands/microcommands" element={<SafeRoute name="Micro Commands"><MicroCommands /></SafeRoute>} />
                    <Route path="commands/custom" element={<SafeRoute name="Custom Commands"><CustomCommands /></SafeRoute>} />
                    <Route path="commands/scripting" element={<SafeRoute name="Scripting"><ScriptingList /></SafeRoute>} />
                    <Route path="commands/scripting/new" element={<SafeRoute name="Script Editor"><ScriptingEditor /></SafeRoute>} />
                    <Route path="commands/scripting/edit/:id" element={<SafeRoute name="Script Editor"><ScriptingEditor /></SafeRoute>} />
                    <Route path="commands/watchtime" element={<SafeRoute name="Watchtime"><WatchtimeConfig /></SafeRoute>} />
                    <Route path="commands/ruleta" element={<SafeRoute name="Ruleta"><RuletaConfig /></SafeRoute>} />
                    <Route path="commands/public" element={<SafeRoute name="Public Commands"><PublicCommandsConfig /></SafeRoute>} />

                    {/* Rutas de Gestión */}
                    <Route path="followers" element={<SafeRoute name="Followers"><Followers /></SafeRoute>} />

                    {/* Rutas de Funciones */}
                    <Route path="features/timers" element={<SafeRoute name="Timers"><Timers /></SafeRoute>} />
                    <Route path="features/giveaways" element={<SafeRoute name="Giveaways"><GiveawayConfig /></SafeRoute>} />
                    {/* Sound Alerts pasó a Overlays: la ruta vieja redirige para no romper links ni favoritos */}
                    <Route path="features/sound-alerts" element={<Navigate to="/overlays/sound-alerts" replace />} />
                    <Route path="features/decatron-ai" element={<SafeRoute name="Decatron AI"><DecatronAIConfig /></SafeRoute>} />
                    <Route path="features/live-translation" element={<SafeRoute name="Traducción en vivo"><LiveTranslationConfig /></SafeRoute>} />
                    <Route path="features/lol-coach" element={<SafeRoute name="Coach de LoL"><LolCoachConfig /></SafeRoute>} />
                    <Route path="credits" element={<SafeRoute name="Créditos"><Credits /></SafeRoute>} />
                    <Route path="features/decatron-chat" element={<SafeRoute name="Decatron Chat"><DecatronChat /></SafeRoute>} />
                    <Route path="features/tips" element={<SafeRoute name="Tips"><TipsConfig /></SafeRoute>} />
                    <Route path="features/speak-chat" element={<SafeRoute name="Speak Chat"><SpeakChat /></SafeRoute>} />

                    {/* Rutas de Admin */}
                    <Route path="admin/decatron-ai" element={<SafeRoute name="AI Admin"><DecatronAIAdmin /></SafeRoute>} />
                    <Route path="admin/decatron-chat" element={<SafeRoute name="Chat Admin"><DecatronChatAdmin /></SafeRoute>} />
                    <Route path="admin/donations" element={<SafeRoute name="Donations"><AdminDonations /></SafeRoute>} />
                    <Route path="admin/supporters" element={<SafeRoute name="Supporters"><SupportersConfig /></SafeRoute>} />
                    <Route path="admin/channels" element={<SafeRoute name="Channels Visibility"><ChannelsVisibility /></SafeRoute>} />
                    <Route path="admin/mods" element={<SafeRoute name="Admin Mods"><AdminMods /></SafeRoute>} />
                    <Route path="admin/economy" element={<SafeRoute name="Economy"><AdminEconomy /></SafeRoute>} />
                    <Route path="admin/tcg" element={<SafeRoute name="TCG Admin"><AdminTcg /></SafeRoute>} />
                    <Route path="admin/tcg-art-queue" element={<SafeRoute name="TCG Art Queue"><AdminTcgArtQueue /></SafeRoute>} />
                    <Route path="admin/email" element={<SafeRoute name="Email"><EmailManagement /></SafeRoute>} />
                    <Route path="admin/dev-docs" element={<SafeRoute name="Dev Docs"><DevDocs /></SafeRoute>} />
                    <Route path="admin/tts-lab" element={<SafeRoute name="TTS Lab"><TtsLab /></SafeRoute>} />
                    <Route path="admin/estilo" element={<SafeRoute name="Design Guide"><DesignGuide /></SafeRoute>} />
                    <Route path="admin/finance" element={<SafeRoute name="Finanzas"><Finance /></SafeRoute>} />
                    <Route path="admin/tts-credits" element={<SafeRoute name="TTS Credits"><TtsCreditsAdmin /></SafeRoute>} />
                    <Route path="admin/live-translation" element={<SafeRoute name="Live Translation Admin"><LiveTranslationAdmin /></SafeRoute>} />
                    {/* Absorbido por Finanzas → Costos (plan FINANZAS_PLAN.md fase 5); la ruta vieja sigue viva para enlaces guardados. */}
                    <Route path="admin/ai-costs" element={<SafeRoute name="AI Costs Admin"><AiCostsAdmin /></SafeRoute>} />
                    <Route path="admin/project-analysis" element={<SafeRoute name="Project Analysis"><ProjectAnalysis /></SafeRoute>} />
                    <Route path="admin/fortnite" element={<SafeRoute name="Fortnite Sprites"><AdminFortnite /></SafeRoute>} />
                    <Route path="admin/logo" element={<SafeRoute name="Logo Guide"><LogoGuide /></SafeRoute>} />
                    <Route path="admin/global-emotes" element={<SafeRoute name="Global Emotes"><GlobalEmotesAdmin /></SafeRoute>} />
                    <Route path="admin/brand" element={<SafeRoute name="Brand Logos"><BrandAdmin /></SafeRoute>} />
                    <Route path="admin/game-overlay-promos" element={<SafeRoute name="Game Overlay Promos"><GameOverlayPromosAdmin /></SafeRoute>} />

                    {/* Chat Moderation */}
                    <Route path="features/moderation/banned-words" element={<SafeRoute name="Banned Words"><BannedWords /></SafeRoute>} />
                    <Route path="features/moderation/links" element={<SafeRoute name="Links Filter"><LinksFilter /></SafeRoute>} />
                    <Route path="features/moderation/commands" element={<SafeRoute name="Moderation Commands"><ModerationCommands /></SafeRoute>} />
                    <Route path="features/moderation/spam" element={<SafeRoute name="Spam Filters"><SpamFilters /></SafeRoute>} />
                    <Route path="features/moderation/raids" element={<SafeRoute name="Raid Protection"><RaidProtection /></SafeRoute>} />
                    <Route path="features/moderation/history" element={<SafeRoute name="Moderation History"><ModerationHistory /></SafeRoute>} />
                    <Route path="features/emotes" element={<SafeRoute name="Emotes"><ChannelEmotes /></SafeRoute>} />
                    <Route path="features/bots" element={<SafeRoute name="Bot List"><BotList /></SafeRoute>} />

                    {/* Overlays */}
                    <Route path="overlays" element={<SafeRoute name="Overlays"><Overlays /></SafeRoute>} />
                    <Route path="overlays/shoutout" element={<SafeRoute name="Shoutout"><ShoutoutConfig /></SafeRoute>} />
                    <Route path="overlays/chat" element={<SafeRoute name="Chat Overlay Config"><ChatOverlayConfig /></SafeRoute>} />
                    <Route path="overlays/timer" element={<SafeRoute name="Timer"><TimerConfig /></SafeRoute>} />
                    <Route path="overlays/sound-alerts" element={<SafeRoute name="Sound Alerts"><SoundAlerts /></SafeRoute>} />
                    <Route path="overlays/goals" element={<SafeRoute name="Goals"><GoalsConfig /></SafeRoute>} />
                    <Route path="overlays/event-alerts" element={<SafeRoute name="Event Alerts"><EventAlertsConfig /></SafeRoute>} />
                    <Route path="overlays/now-playing" element={<SafeRoute name="Now Playing"><NowPlayingConfig /></SafeRoute>} />
                    <Route path="overlays/song-request" element={<SafeRoute name="Song Request"><SongRequestConfig /></SafeRoute>} />
                    <Route path="overlays/games" element={<SafeRoute name="Game Overlays"><GameOverlays /></SafeRoute>} />
                    <Route path="overlays/live" element={<SafeRoute name="Live Match"><LiveOverlays /></SafeRoute>} />
                    <Route path="overlays/rueda" element={<SafeRoute name="Rueda de la Suerte"><WheelConfig /></SafeRoute>} />
                    <Route path="overlays/pets" element={<SafeRoute name="Pets"><Suspense fallback={null}><PetsConfig /></Suspense></SafeRoute>} />
                    <Route path="overlays/pets-demo" element={<SafeRoute name="Pets Demo"><Suspense fallback={null}><PetsDemo /></Suspense></SafeRoute>} />

                    {/* Gacha System */}
                    <Route path="features/gacha" element={<SafeRoute name="Gacha"><GachaConfig /></SafeRoute>} />
                    <Route path="features/torneos" element={<SafeRoute name="Torneos"><TournamentConfig /></SafeRoute>} />

                    {/* Gacha Legacy */}
                    <Route path="gacha/terms" element={<SafeRoute name="Gacha Terms"><GachaTerms /></SafeRoute>} />
                    <Route path="gacha/success" element={<SafeRoute name="Gacha Success"><GachaSuccess /></SafeRoute>} />

                    {/* Viewer Profile */}
                    <Route path="me" element={<SafeRoute name="Profile"><MeOverview /></SafeRoute>} />
                    <Route path="me/account" element={<SafeRoute name="Account"><MeAccount /></SafeRoute>} />
                    <Route path="me/coins" element={<SafeRoute name="Coins"><MeCoins /></SafeRoute>} />
                    <Route path="me/tcg" element={<SafeRoute name="TcgHub"><TcgHub /></SafeRoute>} />
                    <Route path="me/tcg/shop" element={<SafeRoute name="TcgShop"><TcgShop /></SafeRoute>} />
                    <Route path="me/tcg/open" element={<SafeRoute name="TcgOpen"><TcgOpen /></SafeRoute>} />
                    <Route path="me/tcg/claim" element={<SafeRoute name="TcgClaim"><TcgClaim /></SafeRoute>} />
                    <Route path="me/tcg/collection" element={<SafeRoute name="TcgCollection"><TcgCollection /></SafeRoute>} />
                    <Route path="me/tcg/collection/:instanceId" element={<SafeRoute name="TcgCardDetail"><TcgCardDetail /></SafeRoute>} />
                    <Route path="me/tcg/dex" element={<SafeRoute name="TcgDex"><TcgDex /></SafeRoute>} />
                    <Route path="me/tcg/stats" element={<SafeRoute name="TcgStats"><TcgStats /></SafeRoute>} />
                    <Route path="me/billing" element={<SafeRoute name="Billing"><MeBilling /></SafeRoute>} />
                    <Route path="me/invoices" element={<SafeRoute name="Invoices"><MeInvoices /></SafeRoute>} />
                    <Route path="me/gacha" element={<SafeRoute name="My Gacha"><MeGacha /></SafeRoute>} />
                    <Route path="me/spirits" element={<SafeRoute name="My Spirits"><MySpiritCollection /></SafeRoute>} />

                    {/* Discord Configuration */}
                    <Route path="discord" element={<SafeRoute name="Discord"><DiscordConfig /></SafeRoute>} />
                    <Route path="discord/alerts" element={<SafeRoute name="Discord Alerts"><DiscordAlerts /></SafeRoute>} />
                    <Route path="discord/welcome" element={<SafeRoute name="Discord Welcome"><DiscordWelcome /></SafeRoute>} />
                    <Route path="discord/levels" element={<SafeRoute name="Discord Levels"><DiscordLevels /></SafeRoute>} />

                    {/* Developer Portal */}
                    <Route path="developer" element={<SafeRoute name="Developer"><DeveloperPortal /></SafeRoute>} />
                    <Route path="developer/apps/new" element={<SafeRoute name="New App"><ApplicationCreate /></SafeRoute>} />
                    <Route path="developer/apps/:id/edit" element={<SafeRoute name="Edit App"><ApplicationEdit /></SafeRoute>} />
                    <Route path="developer/docs" element={<SafeRoute name="API Docs"><ApiReference /></SafeRoute>} />

                    {/* Configuración */}
                    <Route path="settings" element={<SafeRoute name="Settings"><Settings /></SafeRoute>} />

                    {/* Analytics */}
                    <Route path="analytics" element={<SafeRoute name="Analytics"><Analytics /></SafeRoute>} />

                    {/* Documentacion dentro del dashboard - Accesible para todos los usuarios autenticados */}
                    <Route path="dashboard/docs" element={<PrivateDocsLayout />}>
                        <Route index element={<DashboardDocsHome />} />
                        <Route path="variables" element={<VariablesDoc />} />
                    {/* Comandos */}
                        <Route path="commands/default" element={<DefaultCommandsDoc />} />
                        <Route path="commands/custom" element={<CustomCommandsDoc />} />
                        <Route path="commands/microcommands" element={<MicrocommandsDoc />} />
                        <Route path="commands/scripting" element={<ScriptingCommandsDoc />} />
                        <Route path="commands/watchtime" element={<ChatCommandsDoc page="watchtime" scope="private" />} />
                        <Route path="commands/public" element={<ChatCommandsDoc page="public" scope="private" />} />
                    {/* Overlays */}
                        <Route path="overlays" element={<OverlaysGuide />} />
                        <Route path="overlays/shoutout" element={<ShoutoutOverlayDoc />} />
                        <Route path="overlays/gacha" element={<GachaOverlayDoc />} />
                        <Route path="song-request/setup" element={<SongRequestDoc page="setup" scope="private" />} />
                        <Route path="song-request/requests" element={<SongRequestDoc page="requests" scope="private" />} />
                        <Route path="song-request/playlists" element={<SongRequestDoc page="playlists" scope="private" />} />
                        <Route path="song-request/commands" element={<SongRequestDoc page="commands" scope="private" />} />
                        <Route path="song-request/overlay" element={<SongRequestDoc page="overlay" scope="private" />} />
                        <Route path="song-request/library" element={<SongRequestDoc page="library" scope="private" />} />
                        <Route path="wheel/setup" element={<WheelDoc page="setup" scope="private" />} />
                        <Route path="wheel/prizes" element={<WheelDoc page="prizes" scope="private" />} />
                        <Route path="wheel/credits" element={<WheelDoc page="credits" scope="private" />} />
                        <Route path="wheel/raffle" element={<WheelDoc page="raffle" scope="private" />} />
                        <Route path="wheel/commands" element={<WheelDoc page="commands" scope="private" />} />
                        <Route path="wheel/look" element={<WheelDoc page="look" scope="private" />} />
                        <Route path="commands/ruleta" element={<WheelDoc page="ruleta" scope="private" />} />
                        <Route path="tournaments/setup" element={<TournamentDoc page="setup" scope="private" />} />
                        <Route path="tournaments/registration" element={<TournamentDoc page="registration" scope="private" />} />
                        <Route path="tournaments/aram" element={<TournamentDoc page="aram" scope="private" />} />
                        <Route path="tournaments/fortnite" element={<TournamentDoc page="fortnite" scope="private" />} />
                        <Route path="tournaments/punishments" element={<TournamentDoc page="punishments" scope="private" />} />
                        <Route path="tournaments/prizes" element={<TournamentDoc page="prizes" scope="private" />} />
                        <Route path="tournaments/look" element={<TournamentDoc page="look" scope="private" />} />
                        <Route path="tournaments/discord" element={<TournamentDoc page="discord" scope="private" />} />
                    {/* Features */}
                        <Route path="features/timer" element={<TimerDoc />} />
                        <Route path="features/event-alerts" element={<EventAlertsDoc />} />
                        <Route path="features/giveaway" element={<GiveawayDoc />} />
                        <Route path="features/sound-alerts" element={<SoundAlertsDoc />} />
                        <Route path="features/tips" element={<TipsDoc />} />
                        <Route path="features/shoutout" element={<ShoutoutDoc />} />
                        <Route path="moderation/setup" element={<ModerationDoc page="setup" scope="private" />} />
                        <Route path="moderation/words" element={<ModerationDoc page="words" scope="private" />} />
                        <Route path="moderation/links" element={<ModerationDoc page="links" scope="private" />} />
                        <Route path="moderation/spam" element={<ModerationDoc page="spam" scope="private" />} />
                        <Route path="moderation/raids" element={<ModerationDoc page="raids" scope="private" />} />
                        <Route path="moderation/commands" element={<ModerationDoc page="commands" scope="private" />} />
                        <Route path="moderation/bots" element={<ModerationDoc page="bots" scope="private" />} />
                        <Route path="translation/setup" element={<TranslationDoc page="setup" scope="private" />} />
                        <Route path="translation/config" element={<TranslationDoc page="config" scope="private" />} />
                        <Route path="translation/credits" element={<TranslationDoc page="credits" scope="private" />} />
                        <Route path="translation/desktop" element={<TranslationDoc page="desktop" scope="private" />} />
                        <Route path="translation/extension" element={<TranslationDoc page="extension" scope="private" />} />
                        <Route path="discord/setup" element={<DiscordDoc page="setup" scope="private" />} />
                        <Route path="discord/alerts" element={<DiscordDoc page="alerts" scope="private" />} />
                        <Route path="discord/welcome" element={<DiscordDoc page="welcome" scope="private" />} />
                        <Route path="discord/levels" element={<DiscordDoc page="levels" scope="private" />} />
                        <Route path="discord/rewards" element={<DiscordDoc page="rewards" scope="private" />} />
                        <Route path="discord/commands" element={<DiscordDoc page="commands" scope="private" />} />
                        <Route path="spirits/collection" element={<SpiritsDoc page="collection" scope="private" />} />
                        <Route path="spirits/commands" element={<SpiritsDoc page="commands" scope="private" />} />
                        <Route path="spirits/notices" element={<SpiritsDoc page="notices" scope="private" />} />
                        <Route path="chat/setup" element={<ChatEmotesDoc page="setup" scope="private" />} />
                        <Route path="chat/look" element={<ChatEmotesDoc page="look" scope="private" />} />
                        <Route path="chat/bubbles" element={<ChatEmotesDoc page="bubbles" scope="private" />} />
                        <Route path="chat/filters" element={<ChatEmotesDoc page="filters" scope="private" />} />
                        <Route path="chat/emotes" element={<ChatEmotesDoc page="emotes" scope="private" />} />
                        <Route path="chat/own-emotes" element={<ChatEmotesDoc page="own-emotes" scope="private" />} />
                        <Route path="speak-chat/setup" element={<SpeakChatDoc page="setup" scope="private" />} />
                        <Route path="speak-chat/activation" element={<SpeakChatDoc page="activation" scope="private" />} />
                        <Route path="speak-chat/voice" element={<SpeakChatDoc page="voice" scope="private" />} />
                        <Route path="speak-chat/filters" element={<SpeakChatDoc page="filters" scope="private" />} />
                        <Route path="credits/balance" element={<CreditsDoc page="balance" scope="private" />} />
                        <Route path="credits/buy" element={<CreditsDoc page="buy" scope="private" />} />
                        <Route path="credits/billing" element={<CreditsDoc page="billing" scope="private" />} />
                        <Route path="credits/coins" element={<CreditsDoc page="coins" scope="private" />} />
                        <Route path="plans/buy" element={<PlansDoc page="buy" scope="private" />} />
                        <Route path="plans/plans" element={<PlansDoc page="plans" scope="private" />} />
                        <Route path="kick/connect" element={<KickDoc page="connect" scope="private" />} />
                        <Route path="kick/features" element={<KickDoc page="features" scope="private" />} />
                        <Route path="game-accounts/riot" element={<AccountsDoc page="riot" scope="private" />} />
                        <Route path="game-accounts/epic" element={<AccountsDoc page="epic" scope="private" />} />
                        <Route path="lol-coach/setup" element={<CoachDoc page="setup" scope="private" />} />
                        <Route path="lol-coach/behavior" element={<CoachDoc page="behavior" scope="private" />} />
                        <Route path="lol-coach/commands" element={<CoachDoc page="commands" scope="private" />} />
                        <Route path="features/analytics" element={<AnalyticsDoc />} />
                        <Route path="features/followers" element={<FollowersDoc />} />
                        <Route path="features/ai" element={<AIDoc />} />
                        <Route path="features/now-playing" element={<NowPlayingDoc />} />
                        <Route path="features/game-overlays" element={<GameOverlaysDoc />} />
                        <Route path="features/live-overlay" element={<LiveOverlayDoc />} />
                        <Route path="features/pets" element={<PetsDoc />} />
                        <Route path="features/decatron-chat" element={<DecatronChatDoc />} />
                        <Route path="features/developer" element={<DeveloperPortalDoc />} />
                        <Route path="features/gacha" element={<GachaDoc />} />
                    {/* Settings */}
                        <Route path="settings" element={<SettingsDoc />} />
                        <Route path="platforms" element={<AccountDoc page="platforms" scope="private" />} />
                        <Route path="language" element={<AccountDoc page="language" scope="private" />} />
                        <Route path="permissions" element={<PermissionsDoc />} />
                    </Route>
                </Route>
                        </Routes>
                        <OverlayAutoUpdate />
                    </LanguageProvider>
                </PermissionsProvider>
            </ToastProvider>
            </BrandProvider>
        </BrowserRouter>
                );
            }
function PublicNav() {
    return (
        <nav className="sticky top-0 z-50 bg-white/95 dark:bg-[#1B1C1D]/95 backdrop-blur-sm border-b border-[#e2e8f0] dark:border-[#374151] shadow-sm">
            <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                <a href="/" className="flex items-center">
                    <BrandMark slot="public-nav" fallback={<img src={decatronLockup} alt="Decatron" className="h-10 object-contain" />} />
                </a>
                <ThemeToggle />
            </div>
        </nav>
    );
}

export default App;