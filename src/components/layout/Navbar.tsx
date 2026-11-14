import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  Compass,
  GraduationCap,
  LogOut,
  Map as MapIcon,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePlatform } from '../../context/PlatformContext';
import { PWAInstallButton } from '../ui/PWAInstallButton';

export const Navbar: React.FC = () => {
  const { firebaseUser, userPublic, isAdmin, signOut } = useAuth();
  const { unreadNotificationsCount } = usePlatform();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const dashboardPath = isAdmin
    ? '/admin'
    : userPublic?.role === 'owner'
    ? '/dashboard/owner'
    : userPublic?.role === 'university'
    ? '/university'
    : '/dashboard/student';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-1 py-2 text-sm font-medium transition-colors border-b-2 ${
      isActive
        ? 'border-blue-600 text-slate-900'
        : 'border-transparent text-slate-600 hover:text-slate-900'
    }`;

  return (
    <>
      <header className="sticky top-0 z-40 h-14 md:h-16 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Left: Brand */}
          <Link
            to="/"
            className="flex items-center gap-2.5 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg"
          >
            <div className="w-8 h-8 rounded-lg bg-[#0A192F] text-sky-400 flex items-center justify-center shadow-sm">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="leading-tight">
              <span className="font-display font-bold text-lg tracking-tight text-[#0A192F]">
                ToStay
              </span>
              <span className="hidden sm:block text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Rumphi · Malawi
              </span>
            </div>
          </Link>

          {/* Center: Max 4 top-level links */}
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7">
            <NavLink to="/explore" className={navLinkClass}>
              Explore Hostels
            </NavLink>
            <NavLink to="/map" className={navLinkClass}>
              Satellite Map
            </NavLink>
            <NavLink to="/university" className={navLinkClass}>
              University Portal
            </NavLink>
            {firebaseUser && (
              <NavLink to={dashboardPath} className={navLinkClass}>
                {isAdmin
                  ? 'Admin Console'
                  : userPublic?.role === 'owner'
                  ? 'Owner Studio'
                  : 'My Housing'}
              </NavLink>
            )}
          </nav>

          {/* Right: Single primary CTA or Account Menu */}
          <div className="flex items-center gap-2.5 shrink-0">
            <PWAInstallButton className="hidden lg:inline-flex" />

            {!firebaseUser ? (
              <Link
                to="/auth"
                className="inline-flex items-center justify-center min-h-[40px] px-4 py-2 rounded-lg bg-[#0A192F] text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Sign In
              </Link>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-800 transition-colors"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                >
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                    {(userPublic?.displayName || firebaseUser.email || 'T')[0].toUpperCase()}
                  </span>
                  <span className="hidden sm:inline max-w-[120px] truncate">
                    {userPublic?.displayName || 'Account'}
                  </span>
                  {unreadNotificationsCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold tabular-nums">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </button>

                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setMenuOpen(false)}
                      aria-hidden="true"
                    />
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white shadow-xl py-2 z-40"
                    >
                      <div className="px-4 py-2 border-b border-slate-100">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {userPublic?.displayName || 'ToStay User'}
                        </p>
                        <p className="text-xs text-slate-500 capitalize">
                          {isAdmin ? 'Administrator' : `${userPublic?.role ?? 'student'} account`}
                        </p>
                      </div>
                      <Link
                        to="/dashboard/student"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          Student Dashboard
                        </span>
                        {unreadNotificationsCount > 0 && (
                          <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                            <Bell className="w-3.5 h-3.5" />
                            {unreadNotificationsCount}
                          </span>
                        )}
                      </Link>
                      <Link
                        to="/dashboard/owner"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Building2 className="w-4 h-4 text-slate-400" />
                        Owner Property Studio
                      </Link>
                      {isAdmin && (
                        <Link
                          to="/admin"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          Admin Verification Console
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          void signOut().then(() => navigate('/'));
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 border-t border-slate-100 mt-1"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation (h-14 keeps combined sticky height <= 15% of 844px viewport) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-14 bg-white/95 backdrop-blur border-t border-slate-200 grid grid-cols-4"
      >
        <NavLink
          to="/explore"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              isActive ? 'text-blue-600' : 'text-slate-600'
            }`
          }
        >
          <Compass className="w-5 h-5" />
          <span>Explore</span>
        </NavLink>
        <NavLink
          to="/map"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              isActive ? 'text-blue-600' : 'text-slate-600'
            }`
          }
        >
          <MapIcon className="w-5 h-5" />
          <span>Map</span>
        </NavLink>
        <NavLink
          to="/university"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              isActive ? 'text-blue-600' : 'text-slate-600'
            }`
          }
        >
          <GraduationCap className="w-5 h-5" />
          <span>Campus</span>
        </NavLink>
        <NavLink
          to={firebaseUser ? dashboardPath : '/auth'}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              isActive ? 'text-blue-600' : 'text-slate-600'
            }`
          }
        >
          <User className="w-5 h-5" />
          <span>{firebaseUser ? 'Account' : 'Sign In'}</span>
        </NavLink>
      </nav>
    </>
  );
};
