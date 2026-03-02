import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";

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

// ✅ CHANGE: on utilise le store Zustand (puisque iOS peut bloquer cookies JS)
import { useAuthStore } from "./store/auth";

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

  // ✅ CHANGE: iOS/Safari detection (pour PWA popup sans beforeinstallprompt)
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.matchMedia?.("(display-mode: fullscreen)")?.matches ||
    window.navigator?.standalone === true; // iOS

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // ✅ CHANGE: fallback auth via Zustand (iOS cookies parfois invisibles)
  const storeUser = useAuthStore((s) => s.user);

  // ✅ CHANGE: hasToken robuste
  // - cookies (normal)
  // - store Zustand (si cookie pas lisible mais user déjà en mémoire)
  // - (optionnel) localStorage flag si tu veux persister même après refresh iOS
  const hasToken = useMemo(() => {
    const cookieToken = !!Cookies.get("access_token");
    const storeToken = !!storeUser; // si store contient user (setAuthUser)
    const lsToken = localStorage.getItem("is_logged_in") === "1";
    return cookieToken || storeToken; // || lsToken
  }, [storeUser]);

  // =========================================================
  // ✅ If user already allowed notifications, sync subscription silently
  // =========================================================
  useEffect(() => {
    if (!hasToken) return;
    if (!("Notification" in window)) return;

    // ✅ iOS: ok aussi, mais permission doit être granted
    if (Notification.permission !== "granted") return;

    const already = localStorage.getItem("push_enabled") === "1";
    if (already) return;

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
    ensurePushSubscription(vapidKey)
      .then((ok) => {
        if (ok) localStorage.setItem("push_enabled", "1");
      })
      .catch(() => {});
  }, [hasToken]);

  // =========================================================
  // ✅ Show notification popup (ONLY if user can act)
  // =========================================================
  useEffect(() => {
    if (!hasToken) return;
    if (!("Notification" in window)) return;

    // ✅ si déjà accordé/refusé => pas de popup
    if (Notification.permission !== "default") return;

    // ✅ cooldown 24h si "Plus tard"
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

      if (ok) {
        localStorage.setItem("push_enabled", "1");
        setShowNotifPopup(false);
      } else {
        localStorage.setItem("push_prompt_last_ts", String(Date.now()));
        setShowNotifPopup(false);
      }
    } catch (e) {
      localStorage.setItem("push_prompt_last_ts", String(Date.now()));
      setShowNotifPopup(false);
    } finally {
      setNotifLoading(false);
    }
  }

  function handleLaterNotifications() {
    localStorage.setItem("push_prompt_last_ts", String(Date.now()));
    setShowNotifPopup(false);
  }

  // =========================================================
  // ✅ PWA install logic (ANDROID + iOS)
  // =========================================================
  useEffect(() => {
    // Only mobile + not already installed
    if (!isMobile) return;
    if (isStandalone) return;

    // ✅ si déjà installé (ou flag) => rien
    if (localStorage.getItem("pwa_installed") === "1") return;

    // ✅ CHANGE: iOS Safari -> pas de beforeinstallprompt,
    // donc on affiche un popup "instructions"
    if (isIOS && isSafari) {
      const last = Number(localStorage.getItem("pwa_prompt_last_ts") || 0);
      const oneDay = 24 * 60 * 60 * 1000;
      if (Date.now() - last < oneDay) return;

      setDeferredPrompt(null);
      setShowInstallPopup(true);
      return;
    }

    // ✅ Android/Chrome -> beforeinstallprompt
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPopup(true);
    };

    const onAppInstalled = () => {
      localStorage.setItem("pwa_installed", "1");
      setShowInstallPopup(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function handleInstallPWA() {
    try {
      // ✅ iOS n'a pas deferredPrompt -> bouton "Installer" n'apparaît pas (instructions only)
      if (!deferredPrompt) return;

      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice?.outcome === "accepted") {
        localStorage.setItem("pwa_installed", "1");
        setShowInstallPopup(false);
      } else {
        setShowInstallPopup(false);
      }
      setDeferredPrompt(null);
    } catch (e) {
      setShowInstallPopup(false);
      setDeferredPrompt(null);
    }
  }

  function handleCloseInstallPopup() {
    // ✅ CHANGE: évite popup iOS à chaque refresh
    localStorage.setItem("pwa_prompt_last_ts", String(Date.now()));
    setShowInstallPopup(false);
  }

  // =========================================================
  // ✅ Debug SW messages
  // =========================================================
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

            {/* ✅ CHANGE: iOS => instructions, Android => vrai bouton installer */}
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
          <Route path="/create-new-password" element={<CreateNewPassword />} />

          {/* Create */}
          <Route path="/create" element={<CreateListing />} />

          {/* Listing */}
          <Route path="/listings/:id" element={<ListingDetailScreen />} />

          {/* Mon Espace */}
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

          {/* Settings */}
          <Route path="/me/settings" element={<ProfileSettingsScreen />} />

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
    setUser(); // ton auth init (cookies -> store)
  }, []);

  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}