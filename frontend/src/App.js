import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { BuyNowProvider } from "./context/BuyNowContext";

import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";

import AuthPage from "./pages/AuthPage";
import AuthCallback from "./pages/AuthCallback";
import ZansziiHome from "./pages/ZansziiHome";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminReports from "./pages/admin/AdminReports";
import AdminOrders from "./pages/admin/AdminOrdersPage";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminManagers from "./pages/admin/AdminManagers";
import AdminCostManagement from "./pages/admin/AdminCostManagement";
import AdminDeliveryPartners from "./pages/admin/AdminDeliveryPartners";
import AdminVendorApplications from "./pages/admin/AdminVendorApplications";


import CustomerProducts from "./pages/customer/CustomerProducts";
import ProductDetails from "./pages/customer/ProductDetails";
import CustomerCart from "./pages/customer/CustomerCart";
import CustomerCheckout from "./pages/customer/CustomerCheckout";
import OrderSuccess from "./pages/customer/OrderSuccess";
import MyOrders from "./pages/customer/MyOrders";
import OrderDetails from "./pages/customer/OrderDetails";
import CustomerProfile from "./pages/customer/CustomerProfile";
import CustomerWishlist from "./pages/customer/CustomerWishlist";
import CustomerAddresses from "./pages/customer/CustomerAddresses";
import CustomerNotifications from "./pages/customer/CustomerNotifications";
import CustomerOffers from "./pages/customer/CustomerOffers";
import BecomePartner from "./pages/customer/BecomePartner";



import ManagerDeliveries from "./pages/manager/ManagerDeliveries";
import ManagerReports from "./pages/manager/ManagerReports";

import "./App.css";

function RoleHome() {
  const { user } = useAuth();

  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  if (user?.role === "manager") {
    return <Navigate to="/manager/deliveries" replace />;
  }

  return <ZansziiHome />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <BuyNowProvider>
            <Routes>

              <Route path="/auth" element={<AuthPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>

                  <Route path="/" element={<RoleHome />} />

                  <Route path="/products" element={<CustomerProducts />} />
                  <Route
                    path="/products/:productId"
                    element={<ProductDetails />}
                  />

                  <Route path="/cart" element={<CustomerCart />} />
                  <Route path="/checkout" element={<CustomerCheckout />} />

                  <Route
                    path="/order-success/:orderId"
                    element={<OrderSuccess />}
                  />

                  <Route path="/orders" element={<MyOrders />} />
                  <Route
                    path="/orders/:orderId"
                    element={<OrderDetails />}
                  />

                  <Route path="/wishlist" element={<CustomerWishlist />} />

                  <Route
                    path="/addresses"
                    element={<CustomerAddresses />}
                  />

                 <Route
  path="/notifications"
  element={<CustomerNotifications />}
/>

<Route
  path="/offers"
  element={<CustomerOffers />}
/>

<Route
  path="/profile"
  element={<CustomerProfile />}
/>

<Route
  path="/become-partner"
  element={<BecomePartner />}
/>


                </Route>
              </Route>

              <Route element={<ProtectedRoute roles={["manager"]} />}>
                <Route element={<AppLayout />}>
                  <Route
                    path="/manager"
                    element={<Navigate to="/manager/deliveries" replace />}
                  />

                  <Route
                    path="/manager/deliveries"
                    element={<ManagerDeliveries />}
                  />

                  <Route
                    path="/manager/reports"
                    element={<ManagerReports />}
                  />
                </Route>
              </Route>

              <Route element={<ProtectedRoute roles={["admin"]} />}>
                <Route element={<AppLayout />}>

                  <Route path="/admin" element={<AdminDashboard />} />

                  <Route
                    path="/admin/products"
                    element={<AdminProducts />}
                  />

                  <Route
                    path="/admin/categories"
                    element={<AdminCategories />}
                  />

<Route
  path="/admin/vendor-applications"
  element={<AdminVendorApplications />}
/>


                  <Route
                    path="/admin/orders"
                    element={<AdminOrders />}
                  />

                  <Route
                    path="/admin/customers"
                    element={<AdminCustomers />}
                  />

                  <Route
                    path="/admin/managers"
                    element={<AdminManagers />}
                  />

                  <Route
                    path="/admin/delivery-partners"
                    element={<AdminDeliveryPartners />}
                  />

                  <Route
                    path="/admin/cost-management"
                    element={<AdminCostManagement />}
                  />

                  <Route
                    path="/admin/reports"
                    element={<AdminReports />}
                  />

                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>
          </BuyNowProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
                             }
