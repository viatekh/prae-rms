import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './components/shared/Toast'
import { AuthGuard } from './components/shared/AuthGuard'
import { Layout } from './components/shared/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { InventoryPage } from './pages/InventoryPage'
import { ClientsPage } from './pages/ClientsPage'
import { CalendarPage } from './pages/CalendarPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { UsersPage } from './pages/UsersPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 30 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected */}
            <Route path="/" element={<AuthGuard><Layout /></AuthGuard>}>
              <Route index element={<DashboardPage />} />
              <Route path="projects"      element={<ProjectsPage />} />
              <Route path="projects/:id"  element={<ProjectDetailPage />} />
              <Route path="inventory"     element={<InventoryPage />} />
              <Route path="clients"       element={<ClientsPage />} />
              <Route path="calendar"      element={<CalendarPage />} />
              <Route path="reports"       element={<ReportsPage />} />
              <Route path="settings"      element={<SettingsPage />} />
              <Route path="users"         element={<UsersPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
