import { GroupementDetailPage } from '@/components/features/backoffice/groupement-detail-page';

export default async function GroupementPage({
  params,
}: {
  params: Promise<{ groupementId: string }>;
}) {
  const { groupementId } = await params;

  return <GroupementDetailPage groupementId={groupementId} />;
}
