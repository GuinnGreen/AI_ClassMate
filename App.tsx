import { lazy, Suspense, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebaseAuth';
import { ToastProvider } from './contexts/ToastContext';
import { EnvironmentBanner } from './components/EnvironmentBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FontStyles } from './components/FontStyles';
import { Login } from './components/Login';

const ClassroomApp = lazy(() => import('./ClassroomApp'));
const Loading = () => <div role="status" className="h-dvh flex items-center justify-center bg-[#F5F5F7] text-[#2D3436]">載入資料中...</div>;

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  return (
    <ToastProvider>
      <EnvironmentBanner />
      <ErrorBoundary>
        {user === undefined ? <Loading /> : user ? (
          <Suspense fallback={<Loading />}>
            <ClassroomApp key={user.uid} user={user} />
          </Suspense>
        ) : <><FontStyles /><Login /></>}
      </ErrorBoundary>
    </ToastProvider>
  );
}
