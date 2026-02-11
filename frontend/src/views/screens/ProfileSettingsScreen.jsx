import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import apiInstance from "../../utils/axios";
import UserData from "../plugin/UserData";

/**
 * ProfileSettingsScreen.jsx
 * Page paramètres compte :
 * - Modifier profil (nom, phone) + profil (about, etc.) + photo
 * - Changer mot de passe
 *
 * Routes API utilisées (backend):
 * - GET    user/me/
 * - PATCH  user/me/update/   (multipart/form-data)
 * - POST   user/me/change-password/ (json)
 */

function safeText(x) {
  return x == null ? "" : String(x);
}

export default function ProfileSettingsScreen() {
  const navigate = useNavigate();
  const userData = UserData();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  // Data
  const [me, setMe] = useState(null); // {id,email,full_name,...}
  const [profile, setProfile] = useState(null); // ProfileSerializer

  // Form: profil
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [about, setAbout] = useState("");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  // Photo
  const [photoFile, setPhotoFile] = useState(null);
  const photoPreview = useMemo(() => {
    if (photoFile) return URL.createObjectURL(photoFile);
    return profile?.image_url || "/avatar.png";
  }, [photoFile, profile?.image_url]);

  // Form: password
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");

  useEffect(() => {
    if (!userData) return;

    (async () => {
      setLoading(true);
      try {
        // ✅ 1) user safe
        const { data: u } = await apiInstance.get("user/me/");
        setMe(u);

        // ✅ 2) profile public (par id)
        const uid = u?.id;
        if (uid) {
          const { data: p } = await apiInstance.get(`user/profile/${uid}/`);
          setProfile(p);

          // hydrate form
          setFullName(safeText(u.full_name));
          setPhone(safeText(u.phone));
          setAbout(safeText(p.about));
          setGender(safeText(p.gender));
          setCountry(safeText(p.country));
          setState(safeText(p.state));
          setCity(safeText(p.city));
          setAddress(safeText(p.address));
        }
      } catch (e) {
        console.error("settings load error:", e?.response?.data || e?.message);
        Swal.fire({ icon: "error", title: "Erreur", text: "Impossible de charger ton profil." });
      } finally {
        setLoading(false);
      }
    })();
  }, [userData]);

  if (!userData) {
    return (
      <div className="container py-5 text-center">
        <h4>Accès restreint</h4>
        <p className="text-muted">Connecte-toi pour accéder à tes paramètres.</p>
        <button className="btn btn-dark" onClick={() => navigate("/login")}>Se connecter</button>
      </div>
    );
  }

  const onPickPhoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
  };

  const reloadProfile = async (userId) => {
    try {
      const { data: p } = await apiInstance.get(`user/profile/${userId}/`);
      setProfile(p);
    } catch (_) {}
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!me?.id) return;

    setSaving(true);
    try {
      const fd = new FormData();

      // ✅ User fields
      fd.append("full_name", fullName);
      fd.append("phone", phone);

      // ✅ Profile fields
      fd.append("about", about);
      fd.append("gender", gender);
      fd.append("country", country);
      fd.append("state", state);
      fd.append("city", city);
      fd.append("address", address);

      // ✅ Photo (field name = image, car Profile.image)
      if (photoFile) fd.append("image", photoFile);

      // IMPORTANT: endpoint attend multipart/form-data
      const { data } = await apiInstance.patch("user/me/update/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Le backend renvoie { user, profile }
      if (data?.user) setMe(data.user);
      if (data?.profile) setProfile(data.profile);

      // refresh profile endpoint (au cas où)
      await reloadProfile(me.id);

      setPhotoFile(null);
      Swal.fire({ icon: "success", title: "OK", text: "Profil mis à jour ✅", timer: 1200, showConfirmButton: false });
    } catch (e2) {
      const msg = e2?.response?.data ? JSON.stringify(e2.response.data) : "Action impossible.";
      Swal.fire({ icon: "error", title: "Erreur", text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!oldPassword || !newPassword || !newPassword2) {
      Swal.fire({ icon: "warning", title: "Attention", text: "Remplis tous les champs." });
      return;
    }

    setSavingPass(true);
    try {
      await apiInstance.post("user/me/change-password/", {
        old_password: oldPassword,
        new_password: newPassword,
        new_password2: newPassword2,
      });

      setOldPassword("");
      setNewPassword("");
      setNewPassword2("");

      Swal.fire({
        icon: "success",
        title: "OK",
        html: "Mot de passe mis à jour ✅<br/><span style='font-size:13px;color:#666'>Par sécurité, reconnecte-toi si tu veux.</span>",
      });
    } catch (e2) {
      const msg = e2?.response?.data ? JSON.stringify(e2.response.data) : "Impossible de changer le mot de passe.";
      Swal.fire({ icon: "error", title: "Erreur", text: msg });
    } finally {
      setSavingPass(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-4" style={{ maxWidth: 920 }}>
        <div className="alert alert-light border">Chargement…</div>
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: 920 }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <button className="btn btn-outline-dark btn-sm" onClick={() => navigate(-1)}>
          ← Retour
        </button>
        <div className="small text-muted">Paramètres du compte</div>
      </div>

      <div className="row g-3">
        {/* ====== PROFIL ====== */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">
              <h5 className="mb-3">Profil</h5>

              <form onSubmit={handleSave}>
                <div className="d-flex align-items-center gap-3 mb-3">
                  <div style={{ width: 72, height: 72 }}>
                    <img
                      src={photoPreview}
                      alt="avatar"
                      style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover" }}
                    />
                  </div>

                  <div className="flex-grow-1">
                    <label className="form-label">Photo de profil</label>
                    <input className="form-control" type="file" accept="image/*" onChange={onPickPhoto} />
                    <div className="small text-muted mt-1">PNG/JPG. Tu peux remplacer à tout moment.</div>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Nom complet</label>
                  <input className="form-control" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>

                <div className="mb-3">
                  <label className="form-label">Téléphone</label>
                  <input className="form-control" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>

                <div className="mb-3">
                  <label className="form-label">À propos</label>
                  <textarea className="form-control" rows={3} value={about} onChange={(e) => setAbout(e.target.value)} />
                </div>

                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label">Genre</label>
                    <input className="form-control" value={gender} onChange={(e) => setGender(e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Pays</label>
                    <input className="form-control" value={country} onChange={(e) => setCountry(e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">État / Région</label>
                    <input className="form-control" value={state} onChange={(e) => setState(e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Ville</label>
                    <input className="form-control" value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Adresse</label>
                    <input className="form-control" value={address} onChange={(e) => setAddress(e.target.value)} />
                  </div>
                </div>

                <div className="mt-3">
                  <button className="btn btn-dark" disabled={saving}>
                    {saving ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* ====== PASSWORD ====== */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">
              <h5 className="mb-3">Mot de passe</h5>

              <form onSubmit={handleChangePassword}>
                <div className="mb-2">
                  <label className="form-label">Ancien mot de passe</label>
                  <input
                    type="password"
                    className="form-control"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-2">
                  <label className="form-label">Nouveau mot de passe</label>
                  <input
                    type="password"
                    className="form-control"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Confirmer</label>
                  <input
                    type="password"
                    className="form-control"
                    value={newPassword2}
                    onChange={(e) => setNewPassword2(e.target.value)}
                    required
                  />
                </div>

                <button className="btn btn-outline-dark w-100" disabled={savingPass}>
                  {savingPass ? "..." : "Changer le mot de passe"}
                </button>
              </form>

              <div className="small text-muted mt-3">
                Si tu as des soucis de session après changement, déconnecte-toi puis reconnecte-toi.
              </div>
            </div>
          </div>

          {/* Info email */}
          <div className="alert alert-light border mt-3">
            <div className="small text-muted">Email</div>
            <div className="fw-semibold">{me?.email || ""}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
