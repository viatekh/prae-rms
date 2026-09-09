import { useState } from 'react'
import { useSettings, useSaveSettings } from '../hooks/useSettings'
import type { Settings } from '../types'
import { Input, Textarea } from '../components/shared/Input'
import { Button } from '../components/shared/Button'
import { CategoryManager } from '../components/inventory/CategoryManager'
import { useToast } from '../lib/toast-context'
import { errorMessage } from '../lib/errors'

export function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const save = useSaveSettings()
  const toast = useToast()
  // Only the fields the user has actually touched are held locally; everything
  // else reads straight from the server copy, so a refetch can't clobber edits
  // and edits can't be silently reverted by one.
  const [edits, setEdits] = useState<Partial<Settings>>({})
  const [saved, setSaved] = useState(false)

  const form: Partial<Settings> = { ...settings, ...edits }
  const isDirty = Object.keys(edits).length > 0

  function upd<K extends keyof Settings>(field: K, value: Settings[K]) {
    setEdits(f => ({ ...f, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isDirty) return
    try {
      await save.mutateAsync(edits)
      setEdits({})
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      toast(errorMessage(err, 'Failed to save settings'), 'error')
    }
  }

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Loading…</div>

  return (
    <div className="p-3 md:p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Company */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Company details</h2>
          <p className="text-xs text-gray-400 -mt-2">Shown on quote and picking list PDFs</p>
          <Input label="Company name" value={form.company_name || ''} onChange={e => upd('company_name', e.target.value)} />
          <Textarea label="Address" value={form.company_address || ''} onChange={e => upd('company_address', e.target.value)} rows={3} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={form.company_email || ''} onChange={e => upd('company_email', e.target.value)} />
            <Input label="Phone" value={form.company_phone || ''} onChange={e => upd('company_phone', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Website" value={form.company_website || ''} onChange={e => upd('company_website', e.target.value)} />
            <Input label="Company reg / VAT no" value={form.company_reg || ''} onChange={e => upd('company_reg', e.target.value)} />
          </div>
        </div>

        {/* VAT */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">VAT</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.vat_enabled || false} onChange={e => upd('vat_enabled', e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-700">Charge VAT on quotes</span>
          </label>
          {form.vat_enabled && (
            <Input label="VAT rate (%)" type="number" min="0" max="100" step="0.1" value={form.vat_rate || 20} onChange={e => upd('vat_rate', parseFloat(e.target.value))} className="w-32" />
          )}
        </div>

        {/* Quote numbering */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Quote numbering</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Prefix" value={form.quote_prefix || 'QUOTE'} onChange={e => upd('quote_prefix', e.target.value)} />
            <Input label="Next number" type="number" min="1" value={form.quote_next_number || 1} onChange={e => upd('quote_next_number', parseInt(e.target.value) || 1)} />
          </div>
          <p className="text-xs text-gray-400">
            Next quote: <span className="font-mono">{form.quote_prefix || 'QUOTE'}-{String(form.quote_next_number || 1).padStart(5, '0')}</span>
          </p>
        </div>

        {/* Payment terms */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Payment terms</h2>
          <p className="text-xs text-gray-400 -mt-2">Shown at the bottom of quote PDFs</p>
          <Textarea value={form.payment_terms || ''} onChange={e => upd('payment_terms', e.target.value)} rows={3} />
        </div>

        {/* T&Cs */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Terms & Conditions</h2>
          <p className="text-xs text-gray-400 -mt-2">Appended as a final page on quote PDFs</p>
          <Textarea value={form.tc_text || ''} onChange={e => upd('tc_text', e.target.value)} rows={12} placeholder="Paste your full T&Cs here..." />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending || !isDirty}>
            {saved ? '✓ Saved' : save.isPending ? 'Saving…' : isDirty ? 'Save settings' : 'No changes'}
          </Button>
        </div>
      </form>

      {/* Categories — separate from the main save form */}
      <div className="mt-5">
        <CategoryManager />
      </div>
    </div>
  )
}
