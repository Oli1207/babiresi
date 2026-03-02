import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import Cookies from "js-cookie";
import { adminApi } from "./AdminApi";
import AdminSidebar from "./AdminSidebar";
import "./admin.css";

const Toast = Swal.mixin({
  toast: true,
  position: "top",
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
});

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  // ✅ token cookie comme ton App.jsx
  const hasToken = !!Cookies.get("access_token");

  useEffect(() => {
    let mounted = true;

    (async () => {
      // 1) pas connecté => go login
      if (!hasToken) {
        setChecking(false);
        setAllowed(false);
        Swal.fire({
          icon: "info",
          title: "Connexion requise",
          text: "Connecte-toi pour accéder à l’admin.",
        }).then(() =>
          navigate("/login", { replace: true, state: { from: location.pathname } })
        );
        return;
      }

      // 2) connecté => test permission via endpoint admin
      try {
        setChecking(true);
        await adminApi.metrics(); // ✅ endpoint protégé (IsAdminDashboard)
        if (!mounted) return;
        setAllowed(true);
      } catch (e) {
        if (!mounted) return;

        const status = e?.response?.status;
        const detail =
          e?.response?.data?.detail ||
          e?.response?.data?.message ||
          "Accès refusé.";

        if (status === 403) {
          setAllowed(false);
          Swal.fire({
            icon: "error",
            title: "Accès refusé",
            text: "Tu n’as pas les permissions admin.",
          }).then(() => navigate("/", { replace: true }));
          return;
        }

        // autre erreur (serveur down / réseau)
        console.error(e?.response?.data || e?.message);
        Toast.fire({ icon: "error", title: "Erreur serveur (admin)" });
        setAllowed(false);
      } finally {
        if (!mounted) return;
        setChecking(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [hasToken, location.pathname, navigate]);

  if (checking) {
    return <div className="container py-4">Chargement...</div>;
  }

  if (!allowed) {
    return null;
  }

  return (
    <div className="admin-wrap">
      <div className="admin-left">
        <AdminSidebar />
      </div>
      <div className="admin-right">
        <Outlet />
      </div>
    </div>
  );
}