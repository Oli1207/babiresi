import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage?.slice(0, 2) || i18n.language?.slice(0, 2) || 'fr';
  const nextLanguage = current === 'fr' ? 'en' : 'fr';

  const toggle = () => {
    i18n.changeLanguage(nextLanguage);
  };

  return (
    <button
      className="lang-switcher"
      type="button"
      onClick={toggle}
      title={t('language.switchTo', { language: t(`language.${nextLanguage}`) })}
      aria-label={t('language.switchTo', { language: t(`language.${nextLanguage}`) })}
    >
      <span className={`lang-flag lang-flag-${current}`} aria-hidden="true" />
      <span>{current === 'fr' ? 'FR' : 'EN'}</span>
    </button>
  );
}
