import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}

export function calcLineTotal(unitPrice: number, quantity: number, days: number, discountPct: number): number {
  const gross = unitPrice * quantity * days
  return gross * (1 - discountPct / 100)
}

export function calcProjectTotals(
  lineItems: { unit_price: number; quantity: number; days: number; discount_pct: number; is_component: boolean }[],
  overallDiscountPct = 0
) {
  const linesSubtotal = lineItems
    .filter(l => !l.is_component)
    .reduce((sum, l) => sum + calcLineTotal(l.unit_price, l.quantity, l.days, l.discount_pct), 0)
  const overallDiscount = linesSubtotal * (overallDiscountPct / 100)
  const subtotal = linesSubtotal - overallDiscount
  return { subtotal, linesSubtotal, overallDiscount }
}
