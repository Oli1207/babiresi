import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import apiInstance from "../../utils/axios";
import "./sellerprofilescreen.css";

const fmt = (x) => Number(x || 0).toLocaleString();

function safeName(profile) {
  return profile?.full_name || profile?.user?.full_name || profile?.user?.username || profile?.user?.email || "Vendeur";
}

// ✅ CHANGE: cover depuis images[]
function getCoverUrl(listing) {
  const imgs = listing?.images || [];
  const cover = imgs.find((i) => i.is_cover) || imgs[0] || null;
  return cover?.image_url || "";
}

export default function SellerProfileScreen() {
  const { userId } = useParams();
  const sellerId = Number(userId);
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSeller = async () => {
    setLoading(true);
    try {
      const { data } = await apiInstance.get(`sellers/${sellerId}/`);
      setData(data);
    } catch (e) {
      console.error("seller page error:", e?.response?.data || e?.message);
      Swal.fire({ icon: "error", title: "Erreur", text: "Impossible de charger la page du vendeur." });
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sellerId) return;
    fetchSeller();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId]);

  const profile = data?.profile || null;
  const listings = useMemo(() => data?.listings || [], [data?.listings]);

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
        <div className="alert alert-warning">Vendeur introuvable.</div>
        <button type="button" className="sellerp-back" onClick={() => navigate(-1)}>
          ← Retour
        </button>
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: 980 }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <button type="button" className="sellerp-back" onClick={() => navigate(-1)}>
          ← Retour
        </button>
        <button type="button" className="sellerp-btn" onClick={() => navigate("/")}>
          Explorer
        </button>
      </div>

      <div className="card border-0 shadow-sm rounded-4 sellerp-header">
        <div className="card-body d-flex align-items-center gap-3">
          <div className="sellerp-avatar">
            <img src={profile?.image_url || "/avatar.png"} alt="seller avatar" />
            {/* ✅ CHANGE: fallback local */}
          </div>

          <div className="flex-grow-1">
            <div className="sellerp-name">{safeName(profile)}</div>
            <div className="sellerp-meta">
              {(profile?.city || "")}
              {profile?.city && profile?.country ? " · " : ""}
              {(profile?.country || "")}
            </div>

            {profile?.about ? <div className="sellerp-about">{profile.about}</div> : null}

            <div className="sellerp-stats mt-2">
              <span className="badge text-bg-dark">{data?.stats?.active_listings ?? listings.length} résidences</span>
            </div>
          </div>

          <div className="text-end d-none d-md-block sellerp-header-right">
            <div className="small">Répond généralement vite</div>
            <div className="small">Profil public</div>
          </div>
        </div>
      </div>

      <div className="mt-4 d-flex align-items-center justify-content-between">
        <div className="fw-semibold" style={{ fontSize: 16 }}>
          Résidences du vendeur
        </div>
        <button type="button" className="sellerp-btn" onClick={fetchSeller}>
          Rafraîchir
        </button>
      </div>

      {listings.length === 0 ? (
        <div className="alert alert-light border mt-3">Aucune résidence active pour le moment.</div>
      ) : (
        <div className="row g-3 mt-1">
          {listings.map((l) => {
            const coverUrl = getCoverUrl(l); // ✅ CHANGE
            return (
              <div className="col-12 col-md-6 col-lg-4" key={l.id}>
                <button
                  type="button"
                  className="sellerp-card card border-0 shadow-sm rounded-4 text-start w-100"
                  onClick={() => navigate(`/listings/${l.id}`)}
                >
                  <div className="sellerp-cover">
                    <img
                      src={coverUrl || "/listing-fallback.jpg"} // ✅ CHANGE
                      alt={l.title}
                    />
                  </div>

                  <div className="card-body">
                    <div className="sellerp-title">{l.title}</div>
                    <div className="sellerp-sub">
                      {(l.borough || "")}
                      {l.borough && l.area ? " · " : ""}
                      {(l.area || "")}
                      {l.city ? ` · ${l.city}` : ""}
                    </div>

                    <div className="d-flex align-items-center justify-content-between mt-2">
                      <div className="sellerp-price">{fmt(l.price_per_night)} FCFA</div>
                      <span className="badge text-bg-light border">Max {l.max_guests}</span>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
