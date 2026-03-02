import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { adminApi } from "./AdminApi";

const Toast = Swal.mixin({
  toast: true,
  position: "top",
  showConfirmButton: false,
  timer: 2200,
  timerProgressBar: true,
});

export default function AdminDisputeDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await adminApi.disputeDetail(id);
      setD(data);
    } catch (e) {
      console.error(e?.response?.data || e?.message);
      Toast.fire({ icon: "error", title: "Impossible de charger la réclamation" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const updateField = async (payload) => {
    try {
      await adminApi.disputeUpdate(id, payload);
      Toast.fire({ icon: "success", title: "Mise à jour" });
      load();
    } catch (e) {
      const apiErr = e?.response?.data;
      console.error(apiErr || e?.message);
      Swal.fire({ icon: "error", title: "Erreur", text: apiErr?.detail || "Impossible." });
    }
  };

  const sendMessage = async () => {
    if (!msg.trim()) return;
    try {
      setSending(true);
      await adminApi.disputeAddMessage(id, { message: msg.trim() });
      setMsg("");
      load();
    } catch (e) {
      const apiErr = e?.response?.data;
      console.error(apiErr || e?.message);
      Swal.fire({ icon: "error", title: "Erreur", text: apiErr?.detail || "Impossible." });
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="admin-card">Chargement...</div>;
  if (!d) return <div className="admin-card">Introuvable</div>;

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <button className="btn btn-outline-dark btn-sm" onClick={() => navigate(-1)}>← Retour</button>
        <button className="btn btn-dark btn-sm" onClick={load}>Rafraîchir</button>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <div className="admin-card">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <h5 className="mb-0">Dispute #{d.id}</h5>
                <div className="text-muted small">Booking #{d.booking_id}</div>
              </div>
              <span className="badge text-bg-dark">{d.status}</span>
            </div>

            <hr />

            <div className="fw-bold">{d.title}</div>
            <div className="text-muted small mt-1">{d.category} · priorité: {d.priority}</div>

            <hr />

            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={() => updateField({ status: "in_review" })}
              >
                En cours
              </button>
              <button
                className="btn btn-outline-success btn-sm"
                onClick={() => updateField({ status: "resolved" })}
              >
                Résolu
              </button>
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={() => updateField({ status: "rejected" })}
              >
                Rejeté
              </button>
            </div>

            <div className="mt-3">
              <label className="form-label small">Priorité</label>
              <select
                className="form-select"
                value={d.priority}
                onChange={(e) => updateField({ priority: e.target.value })}
              >
                <option value="low">low</option>
                <option value="normal">normal</option>
                <option value="high">high</option>
                <option value="urgent">urgent</option>
              </select>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-8">
          <div className="admin-card">
            <div className="fw-bold mb-2">Messages</div>

            <div style={{ maxHeight: 420, overflow: "auto" }}>
              {(d.messages || []).length === 0 ? (
                <div className="text-muted small">Aucun message</div>
              ) : (
                d.messages.map((m) => (
                  <div key={m.id} className="border rounded-3 p-2 mb-2">
                    <div className="d-flex justify-content-between">
                      <b style={{ fontSize: 13 }}>User #{m.author_id || "-"}</b>
                      <span className="text-muted small">
                        {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
                      </span>
                    </div>
                    <div className="mt-1">{m.message}</div>
                  </div>
                ))
              )}
            </div>

            <hr />

            <div className="d-flex gap-2">
              <input
                className="form-control"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="Répondre..."
              />
              <button className="btn btn-dark" onClick={sendMessage} disabled={sending}>
                {sending ? "..." : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}