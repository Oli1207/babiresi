// src/pages/Auth/Register.jsx (ou équivalent)
import React, { useState, useEffect } from "react";
import { register, login } from "../../utils/auth";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../../store/auth";
import Swal from "sweetalert2";
import logoImage from "../../assets/logo.png";
import "./login.css";

function Register() {
  const [full_name, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const setUser = useAuthStore((state) => state.setUser);

  // ✅ NEW: gestion modal + consentement politique
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      navigate("/");
    }
  }, []);

  const resetForm = () => {
    setFullname("");
    setEmail("");
    setMobile("");
    setPassword("");
    setPassword2("");
    // ✅ NEW
    setAcceptPrivacy(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ NEW: bloquer si pas accepté
    if (!acceptPrivacy) {
      Swal.fire({
        icon: "warning",
        title: "Confirmation requise",
        text: "Veuillez accepter la Politique de confidentialité pour continuer.",
        position: "center",
        confirmButtonText: "OK",
      });
      return;
    }

    setIsLoading(true);

    const { error } = await register(full_name, email, phone, password, password2);

    if (error) {
      Swal.fire({
        icon: "error",
        title: "Erreur",
        text: "Vérifiez les informations fournies.",
        position: "center",
        confirmButtonText: "OK",
      });
      setIsLoading(false);
    } else {
      // ✅ inscription OK → on tente un login automatique
      const { error: loginError, data } = await login(email, password);

      if (loginError) {
        Swal.fire({
          icon: "success",
          title: "Inscription réussie",
          text: "Votre compte a bien été créé. Vous pouvez maintenant vous connecter.",
          position: "center",
          confirmButtonText: "OK",
        });
        setIsLoading(false);
        resetForm();
        navigate("/login");
        return;
      }

      // ✅ on met le user dans le store
      if (data?.user) {
        setUser(data.user);
      }

      Swal.fire({
        icon: "success",
        title: "Inscription réussie",
        text: "Votre compte a bien été créé, vous êtes connecté !",
        position: "center",
        confirmButtonText: "OK",
      });

      navigate("/");
      setIsLoading(false);
      resetForm();
    }
  };

  // ✅ NEW: contenu politique (affiché dans modal)
  const PrivacyContent = () => (
    <div style={{ lineHeight: 1.5, fontSize: 14 }}>
      <p style={{ marginTop: 0 }}>
        <strong>Politique de Confidentialité & de Sécurité — Decrou Resi</strong>
        <br />
        <span style={{ opacity: 0.8 }}>Dernière mise à jour : 02 mars 2026</span>
      </p>

      <p>
        Decrou Resi collecte et utilise certaines informations (nom, email/téléphone, réservations, messages, données
        techniques) afin de fournir le service, sécuriser la plateforme, traiter les paiements et vous assister en cas de
        problème.
      </p>

      <p>
        <strong>Paiements (Paystack)</strong> : les paiements sont traités via Paystack. Decrou Resi ne stocke pas vos
        informations de carte bancaire. Nous pouvons conserver des références de transaction (ID, statut, montant, date)
        pour le support et la prévention de la fraude.
      </p>

      <p>
        <strong>Paiements obligatoirement sur la plateforme</strong> : tout paiement doit être effectué exclusivement sur
        Decrou Resi. Les paiements hors plateforme ne permettent pas à Decrou Resi de sécuriser la transaction ni
        d’appliquer la procédure de remboursement.
      </p>

      <p>
        <strong>Hôtes / Gérants (obligations)</strong> : le gérant/hôte doit publier des informations et images réelles,
        fidèles à la résidence (pas d’images trompeuses), maintenir un niveau raisonnable de propreté et sécurité, et ne
        pas contourner la plateforme (paiements externes).
      </p>

      <p>
        <strong>Hors plateforme</strong> : Decrou Resi n’est pas responsable de tout ce qui se fait en dehors de la plateforme. Entre autres, elle n'est pas responsable des paiements, accords ou litiges réalisés en
        dehors de la plateforme (Wave/cash/transfert, discussions privées, etc.).
      </p>

  <p>
  <strong>Remboursement (non-conformité)</strong> : si la résidence est non conforme à l’annonce (fausses photos,
  équipements essentiels absents, insalubrité grave, impossibilité d’accès, annulation injustifiée, etc.), un remboursement
  peut être accordé après vérification (preuves). <strong>Important :</strong> à votre arrivée, vérifiez la conformité de
  la résidence <strong>avant</strong> de communiquer le <strong>code de confirmation</strong> au gérant/hôte. Une fois le
  code transmis, la réservation est considérée comme validée et <strong>le paiement est libéré au gérant</strong> ; dans
  ce cas, Decrou Resi peut ne pourra plus récupérer les fonds. Le remboursement, lorsqu’il est validé, se fait
  <strong> hors frais de transaction et de service</strong>.
</p>

      <p>
        <strong>Vos droits</strong> : vous pouvez demander l’accès, la rectification ou la suppression de vos données :
        <strong> support@decrouresi.com</strong>.
      </p>
    </div>
  );

  return (
    <div className="login-container">
      <div className="login-logo">
        <img src={logoImage} alt="Decrou Resi" />
      </div>

      <div className="login-box">
        <h2>Créer un compte</h2>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="full_name" className="form-label">
              Nom et prénoms
            </label>
            <input
              type="text"
              id="full_name"
              placeholder="Nom et prénoms"
              value={full_name}
              onChange={(e) => setFullname(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              type="email"
              id="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone" className="form-label">
              Numéro de téléphone
            </label>
            <input
              type="number"
              id="phone"
              placeholder="Numéro"
              value={phone}
              onChange={(e) => setMobile(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Mot de passe
            </label>
            <input
              type="password"
              id="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password2" className="form-label">
              Confirmez votre mot de passe
            </label>
            <input
              type="password"
              id="password2"
              placeholder="Confirmez votre mot de passe"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="input-field"
            />
          </div>

          {/* ✅ NEW: consentement + ouverture du modal */}
          <div className="form-group" style={{ marginTop: 6 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={acceptPrivacy}
                onChange={(e) => setAcceptPrivacy(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span style={{ fontSize: 13, lineHeight: 1.4 }}>
                En créant un compte, vous confirmez avoir lu et accepté notre{" "}
                <button
                  type="button"
                  onClick={() => setShowPrivacy(true)}
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    color: "inherit",
                    textDecoration: "underline",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Politique de confidentialité & de sécurité
                </button>
                .
              </span>
            </label>
          </div>
  <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.4, opacity: 0.9 }}>
            <strong>Sécurité paiement :</strong> Tous les paiements doivent être effectués exclusivement sur{" "}
            <strong>Decrou Resi</strong>. N’effectuez aucun paiement hors plateforme
            (Wave/cash/transfert), car Decrou Resi ne pourra pas garantir la transaction ni traiter un remboursement selon
            nos conditions.
          </div>
          
          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? "Chargement..." : "Créer un compte"}
          </button>

          {/* ✅ NEW: message sécurité paiement (juste sous le bouton) */}
        
        </form>

        <div className="sign-up-prompt">
          Vous avez déjà un compte ? <Link to="/login">Connectez-vous</Link>
        </div>
      </div>

      {/* ✅ NEW: Modal Politique de confidentialité */}
      {showPrivacy && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowPrivacy(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 720,
              background: "#fff",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              <div style={{ fontWeight: 800 }}>Politique de confidentialité</div>
              <button
                type="button"
                onClick={() => setShowPrivacy(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                }}
                aria-label="Fermer"
                title="Fermer"
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 16, maxHeight: "70vh", overflowY: "auto" }}>
              <PrivacyContent />
            </div>

            <div
              style={{
                padding: 16,
                borderTop: "1px solid rgba(0,0,0,0.08)",
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setShowPrivacy(false)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.2)",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Fermer
              </button>

              {/* ✅ NEW: bouton "J'accepte" pour cocher automatiquement */}
              <button
                type="button"
                onClick={() => {
                  setAcceptPrivacy(true);
                  setShowPrivacy(false);
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "none",
                  background: "#111",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                J’accepte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Register;