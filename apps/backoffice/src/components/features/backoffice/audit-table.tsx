import type { AuditLog } from '@taxikiwi/shared-types';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getAuditActionPresentation,
  getAuditActor,
  getAuditGroupement,
  getAuditResource,
} from '@/lib/audit-display';
import { formatDateTime } from '@/lib/format';

type AuditTableProps = {
  compact?: boolean;
  entries: AuditLog[];
};

export function AuditTable({ compact = false, entries }: AuditTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Moment</TableHead>
          <TableHead>Personne</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Élément concerné</TableHead>
          <TableHead>Groupement</TableHead>
          {!compact && <TableHead>Connexion</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const action = getAuditActionPresentation(entry.action);
          const actor = getAuditActor(entry);
          const groupement = getAuditGroupement(entry);
          const resource = getAuditResource(entry);

          return (
            <TableRow key={entry.id}>
              <TableCell className="min-w-32 whitespace-normal text-muted-foreground">
                {formatDateTime(entry.createdAt)}
              </TableCell>
              <TableCell className="min-w-44 whitespace-normal">
                <div className="font-medium text-foreground">{actor.label}</div>
                {actor.detail && (
                  <div className="mt-0.5 text-xs text-muted-foreground">{actor.detail}</div>
                )}
              </TableCell>
              <TableCell className="min-w-44 whitespace-normal">
                <Badge variant={action.tone} title={entry.action}>
                  {action.label}
                </Badge>
                {!compact && (
                  <div className="mt-1 text-xs text-muted-foreground">{action.category}</div>
                )}
              </TableCell>
              <TableCell className="min-w-56 whitespace-normal">
                <div className="font-medium text-foreground">{resource.label}</div>
                {resource.detail && (
                  <div className="mt-0.5 text-xs text-muted-foreground">{resource.detail}</div>
                )}
              </TableCell>
              <TableCell className="min-w-44 whitespace-normal">
                <div>{groupement.label}</div>
                {groupement.detail && (
                  <div className="mt-0.5 text-xs text-muted-foreground">{groupement.detail}</div>
                )}
              </TableCell>
              {!compact && (
                <TableCell className="min-w-36 whitespace-normal text-muted-foreground">
                  {entry.ipAddress ?? 'Non renseignée'}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
