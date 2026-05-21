import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './services/i18n'

import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import VerifyEmailPage from './pages/auth/VerifyEmailPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import EventsPage from './pages/events/EventsPage'
import EventDetailPage from './pages/events/EventDetailPage'
import CreateEventPage from './pages/events/CreateEventPage'
import MessagesPage from './pages/messages/MessagesPage'
import ChatPage from './pages/messages/ChatPage'
import DMChatPage from './pages/messages/DMChatPage'
import ProfilePage from './pages/profile/ProfilePage'
import EditProfilePage from './pages/profile/EditProfilePage'
import UserProfilePage from './pages/profile/UserProfilePage'
import FriendsPage from './pages/profile/FriendsPage'
import FriendRequestsPage from './pages/profile/FriendRequestsPage'
import NotificationsPage from './pages/notifications/NotificationsPage'
import AdminPage from './pages/admin/AdminPage'
import VerificationPage from './pages/verification/VerificationPage'
import SettingsPage from './pages/settings/SettingsPage'
import CharterPage from './pages/legal/CharterPage'
import TermsPage from './pages/legal/TermsPage'
import PremiumPage from './pages/premium/PremiumPage'
import PremiumSuccessPage from './pages/premium/PremiumSuccessPage'
import BusinessDashboardPage from './pages/business/BusinessDashboardPage'
import CreateSponsoredEventPage from './pages/business/CreateSponsoredEventPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Publiques */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/charter" element={<CharterPage />} />

        {/* Protégées */}
        <Route element={<AppLayout />}>
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/new" element={<CreateEventPage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/messages/:id" element={<ChatPage />} />
          <Route path="/dm/:userId" element={<DMChatPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/edit" element={<EditProfilePage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/friend-requests" element={<FriendRequestsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/users/:id" element={<UserProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/verification" element={<VerificationPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/premium" element={<PremiumPage />} />
          <Route path="/premium/success" element={<PremiumSuccessPage />} />
          <Route path="/business" element={<BusinessDashboardPage />} />
          <Route path="/business/events/new" element={<CreateSponsoredEventPage />} />
          <Route path="/" element={<Navigate to="/events" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/events" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
