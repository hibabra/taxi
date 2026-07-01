export function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Jamais';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatPercent(value: number): string {
  return `${value}%`;
}
