export function formatCurrency(value: number): string {
  return `Rs ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
