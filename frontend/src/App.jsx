import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import HomeScreen from "./views/screens/HomeScreen";
import Login from "./views/auth/Login";
import Register from "./views/auth/Register";
import CreateListing from "./views/screens/CreateListing";
import ListingDetailScreen from "./views/screens/ListingDetailScreen";
import ValidateKey from "./views/screens/ValidateKey";
import OwnerInboxScreen from "./views/screens/OwnerInboxScreen";
import { setUser } from "./utils/auth"; 
import { useEffect } from "react";
import BookingStatusScreen from "./views/screens/BookingStatusScreen";
import MyBookingsScreen from "./views/screens/MyBookingsScreen";
import PaystackReturnScreen from "./views/screens/PaystackReturnScreen";
import Navbar from "./views/components/Navbar";
import Footer from "./views/components/Footer";
import "./App.css";

function AppLayout() {
  const location = useLocation();

  // ✅ Home full width (seulement "/")
  const isHome = location.pathname === "/";
  const isAuth = location.pathname === "/login" || location.pathname === "/register";

  return (
    <div className="app-container">
      {!isAuth && <Navbar />}
      <main className={isHome ? "p-0" : "container py-4"}>
        <Routes>
          <Route path="/" element={<HomeScreen />} />

          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Create */}
          <Route path="/create" element={<CreateListing />} />

          {/* ✅ NEW: Listing detail */}
          <Route path="/listings/:id" element={<ListingDetailScreen />} />
          <Route path="/owner/inbox" element={<OwnerInboxScreen />} />
          <Route path="/owner/validate-key" element={<ValidateKey />} />
          <Route path="/bookings/:id" element={<BookingStatusScreen />} />
          <Route path="/me/bookings" element={<MyBookingsScreen />} />
          <Route path="/payments/paystack/return" element={<PaystackReturnScreen />} />

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
