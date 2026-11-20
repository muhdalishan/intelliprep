import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { SubjectWorkspace } from './pages/SubjectWorkspace';
import { Groups } from './pages/Groups';
import { Settings } from './pages/Settings';
import { About, NotFound, Privacy, Terms } from './pages/InfoPages';
import { NovaAssistant } from './components/NovaAssistant';
import { FeedbackHost } from './components/Feedback';
import { useAuth } from './services/authService';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { ready, signedIn } = useAuth();
  if (!ready) return <div className="min-h-screen bg-[#fafbff] dark:bg-slate-950" aria-busy="true" />;
  return signedIn ? <>{children}</> : <Navigate to="/" replace />;
};

// A fresh workspace per subject, so one subject's state never carries into another.
const SubjectRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <SubjectWorkspace key={id} />;
};

// The assistant belongs to the signed-in app, not the landing page.
const Assistants: React.FC = () => {
  const { pathname } = useLocation();
  const { signedIn: isAuth } = useAuth();
  const publicPages = ['/', '/about', '/privacy', '/terms'];
  if (!isAuth || publicPages.includes(pathname)) return null;
  return <NovaAssistant />;
};

// Each page fades in when you move between pages (not between tabs of the same page).
const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  return <div key={pathname} className="ip-page">{children}</div>;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="antialiased text-gray-900 dark:text-gray-100 min-h-screen">
        <PageTransition>
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/subject/:id" element={
            <ProtectedRoute>
              <SubjectRoute />
            </ProtectedRoute>
          } />
          <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
          <Route path="/groups/:groupId" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </PageTransition>
        <Assistants />
        <FeedbackHost />
      </div>
    </BrowserRouter>
  );
};

export default App;