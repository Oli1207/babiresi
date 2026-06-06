import { createElement, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Video, PlusCircle, Star, Trophy, Heart,
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
        {createElement(Icon, { size: 14 })}
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
      {createElement(Icon, { size: 22, className: 'ds-card-icon', strokeWidth: 1.8 })}
      <span className="ds-card-label">{label}</span>
      <span className="ds-card-desc">{desc}</span>
    </Link>
  );
}

export default function DashboardScreen() {
  const navigate   = useNavigate();
  const { t } = useTranslation();
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
            {t('dashboard.hello')}{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="ds-subtitle">{t('dashboard.subtitle')}</p>
        </div>
      </header>

      {/* 1. Vlogs */}
      <Section title={t('dashboard.sections.vlogs')} Icon={Video}>
        <Card to="/"              Icon={Video}        label={t('dashboard.cards.explore')}     desc={t('dashboard.cards.exploreDesc')} accent />
        <Card to="/vlogs/me"      Icon={Heart}        label={t('dashboard.cards.myVlogSpace')} desc={t('dashboard.cards.myVlogSpaceDesc')} />
        <Card to="/vlogs/create"  Icon={PlusCircle}   label={t('dashboard.cards.postVlog')}    desc={t('dashboard.cards.postVlogDesc')} />
        <Card to="/vlogs/creator" Icon={Star}         label={t('dashboard.cards.myPoints')}    desc={t('dashboard.cards.myPointsDesc')} />
        <Card to="/vlogs/challenges" Icon={Trophy}    label={t('nav.challenges')}              desc={t('dashboard.cards.challengesDesc')} />
      </Section>

      {/* 2. Voyages */}
      <Section title={t('dashboard.sections.trips')} Icon={Plane}>
        <Card to="/voyager"             Icon={Plane}         label={t('nav.plan')}          desc={t('dashboard.cards.newStay')} accent />
        <Card to="/voyager/mes-voyages" Icon={ClipboardList} label={t('travel.myRequests')} desc={t('dashboard.cards.quotesFollowup')} />
      </Section>

      {/* 3. Hébergements */}
      <Section title={t('listings.title')} Icon={Home}>
        <Card to="/carte"    Icon={Map}       label={t('nav.map')}                    desc={t('dashboard.cards.findStay')} />
        <Card to="/me/bookings"   Icon={Calendar}  label={t('dashboard.cards.myBookings')} desc={t('dashboard.cards.historyStatuses')} />
        {isOwner ? (
          <>
            <Card to="/dashboard/owner"    Icon={Building2} label={t('dashboard.cards.myListings')}      desc={t('dashboard.cards.manageListings')} />
            <Card to="/owner/inbox"        Icon={Inbox}     label={t('dashboard.cards.receivedRequests')} desc={t('dashboard.cards.approveReject')} />
            <Card to="/owner/validate-key" Icon={Key}       label={t('dashboard.cards.validateKey')}      desc={t('dashboard.cards.clientCode')} />
            <Card to="/create"             Icon={PlusCircle} label={t('dashboard.cards.publish')}         desc={t('dashboard.cards.newListing')}  accent />
          </>
        ) : (
          <Card to="/create" Icon={PlusCircle} label={t('dashboard.cards.becomeHost')} desc={t('dashboard.cards.publishResidence')} />
        )}
      </Section>

      {/* 4. Services */}
      <Section title={t('dashboard.sections.servicesDestinations')} Icon={Compass}>
        <Card to="/services"  Icon={LayoutGrid} label={t('nav.services')}      desc={t('dashboard.cards.servicesDesc')} />
        <Card to="/decouvrir" Icon={Compass}    label={t('nav.destinations')}  desc={t('dashboard.cards.destinationsDesc')} />
      </Section>

      {/* 5. Compte */}
      <Section title={t('dashboard.sections.account')} Icon={Settings}>
        <Card to="/me/settings" Icon={Settings} label={t('dashboard.cards.settings')} desc={t('dashboard.cards.settingsDesc')} />
        {userId != null && (
          <Card to={`/seller/${userId}`} Icon={IdCard} label={t('dashboard.cards.publicProfile')} desc={t('dashboard.cards.publicProfileDesc')} />
        )}
        <Link to="/logout" className="ds-card ds-card-danger">
          <LogOut size={22} className="ds-card-icon" strokeWidth={1.8} />
          <span className="ds-card-label">{t('nav.logout')}</span>
          <span className="ds-card-desc">{t('dashboard.cards.leaveSpace')}</span>
        </Link>
      </Section>
    </div>
  );
}
