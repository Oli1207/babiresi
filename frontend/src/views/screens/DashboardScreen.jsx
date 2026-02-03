/**
 * DashboardScreen.jsx
 * Page "Mon Espace" : hub central pour les actions client (réservations, explorer)
 * et propriétaire (annonces, inbox, publier) + lien vers le profil public.
 * Route : /mon-espace — réservée aux utilisateurs connectés.
 */

import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth";
import "./DashboardScreen.css";

export default function DashboardScreen() {
  const navigate = useNavigate();

  // Récupération du user : le store expose user comme une fonction qui retourne l'objet
  const getUser = useAuthStore((state) => state.user);
  const user = typeof getUser === "function" ? getUser() : getUser;
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  // Redirection si non connecté (évite d'afficher le dashboard en étant déco)
  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/login", { replace: true });
    }
  }, [isLoggedIn, navigate]);

  // Id du user pour le lien "Mon profil public" (page vendeur /seller/:userId)
  const userId = user?.id ?? user?.user_id ?? null;

  // Ne rien afficher le temps de la redirection (évite un flash de contenu)
  if (!isLoggedIn()) {
    return null;
  }

  return (
    <div className="dashboard-container">
      {/* En-tête : titre + sous-titre */}
      <header className="dashboard-header">
        <h1 className="dashboard-title">Mon Espace</h1>
        <p className="dashboard-subtitle">
          Gérez vos réservations et vos annonces.
        </p>
      </header>

      {/* Bloc : En tant que client */}
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">En tant que client</h2>
        <div className="dashboard-cards">
          <Link to="/me/bookings" className="dashboard-card">
            <span className="dashboard-card-label">Mes réservations</span>
            <span className="dashboard-card-desc">Voir et suivre mes demandes de réservation</span>
          </Link>
          <Link to="/" className="dashboard-card">
            <span className="dashboard-card-label">Explorer les résidences</span>
            <span className="dashboard-card-desc">Carte et liste des logements disponibles</span>
          </Link>
        </div>
      </section>

      {/* Bloc : En tant que propriétaire */}
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">En tant que propriétaire</h2>
        <div className="dashboard-cards">
          <Link to="/dashboard/owner" className="dashboard-card">
            <span className="dashboard-card-label">Mes annonces</span>
            <span className="dashboard-card-desc">Gérer mes résidences publiées</span>
          </Link>
          <Link to="/owner/inbox" className="dashboard-card">
            <span className="dashboard-card-label">Boîte de réception</span>
            <span className="dashboard-card-desc">Demandes de réservation reçues</span>
          </Link>
          <Link to="/create" className="dashboard-card">
            <span className="dashboard-card-label">Publier une résidence</span>
            <span className="dashboard-card-desc">Créer une nouvelle annonce</span>
          </Link>
          <Link to="/owner/validate-key" className="dashboard-card">
            <span className="dashboard-card-label">Valider la remise de clé</span>
            <span className="dashboard-card-desc">Saisir le code à 6 chiffres donné par le client</span>
          </Link>
        </div>
      </section>

      {/* Bloc : Compte */}
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Compte</h2>
        <div className="dashboard-cards">
          {userId != null ? (
            <Link to={`/seller/${userId}`} className="dashboard-card">
              <span className="dashboard-card-label">Mon profil public</span>
              <span className="dashboard-card-desc">Voir mon profil vendeur tel qu’il apparaît aux autres</span>
            </Link>
          ) : (
            <div className="dashboard-card dashboard-card-disabled">
              <span className="dashboard-card-label">Mon profil public</span>
              <span className="dashboard-card-desc">Profil indisponible (id manquant)</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
