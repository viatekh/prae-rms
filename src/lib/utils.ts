import { type ClassValue, clsx } from 'clsx'
import type { PricedLine } from '../types'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })

export function formatCurrency(amount: number): string {
  // A missing or malformed price should read as £0.00, never "£NaN".
  return GBP.format(Number.isFinite(amount) ? amount : 0)
}

export function calcLineTotal(unitPrice: number, quantity: number, days: number, discountPct: number): number {
  const gross = (unitPrice || 0) * (quantity || 0) * (days || 0)
  const total = gross * (1 - (discountPct || 0) / 100)
  return Number.isFinite(total) ? total : 0
}

export function calcProjectTotals(
  lineItems: PricedLine[],
  overallDiscountPct = 0
) {
  const linesSubtotal = lineItems
    .filter(l => !l.is_component)
    .reduce((sum, l) => sum + calcLineTotal(l.unit_price, l.quantity, l.days, l.discount_pct), 0)
  const overallDiscount = linesSubtotal * (overallDiscountPct / 100)
  const subtotal = linesSubtotal - overallDiscount
  return { subtotal, linesSubtotal, overallDiscount }
}
