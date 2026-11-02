import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { SubjectWorkspace } from './pages/SubjectWorkspace';
import { JarvisChat } from './components/JarvisChat';
import { NovaAssistant } from './components/NovaAssistant';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuth = localStorage.getItem('isAuthenticated') === 'true';
  return isAuth ? <>{children}</> : <Navigate to="/" replace />;
};

// A fresh workspace per subject, so one subject's state never carries into another.
const SubjectRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <SubjectWorkspace key={id} />;
};

// The tutor chat and Nova belong to the signed-in app, not the landing page.
const Assistants: React.FC = () => {
  const { pathname } = useLocation();
  const isAuth = localStorage.getItem('isAuthenticated') === 'true';
  if (!isAuth || pathname === '/') return null;
  return (
    <>
      <NovaAssistant />
      <JarvisChat />
    </>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="antialiased text-gray-900 dark:text-gray-100 min-h-screen">
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
        </Routes>
        <Assistants />
      </div>
    </HashRouter>
  );
};

export default App;