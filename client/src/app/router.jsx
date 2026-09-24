import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Suspense } from 'react';
import { lazyLoad } from '@/app/lazyLoad';
import { AuthInitializer, OTPVerifyRoute, ProtectedRoute, PublicRoute } from '@/features/auth';
import { AuthLayout, MainLayout } from '@/app/layout';

import LandingPage from '@/pages/LandingPage';

const TermsOfService = lazyLoad(() => import('@/pages/TermsOfService'), 'TermsOfService');
const Login = lazyLoad(() => import('@/pages/Login'), 'Login');
const Register = lazyLoad(() => import('@/pages/Register'), 'Register');
const ForgotPassword = lazyLoad(() => import('@/pages/ForgotPassword'), 'ForgotPassword');
const OTPLogin = lazyLoad(() => import('@/pages/OTPLogin'), 'OTPLogin');
const VerifyOtp = lazyLoad(() => import('@/pages/VerifyOtp'), 'VerifyOtp');
const Dashboard = lazyLoad(() => import('@/pages/Dashboard'), 'Dashboard');
const ChatPage = lazyLoad(() => import('@/pages/ChatPage'), 'ChatPage');
const ProjectSettings = lazyLoad(() => import('@/pages/ProjectSettings'), 'ProjectSettings');
const Profile = lazyLoad(() => import('@/pages/Profile'), 'Profile');
const SecurityPage = lazyLoad(() => import('@/pages/SecurityPage'), 'SecurityPage');
const PreferencesPage = lazyLoad(() => import('@/pages/PreferencesPage'), 'PreferencesPage');
const ApiKeyPage = lazyLoad(() => import('@/pages/ApiKeyPage'), 'ApiKeyPage');
const UsagePage = lazyLoad(() => import('@/pages/UsagePage'), 'UsagePage');
const ResetPassword = lazyLoad(() => import('@/pages/ResetPassword'), 'ResetPassword');
const NotFound = lazyLoad(() => import('@/pages/NotFound'), 'NotFound');

const LoadingFallback = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-6">
    <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Loading — Please wait</p>
  </div>
);

export function AppRouter() {
  return (
    <AuthInitializer>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/terms" element={<TermsOfService />} />

            <Route element={<PublicRoute />}>
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/otp-login" element={<OTPLogin />} />
              </Route>
            </Route>

            <Route element={<OTPVerifyRoute />}>
              <Route element={<AuthLayout />}>
                <Route path="/verify-otp" element={<VerifyOtp />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/projects/:projectId/chat" element={<ChatPage />} />
                <Route path="/projects/:projectId/settings" element={<ProjectSettings />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings/security" element={<SecurityPage />} />
                <Route path="/settings/preferences" element={<PreferencesPage />} />
                <Route path="/settings/api-key" element={<ApiKeyPage />} />
                <Route path="/settings/usage" element={<UsagePage />} />
              </Route>
            </Route>

            <Route element={<AuthLayout />}>
              <Route path="/reset-password" element={<ResetPassword />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthInitializer>
  );
}

