# Babiresi — Todolist Complète
> Portail touristique Côte d'Ivoire : Découvrir → Vivre → Séjourner
> Légende : [ ] à faire · [x] fait · [~] en cours

---

## PHASE 0 — Fondations & Setup

### 0.1 Audit & Nettoyage
- [ ] Audit complet du code backend existant (models, views, urls)
- [ ] Audit complet du code frontend existant (routes, composants, store)
- [ ] Identifier et supprimer le code mort / commenté
- [ ] Vérifier que toutes les migrations sont à jour
- [ ] Tester les endpoints existants (logements, réservations, paiements)

### 0.2 Infrastructure
- [ ] Configurer Cloudinary (compte, credentials, SDK Django + React)
- [ ] Migrer les images de logements existantes vers Cloudinary
- [ ] Configurer les variables d'environnement Cloudinary (.env)
- [ ] Vérifier la configuration CORS pour les nouveaux domaines à venir
- [ ] Mettre en place un système de logs centralisé (erreurs + actions)

### 0.3 Base de données — Extensions
- [ ] Ajouter l'extension PostgreSQL `pg_trgm` (recherche full-text)
- [ ] Revoir les index existants après les nouveaux modèles
- [ ] Créer un script de backup automatique de la base

---

## PHASE 1 — Vlogs & Système Créateurs

### 1.1 Modèles Backend
- [ ] Modèle `Vlog`
  - title, description, cloudinary_url, thumbnail_url
  - author (FK User), duration_seconds
  - region, city, category (choices), ambiance (choices)
  - views_count, likes_count, comments_count, shares_count, saves_count
  - is_published, is_featured, created_at, updated_at
  - Tags libres (ManyToMany)
- [ ] Modèle `VlogSeries` (série multi-épisodes)
  - title, description, author, cover_image
  - Relation avec Vlog (ordre des épisodes)
- [ ] Modèle `VlogLike` (user + vlog, unique together)
- [ ] Modèle `VlogComment` (user, vlog, message, parent pour replies, created_at)
- [ ] Modèle `VlogSave` (user + vlog, favoris)
- [ ] Modèle `VlogView` (user/ip, vlog, watch_percentage, created_at)
- [ ] Migrations + index sur (region, category), (author, created_at), (is_featured)

### 1.2 Système de Points & Récompenses
- [ ] Modèle `CreatorPoints`
  - user (OneToOne), total_points, available_points, withdrawn_points
  - level (bronze/silver/gold/platinum)
- [ ] Modèle `PointTransaction`
  - user, amount, type (view/like/comment/share/save/booking_generated/artisan_order/featured)
  - source_vlog (FK nullable), created_at
- [ ] Modèle `PointWithdrawal`
  - user, amount_points, amount_fcfa, method (wave/orange_money/paystack)
  - status (pending/paid/failed), reference, created_at
- [ ] Logique de calcul des taux par niveau :
  - Bronze (0–5k) : 0.3 FCFA/pt
  - Silver (5k–25k) : 0.5 FCFA/pt
  - Gold (25k–100k) : 0.8 FCFA/pt
  - Platinum (100k+) : 1.2 FCFA/pt
- [ ] Signal/task automatique : mise à jour du niveau après chaque transaction
- [ ] Anti-fraude : bloquer self-views (même device), minimum 50% vidéo pour compter

### 1.3 Endpoints API Vlogs
- [ ] `POST /vlogs/` — créer un vlog (upload Cloudinary)
- [ ] `GET /vlogs/` — liste avec filtres (region, city, category, ambiance)
- [ ] `GET /vlogs/<id>/` — détail vlog
- [ ] `PUT/PATCH /vlogs/<id>/` — modifier (auteur seulement)
- [ ] `DELETE /vlogs/<id>/` — supprimer (auteur ou admin)
- [ ] `POST /vlogs/<id>/like/` — liker/unliker (toggle)
- [ ] `POST /vlogs/<id>/save/` — sauvegarder/retirer (toggle)
- [ ] `POST /vlogs/<id>/view/` — enregistrer une vue (avec watch_percentage)
- [ ] `GET /vlogs/<id>/comments/` — liste commentaires
- [ ] `POST /vlogs/<id>/comments/` — ajouter commentaire
- [ ] `GET /vlogs/feed/` — feed personnalisé (selon région, intérêts)
- [ ] `GET /vlogs/trending/` — vlogs populaires du moment
- [ ] `GET /vlogs/featured/` — vlogs mis en avant par l'admin

