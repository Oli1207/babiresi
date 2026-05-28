export function setSEO({ title, description, image, url, type = 'website' }) {
  const siteName = 'Babiresi';
  const fullTitle = title ? `${title} — ${siteName}` : `${siteName} — Découvrez la Côte d'Ivoire`;
  const desc = description || "Vlogs authentiques, guides certifiés et séjours organisés en Côte d'Ivoire.";
  const img = image || 'https://babiresi.com/og-cover.jpg';
  const canonical = url || window.location.href;

  document.title = fullTitle;
  setMeta('name', 'description', desc);
  setMeta('property', 'og:title', fullTitle);
  setMeta('property', 'og:description', desc);
  setMeta('property', 'og:image', img);
  setMeta('property', 'og:url', canonical);
  setMeta('property', 'og:type', type);
  setMeta('name', 'twitter:title', fullTitle);
  setMeta('name', 'twitter:description', desc);
  setMeta('name', 'twitter:image', img);
  setCanonical(canonical);
}

function setMeta(attr, key, value) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setCanonical(url) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}
