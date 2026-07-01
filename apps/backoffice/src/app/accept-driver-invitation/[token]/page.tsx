import { AcceptDriverInvitationScreen } from '@/components/features/auth/accept-driver-invitation-screen';

export default async function AcceptDriverInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <AcceptDriverInvitationScreen token={token} />;
}
