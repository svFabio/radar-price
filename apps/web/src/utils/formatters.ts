export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return "Pendiente";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Pendiente";

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "Hace un momento";

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Hace unos segundos";
  if (diffMinutes < 60) return `Hace ${diffMinutes}m`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  return `Hace ${diffDays}d`;
}

export function formatCurrency(amount: number, currency: string = "BOB"): string {
  const prefix = currency === "BOB" ? "Bs." : currency;
  return `${prefix} ${Math.round(amount).toLocaleString()}`;
}
