import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import Templates from './pages/Templates'
import Scripts from './pages/Scripts'
import Products from './pages/Products'
import Pipeline from './pages/Pipeline'
import Interactions from './pages/Interactions'
import Quotes from './pages/Quotes'
import PaymentRequest from './pages/PaymentRequest'
import Sales from './pages/Sales'

function Protected({ children }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  const { session } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/pipeline" element={<Protected><Pipeline /></Protected>} />
      <Route path="/sales" element={<Protected><Sales /></Protected>} />
      <Route path="/quotes" element={<Protected><Quotes /></Protected>} />
      <Route path="/payment-requests" element={<Protected><PaymentRequest /></Protected>} />
      <Route path="/interactions" element={<Protected><Interactions /></Protected>} />
      <Route path="/customers/b2b" element={<Protected><Customers segment="b2b" /></Protected>} />
      <Route path="/customers/retail" element={<Protected><Customers segment="retail" /></Protected>} />
      <Route path="/templates" element={<Protected><Templates /></Protected>} />
      <Route path="/scripts" element={<Protected><Scripts /></Protected>} />
      <Route path="/products" element={<Protected><Products /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
