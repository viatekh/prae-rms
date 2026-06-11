import { useState } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { usePackages, useCreatePackage, useUpdatePackage, useDeletePackage } from '../hooks/usePackages'
import { useItems, useCategories } from '../hooks/useItems'
import type { Package } from '../types'
import { Button } from '../components/shared/Button'
import { Input, Textarea } from '../components/shared/Input'
import { Select } from '../components/shared/Select'
import { Modal } from '../components/shared/Modal'
import { formatCurrency } from '../lib/utils'
import { generateItemCode, formatItemId } from '../lib/generateId'

function PackageForm({ initial, onSave, onCancel, existingIds = [] }: {
  initial?: Package
  onSave: (pkg: any, items: any[]) => void
  onCancel: () => void
  existingIds?: string[]
}) {
  const { data: allItems = [] } = useItems()
  const { data: categories = [] } = useCategories()
  const [name, setName] = useState(initial?.name || '')
  const [pkgId, setPkgId] = useState(initial?.package_id || '')
  const [categoryId, setCategoryId] = useState(initial?.category_id || '')
  const [dayPrice, setDayPrice] = useState(String(initial?.day_price || ''))
  const [weekPrice, setWeekPrice] = useState(String(initial?.week_price || ''))
  const [monthPrice, setMonthPrice] = useState(String(initial?.month_price || ''))
  const [notes, setNotes] = useState(initial?.notes || '')
  const [pkgItems, setPkgItems] = useState<{ item_id: string; quantity: number }[]>(
    initial?.package_items?.map(pi => ({ item_id: pi.item_id, quantity: pi.quantity })) || []
  )
  const [idEdited, setIdEdited] = useState(!!initial)

  const updateId = () => {
    if (idEdited || initial || !name.trim()) return
    const code = generateItemCode(name)
    let counter = 1
    while (existingIds.includes(formatItemId(code, counter))) counter++
    setPkgId(formatItemId(code, counter))
  }

  return (
    <form onSubmit={e => {
      e.preventDefault()
      onSave({ package_id: pkgId, name, category_id: categoryId, day_price: parseFloat(dayPrice) || 0, week_price: weekPrice ? parseFloat(weekPrice) : null, month_price: monthPrice ? parseFloat(monthPrice) : null, notes: notes || null }, pkgItems)
    }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Package name *" value={name} onChange={e => { setName(e.target.value); updateId() }} required />
        <Input label="Package ID *" value={pkgId} onChange={e => { setPkgId(e.target.value.toUpperCase()); setIdEdited(true) }} required className="font-mono" />
      </div>
      <Select label="Category" value={categoryId} onChange={e => setCategoryId(e.target.value)} required>
        <option value="">Select category</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <div className="grid grid-cols-3 gap-4">
        <Input label="Day price (£)" type="number" step="0.01" min="0" value={dayPrice} onChange={e => setDayPrice(e.target.value)} />
        <Input label="Week price (£)" type="number" step="0.01" min="0" value={weekPrice} onChange={e => setWeekPrice(e.target.value)} placeholder="Optional" />
        <Input label="Month price (£)" type="number" step="0.01" min="0" value={monthPrice} onChange={e => setMonthPrice(e.target.value)} placeholder="Optional" />
      </div>
      <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Items in package</label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPkgItems(p => [...p, { item_id: '', quantity: 1 }])}>
            <Plus size={14} />Add item
          </Button>
        </div>
        <div className="space-y-2">
          {pkgItems.map((pi, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                value={pi.item_id}
                onChange={e => setPkgItems(p => p.map((x, j) => j === i ? { ...x, item_id: e.target.value } : x))}
              >
                <option value="">Select item</option>
                {allItems.map(item => <option key={item.id} value={item.id}>{item.name} ({item.item_id})</option>)}
              </select>
              <Input
                className="w-20"
                type="number"
                min="1"
                value={pi.quantity}
                onChange={e => setPkgItems(p => p.map((x, j) => j === i ? { ...x, quantity: parseInt(e.target.value) || 1 } : x))}
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => setPkgItems(p => p.filter((_, j) => j !== i))}>
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save package</Button>
      </div>
    </form>
  )
}

export function PackagesPage() {
  const { data: packages = [], isLoading } = usePackages()
  const create = useCreatePackage()
  const update = useUpdatePackage()
  const del = useDeletePackage()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Package | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<Package | null>(null)

  const toggle = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const existingIds = packages.map(p => p.package_id)

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Packages</h1>
          <p className="text-sm text-gray-500 mt-0.5">{packages.length} packages</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus size={16} />Add package</Button>
      </div>

      {isLoading ? <p className="text-sm text-gray-500">Loading...</p> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {packages.map((pkg, idx) => (
            <div key={pkg.id} className={idx > 0 ? 'border-t border-gray-100' : ''}>
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <button onClick={() => toggle(pkg.id)} className="text-gray-400 hover:text-gray-600">
                  {expanded.has(pkg.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <span className="font-mono text-xs text-gray-400 w-32 shrink-0">{pkg.package_id}</span>
                <span className="font-medium text-gray-900 flex-1">{pkg.name}</span>
                <span className="text-sm text-gray-500">{pkg.category?.name}</span>
                <span className="text-sm text-gray-600 w-24 text-right">{formatCurrency(pkg.day_price)}<span className="text-gray-400">/day</span></span>
                <div className="flex gap-1 ml-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(pkg)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(pkg)}><Trash2 size={14} /></Button>
                </div>
              </div>
              {expanded.has(pkg.id) && (
                <div className="px-14 py-3 bg-gray-50 border-t border-gray-100">
                  {pkg.package_items?.length ? (
                    <div className="space-y-1">
                      {pkg.package_items.map(pi => (
                        <div key={pi.id} className="text-sm text-gray-600">
                          {pi.quantity}× {pi.item?.name}
                          {(pi.item?.components?.length || 0) > 0 && (
                            <span className="text-xs text-gray-400 ml-2">
                              (incl. {pi.item!.components!.map(c => c.name).join(', ')})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-gray-400">No items in package</p>}
                </div>
              )}
            </div>
          ))}
          {packages.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-sm">No packages yet</p>
            </div>
          )}
        </div>
      )}

      <Modal open={showForm || !!editing} onClose={() => { setShowForm(false); setEditing(null) }}
        title={editing ? `Edit: ${editing.name}` : 'Add package'} size="lg">
        <PackageForm
          initial={editing || undefined}
          existingIds={existingIds}
          onSave={async (pkg, items) => {
            if (editing) { await update.mutateAsync({ id: editing.id, pkg, items }); setEditing(null) }
            else { await create.mutateAsync({ pkg, items }); setShowForm(false) }
          }}
          onCancel={() => { setShowForm(false); setEditing(null) }}
        />
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete package" size="sm">
        <div className="space-y-4">
          <div className="flex gap-3 items-start">
            <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">Delete <strong>{confirmDelete?.name}</strong>? Cannot be undone.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={async () => { await del.mutateAsync(confirmDelete!.id); setConfirmDelete(null) }}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
