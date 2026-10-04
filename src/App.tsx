import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sheet from './pages/Sheet';
import Mark from './pages/Mark';
import Scores from './pages/Scores';
import Calendar from './pages/Calendar';
import Announcements from './pages/Announcements';
import Chat from './pages/Chat';
import Tasks from './pages/Tasks';
import Leaves from './pages/Leaves';
import Warnings from './pages/Warnings';
import Team from './pages/Team';
import Settings from './pages/Settings';

function Guard({ children, head }: { children: React.ReactNode; head?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-950">
      <img src="/logo.png" alt="" className="h-16 w-16 rounded-2xl object-cover bg-white" />
      <div className="animate-spin h-8 w-8 rounded-full border-4 border-white/20 border-t-white" />
    </div>
  );
  if (!user) return <Login />;
  if (head && user.role !== 'head') return <Navigate to="/app" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/app" element={<Guard><Dashboard /></Guard>} />
            <Route path="/app/sheet" element={<Guard><Sheet /></Guard>} />
            <Route path="/app/mark" element={<Guard head><Mark /></Guard>} />
            <Route path="/app/scores" element={<Guard head><Scores /></Guard>} />
            <Route path="/app/calendar" element={<Guard><Calendar /></Guard>} />
            <Route path="/app/announcements" element={<Guard><Announcements /></Guard>} />
            <Route path="/app/chat" element={<Guard><Chat /></Guard>} />
            <Route path="/app/tasks" element={<Guard><Tasks /></Guard>} />
            <Route path="/app/leaves" element={<Guard><Leaves /></Guard>} />
            <Route path="/app/warnings" element={<Guard><Warnings /></Guard>} />
            <Route path="/app/team" element={<Guard head><Team /></Guard>} />
            <Route path="/app/settings" element={<Guard><Settings /></Guard>} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

