import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { SubjectWorkspace } from './pages/SubjectWorkspace';
import { JarvisChat } from './components/JarvisChat';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuth = localStorage.getItem('isAuthenticated') === 'true';
  return isAuth ? <>{children}</> : <Navigate to="/" replace />;
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
              <SubjectWorkspace />
            </ProtectedRoute>
          } />
        </Routes>
        <JarvisChat />
      </div>
    </HashRouter>
  );
};

export default App;