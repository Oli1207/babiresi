import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Video, PlusCircle, Star, Trophy,
  Plane, ClipboardList,
  Map, Calendar, Building2, Inbox, Key, Home,
  Compass, LayoutGrid,
  Settings, IdCard, LogOut,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import './DashboardScreen.css';

function Section({ title, Icon, children }) {
  return (
    <section className="ds-section">
      <h2 className="ds-section-title">
        <Icon size={14} />
        {title}
      </h2>
      <div className="ds-cards">{children}</div>
    </section>
  );
}

function Card({ to, Icon, label, desc, accent, danger }) {
  const cls = `ds-card${accent ? ' ds-card-accent' : ''}${danger ? ' ds-card-danger' : ''}`;
  return (
    <Link to={to} className={cls}>
      <Icon size={22} className="ds-card-icon" strokeWidth={1.8} />
      <span className="ds-card-label">{label}</span>
      <span className="ds-card-desc">{desc}</span>
    </Link>
  );
}

export default function DashboardScreen() {
  const navigate   = useNavigate();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const getUser    = useAuthStore((s) => s.user);
  const user       = typeof getUser === 'function' ? getUser() : getUser;

  useEffect(() => {
    if (!isLoggedIn()) navigate('/login', { replace: true });
  }, [isLoggedIn, navigate]);

  if (!isLoggedIn()) return null;

  const userId  = user?.id ?? user?.user_id ?? null;
  const isOwner = user?.is_owner;

  return (
    <div className="ds-container">
      {/* Header */}
      <header className="ds-header">
        <div className="ds-avatar">
          {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
        </div>
        <div>
          <h1 className="ds-greeting">
            Bonjour{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="ds-subtitle">Portail touristique Côte d'Ivoire</p>
        </div>
      </header>

      {/* 1. Vlogs */}
      <Section title="Vlogs & Création" Icon={Video}>
        <Card to="/"              Icon={Video}        label="Explorer"         desc="Feed vidéo CI"        accent />
        <Card to="/vlogs/create"  Icon={PlusCircle}   label="Poster un vlog"   desc="Partager mon voyage" />
        <Card to="/vlogs/creator" Icon={Star}         label="Mes points"       desc="Revenus & retraits" />
        <Card to="/vlogs/challenges" Icon={Trophy}    label="Challenges"       desc="Concours en cours" />
      </Section>

      {/* 2. Voyages */}
      <Section title="Mes voyages" Icon={Plane}>
        <Card to="/voyager"             Icon={Plane}         label="Planifier"       desc="Nouveau séjour"   accent />
        <Card to="/voyager/mes-voyages" Icon={ClipboardList} label="Mes demandes"    desc="Devis & suivi" />
      </Section>

      {/* 3. Hébergements */}
      <Section title="Hébergements" Icon={Home}>
        <Card to="/residences"    Icon={Map}       label="Carte"             desc="Trouver un logement" />
        <Card to="/me/bookings"   Icon={Calendar}  label="Mes réservations"  desc="Historique & statuts" />
        {isOwner ? (
          <>
            <Card to="/dashboard/owner"    Icon={Building2} label="Mes annonces"      desc="Gérer mes logements" />
            <Card to="/owner/inbox"        Icon={Inbox}     label="Demandes reçues"   desc="Approuver / Refuser" />
            <Card to="/owner/validate-key" Icon={Key}       label="Valider clé"       desc="Code client" />
            <Card to="/create"             Icon={PlusCircle} label="Publier"          desc="Nouvelle annonce"  accent />
          </>
        ) : (
          <Card to="/create" Icon={PlusCircle} label="Devenir hôte" desc="Publier ma résidence" />
        )}
      </Section>

      {/* 4. Services */}
      <Section title="Services & Destinations" Icon={Compass}>
        <Card to="/services"  Icon={LayoutGrid} label="Services"      desc="Guides, activités, artisans" />
        <Card to="/decouvrir" Icon={Compass}    label="Destinations"  desc="Régions & lieux de CI" />
      </Section>

      {/* 5. Compte */}
      <Section title="Mon compte" Icon={Settings}>
        <Card to="/me/settings" Icon={Settings} label="Paramètres"    desc="Profil & mot de passe" />
        {userId != null && (
          <Card to={`/seller/${userId}`} Icon={IdCard} label="Profil public" desc="Vue des autres" />
        )}
        <Link to="/logout" className="ds-card ds-card-danger">
          <LogOut size={22} className="ds-card-icon" strokeWidth={1.8} />
          <span className="ds-card-label">Déconnexion</span>
          <span className="ds-card-desc">Quitter mon espace</span>
        </Link>
      </Section>
    </div>
  );
}
