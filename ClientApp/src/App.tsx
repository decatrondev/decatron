import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Bot } from 'lucide-react';
import ThemeToggle from './components/ThemeToggle';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Index from './pages/Index';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import DefaultCommands from './pages/commands/DefaultCommands';
import MicroCommands from './pages/commands/MicroCommands';
import CustomCommands from './pages/commands/CustomCommands';
import ScriptingList from './pages/commands/ScriptingList';
import ScriptingEditor from './pages/commands/ScriptingEditor';
import Timers from './pages/features/Timers';
import Overlays from './pages/features/Overlays';
import ShoutoutConfig from './pages/features/ShoutoutConfig';
import TimerConfig from './pages/features/TimerConfig';
import GiveawayConfig from './pages/features/GiveawayConfig';
import GoalsConfig from './pages/features/GoalsConfig';
import EventAlertsConfig from './pages/features/EventAlertsConfig';
import BannedWords from './pages/features/moderation/BannedWords';
import SoundAlerts from './pages/features/SoundAlerts';
import FollowAlertConfig from './pages/features/FollowAlertConfig';
import DecatronAIConfig from './pages/features/DecatronAIConfig';
import DecatronChat from './pages/features/DecatronChat';
import TipsConfig from './pages/features/TipsConfig';
import DecatronAIAdmin from './pages/admin/DecatronAIAdmin';
import DecatronChatAdmin from './pages/admin/DecatronChatAdmin';
import AdminDonations from './pages/admin/Donations/index';
import SupportersConfig from './pages/admin/SupportersConfig/index';
import SupportersPublic from './pages/SupportersPublic';
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
import NowPlayingConfig from './pages/features/NowPlayingConfig';
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
// Public docs
import About from './pages/docs/public/About';
import GettingStarted from './pages/docs/public/GettingStarted';
import Features from './pages/docs/public/Features';
import FAQ from './pages/docs/public/FAQ';
// Private docs
import DashboardDocsHome from './pages/docs/private/DashboardDocsHome';
import OverlaysGuide from './pages/docs/private/overlays/OverlaysGuide';
import TimerDoc from './pages/docs/private/features/TimerDoc';
import EventAlertsDoc from './pages/docs/private/features/EventAlertsDoc';
import GiveawayDoc from './pages/docs/private/features/GiveawayDoc';
import GoalsDoc from './pages/docs/private/features/GoalsDoc';
import SoundAlertsDoc from './pages/docs/private/features/SoundAlertsDoc';
import TipsDoc from './pages/docs/private/features/TipsDoc';
import ShoutoutDoc from './pages/docs/private/features/ShoutoutDoc';
import ModerationDoc from './pages/docs/private/features/ModerationDoc';
import AnalyticsDoc from './pages/docs/private/features/AnalyticsDoc';
import FollowersDoc from './pages/docs/private/features/FollowersDoc';
import AIDoc from './pages/docs/private/features/AIDoc';
import NowPlayingDoc from './pages/docs/private/features/NowPlayingDoc';
import FollowAlertsDoc from './pages/docs/private/features/FollowAlertsDoc';
import DecatronChatDoc from './pages/docs/private/features/DecatronChatDoc';
import DeveloperPortalDoc from './pages/docs/private/features/DeveloperPortalDoc';
import SettingsDoc from './pages/docs/private/settings/SettingsDoc';
import PermissionsDoc from './pages/docs/private/settings/PermissionsDoc';
import GachaLogin from './pages/gacha/GachaLogin';
import GachaTerms from "./pages/gacha/GachaTerms";
import GachaSuccess from './pages/gacha/GachaSuccess';
// Developer Portal & OAuth
import DiscordConfig from './pages/discord/DiscordConfig';
import DeveloperPortal from './pages/developer/DeveloperPortal';
import ApplicationCreate from './pages/developer/ApplicationCreate';
import ApiReference from './pages/developer/ApiReference';
import OAuthAuthorizePage from './pages/oauth/OAuthAuthorizePage';
import ApiDocs from './pages/docs/public/ApiDocs';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './components/ui/Toast';
import './i18n/config'; // Initialize i18next

