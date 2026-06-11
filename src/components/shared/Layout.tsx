import { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Users, FolderKanban, Calendar, Settings, Boxes, LogOut, Shield, Menu, X, Search, LayoutDashboard, BarChart2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../hooks/useAuth'
import { useProjects } from '../../hooks/useProjects'
import { useItems } from '../../hooks/useItems'
import { useClients } from '../../hooks/useClients'

function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const { data: projects = [] } = useProjects()
  const { data: items = [] } = useItems()
  const { data: clients = [] } = useClients()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const q = query.trim().toLowerCase()
  const results = q.length < 2 ? [] : [
    ...projects
      .filter(p => p.name.toLowerCase().includes(q) || p.project_number.toLowerCase().includes(q) || (p.client?.name || '').toLowerCase().includes(q))
      .slice(0, 4)
      .map(p => ({ type: 'Project' as const, label: p.name, sub: p.project_number, id: `/projects/${p.id}` })),
    ...clients
      .filter(c => c.name.toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q))
      .slice(0, 3)
      .map(c => ({ type: 'Client' as const, label: c.name, sub: c.company || '', id: `/clients` })),
    ...items
      .filter(i => i.name.toLowerCase().includes(q) || i.item_id.toLowerCase().includes(q))
      .slice(0, 3)
      .map(i => ({ type: 'Item' as const, label: i.name, sub: i.item_id, id: `/inventory` })),
  ]

  const TYPE_COLOR: Record<string, string> = {
    Project: 'bg-blue-100 text-blue-700',
    Client:  'bg-purple-100 text-purple-700',
    Item:    'bg-gray-100 text-gray-600',
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search…"
          className="w-48 lg:w-64 pl-8 pr-3 py-1.5 text-sm bg-white/10 text-white placeholder-gray-400 border border-white/10 rounded-lg focus:outline-none focus:bg-white/20 focus:border-white/20"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {results.map((r, i) => (
            <button key={i} onClick={() => { navigate(r.id); setQuery(''); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${TYPE_COLOR[r.type]}`}>{r.type}</span>
              <span className="flex-1 text-sm text-gray-900 truncate">{r.label}</span>
              {r.sub && <span className="text-xs text-gray-400 shrink-0 truncate max-w-[80px]">{r.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects',  icon: FolderKanban,    label: 'Projects' },
  { to: '/inventory', icon: Boxes,           label: 'Inventory' },
  { to: '/clients',   icon: Users,           label: 'Clients' },
  { to: '/calendar',  icon: Calendar,        label: 'Calendar' },
  { to: '/reports',   icon: BarChart2,       label: 'Reports' },
  { to: '/users',     icon: Shield,          label: 'Users' },
  { to: '/settings',  icon: Settings,        label: 'Settings' },
]

// Bottom nav shows only the 4 most-used items on mobile
const BOTTOM_NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Home' },
  { to: '/projects',  icon: FolderKanban,    label: 'Projects' },
  { to: '/inventory', icon: Boxes,           label: 'Inventory' },
  { to: '/calendar',  icon: Calendar,        label: 'Calendar' },
]

export function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const SidebarContent = () => (
    <>
      <div className="px-4 py-5 border-b border-white/10 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">PRAE</h1>
          <p className="text-xs text-gray-400 mt-0.5">Rental Management</p>
        </div>
        <button onClick={() => setDrawerOpen(false)} className="md:hidden text-gray-400 hover:text-white p-1">
          <X size={18} />
        </button>
      </div>

      <div className="px-3 py-2 border-b border-white/10">
        <GlobalSearch />
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            onClick={() => setDrawerOpen(false)}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              isActive ? 'bg-white text-gray-900 font-medium' : 'text-gray-300 hover:bg-white/10'
            )}>
            <Icon size={16} />{label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold shrink-0">
            {(profile?.full_name || profile?.email || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">
              {profile?.full_name || profile?.email}
            </p>
            {profile?.role && (
              <p className="text-xs text-gray-400 capitalize">{profile.role}</p>
            )}
          </div>
          <button onClick={handleSignOut} title="Sign out"
            className="text-gray-400 hover:text-white p-1 rounded cursor-pointer shrink-0">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-gray-900 text-white flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <aside className="relative w-64 bg-gray-900 text-white flex flex-col z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-gray-900 text-white shrink-0">
          <button onClick={() => setDrawerOpen(true)} className="text-gray-300 hover:text-white p-1 -ml-1">
            <Menu size={20} />
          </button>
          <span className="text-sm font-bold tracking-tight">PRAE</span>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-30">
          {BOTTOM_NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors',
                isActive ? 'text-gray-900 font-medium' : 'text-gray-400'
              )}>
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
