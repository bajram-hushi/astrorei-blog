export function formatEurCompact(value: number) {
  const absValue = Math.abs(value);

  if (absValue >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1)}m`;
  }

  if (absValue >= 1_000) {
    const thousands = value / 1_000;
    return `${Number.isInteger(thousands) ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
  }

  return value.toString();
}