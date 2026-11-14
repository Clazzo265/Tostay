import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import { AlertTriangle, X } from 'lucide-react';
import { Footer } from './components/layout/Footer';
import { Navbar } from './components/layout/Navbar';
import { OfflineIndicator } from './components/ui/OfflineIndicator';
import { ToastContainer } from './components/ui/ToastContainer';
import { AuthProvider } from './context/AuthContext';
import { PlatformProvider } from './context/PlatformContext';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AuthPage } from './pages/AuthPage';
import { ComparePage } from './pages/ComparePage';
import { ExplorePage } from './pages/ExplorePage';
import { HomePage } from './pages/HomePage';
import { HostelProfilePage } from './pages/HostelProfilePage';
import { LegalPage } from './pages/LegalPage';
import { MapPage } from './pages/MapPage';
import { OwnerDashboardPage } from './pages/OwnerDashboardPage';
import { StudentDashboardPage } from './pages/StudentDashboardPage';
import { UniversityDashboardPage } from './pages/UniversityDashboardPage';

const QuotaExceededBanner: React.FC<{ onDismiss: () => void }> = ({ onDismiss }) => (
  <div
    role="alert"
    className="sticky top-0 z-50 bg-amber-950 text-amber-100 border-b border-amber-700 px-4 py-2.5 text-xs sm:text-sm flex items-center justify-between gap-4"
  >
    <div className="flex items-center gap-2.5 max-w-6xl mx-auto">
      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
      <span>
        Google Maps Platform demo quota exceeded. To continue uninterrupted satellite mapping and routing,
        configure your own <code className="font-mono text-amber-200">VITE_GOOGLE_MAPS_API_KEY</code>{' '}
        in project environment secrets.
      </span>
    </div>
    <button
      type="button"
      onClick={onDismiss}
      className="p-1 rounded text-amber-300 hover:text-white"
      aria-label="Dismiss quota notice"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  return (
    <APIProvider
      apiKey={mapsApiKey}
      language="en"
      region="MW"
      libraries={['marker', 'routes', 'maps']}
    >
      <AuthProvider>
        <PlatformProvider>
          <BrowserRouter>
            <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
              {quotaExceeded && <QuotaExceededBanner onDismiss={() => setQuotaExceeded(false)} />}
              <OfflineIndicator />
              <Navbar />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/explore" element={<ExplorePage />} />
                  <Route path="/map" element={<MapPage />} />
                  <Route path="/hostel/:id" element={<HostelProfilePage />} />
                  <Route path="/compare" element={<ComparePage />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/dashboard/student" element={<StudentDashboardPage />} />
                  <Route path="/dashboard/owner" element={<OwnerDashboardPage />} />
                  <Route path="/admin" element={<AdminDashboardPage />} />
                  <Route path="/university" element={<UniversityDashboardPage />} />
                  <Route path="/privacy" element={<LegalPage section="privacy" />} />
                  <Route path="/terms" element={<LegalPage section="terms" />} />
                  <Route path="/support" element={<LegalPage section="support" />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              <Footer />
              <ToastContainer />
            </div>
          </BrowserRouter>
        </PlatformProvider>
      </AuthProvider>
    </APIProvider>
  );
}
