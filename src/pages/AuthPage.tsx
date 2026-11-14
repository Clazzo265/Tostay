import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, GraduationCap, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePlatform } from '../context/PlatformContext';

export const AuthPage: React.FC = () => {
  const { firebaseUser, userPublic, isAdmin, signInWithGoogle } = useAuth();
  const { pushToast } = usePlatform();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialRole = searchParams.get('role') === 'owner' ? 'owner' : 'student';
  const [selectedRole, setSelectedRole] = useState<'student' | 'owner'>(initialRole);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (firebaseUser && userPublic) {
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else if (userPublic.role === 'owner') {
        navigate('/dashboard/owner', { replace: true });
      } else {
        navigate('/dashboard/student', { replace: true });
      }
    }
  }, [firebaseUser, userPublic, isAdmin, navigate]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle(selectedRole);
      pushToast({
        title: 'Signed in to ToStay',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Sign-in cancelled or failed',
        description: err instanceof Error ? err.message : 'Please allow popups and try again.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-[#0A192F] text-sky-400 flex items-center justify-center mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Sign in to ToStay</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Find your place. Feel at home. Choose your primary workspace below.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSelectedRole('student')}
            className={`rounded-xl border p-4 text-left transition-colors ${
              selectedRole === 'student'
                ? 'border-blue-600 bg-blue-50/60'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <GraduationCap className="w-5 h-5 text-blue-600 mb-2" />
            <p className="font-display font-semibold text-sm text-slate-900">Student</p>
            <p className="text-xs text-slate-600 mt-0.5">Save, view & book rooms</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedRole('owner')}
            className={`rounded-xl border p-4 text-left transition-colors ${
              selectedRole === 'owner'
                ? 'border-blue-600 bg-blue-50/60'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-5 h-5 text-[#0A192F] mb-2" />
            <p className="font-display font-semibold text-sm text-slate-900">Hostel Owner</p>
            <p className="text-xs text-slate-600 mt-0.5">List & manage properties</p>
          </button>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => void handleGoogleSignIn()}
          className="w-full min-h-[48px] rounded-xl bg-[#0A192F] hover:bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-3 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
        </button>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-600 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p>
            Google sign-in verifies your email address automatically to prevent spam bookings and
            protect Rumphi students and landlords.
          </p>
        </div>
      </div>
    </div>
  );
};
