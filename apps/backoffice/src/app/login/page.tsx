import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { LoginScreen } from '@/components/features/auth/login-screen';
import { authOptions } from '@/lib/auth/auth-options';

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect('/dashboard');
  }

  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
