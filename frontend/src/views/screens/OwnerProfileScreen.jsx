import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import apiInstance from "../../utils/axios";
import UserData from "../plugin/UserData";
import "./ownerprofilescreen.css";

const fmt = (x) => Number(x || 0).toLocaleString();

function getCoverUrl(listing) {
  const imgs = listing?.images || [];
  const cover = imgs.find((i) => i.is_cover) || imgs[0] || null;
  return cover?.image_url || "";
}

function safeName(profile, user) {
  return profile?.full_name || user?.full_name || user?.username || user?.email || "Mon profil";
}

export default function OwnerProfileScreen() {
  const navigate = useNavigate();
  const userData = UserData();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null); // ✅ CHANGE

  if (!userData) {
    return (
      <div className="container py-5 text-center">
        <h4>Accès restreint</h4>
        <p className="text-muted">Connecte-toi pour accéder à ton espace gérant.</p>
        <button className="btn btn-dark" onClick={() => navigate("/login")}>
          Se connecter
        </button>
      </div>
    );
  }

  const fetchMe = async () => {
    setLoading(true);
    try {
      const { data } = await apiInstance.get("owners/me/dashboard/");
      setData(data);
    } catch (e) {
      console.error("owner dashboard error:", e?.response?.data || e?.message);
      Swal.fire({ icon: "error", title: "Erreur", text: "Impossible de charger ton dashboard." });
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listings = useMemo(() => data?.listings || [], [data?.listings]);
  const profile = data?.profile || null;
  const user = data?.user || null;
  const stats = data?.stats || null;

  // ✅ CHANGE: désactiver/activer au lieu de delete
  const toggleActive = async (listingId, nextActive) => {
    const label = nextActive ? "Réactiver" : "Désactiver";
    const res = await Swal.fire({
      icon: "warning",
      title: `${label} la résidence ?`,
      html: `
        <div style="text-align:left">
          <div>${nextActive ? "Elle sera de nouveau visible" : "Elle ne sera plus visible"} pour les clients.</div>
          <div class="mt-2" style="font-size:13px;color:#555">Aucune suppression définitive.</div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Confirmer",
      cancelButtonText: "Annuler",
      confirmButtonColor: "#111",
    });

    if (!res.isConfirmed) return;

    setUpdatingId(listingId);
    try {
      await apiInstance.patch(`listings/${listingId}/`, { is_active: nextActive });
      Swal.fire({ icon: "success", title: "OK", timer: 900, showConfirmButton: false });
      fetchMe();
    } catch (e) {
      const msg = e?.response?.data?.detail || "Action impossible.";
      Swal.fire({ icon: "error", title: "Erreur", text: msg });
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="container py-4" style={{ maxWidth: 980 }}>
        <div className="alert alert-light border">Chargement…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container py-4" style={{ maxWidth: 980 }}>
        <div className="alert alert-warning">Dashboard indisponible.</div>
        <button className="btn btn-outline-dark" onClick={fetchMe}>
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: 980 }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <button type="button" className="ownerp-back" onClick={() => navigate(-1)}>
          ← Retour
        </button>

        <div className="d-flex gap-2">
          {/* ✅ NEW: accès rapide aux paramètres de compte */}
          <button type="button" className="ownerp-refresh" onClick={() => navigate("/me/settings")}>
            Paramètres
          </button>

          <button type="button" className="ownerp-refresh" onClick={fetchMe}>
            Rafraîchir
          </button>
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4 ownerp-header">
        <div className="card-body d-flex align-items-center gap-3">
          <div className="ownerp-avatar">
            <img src={profile?.image_url || "/avatar.png"} alt="me" />
          </div>

          <div className="flex-grow-1">
            <div className="ownerp-name">{safeName(profile, user)}</div>
            <div className="ownerp-meta">{user?.email || ""}</div>

            {stats ? (
              <div className="ownerp-stats mt-2 d-flex flex-wrap gap-2">
                <span className="badge text-bg-dark">Total: {stats.total_listings}</span>
                <span className="badge text-bg-light border">Actives: {stats.active_listings}</span>
                <span className="badge text-bg-light border">Inactives: {stats.inactive_listings}</span>
              </div>
            ) : null}
          </div>

          <div className="text-end d-none d-md-block">
            <div className="ownerp-right-label">Espace gérant</div>
            <div className="ownerp-right-meta">Privé</div>
          </div>
        </div>
      </div>

      <div className="mt-4 d-flex align-items-center justify-content-between">
        <div className="fw-semibold" style={{ fontSize: 16 }}>
          Mes résidences
        </div>
      </div>

      {listings.length === 0 ? (
        <div className="alert alert-light border mt-3">
          Tu n’as encore publié aucune résidence.
          <div className="mt-2">
            <button className="btn btn-dark" onClick={() => navigate("/residences/create")}>
              Publier une résidence
            </button>
          </div>
        </div>
      ) : (
        <div className="row g-3 mt-1">
          {listings.map((l) => {
            const coverUrl = getCoverUrl(l);
            const isBusy = updatingId === l.id;

            return (
              <div className="col-12 col-md-6 col-lg-4" key={l.id}>
                <div className="card border-0 shadow-sm rounded-4 ownerp-card">
                  <div className="ownerp-cover" role="button" onClick={() => navigate(`/listings/${l.id}`)}>
                    <img src={coverUrl || "/listing-fallback.jpg"} alt={l.title} />
                  </div>

                  <div className="card-body">
                    <div className="ownerp-title">{l.title}</div>
                    <div className="ownerp-sub">
                      {(l.borough || "")}
                      {l.borough && l.area ? " · " : ""}
                      {(l.area || "")}
                      {l.city ? ` · ${l.city}` : ""}
                    </div>

                    <div className="d-flex align-items-center justify-content-between mt-2">
                      <div className="ownerp-price">{fmt(l.price_per_night)} FCFA</div>
                      <span className={`badge ${l.is_active ? "text-bg-dark" : "text-bg-light border"}`}>
                        {l.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="d-flex gap-2 mt-3">
                      <button
                        className="btn btn-outline-dark btn-sm w-100"
                        onClick={() => navigate(`/listings/${l.id}`)}
                      >
                        Voir
                      </button>

                      {/* ✅ CHANGE: Désactiver / Réactiver */}
                      <button
                        className={`btn btn-sm w-100 ${l.is_active ? "btn-warning" : "btn-success"}`}
                        onClick={() => toggleActive(l.id, !l.is_active)}
                        disabled={isBusy}
                      >
                        {isBusy ? "..." : l.is_active ? "Désactiver" : "Réactiver"}
                      </button>
                    </div>

                    <div className="small text-muted mt-2">
                      Max {l.max_guests} pers. · {fmt(l.price_per_night)} FCFA/nuit
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