function App() {
    return (
        <BrowserRouter>
            <ToastProvider>
                <PermissionsProvider>
                    <LanguageProvider>
                        <Routes>
                {/* Public Routes */}
                <Route path="/" element={<><PublicNav /><Index /></>} />
                <Route path="/login" element={<><PublicNav /><Login /></>} />

                {/* Overlay Routes - No layout for OBS */}
                <Route path="/overlay/shoutout" element={<ShoutoutOverlay />} />
                <Route path="/overlay/soundalerts" element={<SoundAlertsOverlay />} />
                <Route path="/overlay/timer" element={<TimerOverlay />} />
                <Route path="/overlay/giveaway" element={<GiveawayOverlay />} />
                <Route path="/overlay/goals" element={<GoalsOverlay />} />
                <Route path="/overlay/event-alerts" element={<EventAlertsOverlay />} />
                <Route path="/overlay/tips" element={<TipsOverlay />} />
                <Route path="/overlay/now-playing" element={<NowPlayingOverlay />} />

                {/* Public Supporters Page - No authentication required */}
                <Route path="/supporters" element={<SupportersPublic />} />

                {/* Public Tips/Donation Pages - No authentication required */}
                <Route path="/tip/privacy" element={<TipsPrivacy />} />
                <Route path="/tip/terms" element={<TipsTerms />} />
                <Route path="/tip/:channelName" element={<TipsDonate />} />
                <Route path="/donate/:channelName" element={<TipsDonate />} />

                {/* Public Gacha Routes - No authentication required */}
                <Route path="/gacha/login" element={<><PublicNav /><GachaLogin /></>} />

                {/* OAuth Authorization Page */}
                <Route path="/oauth/authorize" element={<OAuthAuthorizePage />} />

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
                </Route>

                {/* Protected Routes */}
                <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route path="dashboard" element={<Dashboard />} />

                    {/* Rutas de Comandos - Requieren nivel 'commands' */}
                    <Route path="commands/default" element={<DefaultCommands />} />
                    <Route path="commands/microcommands" element={<MicroCommands />} />
                    <Route path="commands/custom" element={<CustomCommands />} />
                    <Route path="commands/scripting" element={<ScriptingList />} />
                    <Route path="commands/scripting/new" element={<ScriptingEditor />} />
                    <Route path="commands/scripting/edit/:id" element={<ScriptingEditor />} />

                    {/* Rutas de Gestión - Requieren nivel 'commands' */}
                    <Route path="followers" element={<Followers />} />

                    {/* Rutas de Funciones - Requieren nivel 'moderation' */}
                    <Route path="features/timers" element={<Timers />} />
                    <Route path="features/giveaways" element={<GiveawayConfig />} />
                    <Route path="features/sound-alerts" element={<SoundAlerts />} />
                    <Route path="features/follow-alerts" element={<FollowAlertConfig />} />
                    <Route path="features/decatron-ai" element={<DecatronAIConfig />} />
                    <Route path="features/decatron-chat" element={<DecatronChat />} />
                    <Route path="features/tips" element={<TipsConfig />} />

                    {/* Rutas de Admin - Solo owner del sistema */}
                    <Route path="admin/decatron-ai" element={<DecatronAIAdmin />} />
                    <Route path="admin/decatron-chat" element={<DecatronChatAdmin />} />
                    <Route path="admin/donations" element={<AdminDonations />} />
                    <Route path="admin/supporters" element={<SupportersConfig />} />

                    {/* Rutas de Chat Moderation - Requieren nivel 'moderation' */}
                    <Route path="features/moderation/banned-words" element={<BannedWords />} />

                    {/* Rutas de Overlays - Requieren nivel 'moderation' */}
                    <Route path="overlays" element={<Overlays />} />
                    <Route path="overlays/shoutout" element={<ShoutoutConfig />} />
                    <Route path="overlays/timer" element={<TimerConfig />} />
                    <Route path="overlays/goals" element={<GoalsConfig />} />
                    <Route path="overlays/event-alerts" element={<EventAlertsConfig />} />
                    <Route path="overlays/now-playing" element={<NowPlayingConfig />} />

                    {/* Rutas de Gacha - Requieren autenticación Twitch */}
                    <Route path="gacha/terms" element={<GachaTerms />} />
                    <Route path="gacha/success" element={<GachaSuccess />} />

                    {/* Discord Configuration */}
                    <Route path="discord" element={<DiscordConfig />} />

                    {/* Developer Portal - OAuth API Management */}
                    <Route path="developer" element={<DeveloperPortal />} />
                    <Route path="developer/apps/new" element={<ApplicationCreate />} />
                    <Route path="developer/docs" element={<ApiReference />} />

                    {/* Configuración - Requiere nivel 'control_total' */}
                    <Route path="settings" element={<Settings />} />

                    {/* Analytics - Requiere nivel 'moderation' o superior */}
                    <Route path="analytics" element={<Analytics />} />

                    {/* Documentacion dentro del dashboard - Accesible para todos los usuarios autenticados */}
                    <Route path="dashboard/docs" element={<DashboardDocsHome />} />
                    <Route path="dashboard/docs/variables" element={<VariablesDoc />} />
                    {/* Comandos */}
                    <Route path="dashboard/docs/commands/default" element={<DefaultCommandsDoc />} />
                    <Route path="dashboard/docs/commands/custom" element={<CustomCommandsDoc />} />
                    <Route path="dashboard/docs/commands/microcommands" element={<MicrocommandsDoc />} />
                    <Route path="dashboard/docs/commands/scripting" element={<ScriptingCommandsDoc />} />
                    {/* Overlays */}
                    <Route path="dashboard/docs/overlays" element={<OverlaysGuide />} />
                    <Route path="dashboard/docs/overlays/shoutout" element={<ShoutoutOverlayDoc />} />
                    <Route path="dashboard/docs/overlays/gacha" element={<GachaOverlayDoc />} />
                    {/* Features */}
                    <Route path="dashboard/docs/features/timer" element={<TimerDoc />} />
                    <Route path="dashboard/docs/features/event-alerts" element={<EventAlertsDoc />} />
                    <Route path="dashboard/docs/features/giveaway" element={<GiveawayDoc />} />
                    <Route path="dashboard/docs/features/goals" element={<GoalsDoc />} />
                    <Route path="dashboard/docs/features/sound-alerts" element={<SoundAlertsDoc />} />
                    <Route path="dashboard/docs/features/tips" element={<TipsDoc />} />
                    <Route path="dashboard/docs/features/shoutout" element={<ShoutoutDoc />} />
                    <Route path="dashboard/docs/features/moderation" element={<ModerationDoc />} />
                    <Route path="dashboard/docs/features/analytics" element={<AnalyticsDoc />} />
                    <Route path="dashboard/docs/features/followers" element={<FollowersDoc />} />
                    <Route path="dashboard/docs/features/ai" element={<AIDoc />} />
                    <Route path="dashboard/docs/features/now-playing" element={<NowPlayingDoc />} />
                    <Route path="dashboard/docs/features/follow-alerts" element={<FollowAlertsDoc />} />
                    <Route path="dashboard/docs/features/decatron-chat" element={<DecatronChatDoc />} />
                    <Route path="dashboard/docs/features/developer" element={<DeveloperPortalDoc />} />
                    {/* Settings */}
                    <Route path="dashboard/docs/settings" element={<SettingsDoc />} />
                    <Route path="dashboard/docs/permissions" element={<PermissionsDoc />} />
                </Route>
                        </Routes>
                    </LanguageProvider>
                </PermissionsProvider>
            </ToastProvider>
        </BrowserRouter>
                );
            }
function PublicNav() {
    return (
        <nav className="sticky top-0 z-50 bg-white/95 dark:bg-[#1B1C1D]/95 backdrop-blur-sm border-b border-[#e2e8f0] dark:border-[#374151] shadow-sm">
            <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                <a href="/" className="flex items-center gap-2 text-2xl font-black text-[#2563eb]">
                    <Bot className="w-8 h-8" />
                    <span>Decatron</span>
                </a>
                <ThemeToggle />
            </div>
        </nav>
    );
}

export default App;