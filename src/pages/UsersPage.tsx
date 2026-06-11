import { useState, useEffect } from 'react'
import { Plus, Shield, User, Trash2, AlertTriangle, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { createAuthUser, sendPasswordReset } from '../lib/auth'
import { useAuth, type Profile } from '../hooks/useAuth'
import { Button } from '../components/shared/Button'
import { Input } from '../components/shared/Input'
import { Modal } from '../components/shared/Modal'
import { useToast } from '../components/shared/Toast'

function RoleBadge({ role }: { role: 'admin' | 'staff' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
    }`}>
      {role === 'admin' ? <Shield size={11} /> : <User size={11} />}
      {role}
    </span>
  )
}

export function UsersPage() {
  const { profile: myProfile, isAdmin } = useAuth()
  const toast = useToast()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setProfiles(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleRoleChange = async (profile: Profile, role: 'admin' | 'staff') => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', profile.id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${profile.email} is now ${role}`)
    load()
  }

  const handleDelete = async (profile: Profile) => {
    // Deletes the profile row; the auth.users row will cascade via the trigger
    const { error } = await supabase.from('profiles').delete().eq('id', profile.id)
    if (error) { toast(error.message, 'error'); return }
    toast('User removed')
    setConfirmDelete(null)
    load()
  }

  const handlePasswordReset = async (profile: Profile) => {
    const { error } = await sendPasswordReset(profile.email)
    if (error) { toast(error.message, 'error'); return }
    toast(`Password reset email sent to ${profile.email}`)
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <Shield size={18} />
          <p className="text-sm">Only admins can manage users.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{profiles.length} user{profiles.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} />Add user</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        {loading ? (
          <p className="text-sm text-gray-500 p-4">Loading…</p>
        ) : profiles.map((p, idx) => (
          <div key={p.id} className={`flex items-center gap-4 px-4 py-3 ${idx > 0 ? 'border-t border-gray-100' : ''} ${p.id === myProfile?.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-gray-900">{p.full_name || p.email}</span>
                {p.id === myProfile?.id && <span className="text-xs text-blue-500">(you)</span>}
              </div>
              {p.full_name && <p className="text-xs text-gray-400">{p.email}</p>}
            </div>
            <RoleBadge role={p.role} />
            {p.id !== myProfile?.id && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" title="Send password reset" onClick={() => handlePasswordReset(p)}>
                  <KeyRound size={14} />
                </Button>
                <Button variant="ghost" size="sm" title={p.role === 'admin' ? 'Set as staff' : 'Set as admin'}
                  onClick={() => handleRoleChange(p, p.role === 'admin' ? 'staff' : 'admin')}>
                  <Shield size={14} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(p)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            )}
          </div>
        ))}
        {profiles.length === 0 && !loading && (
          <p className="text-sm text-gray-400 text-center py-8">No users yet</p>
        )}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <p className="text-xs text-yellow-800 font-medium mb-1">Email confirmation</p>
        <p className="text-xs text-yellow-700">For users to log in immediately after creation, disable <strong>Enable email confirmations</strong> in your Supabase dashboard under Authentication → Settings. Otherwise new users must confirm their email first.</p>
      </div>

      {/* Create user modal */}
      <CreateUserModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { load(); setShowCreate(false) }} />

      {/* Confirm delete */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Remove user" size="sm">
        <div className="space-y-4">
          <div className="flex gap-3 items-start">
            <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">
              Remove <strong>{confirmDelete?.email}</strong>? They will no longer be able to log in. This cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => confirmDelete && handleDelete(confirmDelete)}>Remove</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function CreateUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'staff'>('staff')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reset = () => { setEmail(''); setFullName(''); setPassword(''); setRole('staff'); setError('') }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: signUpError } = await createAuthUser(email, password)
      if (signUpError) { setError(signUpError.message); return }
      if (!data.user) { setError('User creation failed — no user returned'); return }

      // Update their profile with name + role
      const { error: profileError } = await supabase.from('profiles')
        .upsert({ id: data.user.id, email, full_name: fullName || null, role })
      if (profileError) { setError(profileError.message); return }

      toast(`${email} added`)
      reset()
      onCreated()
    } catch (e: any) {
      setError(e?.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { onClose(); reset() }} title="Add user" size="sm">
      <form onSubmit={handleCreate} className="space-y-4">
        <Input label="Email *" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="off" />
        <Input label="Full name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Optional" />
        <Input label="Initial password *" type="password" value={password} onChange={e => setPassword(e.target.value)} required
          placeholder="Min 6 characters" minLength={6} autoComplete="new-password" />
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Role</label>
          <div className="flex gap-3">
            {(['staff', 'admin'] as const).map(r => (
              <label key={r} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
                <span className="text-sm capitalize text-gray-700">{r}</span>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={() => { onClose(); reset() }}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create user'}</Button>
        </div>
      </form>
    </Modal>
  )
}
