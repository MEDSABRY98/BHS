export const PurchasePriceDecimals = 3;

export function FormatPurchasePrice(value: number): string {
  return value.toFixed(PurchasePriceDecimals);
}

export function RoundPurchasePrice(value: number): number {
  return Number(value.toFixed(PurchasePriceDecimals));
}

export function SamePurchasePrice(a: number, b: number): boolean {
  return RoundPurchasePrice(a) === RoundPurchasePrice(b);
}

export function PurchasePriceKey(value: number): number {
  return RoundPurchasePrice(value);
}

export function FormatPurchasePriceAed(value: number): string {
  return `${FormatPurchasePrice(value)} AED`;
}

export const PurchasePriceInputStep = '0.001';
