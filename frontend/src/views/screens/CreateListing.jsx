import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import UserData from "../plugin/UserData";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie"; // ✅ ajoute en haut du fichier


import apiInstance from "../../utils/axios";

const Toast = Swal.mixin({
  toast: true,
  position: "top",
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
});

function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (typeof lat === "number" && typeof lng === "number") {
      map.setView([lat, lng], 16);
    }
  }, [lat, lng, map]);
  return null;
}

function MapClickHandler({ onPick }) {
  const map = useMap();

  useEffect(() => {
   const onClick = (e) => {
  if (!e?.latlng) return;
  onPick(e.latlng.lat, e.latlng.lng);
};

    map.on("click", onClick);
    return () => map.off("click", onClick);
  }, [map, onPick]);

  return null;
}

export default function CreateListing() {
  // ✅ FORM STATE
  const [form, setForm] = useState({
    title: "",
    description: "",
    listing_type: "appartement",
    price_per_night: "",
    max_guests: 1,

    // ✅ NEW: pièces / couchage
    bedrooms: 0,
    bathrooms: 0,
    living_rooms: 0,
    kitchens: 0,
    beds: 0,

    address_label: "",
    city: "",
    area: "", // commune
    borough: "", // quartier

    has_wifi: false,
    has_ac: false,
    has_parking: false,
    has_tv: false,
    has_kitchen: false,
    has_hot_water: false,

        // ✅ NEW: amenities avancées
    has_garden: false,
    has_balcony: false,
    has_generator: false,
    has_security: false,

    // ✅ NEW: règles
    allows_smoking: false,
    allows_pets: false,


    latitude: null,
    longitude: null,
  });

  const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));

  // ✅ FILES
  const [coverImage, setCoverImage] = useState(null);
  const [galleryImages, setGalleryImages] = useState([]);

  // ✅ GEO/UX STATE
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [geoError, setGeoError] = useState("");

  // ✅ Autocomplete (Yango style)
  const [addressQuery, setAddressQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);

  // ✅ si user édite manuellement -> on n'écrase pas ses champs
  const [manualAddressEdit, setManualAddressEdit] = useState(false);

  // ✅ timers / refs
  const reverseTimer = useRef(null);
  const suggestTimer = useRef(null);
  const lastCoordsRef = useRef({ lat: null, lng: null });

  
  // ✅ default center
  const center = useMemo(() => {
    const lat = typeof form.latitude === "number" ? form.latitude : 5.359952; // Abidjan
    const lng = typeof form.longitude === "number" ? form.longitude : -4.008256;
    return { lat, lng };
  }, [form.latitude, form.longitude]);

  const navigate = useNavigate();