### 1.4 Endpoints API Créateurs & Points
- [ ] `GET /creator/dashboard/` — stats créateur (vues, likes, points, retraits)
- [ ] `GET /creator/points/history/` — historique transactions points
- [ ] `POST /creator/points/withdraw/` — demande de retrait
- [ ] `GET /creator/points/withdrawals/` — historique retraits
- [ ] `GET /creator/level/` — niveau actuel + progression vers prochain

### 1.5 Challenges
- [ ] Modèle `VlogChallenge`
  - title, description, theme, prize_amount_fcfa
  - start_date, end_date, winner (FK User nullable)
  - is_active
- [ ] Modèle `ChallengeEntry` (user, challenge, vlog)
- [ ] `GET /challenges/` — liste challenges actifs
- [ ] `POST /challenges/<id>/enter/` — soumettre un vlog au challenge
- [ ] Admin : créer challenge, désigner gagnant, déclencher paiement prix

### 1.6 Frontend — Section Vlogs
- [ ] Page `ExploreVlogsScreen` — feed vlogs avec filtres (région, catégorie, ambiance)
- [ ] Composant `VlogCard` — thumbnail, titre, auteur, vues, like
- [ ] Page `VlogDetailScreen` — player Cloudinary, description, like/save/share, commentaires
- [ ] Composant `VlogComments` — thread avec replies
- [ ] Page `CreateVlogScreen` — upload vidéo + thumbnail, formulaire complet
- [ ] Page `VlogSeriesScreen` — liste épisodes d'une série
- [ ] Page `CreatorDashboardScreen` — stats, points, retraits, mes vlogs
- [ ] Composant `PointsWidget` — affiche niveau + points disponibles dans le navbar/profil
- [ ] Page `WithdrawScreen` — formulaire retrait + historique
- [ ] Page `ChallengesScreen` — challenges actifs, soumission
- [ ] Intégration Cloudinary Upload Widget (frontend)

---

## PHASE 2 — Pages Destination

### 2.1 Modèles Backend
- [ ] Modèle `Destination`
  - name, slug, region, description, cover_image
  - latitude, longitude
  - practical_info (JSON : comment y aller, meilleure période, budget moyen)
  - is_published, order (pour mise en avant)
- [ ] Lier Vlog → Destination (FK nullable)
- [ ] Lier Listing → Destination (FK nullable)

### 2.2 Endpoints
- [ ] `GET /destinations/` — liste toutes les destinations
- [ ] `GET /destinations/<slug>/` — page destination complète
  - Inclure : vlogs liés, logements, guides, restaurants, activités, artisans

### 2.3 Frontend
- [ ] Page `ExploreCIScreen` — carte interactive CI avec toutes les destinations
- [ ] Page `DestinationScreen` — page complète d'une ville/région
  - Sections : Vlogs · Où dormir · Guides · À faire · Où manger · Artisans · Infos pratiques
- [ ] Composant `DestinationCard` — carte avec photo cover + nom + teaser

---

## PHASE 3 — Services Locaux

### 3.1 Guides Certifiés
- [ ] Modèle `Guide`
  - user (OneToOne), bio, photo
  - specialties (choices multiples : histoire/gastronomie/nature/artisanat/photo/nightlife)
  - languages (choices multiples : fr/en/dioula/bété/baoulé/autre)
  - destinations (ManyToMany Destination)
  - half_day_price, full_day_price, multi_day_price (FCFA)
  - is_anglophone_certified, is_verified, badge_level
  - rating_avg, total_reviews
