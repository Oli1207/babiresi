/**
 * BottomNav — barre de navigation mobile (5 onglets)
 * Affichée sur la plupart des pages ; masquée sur le feed vlog,
 * la carte, le mode coloc et les pages plein écran (géré dans App.jsx).
 */
import { Link, useLocation } from 'react-router-dom';
import { Play, Map, Briefcase, Users, User } from 'lucide-react';
import './BottomNav.css';

const TABS = [
  { to: '/',           label: 'Accueil',  Icon: Play,      match: (p) => p === '/' },
  { to: '/carte',      label: 'Carte',    Icon: Map,       match: (p) => p.startsWith('/carte') },
  { to: '/services',   label: 'Services', Icon: Briefcase, match: (p) => p.startsWith('/services') },
  { to: '/coloc',      label: 'Coloc',    Icon: Users,     match: (p) => p.startsWith('/coloc') },
  { to: '/mon-espace', label: 'Profil',   Icon: User,      match: (p) => p.startsWith('/mon-espace') },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="bottom-nav">
      {TABS.map(({ to, label, Icon, match }) => {
        const active = match(pathname);
        return (
          <Link key={to} to={to} className={`bottom-nav-item ${active ? 'active' : ''}`}>
            <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
