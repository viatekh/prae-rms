import { useState, useEffect } from 'react'
import { Plus, Trash2, GripVertical, Pencil, Check, X } from 'lucide-react'
import { useSettings, useSaveSettings, useCreateCategory, useUpdateCategory, useDeleteCategory } from '../hooks/useSettings'
import { useCategories } from '../hooks/useItems'
import type { Settings, Category } from '../types'
import { Input, Textarea } from '../components/shared/Input'
import { Button } from '../components/shared/Button'

function CategoriesSection() {
  const { data: categories = [] } = useCategories()
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const del = useDeleteCategory()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const handleAdd = async () => {
    if (!newName.trim()) return
    await create.mutateAsync({ name: newName.trim(), sort_order: categories.length + 1 })
    setNewName('')
    setAdding(false)
  }

  const handleEdit = async (cat: Category) => {
    if (!editName.trim()) return
    await update.mutateAsync({ id: cat.id, name: editName.trim(), sort_order: cat.sort_order })
    setEditingId(null)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Categories</h2>
        <Button variant="ghost" size="sm" onClick={() => setAdding(true)}><Plus size={14} />Add</Button>
      </div>
      <div className="space-y-1">
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 group">
            <GripVertical size={14} className="text-gray-300 shrink-0" />
            {editingId === cat.id ? (
              <>
                <input
                  autoFocus
                  className="flex-1 text-sm px-2 py-0.5 border border-gray-300 rounded"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleEdit(cat); if (e.key === 'Escape') setEditingId(null) }}
                />
                <button onClick={() => handleEdit(cat)} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
                <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-700">{cat.name}</span>
                <button onClick={() => { setEditingId(cat.id); setEditName(cat.name) }} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600"><Pencil size={13} /></button>
                <button onClick={() => del.mutateAsync(cat.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
              </>
            )}
          </div>
        ))}
        {adding && (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <GripVertical size={14} className="text-gray-200 shrink-0" />
            <input
              autoFocus
              className="flex-1 text-sm px-2 py-0.5 border border-gray-300 rounded"
              placeholder="Category name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
            />
            <button onClick={handleAdd} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
            <button onClick={() => setAdding(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
        )}
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const save = useSaveSettings()
  const [form, setForm] = useState<Partial<Settings>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  const upd = (field: keyof Settings, value: any) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await save.mutateAsync(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Loading...</div>

  return (
    <div className="p-6 max-w-2xl">
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
          <Button type="submit" disabled={save.isPending}>
            {saved ? '✓ Saved' : save.isPending ? 'Saving...' : 'Save settings'}
          </Button>
        </div>
      </form>

      {/* Categories — separate from the main save form */}
      <div className="mt-5">
        <CategoriesSection />
      </div>
    </div>
  )
}
