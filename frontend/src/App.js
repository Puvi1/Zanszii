import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import AuthPage from "./pages/AuthPage";
import AuthCallback from "./pages/AuthCallback";
import ZansziiHome from "./pages/ZansziiHome";
import ComingSoon from "./pages/ComingSoon";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminReports from "./pages/admin/AdminReports";
import { CartProvider } from "./context/CartContext";
import CustomerProducts from "./pages/customer/CustomerProducts";

import "./App.css";

function RoleHome() {
  const { user } = useAuth();
  if (user?.role === "admin") return <Navigate to="/admin" replace />;
  if (user?.role === "manager") return <Navigate to="/manager" replace />;
  return <ZansziiHome />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<RoleHome />} />
                <Route path="/products" element={<CustomerProducts />} />
                <Route
                  path="/cart"
                  element={<ComingSoon title="Shopping Cart" />}
                />
                <Route
                  path="/orders"
                  element={<ComingSoon title="My Orders" />}
                />
                <Route
                  path="/profile"
                  element={<ComingSoon title="Profile" />}
                />
              </Route>
            </Route>

            <Route element={<ProtectedRoute roles={["manager"]} />}>
              <Route element={<AppLayout />}>
                <Route path="/manager" element={<ZansziiHome />} />
                <Route
                  path="/manager/deliveries"
                  element={<ComingSoon title="Delivery Queue" />}
                />
                <Route
                  path="/manager/reports"
                  element={<ComingSoon title="Delivery Reports" />}
                />
              </Route>
            </Route>

            <Route element={<ProtectedRoute roles={["admin"]} />}>
              <Route element={<AppLayout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/products" element={<AdminProducts />} />
                <Route
                  path="/admin/categories"
                  element={<AdminCategories />}
                />
                <Route
                  path="/admin/orders"
                  element={<ComingSoon title="Manage Orders" />}
                />
                <Route
                  path="/admin/customers"
                  element={<ComingSoon title="Customers" />}
                />
                <Route
                  path="/admin/managers"
                  element={<ComingSoon title="Managers" />}
                />
                <Route path="/admin/reports" element={<AdminReports />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
                           }
