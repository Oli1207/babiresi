import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './locales/fr.json';
import en from './locales/en.json';

const supportedLanguages = ['fr', 'en'];
const savedLanguage = localStorage.getItem('babiresi_lang')?.slice(0, 2);
const systemLanguage = (navigator.languages?.[0] || navigator.language || 'fr').slice(0, 2);
const initialLanguage = supportedLanguages.includes(savedLanguage)
  ? savedLanguage
  : supportedLanguages.includes(systemLanguage)
    ? systemLanguage
    : 'fr';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: initialLanguage,
    fallbackLng: 'fr',
    supportedLngs: supportedLanguages,
    cleanCode: true,
    interpolation: { escapeValue: false },
  });

i18n.on('languageChanged', (lng) => {
  const language = supportedLanguages.includes(lng?.slice(0, 2)) ? lng.slice(0, 2) : 'fr';
  localStorage.setItem('babiresi_lang', language);
  document.documentElement.lang = language;
});

document.documentElement.lang = initialLanguage;

export default i18n;
