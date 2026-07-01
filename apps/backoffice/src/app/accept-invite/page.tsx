import { AcceptDriverInvitationScreen } from '@/components/features/auth/accept-driver-invitation-screen';
import { notFound } from 'next/navigation';

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    notFound();
  }

  return <AcceptDriverInvitationScreen token={token} />;
}
