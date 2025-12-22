import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import Game from './pages/Game';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Transactions from './pages/Transactions';
import Navbar from './components/Navbar';

function ProtectedRoute({ children }) {
  const { player } = useAuth();
  if (!player) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AppRoutes() {
  const { player } = useAuth();

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
        <Route path="*" element={<Navigate to={player ? "/lobby" : "/login"} replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
