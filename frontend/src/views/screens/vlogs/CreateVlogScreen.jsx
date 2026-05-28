import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/auth';
import { vlogsApi, VLOG_CATEGORIES, AMBIANCES, REGIONS_CI } from '../../../utils/vlogs';
import './vlogs.css';

const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'babiresi_vlogs';
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';

export default function CreateVlogScreen() {
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    ambiance: '',
    region: '',
    tags: '',
    cloudinary_url: '',
    cloudinary_public_id: '',
    thumbnail_url: '',
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn()) navigate('/login');
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 200 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`Fichier trop lourd (max ${isVideo ? '200MB' : '10MB'})`);
      return;
    }
    setError('');
    setPreview(URL.createObjectURL(file));
    await uploadToCloudinary(file, isVideo);
  };

  const uploadToCloudinary = async (file, isVideo) => {
    if (!CLOUDINARY_CLOUD_NAME) {
      setError("Configuration Cloudinary manquante. Contacte l'admin.");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    data.append('resource_type', isVideo ? 'video' : 'image');

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
    });

    xhr.onload = () => {
      setUploading(false);
      if (xhr.status === 200) {
        const res = JSON.parse(xhr.responseText);
        setForm(f => ({
          ...f,
          cloudinary_url: res.secure_url,
          cloudinary_public_id: res.public_id,
          thumbnail_url: isVideo
            ? res.secure_url.replace('/upload/', '/upload/so_0,w_400/').replace(/\.[^.]+$/, '.jpg')
            : res.secure_url,
        }));
      } else {
        setError('Erreur lors de l\'upload. Réessaie.');
      }
    };

    xhr.onerror = () => { setUploading(false); setError('Erreur réseau lors de l\'upload.'); };
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`);
    xhr.send(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Le titre est requis.'); return; }
    if (!form.cloudinary_url) { setError('Ajoute une vidéo ou une image.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      };
      const res = await vlogsApi.create(payload);
      navigate(`/vlogs/${res.data.id}`);
    } catch (err) {
      const msg = err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Erreur';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-vlog-screen">
      <div className="create-vlog-container">
        <h1 className="create-vlog-title">🎬 Poster un Vlog</h1>
        <p className="create-vlog-subtitle">Partage ton expérience en Côte d'Ivoire et gagne des points !</p>

        <form onSubmit={handleSubmit} className="create-vlog-form">
          {/* Upload zone */}
          <div
            className={`upload-zone ${uploading ? 'uploading' : ''} ${form.cloudinary_url ? 'uploaded' : ''}`}
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="upload-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p>{uploadProgress}% uploadé...</p>
              </div>
            ) : form.cloudinary_url ? (
              <div className="upload-success">
                {preview && preview.includes('video') ? (
                  <video src={preview} className="upload-preview" muted playsInline />
                ) : preview ? (
                  <img src={preview} alt="preview" className="upload-preview" />
                ) : null}
                <p>✅ Média uploadé</p>
                <button type="button" onClick={(e) => { e.stopPropagation(); setForm(f => ({ ...f, cloudinary_url: '', cloudinary_public_id: '', thumbnail_url: '' })); setPreview(null); }}>
                  Changer
                </button>
              </div>
            ) : (
              <div className="upload-placeholder">
                <span className="upload-icon">📹</span>
                <p>Clique pour ajouter une vidéo ou photo</p>
                <small>Vidéo max 200MB · Photo max 10MB</small>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,image/*"
              onChange={handleFileChange}
              className="upload-input-hidden"
            />
          </div>

          {/* Form fields */}
          <div className="form-group">
            <label>Titre *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ex: Découverte du Parc de Taï 🌿"
              maxLength={120}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Raconte ton expérience..."
              rows={3}
              className="form-input"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Catégorie</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="form-input">
                <option value="">Choisir...</option>
                {VLOG_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Ambiance</label>
              <select value={form.ambiance} onChange={e => setForm(f => ({ ...f, ambiance: e.target.value }))} className="form-input">
                <option value="">Choisir...</option>
                {AMBIANCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Région</label>
            <select value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} className="form-input">
              <option value="">Choisir...</option>
              {REGIONS_CI.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Tags (séparés par des virgules)</label>
            <input
              type="text"
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              placeholder="plage, coucher de soleil, abidjan..."
              className="form-input"
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="points-hint">
            💡 Ce vlog peut te rapporter des points : <strong>1pt/vue · 5pts/like · 10pts/commentaire · 15pts/partage</strong>
          </div>

          <button type="submit" disabled={submitting || uploading} className="btn-submit-vlog">
            {submitting ? 'Publication...' : '🚀 Publier le Vlog'}
          </button>
        </form>
      </div>
    </div>
  );
}
