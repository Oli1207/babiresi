/**
 * BottomNav — barre de navigation mobile (5 onglets)
 * Affichée sur la plupart des pages ; masquée sur le feed vlog,
 * la carte, le mode coloc et les pages plein écran (géré dans App.jsx).
 */
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createElement } from 'react';
import { Play, Map, Briefcase, Users, User } from 'lucide-react';
import './BottomNav.css';

const TABS = [
  { to: '/',           labelKey: 'nav.home',     Icon: Play,      match: (p) => p === '/' },
  { to: '/carte',      labelKey: 'nav.map',      Icon: Map,       match: (p) => p.startsWith('/carte') },
  { to: '/services',   labelKey: 'nav.services', Icon: Briefcase, match: (p) => p.startsWith('/services') },
  { to: '/coloc',      labelKey: 'nav.coloc',    Icon: Users,     match: (p) => p.startsWith('/coloc') },
  { to: '/mon-espace', labelKey: 'nav.profile',  Icon: User,      match: (p) => p.startsWith('/mon-espace') },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  return (
    <nav className="bottom-nav">
      {TABS.map(({ to, labelKey, Icon, match }) => {
        const active = match(pathname);
        return (
          <Link key={to} to={to} className={`bottom-nav-item ${active ? 'active' : ''}`}>
            {createElement(Icon, { size: 22, strokeWidth: active ? 2.4 : 1.8 })}
            <span>{t(labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