- [ ] Modèle `GuideAvailability` — calendrier disponibilités (date, is_available)
- [ ] Modèle `GuideBooking`
  - guide, client, destination
  - date, type (half_day/full_day/multi_day), nb_days
  - status, total_amount, notes
  - created_at
- [ ] Endpoints CRUD + `GET /guides/` avec filtres (destination, langue, spécialité)
- [ ] `GET /guides/<id>/availability/` — calendrier
- [ ] `POST /guides/<id>/book/` — réserver un guide
- [ ] Frontend : `GuidesScreen`, `GuideDetailScreen`, `GuideBookingScreen`
- [ ] Admin : certifier un guide, badge anglophone

### 3.2 Restaurants & Maquis
- [ ] Modèle `Restaurant`
  - name, description, address, destination (FK), latitude, longitude
  - category (maquis/restaurant/street_food/gastronomique)
  - price_range (€/€€/€€€), opening_hours
  - signature_dishes (JSON), phone, instagram
  - cover_image, rating_avg, is_verified
- [ ] Modèle `RestaurantImage`
- [ ] Lier Vlog → Restaurant (nullable)
- [ ] Endpoints : CRUD + `GET /restaurants/` filtres (destination, catégorie, prix)
- [ ] Frontend : `RestaurantsScreen`, `RestaurantDetailScreen`
- [ ] Possibilité de claim son restaurant (propriétaire)

### 3.3 Activités & Expériences
- [ ] Modèle `Activity`
  - title, description, destination (FK)
  - category (excursion/cours_cuisine/culturel/nature/plage/nocturne)
  - duration_hours, price_per_person, min_persons, max_persons
  - included_services (JSON), meeting_point
  - provider (FK User), is_verified, cover_image
- [ ] Modèle `ActivityBooking` — réservation activité (date, nb_persons, total, status)
- [ ] Endpoints : CRUD + booking
- [ ] Frontend : `ActivitiesScreen`, `ActivityDetailScreen`, `BookActivityScreen`

### 3.4 Chauffeurs & Location Voiture
- [ ] Modèle `Driver`
  - user (OneToOne), license_number, experience_years
  - languages, destinations_covered (ManyToMany)
  - rating_avg, is_verified, is_available
- [ ] Modèle `Vehicle`
  - driver (FK), type (citadine/berline/suv/minibus)
  - brand, model, year, capacity, photo
  - price_per_day_with_driver, price_per_day_without_driver
  - has_ac, is_available
- [ ] Modèle `DriverBooking`
  - vehicle, client, with_driver (boolean)
  - start_date, end_date, pickup_location, dropoff_location
  - total_days, total_amount, status, notes
- [ ] Endpoints : liste véhicules (filtres : type, avec/sans chauffeur, destination, dates)
- [ ] Frontend : `DriversScreen`, `VehicleDetailScreen`, `BookVehicleScreen`

### 3.5 Artisans & Marketplace
- [ ] Modèle `Artisan`
  - user (OneToOne), bio, story (long text), craft_type
  - location, destination (FK), video_intro (Cloudinary)
  - is_verified, badge "Made in CI", rating_avg
- [ ] Modèle `Product`
  - artisan (FK), name, description, story
  - price_fcfa, price_eur, price_usd (calculé via taux)
  - stock (nullable — null = fait sur commande)
  - made_to_order (boolean), production_time_days
  - category (pagne/sculpture/bijou/poterie/vannerie/autre)
  - is_available, weight_kg (pour livraison)
- [ ] Modèle `ProductImage`
- [ ] Modèle `ProductOrder`
  - product, buyer, quantity
  - delivery_type (local_abidjan/national/international)
  - delivery_address (JSON), total_fcfa
  - status (pending/confirmed/in_production/shipped/delivered)
  - tracking_number, created_at
