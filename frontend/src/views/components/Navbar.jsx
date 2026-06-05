import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Globe, Map, Briefcase, Plane, User, LogIn, UserPlus, LogOut, Menu, X, Users } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import NotificationBell from './NotificationBell';
import LanguageSwitcher from './LanguageSwitcher';
import logoImage from '../../assets/logo.png';
import './Navbar.css';

function Navbar() {
  useAuthStore((state) => state.allUserData);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const location   = useLocation();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const active = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/')
      ? 'navbar-link active'
      : 'navbar-link';

  return (
    <nav className="navbar-glass">
      <div className="navbar-container">

        {/* Brand */}
        <Link to="/" className="navbar-brand" onClick={close}>
          <img src={logoImage} alt="Babiresi" className="navbar-logo" />
        </Link>

        {/* Hamburger */}
        <button className="navbar-toggle" onClick={() => setOpen(o => !o)} aria-label="Menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Links */}
        <div className={`navbar-links ${open ? 'mobile-open' : ''}`}>

          <Link to="/decouvrir" className={active('/decouvrir')} onClick={close}>
            <Globe size={15} /> Destinations
          </Link>
          <Link to="/carte" className={active('/carte')} onClick={close}>
            <Map size={15} /> Carte
          </Link>
          <Link to="/services" className={active('/services')} onClick={close}>
            <Briefcase size={15} /> Services
          </Link>
          <Link to="/coloc" className={active('/coloc')} onClick={close}>
            <Users size={15} /> Coloc
          </Link>
          <Link to="/voyager" className={`${active('/voyager')} navbar-link-primary`} onClick={close}>
            <Plane size={15} /> Planifier
          </Link>

          <div className="navbar-divider" />

          {isLoggedIn() ? (
            <>
              <Link to="/mon-espace" className={active('/mon-espace')} onClick={close}>
                <User size={15} /> Mon espace
              </Link>
              <NotificationBell />
              <LanguageSwitcher />
              <Link to="/logout" className="navbar-logout-btn" onClick={close}>
                <LogOut size={14} /> Déconnexion
              </Link>
            </>
          ) : (
            <>
              <LanguageSwitcher />
              <Link to="/login" className="navbar-link" onClick={close}>
                <LogIn size={15} /> Connexion
              </Link>
              <Link to="/register" className="navbar-link navbar-link-primary" onClick={close}>
                <UserPlus size={15} /> S'inscrire
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
