import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import { Sidebar } from '@/components/Sidebar'
import { ErrorBoundary } from '@/components/ErrorBoundary'

import { LoginPage } from '@/pages/LoginPage'
import { InboxPage } from '@/pages/InboxPage'
import { TodayPage } from '@/pages/TodayPage'
import { RequestsPage } from '@/pages/RequestsPage'
import { KanbanPage } from '@/pages/KanbanPage'
import { TablePage } from '@/pages/TablePage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DiretoriaPage } from '@/pages/DiretoriaPage'
import { AccountsListPage, AccountDetailPage } from '@/pages/AccountsPage'
import { ContactsPage } from '@/pages/ContactsPage'
import { ActivitiesPage } from '@/pages/ActivitiesPage'
import { QuoteDetailPage } from '@/pages/QuoteDetailPage'
import { OrdersListPage } from '@/pages/OrdersListPage'
import { OrderDetailPage } from '@/pages/OrderDetailPage'
import { ReportListPage, ReportDetailPage } from '@/pages/ReportPage'
import { PublicReportPage } from '@/pages/PublicReportPage'

function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-950">
      <Sidebar />
      <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}

function ProtectedRoute() {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400">
        Carregando...
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <AppShell />
}

function Router() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/r/:slug" element={<PublicReportPage />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<InboxPage />} />
          <Route path="/hoje" element={<TodayPage />} />
          <Route path="/solicitacoes" element={<RequestsPage />} />
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/tabela" element={<TablePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/diretoria" element={<DiretoriaPage />} />
          <Route path="/contas" element={<AccountsListPage />} />
          <Route path="/contas/:id" element={<AccountDetailPage />} />
          <Route path="/contatos" element={<ContactsPage />} />
          <Route path="/atividades" element={<ActivitiesPage />} />
          <Route path="/cotacoes/:id" element={<QuoteDetailPage />} />
          <Route path="/pedidos" element={<OrdersListPage />} />
          <Route path="/pedidos/:id" element={<OrderDetailPage />} />
          <Route path="/relatorio" element={<ReportListPage />} />
          <Route path="/relatorio/:slug" element={<ReportDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </ThemeProvider>
  )
}
