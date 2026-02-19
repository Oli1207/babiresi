import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";

import HomeScreen from "./views/screens/HomeScreen";
import Login from "./views/auth/Login";
import Register from "./views/auth/Register";
import CreateListing from "./views/screens/CreateListing";
import ListingDetailScreen from "./views/screens/ListingDetailScreen";
import ValidateKey from "./views/screens/ValidateKey";
import OwnerInboxScreen from "./views/screens/OwnerInboxScreen";
import BookingStatusScreen from "./views/screens/BookingStatusScreen";
import MyBookingsScreen from "./views/screens/MyBookingsScreen";
import PaystackReturnScreen from "./views/screens/PaystackReturnScreen";
import SellerProfileScreen from "./views/screens/SellerProfileScreen";
import OwnerProfileScreen from "./views/screens/OwnerProfileScreen";
import DashboardScreen from "./views/screens/DashboardScreen";
import Logout from './views/auth/Logout';
import ForgotPassword from './views/auth/ForgotPassword';
import CreateNewPassword from './views/auth/CreateNewPassword';
import Cookies from "js-cookie"; // ✅ CHANGE


import Navbar from "./views/components/Navbar";
import Footer from "./views/components/Footer";
import "./App.css";

import { setUser } from "./utils/auth";
import { ensurePushSubscription } from "./utils/push";
import ProfileSettingsScreen from "./views/screens/ProfileSettingsScreen";

function AppLayout() {
  const location = useLocation();

  const isHome = location.pathname === "/";
  const isAuth = location.pathname === "/login" || location.pathname === "/register";

  // useEffect(() => {
  //   // ✅ Push: uniquement si clé dispo (et idéalement user connecté)
  //   const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

  //   // 👉 règle simple: on tente seulement si token existe
  //   // (adapte si toi tu stockes ailleurs)
  //   const hasToken =
  //     !!localStorage.getItem("access") ||
  //     !!localStorage.getItem("token") ||
  //     !!localStorage.getItem("authToken");

  //   if (!vapidKey || !hasToken) return;

  //   ensurePushSubscription(vapidKey).catch(console.error);
  // }, []);


    // ✅ CHANGE: chez toi le token est stocké en cookie, pas en localStorage
  const hasToken = () => !!Cookies.get("access_token");

  useEffect(() => {
    // ✅ CHANGE: si pas connecté → pas de subscription (endpoint protégé)
    if (!hasToken()) return;

    // ✅ CHANGE: on tente d'enregistrer la subscription
    // (nécessaire pour que le backend puisse envoyer une notif au gérant)
    ensurePushSubscription(import.meta.env.VITE_VAPID_PUBLIC_KEY);
  }, []);


  return (
    <div className="app-container">
      {!isAuth && <Navbar />}

      <main className={isHome ? "p-0" : "container py-4"}>
        <Routes>
          <Route path="/" element={<HomeScreen />} />

          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
           <Route path="/logout" element={<Logout />} />
         <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/create-new-password" element={<CreateNewPassword />} />
  
          {/* Create */}
          <Route path="/create" element={<CreateListing />} />

          {/* Listing */}
          <Route path="/listings/:id" element={<ListingDetailScreen />} />

          {/* Mon Espace (hub client + propriétaire) */}
          <Route path="/mon-espace" element={<DashboardScreen />} />

          {/* Owner flow */}
          <Route path="/owner/inbox" element={<OwnerInboxScreen />} />
          <Route path="/owner/validate-key" element={<ValidateKey />} />
          <Route path="/dashboard/owner" element={<OwnerProfileScreen />} />

          {/* Booking */}
          <Route path="/bookings/:id" element={<BookingStatusScreen />} />
          <Route path="/me/bookings" element={<MyBookingsScreen />} />

          {/* Paystack */}
          <Route path="/payments/paystack/return" element={<PaystackReturnScreen />} />

          {/* Public seller */}
          <Route path="/seller/:userId" element={<SellerProfileScreen />} />
          <Route path="/me/settings" element={<ProfileSettingsScreen />} />
        </Routes>
      </main>

      {!isAuth && !isHome && <Footer />}
    </div>
  );
}

function App() {
  useEffect(() => {
    setUser(); // ✅ hydrate le store depuis les cookies au démarrage
  }, []);

  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;
