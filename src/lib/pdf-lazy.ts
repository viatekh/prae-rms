import type { Project, Settings, LineItemDraft } from '../types'

/**
 * @react-pdf/renderer is ~1.8MB and is only needed when someone actually asks
 * for a document, so it is loaded on demand rather than in the entry bundle.
 */
const loadPdf = () => import('./pdf')

export async function generateQuotePDF(project: Project, lines: LineItemDraft[], settings: Settings | undefined) {
  return (await loadPdf()).generateQuotePDF(project, lines, settings)
}

export async function generatePickingListPDF(
  project: Project,
  lines: LineItemDraft[],
  settings: Settings | undefined,
  items: { id: string; item_id: string }[] = [],
) {
  return (await loadPdf()).generatePickingListPDF(project, lines, settings, items)
}

export async function generateDeliveryDocketPDF(project: Project, lines: LineItemDraft[], settings: Settings | undefined) {
  return (await loadPdf()).generateDeliveryDocketPDF(project, lines, settings)
}