const userData = UserData();
console.log(userData)
if (!userData) {
  return (
    <div className="container py-5 text-center">
      <h4>Accès restreint</h4>
      <p className="text-muted">Connecte-toi pour publier une résidence.</p>
      <button className="btn btn-dark" onClick={() => navigate("/login")}>
        Se connecter
      </button>
    </div>
  );
}

  // ✅ fermer dropdown si click dehors
  useEffect(() => {
    const onDocClick = () => setShowSuggestions(false);
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // =========================
  // ✅ GEO: reverse
  // =========================
  const reverseGeocode = async (latitude, longitude) => {
    try {
      const { data } = await apiInstance.post("utils/reverse-geocode/", {
        latitude,
        longitude,
      });

      // ✅ DEBUG logs
      console.log("reverse-geocode response:", data);
      console.log("reverse-geocode raw.address:", data?.raw?.address);

      // ✅ timeout => backend renvoie 200 + warning
      if (data?.warning === "geocode_timeout") {
        setGeoError("Connexion lente : tu peux remplir l’adresse manuellement ou réessayer.");
        return;
      }

      // ✅ auto fill MAIS editable (si user n'a pas pris la main)
      setForm((p) => ({
        ...p,
        address_label: manualAddressEdit ? p.address_label : (data?.address_label || p.address_label),
        city: manualAddressEdit ? p.city : (data?.city || p.city),
        area: manualAddressEdit ? p.area : (data?.area || p.area),
        borough: manualAddressEdit ? p.borough : (data?.borough || p.borough),
      }));

      // ✅ si user n'a pas édité, on met aussi la barre de recherche
      if (!manualAddressEdit && data?.address_label) {
        setAddressQuery(data.address_label);
      }

      setGeoError("");
    } catch (e) {
      // ✅ DEBUG logs (si jamais il y a encore une 400 autre que timeout)
      console.error("reverse-geocode error:", {
        message: e?.message,
        status: e?.response?.status,
        data: e?.response?.data,
      });

      const detail =
        e?.response?.data?.detail ||
        e?.response?.data?.error ||
        e?.message ||
        "Impossible de récupérer l’adresse automatiquement.";

      setGeoError(detail);
    }
  };

  const setCoordsAndAutofill = (latitude, longitude) => {
    setGeoError("");

    // ✅ skip si mouvement trop faible (anti-spam)
    const prev = lastCoordsRef.current;
    const delta =
      prev.lat === null
        ? 999
        : Math.abs(prev.lat - latitude) + Math.abs(prev.lng - longitude);

    setForm((p) => ({ ...p, latitude, longitude }));

    // ~0.00015 ≈ ~15-20m (ajuste si tu veux)
    if (delta < 0.00015) return;

    lastCoordsRef.current = { lat: latitude, lng: longitude };

    // ✅ debounce reverse-geocode (anti-timeout)
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    reverseTimer.current = setTimeout(() => {
      reverseGeocode(latitude, longitude);
    }, 1000);
  };

  const useMyLocation = () => {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Géolocalisation non supportée.");
      return;
    }

    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // ✅ user prend pas la main => on autorise auto-fill
        setManualAddressEdit(false);

        setCoordsAndAutofill(lat, lng);
        setLoadingGeo(false);
        Toast.fire({ icon: "success", title: "Position détectée" });
      },
      () => {
        setLoadingGeo(false);
        setGeoError("Autorisation refusée ou localisation indisponible.");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  // ✅ Marker draggable
  const MarkerDraggable = () => {
   if (typeof form.latitude !== "number" || typeof form.longitude !== "number") {
  return null;
}

const position = [form.latitude, form.longitude];


    return (
      <Marker
        draggable
        position={position}
        eventHandlers={{
          dragend: (e) => {
            const p = e.target.getLatLng();

            // ✅ si user drag le pin, on repasse en auto-fill (logique)
            setManualAddressEdit(false);

            setCoordsAndAutofill(p.lat, p.lng);
          },
        }}
      />
    );
  };

  // =========================
  // ✅ AUTOCOMPLETE (forward geocode)
  // =========================
  const searchPlaces = async (q) => {
    const query = (q || "").trim();
    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoadingSuggest(true);
    try {
      const { data } = await apiInstance.get(
        `utils/search-places/?q=${encodeURIComponent(query)}&limit=6`
      );

      const results = data?.results || [];
      setSuggestions(results);
      setShowSuggestions(true);

      // ✅ DEBUG
      console.log("search-places results:", results);
    } catch (e) {
      console.error("search-places error:", e?.response?.data || e?.message);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoadingSuggest(false);
    }
  };

  const onSelectSuggestion = (s) => {
    if (!s) return;

    // ✅ on repasse en mode auto-fill
    setManualAddressEdit(false);
    setShowSuggestions(false);

    // ✅ center map + pin
    setCoordsAndAutofill(Number(s.latitude), Number(s.longitude));

    // ✅ remplit immédiatement (sans attendre reverse)
    setForm((p) => ({
      ...p,
      address_label: s.address_label || p.address_label,
      city: s.city || p.city,
      area: s.area || p.area,
      borough: s.borough || p.borough,
    }));

    setAddressQuery(s.address_label || "");
  };

  // =========================
  // ✅ IMAGES
  // =========================
  const onPickCover = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      Toast.fire({ icon: "warning", title: "Le cover doit être une image" });
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      Toast.fire({ icon: "warning", title: "Cover trop lourd (max 6MB)" });
      return;
    }
    setCoverImage(file);
  };

  const onPickGallery = (files) => {
    const arr = Array.from(files || []);
    if (!arr.length) return;

    const cleaned = arr
      .filter((f) => f.type.startsWith("image/"))
      .filter((f) => f.size <= 6 * 1024 * 1024);

    const MAX = 10;
    const merged = [...galleryImages, ...cleaned].slice(0, MAX);

    setGalleryImages(merged);

    if (merged.length === MAX) {
      Toast.fire({ icon: "info", title: `Galerie limitée à ${MAX} images` });
    }
  };

  const removeGalleryImage = (idx) => {
    setGalleryImages((p) => p.filter((_, i) => i !== idx));
  };

  const coverPreview = useMemo(
    () => (coverImage ? URL.createObjectURL(coverImage) : null),
    [coverImage]
  );
  const galleryPreviews = useMemo(
    () => galleryImages.map((f) => URL.createObjectURL(f)),
    [galleryImages]
  );

  // =========================
  // ✅ SUBMIT
  // =========================
  const submit = async (e) => {
    e.preventDefault();

    if (!coverImage) {
      Toast.fire({ icon: "warning", title: "Ajoute une photo de couverture" });
      return;
    }
    if (!form.title.trim()) {
      Toast.fire({ icon: "warning", title: "Le titre est obligatoire" });
      return;
    }
    if (typeof form.latitude !== "number" || typeof form.longitude !== "number") {
      Toast.fire({ icon: "warning", title: "Choisis la localisation sur la carte" });
      return;
    }
    if (!String(form.price_per_night).trim()) {
      Toast.fire({ icon: "warning", title: "Ajoute un prix / nuit" });
      return;
    }

    setLoadingSubmit(true);

    try {
      const fd = new FormData();

      // ✅ fields
      fd.append("title", form.title);
      fd.append("description", form.description || "");
      fd.append("listing_type", form.listing_type);

      fd.append("price_per_night", String(Number(form.price_per_night || 0)));
      fd.append("max_guests", String(Number(form.max_guests || 1)));

            // ✅ NEW: pièces / couchage
      fd.append("bedrooms", String(Number(form.bedrooms || 0)));
      fd.append("bathrooms", String(Number(form.bathrooms || 0)));
      fd.append("living_rooms", String(Number(form.living_rooms || 0)));
      fd.append("kitchens", String(Number(form.kitchens || 0)));
      fd.append("beds", String(Number(form.beds || 0)));

      
      // ✅ localisation (champs existants backend)
      fd.append("address_label", form.address_label || "");
      fd.append("city", form.city || "");
      fd.append("area", form.area || "");
      fd.append("borough", form.borough || "");

      // ✅ amenities
      fd.append("has_wifi", String(!!form.has_wifi));
      fd.append("has_ac", String(!!form.has_ac));
      fd.append("has_parking", String(!!form.has_parking));
      fd.append("has_tv", String(!!form.has_tv));
      fd.append("has_kitchen", String(!!form.has_kitchen));
      fd.append("has_hot_water", String(!!form.has_hot_water));

            // ✅ NEW: amenities avancées + règles
      fd.append("has_garden", String(!!form.has_garden));
      fd.append("has_balcony", String(!!form.has_balcony));
      fd.append("has_generator", String(!!form.has_generator));
      fd.append("has_security", String(!!form.has_security));

      fd.append("allows_pets", String(!!form.allows_pets));
      fd.append("allows_smoking", String(!!form.allows_smoking));

      // ✅ coords (serializer attend latitude/longitude)
      fd.append("latitude", String(form.latitude));
      fd.append("longitude", String(form.longitude));

      // ✅ images (serializer attend cover_image + gallery_images)
      fd.append("cover_image", coverImage);
      galleryImages.forEach((img) => fd.append("gallery_images", img));
      console.log("access:", document.cookie.includes("access_token"));
console.log("refresh:", document.cookie.includes("refresh_token"));
console.log("REQ Authorization:", apiInstance.defaults.headers?.Authorization);


const { data } = await apiInstance.post("listings/", fd);

      console.log("listing created:", data);
      Toast.fire({ icon: "success", title: "Résidence publiée" });
navigate("/");
      // ✅ reset partiel
      setForm((p) => ({
        ...p,
        title: "",
        description: "",
        price_per_night: "",
      }));
      setCoverImage(null);
      setGalleryImages([]);
    } catch (err) {
      const apiErr = err?.response?.data;
      console.error("create listing error:", apiErr || err?.message);

      const msg =
        apiErr?.detail ||
        apiErr?.error ||
        (typeof apiErr === "string" ? apiErr : JSON.stringify(apiErr || {})) ||
        "Erreur lors de la publication";

      Swal.fire({
        icon: "error",
        title: "Erreur",
        text: msg,
      });
    } finally {
      setLoadingSubmit(false);
    }
  };

  // =========================
  // ✅ UI
  // =========================
  return (
    <div className="container py-3">
      <div className="mb-3">
        <h3 className="mb-1">Publier une résidence</h3>
        <div className="text-muted">
          Recherche l’adresse (comme Yango), ou utilise ta position. Tu peux déplacer le pin.
        </div>
      </div>

      <form onSubmit={submit} className="row g-3">
        {/* LEFT */}
        <div className="col-12 col-lg-7">
          {/* Photos */}
          <div className="card border-0 shadow-sm rounded-4 mb-3">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <div className="fw-semibold">Photos</div>
                <span className="badge text-bg-dark">Cover obligatoire</span>
              </div>

              <div className="mt-3">
                <label className="form-label">Photo de couverture</label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={(e) => onPickCover(e.target.files?.[0])}
                />
                <div className="form-text">Image principale affichée partout.</div>

                {coverPreview && (
                  <div className="mt-3 rounded-3 overflow-hidden border" style={{ height: 220 }}>
                    <img
                      src={coverPreview}
                      alt="cover preview"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                )}
              </div>

              <div className="mt-4">
                <label className="form-label">Galerie (optionnel)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="form-control"
                  onChange={(e) => onPickGallery(e.target.files)}
                />
                <div className="form-text">Jusqu’à 10 images (max 6MB).</div>

                {galleryPreviews.length > 0 && (
                  <div className="row g-2 mt-2">
                    {galleryPreviews.map((src, idx) => (
                      <div className="col-4" key={src}>
                        <div className="border rounded-3 overflow-hidden position-relative" style={{ height: 110 }}>
                          <img
                            src={src}
                            alt={`gallery ${idx}`}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-dark position-absolute"
                            style={{ right: 6, top: 6 }}
                            onClick={() => removeGalleryImage(idx)}
                            title="Retirer"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Infos */}
          <div className="card border-0 shadow-sm rounded-4 mb-3">
            <div className="card-body">
              <div className="fw-semibold">Informations</div>

              <div className="mt-3">
                <label className="form-label">Titre</label>
                <input
                  className="form-control"
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="Ex: Studio meublé à Angré"
                />
              </div>

              <div className="mt-3">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Décris la résidence (accès, propreté, règles...)"
                />
              </div>

              <div className="row mt-3 g-2">
                <div className="col-md-6">
                  <label className="form-label">Type</label>
                  <select
                    className="form-select"
                    value={form.listing_type}
                    onChange={(e) => setField("listing_type", e.target.value)}
                  >
                    <option value="appartement">Appartement</option>
                    <option value="studio">Studio</option>
                    <option value="maison">Maison</option>
                    <option value="villa">Villa</option>
                    <option value="chambre">Chambre</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Personne(s)</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={form.max_guests}
                    onChange={(e) => setField("max_guests", e.target.value)}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Prix / nuit (FCFA)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={form.price_per_night}
                    onChange={(e) => setField("price_per_night", e.target.value)}
                    placeholder="Ex: 25000"
                  />
                </div>
                <div className="row mt-3 g-2">
  <div className="col-md-4">
    <label className="form-label">Chambres</label>
    <input
      type="number"
      min="0"
      className="form-control"
      value={form.bedrooms}
      onChange={(e) => setField("bedrooms", Number(e.target.value))}
    />
  </div>

  <div className="col-md-4">
    <label className="form-label">Douches / SDB</label>
    <input
      type="number"
      min="0"
      className="form-control"
      value={form.bathrooms}
      onChange={(e) => setField("bathrooms", Number(e.target.value))}
    />
  </div>

  <div className="col-md-4">
    <label className="form-label">Salons</label>
    <input
      type="number"
      min="0"
      className="form-control"
      value={form.living_rooms}
      onChange={(e) => setField("living_rooms", Number(e.target.value))}
    />
  </div>

  <div className="col-md-6">
    <label className="form-label">Cuisines</label>
    <input
      type="number"
      min="0"
      className="form-control"
      value={form.kitchens}
      onChange={(e) => setField("kitchens", Number(e.target.value))}
    />
  </div>

  <div className="col-md-6">
    <label className="form-label">Lits</label>
    <input
      type="number"
      min="0"
      className="form-control"
      value={form.beds}
      onChange={(e) => setField("beds", Number(e.target.value))}
    />
  </div>
</div>

              </div>
            </div>
          </div>

          {/* Équipements */}
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">
              <div className="fw-semibold mb-2">Équipements</div>

              <div className="row g-2">
                {[
                 
  ["has_wifi", "Wifi"],
  ["has_ac", "Climatisation"],
  ["has_parking", "Parking"],
  ["has_tv", "TV"],
  ["has_kitchen", "Cuisine"],
  ["has_hot_water", "Eau chaude"],

  // ✅ NEW
  ["has_garden", "Jardin"],
  ["has_balcony", "Balcon / Terrasse"],
  ["has_generator", "Groupe électrogène"],
  ["has_security", "Sécurité / Gardien"],

  // ✅ NEW rules
  ["allows_pets", "Animaux acceptés"],
  ["allows_smoking", "Fumeur autorisé"],


                ].map(([name, label]) => (
                  <div className="col-6 col-md-4" key={name}>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={name}
                        checked={!!form[name]}
                        onChange={(e) => setField(name, e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor={name}>
                        {label}
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn btn-dark mt-4" disabled={loadingSubmit} type="submit">
                {loadingSubmit ? "Publication..." : "Publier"}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="fw-semibold">Localisation</div>

                <button
                  type="button"
                  className="btn btn-outline-dark btn-sm"
                  onClick={useMyLocation}
                  disabled={loadingGeo}
                >
                  {loadingGeo ? "Localisation..." : "Utiliser ma position"}
                </button>
              </div>

              {geoError && <div className="alert alert-warning py-2">{geoError}</div>}

              {/* ✅ SEARCH INPUT (Yango style) */}
              <div className="position-relative" onClick={(e) => e.stopPropagation()}>
                <label className="form-label">Rechercher une adresse</label>
                <input
                  className="form-control"
                  value={addressQuery}
                  onChange={(e) => {
                    const v = e.target.value;
                    setAddressQuery(v);

                    // ✅ l'utilisateur prend la main
                    setManualAddressEdit(true);

                    // ✅ debounce search
                    if (suggestTimer.current) clearTimeout(suggestTimer.current);
                    suggestTimer.current = setTimeout(() => searchPlaces(v), 350);
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  placeholder="Ex: Angré, Riviera, Yopougon..."
                />

                {loadingSuggest && <div className="small text-muted mt-1">Recherche...</div>}

                {showSuggestions && suggestions.length > 0 && (
                  <div
                    className="position-absolute bg-white border rounded-3 shadow-sm w-100 mt-1"
                    style={{ zIndex: 9999, maxHeight: 260, overflowY: "auto" }}
                  >
                    {suggestions.map((s, idx) => (
                      <button
                        type="button"
                        key={idx}
                        className="w-100 text-start btn btn-light border-0 rounded-0"
                        onClick={() => onSelectSuggestion(s)}
                      >
                        <div className="fw-semibold" style={{ fontSize: 14 }}>
                          {s.borough || s.area || s.city || "Lieu"}
                        </div>
                        <div className="text-muted" style={{ fontSize: 12 }}>
                          {s.address_label}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3 overflow-hidden border mt-3" style={{ height: 380 }}>
                <MapContainer
                  center={[center.lat, center.lng]}
                  zoom={15}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap"
                  />

                 {typeof form.latitude === "number" &&
 typeof form.longitude === "number" && (
  <Recenter lat={form.latitude} lng={form.longitude} />
)}


                  {/* click map -> set coords */}
                  <MapClickHandler
                    onPick={(lat, lng) => {
                      setManualAddressEdit(false); // ✅ click map = auto-fill
                      setCoordsAndAutofill(lat, lng);
                    }}
                  />

                  <MarkerDraggable />
                </MapContainer>
              </div>

              <div className="mt-2 small">
                <span className="badge text-bg-light me-2">Lat: {center.lat.toFixed(6)}</span>
                <span className="badge text-bg-light">Lng: {center.lng.toFixed(6)}</span>
              </div>

              {/* ✅ Champs auto-remplis mais modifiables */}
              <div className="mt-3">
                <label className="form-label">Adresse (modifiable)</label>
                <input
                  className="form-control"
                  value={form.address_label || ""}
                  onChange={(e) => {
                    setManualAddressEdit(true);
                    setField("address_label", e.target.value);
                  }}
                  placeholder="Rue..., quartier..., Abidjan"
                />
              </div>

              <div className="row g-2 mt-2">
                <div className="col-6">
                  <label className="form-label">Ville</label>
                  <input
                    className="form-control"
                    value={form.city || ""}
                    onChange={(e) => {
                      setManualAddressEdit(true);
                      setField("city", e.target.value);
                    }}
                    placeholder="Abidjan"
                  />
                </div>

                <div className="col-6">
                  <label className="form-label">Zone / Commune</label>
                  <input
                    className="form-control"
                    value={form.area || ""}
                    onChange={(e) => {
                      setManualAddressEdit(true);
                      setField("area", e.target.value);
                    }}
                    placeholder="Cocody / Yopougon..."
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Quartier</label>
                  <input
                    className="form-control"
                    value={form.borough || ""}
                    onChange={(e) => {
                      setManualAddressEdit(true);
                      setField("borough", e.target.value);
                    }}
                    placeholder="Angré / Attié..."
                  />
                </div>
              </div>

              <div className="small text-muted mt-2">
                Tape une adresse puis sélectionne. Ou clique sur la carte / déplace le pin.
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
