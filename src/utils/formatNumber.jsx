export function formatNumber(value, options = {}) {
  const {
    significant = 3,   
    maxFraction = 3,   
    sciMin = 1e-4,
    sciMax = 1e5,
  } = options;

  if (value === null || value === undefined) return "—";

  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  if (num === 0) return "0";

  const abs = Math.abs(num);

  if (abs < sciMin || abs >= sciMax) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = (num / Math.pow(10, exp)).toFixed(significant - 1);

    return `${mantissa}×10⁻${Math.abs(exp)}`;
  }

  const rounded = Number(num.toPrecision(significant));

  return rounded.toLocaleString("en-US", {
    maximumFractionDigits: maxFraction,
    useGrouping: false,
  });
}
