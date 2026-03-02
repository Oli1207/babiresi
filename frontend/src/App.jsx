import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Cookies from "js-cookie"; // ✅ AJOUT: on check le token dans cookies

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
import Logout from "./views/auth/Logout";
import ForgotPassword from "./views/auth/ForgotPassword";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboardScreen from "./admin/AdminDashboardScreen";
import AdminBookingsScreen from "./admin/AdminBookingsScreen";
import AdminBookingDetailScreen from "./admin/AdminBookingDetailScreen";
import AdminPayoutsScreen from "./admin/AdminPayoutsScreen";
import AdminDisputesScreen from "./admin/AdminDisputesScreen";
import AdminDisputeDetailScreen from "./admin/AdminDisputeDetailScreen";
import AdminAuditScreen from "./admin/AdminAuditScreen";
import AdminStatsOwnersScreen from "./admin/AdminStatsOwnersScreen";
import AdminStatsTopListingsScreen from "./admin/AdminStatsTopListingsScreen";
import AdminStatsProfitScreen from "./admin/AdminStatsProfitScreen";
import CreateNewPassword from "./views/auth/CreateNewPassword";

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

  // =========================================================
  // ✅ Push permission popup (custom) + subscribe only on accept
  // =========================================================
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  // =========================================================
  // ✅ PWA install popup (mobile only) - hidden once installed
  // =========================================================
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // ✅ CHANGE: chez toi le token est stocké en cookie
  const hasToken = !!Cookies.get("access_token");

  // ✅ helpers
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.matchMedia?.("(display-mode: fullscreen)")?.matches ||
    window.navigator?.standalone === true; // iOS

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // ✅ If user already allowed notifications, sync subscription silently (no popup)
  useEffect(() => {
    if (!hasToken) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const already = localStorage.getItem("push_enabled") === "1";
    if (already) return;

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
    ensurePushSubscription(vapidKey)
      .then((ok) => {
        if (ok) localStorage.setItem("push_enabled", "1"); // ✅ CHANGE
      })
      .catch(() => {});
  }, [hasToken]);

  // ✅ On mount: decide whether to show notification popup (ONLY if user can act)
  useEffect(() => {
    if (!hasToken) return;

    // Si déjà accordé/refusé, on ne redemande pas.
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    // ✅ On évite de harceler: si user a cliqué "Plus tard", on attend 24h
    const last = Number(localStorage.getItem("push_prompt_last_ts") || 0);
    const oneDay = 24 * 60 * 60 * 1000;
    if (Date.now() - last < oneDay) return;

    setShowNotifPopup(true);
  }, [hasToken]);

  // ✅ Callback: user clicks "Activer"
  async function handleEnableNotifications() {
    try {
      setNotifLoading(true);
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
      const ok = await ensurePushSubscription(vapidKey);

      // ✅ Si ok, on ferme et on n'affiche plus
      if (ok) {
        localStorage.setItem("push_enabled", "1"); // ✅ CHANGE
        setShowNotifPopup(false);
      } else {
        // user refused or not supported
        localStorage.setItem("push_prompt_last_ts", String(Date.now())); // ✅ CHANGE
        setShowNotifPopup(false);
      }
    } catch (e) {
      
      localStorage.setItem("push_prompt_last_ts", String(Date.now())); // ✅ CHANGE
      setShowNotifPopup(false);
    } finally {
      setNotifLoading(false);
    }
  }

  function handleLaterNotifications() {
    localStorage.setItem("push_prompt_last_ts", String(Date.now())); // ✅ CHANGE
    setShowNotifPopup(false);
  }

  // =========================================================
  // ✅ PWA install logic
  // =========================================================
  useEffect(() => {
    // Only in browser + mobile + not already installed
    if (!isMobile) return;
    if (isStandalone) return;

    const onBeforeInstall = (e) => {
      // ✅ IMPORTANT: prevent the mini-infobar, keep event to trigger later
      e.preventDefault();
      setDeferredPrompt(e);

      // ✅ Show our custom popup
      setShowInstallPopup(true);
    };

    const onAppInstalled = () => {
      // ✅ Installed => never show again
      localStorage.setItem("pwa_installed", "1"); // ✅ CHANGE
      setShowInstallPopup(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    // ✅ If previously installed (flag) hide
    if (localStorage.getItem("pwa_installed") === "1") {
      setShowInstallPopup(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleInstallPWA() {
    try {
      if (!deferredPrompt) {
        // ✅ iOS Safari doesn't fire beforeinstallprompt:
        // we keep popup but show instructions text in UI
        return;
      }
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === "accepted") {
        localStorage.setItem("pwa_installed", "1"); // ✅ CHANGE
        setShowInstallPopup(false);
      } else {
        // user dismissed => show again later (not permanently)
        setShowInstallPopup(false);
      }
      setDeferredPrompt(null);
    } catch (e) {
      
      setShowInstallPopup(false);
      setDeferredPrompt(null);
    }
  }

  function handleCloseInstallPopup() {
    setShowInstallPopup(false);
  }

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handler = (event) => {
      if (event?.data?.type === "PUSH_RECEIVED") {
        console.log("✅ PUSH RECEIVED in page:", event.data.payload);
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  return (
    <div className="app-container">
      {/* ========================================================= */}
      {/* ✅ Popup: Notifications (custom) */}
      {/* ========================================================= */}
      {showNotifPopup && (
        <div className="modal-backdrop-custom">
          <div className="modal-card-custom">
            <h5 style={{ marginBottom: 8 }}>Active les notifications 🔔</h5>
            <p style={{ margin: 0, opacity: 0.9 }}>
              C’est important pour recevoir les confirmations de réservation, les réponses et les alertes.
            </p>

            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={handleLaterNotifications}
                disabled={notifLoading}
              >
                Plus tard
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleEnableNotifications} disabled={notifLoading}>
                {notifLoading ? "Activation..." : "Activer"}
              </button>
            </div>

            <small style={{ display: "block", marginTop: 10, opacity: 0.7 }}>
              Tu peux désactiver à tout moment dans les réglages du navigateur.
            </small>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ✅ Popup: Installer l’app (PWA) - mobile */}
      {/* ========================================================= */}
      {showInstallPopup && (
        <div className="modal-backdrop-custom">
          <div className="modal-card-custom">
            <h5 style={{ marginBottom: 8 }}>Installe l’app 📲</h5>
            {deferredPrompt ? (
              <p style={{ margin: 0, opacity: 0.9 }}>
                Installe l’application sur ton téléphone pour une expérience plus rapide (et les notifications plus fiables).
              </p>
            ) : (
              <p style={{ margin: 0, opacity: 0.9 }}>
                Sur iPhone : appuie sur <b>Partager</b> puis <b>Sur l’écran d’accueil</b>.
              </p>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              <button className="btn btn-outline-secondary btn-sm" onClick={handleCloseInstallPopup}>
                Fermer
              </button>
              {deferredPrompt && (
                <button className="btn btn-dark btn-sm" onClick={handleInstallPWA}>
                  Installer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Navbar />
      <div className="navbar-spacer" />

      <main className={isHome ? "p-0" : "container py-4"}>
        <Routes>
          <Route path="/" element={<HomeScreen />} />

          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:uid/:token" element={<CreateNewPassword />} />

          {/* Screens */}
          <Route path="/create-listing" element={<CreateListing />} />
          <Route path="/listing/:id" element={<ListingDetailScreen />} />
          <Route path="/validate-key" element={<ValidateKey />} />
          <Route path="/owner-inbox" element={<OwnerInboxScreen />} />
          <Route path="/booking-status/:id" element={<BookingStatusScreen />} />
          <Route path="/my-bookings" element={<MyBookingsScreen />} />
          <Route path="/paystack-return" element={<PaystackReturnScreen />} />

          {/* Profiles */}
          <Route path="/seller-profile" element={<SellerProfileScreen />} />
          <Route path="/owner-profile" element={<OwnerProfileScreen />} />
          <Route path="/dashboard" element={<DashboardScreen />} />
          <Route path="/profile-settings" element={<ProfileSettingsScreen />} />
          {/* ADMIN */}
<Route path="/admin" element={<AdminLayout />}>
  <Route index element={<AdminDashboardScreen />} />
  <Route path="bookings" element={<AdminBookingsScreen />} />
  <Route path="bookings/:id" element={<AdminBookingDetailScreen />} />
  <Route path="payouts" element={<AdminPayoutsScreen />} />
  <Route path="disputes" element={<AdminDisputesScreen />} />
  <Route path="disputes/:id" element={<AdminDisputeDetailScreen />} />
  <Route path="audit" element={<AdminAuditScreen />} />
  <Route path="stats/owners" element={<AdminStatsOwnersScreen />} />
  <Route path="stats/top-listings" element={<AdminStatsTopListingsScreen />} />
  <Route path="stats/profit" element={<AdminStatsProfitScreen />} />
</Route>
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    setUser(); // ton auth init
  }, []);

  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}