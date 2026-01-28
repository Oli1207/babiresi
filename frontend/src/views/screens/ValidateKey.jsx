import { useState } from "react";
import Swal from "sweetalert2";
import apiInstance from "../../utils/axios";
import "./owner.css";

export default function ValidateKey() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const c = (code || "").trim();
    if (c.length !== 6) {
      Swal.fire({ icon: "warning", title: "Code", text: "Le code doit contenir 6 chiffres." });
      return;
    }

    setLoading(true);
    try {
      const { data } = await apiInstance.post("bookings/validate-key/", { code: c });

      Swal.fire({
        icon: "success",
        title: "Check-in validé",
        text: `Booking #${data.id} confirmé.`,
      });

      setCode("");
    } catch (e) {
      const apiErr = e?.response?.data;
      const msg = apiErr?.detail || JSON.stringify(apiErr || {}) || "Erreur.";
      Swal.fire({ icon: "error", title: "Erreur", text: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <div className="fw-bold" style={{ fontSize: 18 }}>Valider la remise de clé</div>
      <div className="text-muted small mb-3">Le client te donne un code. Tu le saisis ici.</div>

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body">
          <label className="form-label">Code (6 chiffres)</label>
          <input
            className="form-control"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Ex: 123456"
            style={{ fontSize: 22, fontWeight: 900, letterSpacing: 3, textAlign: "center" }}
          />

          <button className="btn btn-dark w-100 mt-3" disabled={loading} onClick={submit}>
            {loading ? "Validation..." : "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}
