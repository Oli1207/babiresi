import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import apiInstance from "../../utils/axios";
import "./MyBookingsScreen.css";

const fmt = (x) => Number(x || 0).toLocaleString();

function statusLabel(status) {
  const map = {
    requested: "En attente gérant",
    awaiting_payment: "Paiement disponible",
    paid: "Payée",
    checked_in: "Check-in",
    released: "Terminée",
    rejected: "Refusée",
    cancelled: "Annulée",
    expired: "Expirée",
  };
  return map[status] || status;
}

const ALL_STATUSES = [
  { value: "all", label: "Tous les statuts" },
  { value: "requested", label: "En attente gérant" },
  { value: "awaiting_payment", label: "Paiement disponible" },
  { value: "paid", label: "Payée" },
  { value: "checked_in", label: "Check-in" },
  { value: "released", label: "Terminée" },
  { value: "rejected", label: "Refusée" },
  { value: "cancelled", label: "Annulée" },
  { value: "expired", label: "Expirée" },
];

export default function MyBookingsScreen() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const fetchMine = async () => {
    setLoading(true);
    try {
      const { data } = await apiInstance.get("bookings/my/");
      const arr = Array.isArray(data) ? data : (data?.results || []);
      setItems(arr);
    } catch (e) {
      console.error("my bookings error:", e?.response?.data || e?.message);
      Swal.fire({ icon: "error", title: "Erreur", text: "Impossible de charger tes demandes.", position: "center" });
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMine(); }, []);

  const filteredItems = useMemo(() => {
    let filtered = [...items];

    // Filtre par statut
    if (statusFilter !== "all") {
      filtered = filtered.filter((b) => b.status === statusFilter);
    }

    // Filtre par date
    if (dateFilter !== "all") {
      const now = new Date();
      filtered = filtered.filter((b) => {
        if (!b.desired_start_date) return false;
        const bookingDate = new Date(b.desired_start_date);
        
        switch (dateFilter) {
          case "today":
            return bookingDate.toDateString() === now.toDateString();
          case "week":
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return bookingDate >= weekAgo;
          case "month":
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return bookingDate >= monthAgo;
          case "upcoming":
            return bookingDate >= now;
          case "past":
            return bookingDate < now;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [items, statusFilter, dateFilter]);

  const groups = useMemo(() => {
    const pending = filteredItems.filter((b) => ["requested", "awaiting_payment"].includes(b.status));
    const active = filteredItems.filter((b) => ["paid", "checked_in"].includes(b.status));
    const history = filteredItems.filter((b) => ["released", "rejected", "cancelled", "expired"].includes(b.status));
    return { pending, active, history };
  }, [filteredItems]);

  const handleResetFilters = () => {
    setStatusFilter("all");
    setDateFilter("all");
  };

  const Section = ({ title, list }) => (
    <div className="bookings-section">
      <div className="bookings-section-title">
        {title}
        {list.length > 0 && (
          <span className="bookings-section-count">{list.length}</span>
        )}
      </div>
      {list.length === 0 ? (
        <div className="bookings-empty">Aucun élément.</div>
      ) : (
        <div>
          {list.map((b) => (
            <div
              key={b.id}
              className="bookings-card"
              onClick={() => navigate(`/bookings/${b.id}`)}
            >
              <div className="bookings-card-header">
                <h3 className="bookings-card-title">{b.listing_title}</h3>
                <span className="bookings-card-badge">{statusLabel(b.status)}</span>
              </div>
              <p className="bookings-card-details">
                {b.duration_days} jours · {b.guests} pers. · Total: {fmt(b.total_amount)} FCFA
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="bookings-container">
      <div className="bookings-header">
        <div className="bookings-header-content">
          <h2>Mes demandes</h2>
          <p>Suis l'état de tes réservations.</p>
        </div>
        <button className="bookings-explore-btn" onClick={() => navigate("/")}>
          Explorer
        </button>
      </div>

      {/* Filtres */}
      <div className="bookings-filters">
        <div className="bookings-filters-content">
          <div className="bookings-filter-group">
            <label htmlFor="status-filter">Statut :</label>
            <select
              id="status-filter"
              name="status-filter"
              className="bookings-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {ALL_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div className="bookings-filter-group">
            <label htmlFor="date-filter">Date :</label>
            <select
              id="date-filter"
              name="date-filter"
              className="bookings-filter-select"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="all">Toutes les dates</option>
              <option value="today">Aujourd'hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
              <option value="upcoming">À venir</option>
              <option value="past">Passées</option>
            </select>
          </div>

          {(statusFilter !== "all" || dateFilter !== "all") && (
            <button
              className="bookings-filter-reset"
              onClick={handleResetFilters}
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bookings-loading">Chargement...</div>
      ) : (
        <>
          <Section title="En cours" list={groups.pending} />
          <Section title="Actives" list={groups.active} />
          <Section title="Historique" list={groups.history} />
        </>
      )}
    </div>
  );
}
