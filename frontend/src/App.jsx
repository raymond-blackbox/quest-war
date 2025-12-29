import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import Game from './pages/Game';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Transactions from './pages/Transactions';
import Quests from './pages/Quests';
import Navbar from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import { checkForVersionUpdate } from './services/version';

function ProtectedRoute({ children }) {
  const { player } = useAuth();
  if (!player) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AppRoutes() {
  const { player } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const shouldCheck = location.pathname === '/login' || location.pathname === '/lobby';
    if (!shouldCheck) {
      return undefined;
    }

    let isChecking = false;

    const runCheck = async () => {
      if (isChecking) {
        return;
      }
      isChecking = true;
      try {
        await checkForVersionUpdate();
      } finally {
        isChecking = false;
      }
    };

    runCheck();
    const intervalId = setInterval(runCheck, 10 * 60 * 1000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runCheck();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [location.pathname]);

  return (
    <>
      {player && <Navbar />}
      <Routes>
        <Route path="/login" element={
          player ? <Navigate to="/lobby" replace /> : <Login />
        } />
        <Route path="/lobby" element={
          <ProtectedRoute><Lobby /></ProtectedRoute>
        } />
        <Route path="/room/:roomId" element={
          <ProtectedRoute><Room /></ProtectedRoute>
        } />
        <Route path="/game/:roomId" element={
          <ProtectedRoute><Game /></ProtectedRoute>
        } />
        <Route path="/leaderboard" element={
          <ProtectedRoute><Leaderboard /></ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute><Profile /></ProtectedRoute>
        } />
        <Route path="/transactions" element={
          <ProtectedRoute><Transactions /></ProtectedRoute>
        } />
        <Route path="/quests" element={
          <ProtectedRoute><Quests /></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to={player ? "/lobby" : "/login"} replace />} />
      </Routes>
    </>
  );
}

function App() {
  useEffect(() => {
    // Global fix for mobile keyboard pushing up page
    const handleFocusOut = () => {
      // Small delay to ensure the keyboard is fully retracted
      setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      }, 100);
    };

    window.addEventListener('focusout', handleFocusOut);
    return () => window.removeEventListener('focusout', handleFocusOut);
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
