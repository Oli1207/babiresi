import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language?.slice(0, 2);

  const toggle = () => {
    i18n.changeLanguage(current === 'fr' ? 'en' : 'fr');
  };

  return (
    <button className="lang-switcher" onClick={toggle} title="Switch language">
      {current === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}
    </button>
  );
}
