import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }) =>
  "admin-link " + (isActive ? "active" : "");

export default function AdminSidebar() {
  return (
    <div className="admin-side">
      <div className="admin-brand">
        <div className="admin-brand-title">ADMIN</div>
        <div className="admin-brand-sub">Supervision</div>
      </div>

      <div className="admin-nav">
        <NavLink to="/admin" end className={linkClass}>Dashboard</NavLink>
        <NavLink to="/admin/bookings" className={linkClass}>Bookings</NavLink>
        <NavLink to="/admin/payouts" className={linkClass}>Reversements</NavLink>
        <NavLink to="/admin/disputes" className={linkClass}>Réclamations</NavLink>
        <NavLink to="/admin/audit" className={linkClass}>Audit</NavLink>

        <div className="admin-nav-sep" />

        <NavLink to="/admin/stats/owners" className={linkClass}>Stats · Gérants</NavLink>
        <NavLink to="/admin/stats/top-listings" className={linkClass}>Stats · Top résidences</NavLink>
        <NavLink to="/admin/stats/profit" className={linkClass}>Stats · Bénéfice</NavLink>
      </div>
    </div>
  );
}