- [ ] Modèle `ArtisanLive` — sessions live (titre, date, cloudinary_stream_url, is_active)
- [ ] Endpoints : CRUD artisans + produits + commandes
- [ ] Frontend : `ArtisansScreen`, `ArtisanProfileScreen`, `ProductDetailScreen`, `CartScreen`, `OrdersScreen`
- [ ] CI Artisan Box — modèle `ArtisanBox` (abonnement mensuel, curated, livraison internationale)

---

## PHASE 4 — Séjour Clé en Main (Feature Phare)

### 4.1 Modèles Backend
- [ ] Modèle `TravelAgency`
  - name, logo, description, registration_number
  - specialties (choices multiples : luxury/family/honeymoon/adventure/budget/corporate)
  - languages (choices multiples)
  - rating_avg, total_trips_organized
  - is_verified, is_active, created_at
  - owner (FK User)
- [ ] Modèle `TravelConsultant`
  - user (OneToOne), agency (FK nullable — null = indépendant rattaché à Babiresi)
  - bio, languages, specialties
  - is_available, max_active_leads (limite de dossiers simultanés)
  - rating_avg, total_trips
- [ ] Modèle `TravelRequest` — formulaire de qualification complet
  - Infos voyageur : nationality, residence_country, passport_validity
  - Groupe : adults_count, children_count, children_ages (JSON), group_type, special_occasion
  - Voyage : desired_start_date, desired_end_date, is_dates_flexible, flexibility_days
  - duration_days, destinations (ManyToMany Destination)
  - Intérêts : interests (JSON checkboxes)
  - Hébergement : accommodation_style, comfort_level, accommodation_features (JSON), rooms_needed
  - Transport : needs_airport_transfer, transport_type, vehicle_type, has_international_license
  - Services : wants_guide, wants_cooking_class, wants_excursions, wants_artisan_visits, custom_requests
  - Budget : budget_range, currency_preference
  - Contraintes : dietary_restrictions, health_constraints
  - Contact : full_name, email, whatsapp, preferred_contact_time, timezone, preferred_contact_method
  - how_heard, languages_spoken
  - Status : new/assigned/quoted/negotiating/confirmed/paid/in_progress/completed/cancelled
  - assigned_consultant (FK nullable), assigned_agency (FK nullable)
  - created_at, updated_at
- [ ] Modèle `TravelQuote` (devis)
  - request (FK), consultant (FK), version (int auto-incrémenté)
  - status (draft/sent/accepted/rejected/superseded)
  - notes (note du conseiller — "coup de coeur"), validity_until
  - total_fcfa, service_fee_fcfa, subtotal_fcfa
  - created_at
- [ ] Modèle `QuoteLineItem` (lignes du devis)
  - quote (FK), category (accommodation/transport/guide/activity/restaurant/other)
  - label, description, consultant_note (coup de coeur)
  - unit_price_fcfa, quantity, total_fcfa
  - linked_listing (FK nullable), linked_guide (FK nullable), linked_vehicle (FK nullable), linked_activity (FK nullable)
  - order (pour tri)
- [ ] Modèle `TripRoom` — espace de voyage
  - request (FK OneToOne), itinerary (JSON jour par jour)
  - checklist (JSON : visa/vaccins/valise/sim/cash...)
  - emergency_contacts (JSON), map_points (JSON)
  - is_active, created_at
- [ ] Modèle `TripRoomMessage` — chat
  - trip_room (FK), author (FK), message, attachment (Cloudinary nullable)
  - created_at, is_read
- [ ] Modèle `PaymentSchedule`
  - request (FK), deposit_amount, deposit_due_date, deposit_paid_at
  - balance_amount, balance_due_date, balance_paid_at
  - deposit_transaction (FK PaymentTransaction nullable)
  - balance_transaction (FK PaymentTransaction nullable)
- [ ] Modèle `TripInsurance` (assurance voyage add-on)
  - request (FK), provider, coverage_type (JSON), price_per_person, total_price
  - is_subscribed, reference

### 4.2 Logique d'Attribution des Leads
- [ ] Algorithme de matching :
  - Score par destination couverte
  - Score par type de voyage / spécialité
  - Score par langue client
  - Score par niveau budget vs standing agence
