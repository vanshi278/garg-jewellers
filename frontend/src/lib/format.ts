// Money comes from the API as decimal strings (e.g. "1499.00").
// Format as Indian Rupees with grouping.

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatPrice(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return inr.format(n);
}
