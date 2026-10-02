import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AuthModal, { AuthSuccessPulse } from '@/components/AuthModal';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Campaigns from '@/pages/Campaigns';
import CreateCampaign from '@/pages/CreateCampaign';
import CampaignContent from '@/pages/CampaignContent';
import CampaignShell, { CampaignIndexRedirect } from '@/components/campaign/CampaignShell';
import {
  CampaignPlanPage,
  CampaignLibraryPage,
  CampaignVideosPage,
  CampaignAnalyticsPage,
  CampaignSongPage,
} from '@/pages/campaign/CampaignSectionPages';
import VideoGenerator from '@/pages/VideoGenerator';
import Analytics from '@/pages/Analytics';
import Artists from '@/pages/Artists';
import ArtistEditor from '@/pages/ArtistEditor';
import Releases from '@/pages/Releases';
import ReleaseDetail from '@/pages/ReleaseDetail';
import ReleaseEditor from '@/pages/ReleaseEditor';
import ReleaseCalendar from '@/pages/ReleaseCalendar';
import ReleaseContent from '@/pages/ReleaseContent';
import SocialShell, { SocialIndexRedirect } from '@/components/social/SocialShell';
import {
  SocialConnectPage,
  SocialQueuePage,
  SocialActivityPage,
} from '@/pages/social/SocialSectionPages';
import SettingsShell, { SettingsIndexRedirect } from '@/components/settings/SettingsShell';
import Profile from '@/pages/Profile';
import Community from '@/pages/Community';
import {
  SettingsAccountPage,
  SettingsStudioPage,
  SettingsPreferencesPage,
} from '@/pages/settings/SettingsSectionPages';
import SocialCompose from '@/pages/SocialCompose';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import TermsOfService from '@/pages/TermsOfService';
import GoogleAuthCallback from '@/pages/GoogleAuthCallback';
import YouTubeAuthCallback from '@/pages/YouTubeAuthCallback';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  const { pathname } = useLocation();
  const isPublicLegal = pathname === "/privacy" || pathname === "/terms";
  const isGoogleCallback = pathname === "/auth/google/callback";
  const isYouTubeCallback = pathname === "/auth/youtube/callback";

  // Legal URLs must render without waiting on auth (TikTok / Google / Meta review crawlers).
  if (isPublicLegal || isGoogleCallback || isYouTubeCallback) {
    return (
      <Routes>
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
        <Route path="/auth/youtube/callback" element={<YouTubeAuthCallback />} />
      </Routes>
    );
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError && authError.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  return (
    <>
    <AuthSuccessPulse />
    <AuthModal />
    <Routes>
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/create" element={<CreateCampaign />} />
          <Route path="/studio" element={<VideoGenerator />} />
          <Route path="/campaigns/:id/video" element={<VideoGenerator />} />
          <Route path="/campaigns/:id" element={<CampaignShell />}>
            <Route index element={<CampaignIndexRedirect />} />
            <Route path="plan" element={<CampaignPlanPage />} />
            <Route path="library" element={<CampaignLibraryPage />} />
            <Route path="content" element={<CampaignContent />} />
            <Route path="videos" element={<CampaignVideosPage />} />
            <Route path="analytics" element={<CampaignAnalyticsPage />} />
            <Route path="song" element={<CampaignSongPage />} />
          </Route>
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/social/compose" element={<SocialCompose />} />
          <Route path="/social" element={<SocialShell />}>
            <Route index element={<SocialIndexRedirect />} />
            <Route path="connect" element={<SocialConnectPage />} />
            <Route path="queue" element={<SocialQueuePage />} />
            <Route path="activity" element={<SocialActivityPage />} />
          </Route>
          <Route path="/community" element={<Community />} />
          <Route path="/artists" element={<Artists />} />
          <Route path="/artists/:id" element={<ArtistEditor />} />
          <Route path="/releases" element={<Releases />} />
          <Route path="/releases/new" element={<ReleaseEditor />} />
          <Route path="/releases/:id/edit" element={<ReleaseEditor />} />
          <Route path="/releases/:id/calendar" element={<ReleaseCalendar />} />
          <Route path="/releases/:id/content" element={<ReleaseContent />} />
          <Route path="/releases/:id" element={<ReleaseDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:userId" element={<Profile />} />
          <Route path="/settings" element={<SettingsShell />}>
            <Route index element={<SettingsIndexRedirect />} />
            <Route path="account" element={<SettingsAccountPage />} />
            <Route path="studio" element={<SettingsStudioPage />} />
            <Route path="preferences" element={<SettingsPreferencesPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </>
  );
};

const routerBasename =
  (import.meta.env.BASE_URL || "/").replace(/\/$/, "") || undefined;

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router basename={routerBasename}>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App