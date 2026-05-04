# StoryX Backend v2.0 — Node.js + MySQL

> Stack : **Express.js · Sequelize · MySQL 8 · CinetPay · Flutterwave**

---

## Démarrage

```bash
# 1. Importer la base de données
mysql -u root -p < storyx_database.sql

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env
# Éditer .env : DB_HOST, DB_USER, DB_PASSWORD, JWT_SECRET, clés paiement

# 4. Lancer le serveur
npm run dev        # développement
npm start          # production
npm test           # tests

# Vérifier
curl http://localhost:5000/api/health
```

---

## Configuration `.env`

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=storyx
DB_USER=root
DB_PASSWORD=your_password

JWT_SECRET=votre_secret_long
JWT_EXPIRES_IN=7d

CLIENT_URL=http://localhost:3000
FREE_DAILY_REQUESTS=5

# CinetPay — https://cinetpay.com
CINETPAY_API_KEY=...
CINETPAY_SITE_ID=...
CINETPAY_SECRET_KEY=...

# Flutterwave — https://dashboard.flutterwave.com
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-...
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-...

# URLs publiques (ngrok en développement)
BACKEND_URL=https://abc.ngrok.io
FRONTEND_URL=http://localhost:3000
```

---

## Architecture

```
storyx-backend-mysql/
  config/db.js              Sequelize + MySQL2
  models/
    index.js                Toutes les associations
    User.js                 → table users
    Client.js               → table clients
    Prestataire.js          → table prestataires
    Misc.js                 Profile, Photo, Category, Admin, Notification, Setting
    Transactional.js        Subscription, Booking, Payment, Conversation, Message, Review, AuditLog
  controllers/
    authController.js       register, login, me
    profileController.js    getProfiles, getProfileById, upsertProfile, getMyProfile
    mainController.js       bookings, messages, reviews, payments
    adminController.js      stats (vw_admin_stats), users, payments
  services/
    premiumService.js       freemium cache + activation premium MySQL
    cinetpayService.js      API CinetPay complète
    flutterwaveService.js   API Flutterwave complète
  routes/index.js           Toutes les routes
  middleware/
    auth.js                 JWT + Sequelize JOIN
    validators.js           express-validator
    errorHandler.js         Erreurs Sequelize → JSON propre
```

---

## Endpoints API

### Auth `/api/auth`
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/register` | Non | Inscription (CLIENT ou PRESTATAIRE) |
| POST | `/login` | Non | Connexion |
| GET | `/me` | Oui | Profil connecté |

### Profils `/api/profiles`
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/` | Optionnel | Liste + filtres (ville, prix, tri) |
| GET | `/mine` | PRESTATAIRE | Mon profil |
| GET | `/:id` | Optionnel | Détail (photos floutées si non-premium) |
| POST | `/` | PRESTATAIRE | Créer/mettre à jour mon profil |

**Filtres :** `?ville=Douala&minPrix=10000&maxPrix=50000&tri=populaire&page=1&limit=12`

### Réservations `/api/bookings`
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/` | CLIENT | Créer (vérifie la limite freemium) |
| GET | `/` | Oui | Mes réservations |
| PATCH | `/:id/status` | Oui | `{action: "confirm"\|"cancel"\|"complete"}` |

### Messages `/api/messages`
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/` | Oui | Envoyer (vérifie freemium pour CLIENT) |
| GET | `/` | Oui | Conversations |
| GET | `/unread/count` | Oui | Messages non lus |
| GET | `/conversation/:id` | Oui | Messages d'une conversation |

### Avis `/api/reviews`
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/` | CLIENT | Créer (réservation COMPLETED requise) |
| GET | `/:prestataireId` | Oui | Avis + stats (note moyenne calculée par trigger MySQL) |

### Paiements `/api/payments`
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/tarifs` | Oui | Tarifs par rôle |
| POST | `/initiate` | Oui | Initier un paiement |
| POST | `/webhook/:provider` | **NON** | Webhook CinetPay/Flutterwave |
| GET | `/verify/:reference` | Oui | Vérifier après retour |
| GET | `/history` | Oui | Historique |

### Abonnements `/api/subscriptions`
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/status` | Oui | Statut premium + demandes restantes |
| GET | `/history` | Oui | Historique des abonnements |

### Admin `/api/admin`
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/stats` | ADMIN | Stats (via vw_admin_stats) |
| GET | `/users` | ADMIN | Tous les utilisateurs |
| PATCH | `/users/:id/toggle` | ADMIN | Activer/désactiver |
| DELETE | `/users/:id` | ADMIN | Soft delete |
| PATCH | `/prestataires/:id/verify` | ADMIN | Vérifier un prestataire |
| PATCH | `/reviews/:id/approve` | ADMIN | Approuver un avis |
| GET | `/payments` | ADMIN | Tous les paiements |

---

## Flux de paiement

```
1. POST /api/payments/initiate  →  Payment{PENDING} créé en MySQL
2. Frontend redirige vers paymentUrl (CinetPay ou Flutterwave)
3. Utilisateur paie
4. POST /api/payments/webhook/:provider  ← Fournisseur notifie
   a. Vérification signature
   b. Double vérification auprès du fournisseur
   c. Payment.status = SUCCESS
   d. Trigger MySQL : clients.is_premium = 1
   e. Subscription créée
5. Frontend GET /api/payments/verify/:reference  →  confirmation
```

**En développement :** exposer avec `ngrok http 5000` et mettre à jour `BACKEND_URL`.

---

## Fonctionnalités MySQL natives utilisées

- **Triggers** : `trg_review_insert_update_rating` et `trg_review_update_rating` recalculent `rating_avg` et `rating_count` automatiquement à chaque avis
- **Trigger** : `trg_subscription_activate_client` met à jour `clients.is_premium` automatiquement
- **Trigger** : `trg_message_update_conversation` met à jour `last_message_at`
- **Vue** : `vw_admin_stats` pour le dashboard admin
- **Vue** : `vw_prestataires_actifs` pour les requêtes profils
- **Soft delete** : colonne `deleted_at` sur `users`

---

*StoryX Backend v2.0 — MySQL — Confidentiel 2025*