- [ ] Notifier top 2-3 agences/conseillers simultanément
- [ ] Timer 4h pour acceptation — si dépassé, escalade à Babiresi Voyages
- [ ] SLA monitoring : compteur dépassements 48h par agence, alertes automatiques

### 4.3 Endpoints API
- [ ] `POST /travel/request/` — soumettre formulaire de qualification
- [ ] `GET /travel/request/<id>/` — détail demande (client)
- [ ] `POST /travel/request/<id>/accept/` — conseiller accepte le lead
- [ ] `GET /travel/consultant/leads/` — liste leads du conseiller
- [ ] `POST /travel/request/<id>/quote/` — créer devis
- [ ] `PUT /travel/quote/<id>/` — modifier devis (nouvelle version)
- [ ] `GET /travel/quote/<id>/versions/` — historique versions
- [ ] `POST /travel/quote/<id>/accept/` — client accepte le devis
- [ ] `POST /travel/quote/<id>/reject/` — client refuse (avec note)
- [ ] `GET /travel/request/<id>/trip-room/` — accès Trip Room
- [ ] `POST /travel/trip-room/<id>/message/` — envoyer message
- [ ] `GET /travel/trip-room/<id>/messages/` — historique messages
- [ ] `PATCH /travel/trip-room/<id>/itinerary/` — modifier itinéraire
- [ ] `POST /travel/request/<id>/pay-deposit/` — payer acompte (Paystack)
- [ ] `POST /travel/request/<id>/pay-balance/` — payer solde
- [ ] `POST /travel/request/<id>/add-insurance/` — ajouter assurance
- [ ] `GET /travel/agencies/` — liste agences avec filtres
- [ ] `GET /travel/agencies/<id>/` — profil agence

### 4.4 Back-office Conseiller
- [ ] Page `ConsultantDashboardScreen` — leads actifs, stats, agenda
- [ ] Page `LeadDetailScreen` — détail demande + actions (accepter, créer devis)
- [ ] Page `QuoteBuilderScreen` — constructeur de devis
  - Sélecteur de logements depuis l'inventaire Babiresi
  - Sélecteur de guides, véhicules, activités
  - Lignes personnalisées (autres services)
  - Note "coup de coeur" par ligne
  - Total auto-calculé + frais de service
  - Envoyer au client
- [ ] Page `TripRoomConsultantScreen` — suivi du voyage en cours

### 4.5 Frontend Voyageur
- [ ] Page `PlanMyTripScreen` — formulaire de qualification (8 sections, multi-step)
- [ ] Page `MyTravelRequestScreen` — statut de la demande, devis reçus
- [ ] Page `QuoteDetailScreen` — devis interactif, commentaires par ligne, accepter/refuser
- [ ] Page `TripRoomScreen` — chat + itinéraire + checklist + carte (offline-ready)
- [ ] Page `TravelAgenciesScreen` — liste agences avec filtres et notes
- [ ] Page `AgencyProfileScreen` — profil agence + conseillers
- [ ] Composant `KitVoyageSection` — infos pratiques personnalisées (visa, vaccins, monnaie...)

---

## PHASE 5 — Système de Reviews Universel

- [ ] Modèle `Review` (générique via GenericForeignKey)
  - author, rating (1-5), comment
  - object_type (listing/guide/activity/driver/restaurant/artisan/consultant/agency)
  - object_id, created_at, is_verified_purchase
- [ ] Recalcul automatique rating_avg après chaque review
- [ ] Endpoints : créer review (post-séjour/post-service uniquement), lire reviews par objet
- [ ] Composant `ReviewStars` et `ReviewList` réutilisables
- [ ] Déclencheur automatique post-séjour : email/notif "Notez votre expérience"

---

## PHASE 6 — Confiance & Sécurité

- [ ] Badge "Vérifié Terrain" pour logements (inspection physique — admin le pose manuellement)
- [ ] Système de signalement (vlog/profil/commentaire inapproprié)
- [ ] Garantie Babiresi : workflow d'escalade si logement ne correspond pas
- [ ] Ligne urgence 24/7 : WhatsApp dédié, intégré dans Trip Room et Kit Voyage
- [ ] Vérification identité prestataires (upload CNI/passeport — admin valide)
- [ ] Anti-fraude points : détection views anormales, audit trail

---

## PHASE 7 — Notifications & Temps Réel

- [ ] Notifications push existantes — étendre aux nouveaux événements :
  - Nouveau like/commentaire sur un vlog
  - Points crédités
  - Niveau atteint
  - Nouveau lead (conseiller)
  - Devis envoyé/accepté/refusé (client + conseiller)
  - Nouveau message Trip Room
  - Rappel paiement solde (J-14)
  - Check-in confirmé
  - Avis post-séjour à laisser
- [ ] Emails transactionnels pour chaque étape critique

---

## PHASE 8 — Admin Dashboard Étendu

- [ ] Section Vlogs : modération (approuver/rejeter/featured), gestion challenges, stats engagement
- [ ] Section Points & Retraits : valider/rejeter demandes de retrait, audit fraude
- [ ] Section Destinations : créer/modifier pages destination, attacher vlogs/logements
- [ ] Section Travel Agencies : valider agences, surveiller SLA, suspendre
- [ ] Section Consultants : valider consultants, voir leads actifs, stats
- [ ] Section Artisans : valider artisans, badge "Made in CI", gérer commandes
- [ ] Section Guides : certifier guides, badge anglophone
- [ ] Section Reviews : modération, réponses propriétaires
- [ ] Stats globales enrichies : revenus par pilier (vlogs/services/séjours/artisanat)

---

## PHASE 9 — Internationalisation

- [ ] Bilingue FR/EN (i18n frontend — react-i18next)
- [ ] Traduction des interfaces et emails
- [ ] Multi-devise : affichage XOF + EUR + USD (taux via API externe)
- [ ] Paiement international carte (Paystack — déjà en place)
- [ ] SEO pages destination (FR + EN) : "Que faire à Yamoussoukro", "Top things to do in Grand-Bassam"
- [ ] Blog/Magazine section (articles curatés sur la CI)

---

## PHASE 10 — Growth & Monétisation Avancée

- [ ] Programme Ambassadeurs Diaspora : lien de parrainage trackable, commission sur voyages générés
- [ ] Babiresi Pro (abonnement agences) : analytics avancés + placement premium
- [ ] CI Artisan Box : gestion abonnements, curation mensuelle, expédition internationale
- [ ] API B2B : documentation + authentification pour agences étrangères partenaires
- [ ] Contenu sponsorisé : dashboard annonceurs (hôtels, restaus paient pour mise en avant)
- [ ] "Artisan en direct" : intégration live streaming Cloudinary

---

## RÉCAP PRIORITÉS

| Phase | Feature | Priorité | Dépend de |
|---|---|---|---|
| 0 | Audit + Cloudinary setup | 🔴 Critique | — |
| 1 | Vlogs + Points créateurs | 🔴 Critique | Phase 0 |
| 2 | Pages Destination | 🔴 Critique | Phase 1 |
| 3 | Guides + Chauffeurs | 🟠 Haute | Phase 2 |
| 3 | Artisans + Marketplace | 🟠 Haute | Phase 2 |
| 3 | Restaurants | 🟡 Moyenne | Phase 2 |
| 4 | Séjour Clé en Main complet | 🔴 Critique | Phases 2 & 3 |
| 5 | Reviews universel | 🟠 Haute | Phases 3 & 4 |
| 6 | Confiance & Sécurité | 🟠 Haute | Phase 4 |
| 7 | Notifications étendues | 🟡 Moyenne | Toutes |
| 8 | Admin étendu | 🟠 Haute | Toutes |
| 9 | Internationalisation | 🟡 Moyenne | Phase 8 |
| 10 | Growth & Monétisation | 🟢 Basse | Phase 9 |
