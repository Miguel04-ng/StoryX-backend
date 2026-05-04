-- ============================================================
--  STORYX — Base de données complète
--  Plateforme premium de mise en relation
--  MySQL 8.0+ | InnoDB | UTF8MB4
--  Généré à partir du Diagramme de Classes & Use Case UML
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ============================================================
-- 0. BASE DE DONNÉES
-- ============================================================
CREATE DATABASE IF NOT EXISTS storyx
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE storyx;

-- ============================================================
-- 1. USERS (classe abstraite User → Client, Prestataire, Admin)
-- ============================================================
CREATE TABLE users (
    id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
    email           VARCHAR(191)         NOT NULL,
    password        VARCHAR(255)         NOT NULL,          -- bcrypt hash
    role            ENUM('CLIENT','PRESTATAIRE','ADMIN')
                                         NOT NULL DEFAULT 'CLIENT',
    is_active       TINYINT(1)           NOT NULL DEFAULT 1,
    email_verified_at DATETIME           NULL,
    last_login_at   DATETIME             NULL,
    created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                  ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      DATETIME             NULL,              -- soft delete

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    INDEX idx_users_role      (role),
    INDEX idx_users_active    (is_active),
    INDEX idx_users_deleted   (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Table centrale : tous les acteurs de la plateforme';

-- ============================================================
-- 2. CLIENTS (hérite de users via user_id)
-- ============================================================
CREATE TABLE clients (
    id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED      NOT NULL,
    first_name      VARCHAR(100)         NOT NULL,
    last_name       VARCHAR(100)         NOT NULL,
    phone           VARCHAR(30)          NULL,
    avatar_url      VARCHAR(500)         NULL,
    is_premium      TINYINT(1)           NOT NULL DEFAULT 0,
    premium_since   DATETIME             NULL,
    created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                  ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_clients_user   (user_id),
    INDEX      idx_clients_premium (is_premium),
    CONSTRAINT fk_clients_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Profil étendu des clients';

-- ============================================================
-- 3. PRESTATAIRES (hérite de users via user_id)
-- ============================================================
CREATE TABLE prestataires (
    id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED      NOT NULL,
    display_name    VARCHAR(150)         NOT NULL,
    description     TEXT                 NULL,
    tarif_min       DECIMAL(10,2)        NULL    COMMENT 'Tarif minimum FCFA',
    tarif_max       DECIMAL(10,2)        NULL    COMMENT 'Tarif maximum FCFA',
    is_premium      TINYINT(1)           NOT NULL DEFAULT 0,
    is_verified     TINYINT(1)           NOT NULL DEFAULT 0,
    badge_verified  TINYINT(1)           NOT NULL DEFAULT 0,
    boost_until     DATETIME             NULL    COMMENT 'Date fin de boost profil',
    rating_avg      DECIMAL(3,2)         NOT NULL DEFAULT 0.00,
    rating_count    INT UNSIGNED         NOT NULL DEFAULT 0,
    created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                  ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_prestataires_user    (user_id),
    INDEX      idx_prest_premium       (is_premium),
    INDEX      idx_prest_verified      (is_verified),
    INDEX      idx_prest_rating        (rating_avg DESC),
    CONSTRAINT fk_prestataires_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Profil étendu des prestataires';

-- ============================================================
-- 4. ADMINS (hérite de users via user_id)
-- ============================================================
CREATE TABLE admins (
    id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED      NOT NULL,
    first_name      VARCHAR(100)         NOT NULL,
    last_name       VARCHAR(100)         NOT NULL,
    permissions     JSON                 NULL    COMMENT 'Permissions granulaires',
    created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                  ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_admins_user (user_id),
    CONSTRAINT fk_admins_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Profil étendu des administrateurs';

-- ============================================================
-- 5. PROFILES (lié à un Prestataire — relation 1..1)
-- ============================================================
CREATE TABLE profiles (
    id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
    prestataire_id  BIGINT UNSIGNED      NOT NULL,
    localisation    VARCHAR(255)         NULL,
    ville           VARCHAR(100)         NULL,
    pays            VARCHAR(100)         NOT NULL DEFAULT 'Cameroun',
    latitude        DECIMAL(10,7)        NULL,
    longitude       DECIMAL(10,7)        NULL,
    disponibilites  TEXT                 NULL    COMMENT 'JSON ou texte libre des créneaux',
    categories      JSON                 NULL    COMMENT 'Ex: ["escorte","massage"]',
    langues         JSON                 NULL    COMMENT 'Ex: ["français","anglais"]',
    cover_photo_url VARCHAR(500)         NULL,
    is_photos_blurred TINYINT(1)         NOT NULL DEFAULT 1,
    view_count      INT UNSIGNED         NOT NULL DEFAULT 0,
    created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                  ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_profiles_prest   (prestataire_id),
    INDEX      idx_profiles_ville  (ville),
    INDEX      idx_profiles_pays   (pays),
    CONSTRAINT fk_profiles_prest
        FOREIGN KEY (prestataire_id) REFERENCES prestataires(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Profil public du prestataire (1:1 avec prestataires)';

-- ============================================================
-- 6. PHOTOS (galerie d'un profil prestataire)
-- ============================================================
CREATE TABLE photos (
    id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
    profile_id      BIGINT UNSIGNED      NOT NULL,
    url             VARCHAR(500)         NOT NULL,
    url_blurred     VARCHAR(500)         NULL    COMMENT 'Version floutée pour non-premium',
    watermark       TINYINT(1)           NOT NULL DEFAULT 1,
    is_cover        TINYINT(1)           NOT NULL DEFAULT 0,
    is_approved     TINYINT(1)           NOT NULL DEFAULT 0,
    sort_order      SMALLINT UNSIGNED    NOT NULL DEFAULT 0,
    uploaded_at     DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_photos_profile  (profile_id),
    INDEX idx_photos_approved (is_approved),
    CONSTRAINT fk_photos_profile
        FOREIGN KEY (profile_id) REFERENCES profiles(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Photos de la galerie prestataire';

-- ============================================================
-- 7. CATEGORIES
-- ============================================================
CREATE TABLE categories (
    id              INT UNSIGNED         NOT NULL AUTO_INCREMENT,
    name            VARCHAR(100)         NOT NULL,
    slug            VARCHAR(100)         NOT NULL,
    description     TEXT                 NULL,
    is_active       TINYINT(1)           NOT NULL DEFAULT 1,
    created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catégories de services';

-- Table pivot profil ↔ catégorie (M:N)
CREATE TABLE profile_categories (
    profile_id      BIGINT UNSIGNED      NOT NULL,
    category_id     INT UNSIGNED         NOT NULL,

    PRIMARY KEY (profile_id, category_id),
    CONSTRAINT fk_pc_profile
        FOREIGN KEY (profile_id)   REFERENCES profiles(id)   ON DELETE CASCADE,
    CONSTRAINT fk_pc_category
        FOREIGN KEY (category_id)  REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. SUBSCRIPTIONS (abonnements — User 1..*)
-- ============================================================
CREATE TABLE subscriptions (
    id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED      NOT NULL,
    type            ENUM('CLIENT_PREMIUM','PRESTATAIRE_PREMIUM','PRESTATAIRE_BOOST')
                                         NOT NULL,
    status          ENUM('PENDING','ACTIVE','CANCELLED','EXPIRED')
                                         NOT NULL DEFAULT 'PENDING',
    price           DECIMAL(10,2)        NOT NULL,
    currency        VARCHAR(10)          NOT NULL DEFAULT 'FCFA',
    start_date      DATETIME             NOT NULL,
    end_date        DATETIME             NOT NULL,
    auto_renew      TINYINT(1)           NOT NULL DEFAULT 0,
    cancelled_at    DATETIME             NULL,
    cancel_reason   VARCHAR(255)         NULL,
    created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                  ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_subs_user       (user_id),
    INDEX idx_subs_status     (status),
    INDEX idx_subs_end_date   (end_date),
    CONSTRAINT fk_subs_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Abonnements premium (clients & prestataires)';

-- ============================================================
-- 9. BOOKINGS — Réservations (Client 1..* | Prestataire 1..*)
-- ============================================================
CREATE TABLE bookings (
    id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
    client_id       BIGINT UNSIGNED      NOT NULL,
    prestataire_id  BIGINT UNSIGNED      NOT NULL,
    status          ENUM('PENDING','CONFIRMED','CANCELLED_CLIENT',
                         'CANCELLED_PRESTATAIRE','COMPLETED','DISPUTED')
                                         NOT NULL DEFAULT 'PENDING',
    booking_date    DATETIME             NOT NULL COMMENT 'Date/heure souhaitée',
    duration_hours  DECIMAL(4,2)         NULL     COMMENT 'Durée en heures',
    location        VARCHAR(255)         NULL     COMMENT 'Lieu du rendez-vous',
    note_client     TEXT                 NULL,
    note_prestataire TEXT                NULL,
    amount          DECIMAL(10,2)        NOT NULL COMMENT 'Montant total FCFA',
    commission_rate DECIMAL(5,2)         NOT NULL DEFAULT 15.00,
    commission_amt  DECIMAL(10,2)        NOT NULL DEFAULT 0.00,
    confirmed_at    DATETIME             NULL,
    cancelled_at    DATETIME             NULL,
    completed_at    DATETIME             NULL,
    created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                  ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_book_client      (client_id),
    INDEX idx_book_prest       (prestataire_id),
    INDEX idx_book_status      (status),
    INDEX idx_book_date        (booking_date),
    CONSTRAINT fk_book_client
        FOREIGN KEY (client_id)      REFERENCES clients(id)      ON DELETE RESTRICT,
    CONSTRAINT fk_book_prest
        FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Réservations entre clients et prestataires';

-- ============================================================
-- 10. PAYMENTS — Paiements (Booking 1..1)
-- ============================================================
CREATE TABLE payments (
    id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
    booking_id      BIGINT UNSIGNED      NULL     COMMENT 'NULL si paiement abonnement',
    subscription_id BIGINT UNSIGNED      NULL     COMMENT 'NULL si paiement réservation',
    payer_user_id   BIGINT UNSIGNED      NOT NULL,
    amount          DECIMAL(10,2)        NOT NULL,
    currency        VARCHAR(10)          NOT NULL DEFAULT 'FCFA',
    method          ENUM('MOBILE_MONEY','ORANGE_MONEY','MTN_MOMO',
                         'CARD','WAVE','CASH','OTHER')
                                         NOT NULL,
    status          ENUM('PENDING','PROCESSING','SUCCESS','FAILED',
                         'REFUNDED','PARTIALLY_REFUNDED')
                                         NOT NULL DEFAULT 'PENDING',
    provider_ref    VARCHAR(255)         NULL     COMMENT 'Référence opérateur',
    provider_raw    JSON                 NULL     COMMENT 'Réponse brute API paiement',
    paid_at         DATETIME             NULL,
    refunded_at     DATETIME             NULL,
    refund_amount   DECIMAL(10,2)        NULL,
    created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                  ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_pay_booking  (booking_id),
    INDEX idx_pay_sub      (subscription_id),
    INDEX idx_pay_payer    (payer_user_id),
    INDEX idx_pay_status   (status),
    INDEX idx_pay_method   (method),
    CONSTRAINT fk_pay_booking
        FOREIGN KEY (booking_id)      REFERENCES bookings(id)      ON DELETE SET NULL,
    CONSTRAINT fk_pay_sub
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
    CONSTRAINT fk_pay_payer
        FOREIGN KEY (payer_user_id)   REFERENCES users(id)         ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tous les paiements de la plateforme';

-- ============================================================
-- 11. CONVERSATIONS — Fil de messagerie
-- ============================================================
CREATE TABLE conversations (
    id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
    client_id       BIGINT UNSIGNED      NOT NULL,
    prestataire_id  BIGINT UNSIGNED      NOT NULL,
    booking_id      BIGINT UNSIGNED      NULL     COMMENT 'Conversation liée à une résa',
    last_message_at DATETIME             NULL,
    is_locked       TINYINT(1)           NOT NULL DEFAULT 0
                                                  COMMENT 'Verrou si non-premium',
    created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_conv_pair  (client_id, prestataire_id),
    INDEX      idx_conv_prest (prestataire_id),
    INDEX      idx_conv_last  (last_message_at DESC),
    CONSTRAINT fk_conv_client
        FOREIGN KEY (client_id)      REFERENCES clients(id)      ON DELETE CASCADE,
    CONSTRAINT fk_conv_prest
        FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE CASCADE,
    CONSTRAINT fk_conv_booking
        FOREIGN KEY (booking_id)     REFERENCES bookings(id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Fils de conversation client↔prestataire';

-- ============================================================
-- 12. MESSAGES (Message — lié à une conversation)
-- ============================================================
CREATE TABLE messages (
    id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
    conversation_id BIGINT UNSIGNED      NOT NULL,
    sender_user_id  BIGINT UNSIGNED      NOT NULL,
    content         TEXT                 NOT NULL,
    type            ENUM('TEXT','IMAGE','SYSTEM')
                                         NOT NULL DEFAULT 'TEXT',
    is_read         TINYINT(1)           NOT NULL DEFAULT 0,
    read_at         DATETIME             NULL,
    deleted_at      DATETIME             NULL,
    sent_at         DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_msg_conv       (conversation_id),
    INDEX idx_msg_sender     (sender_user_id),
    INDEX idx_msg_unread     (is_read),
    INDEX idx_msg_sent       (sent_at),
    CONSTRAINT fk_msg_conv
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_msg_sender
        FOREIGN KEY (sender_user_id)  REFERENCES users(id)         ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Messages de la messagerie interne';

-- ============================================================
-- 13. REVIEWS — Avis & notation
-- ============================================================
CREATE TABLE reviews (
    id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
    booking_id      BIGINT UNSIGNED      NOT NULL COMMENT 'Un avis = une réservation',
    client_id       BIGINT UNSIGNED      NOT NULL,
    prestataire_id  BIGINT UNSIGNED      NOT NULL,
    rating          TINYINT UNSIGNED     NOT NULL COMMENT 'Note 1-5',
    comment         TEXT                 NULL,
    is_approved     TINYINT(1)           NOT NULL DEFAULT 0,
    is_flagged      TINYINT(1)           NOT NULL DEFAULT 0,
    moderated_at    DATETIME             NULL,
    moderated_by    BIGINT UNSIGNED      NULL,
    created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                  ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_review_booking  (booking_id)    COMMENT 'Un seul avis par réservation',
    INDEX      idx_rev_client     (client_id),
    INDEX      idx_rev_prest      (prestataire_id),
    INDEX      idx_rev_rating     (rating),
    INDEX      idx_rev_approved   (is_approved),
    CONSTRAINT chk_review_rating  CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT fk_rev_booking
        FOREIGN KEY (booking_id)      REFERENCES bookings(id)      ON DELETE CASCADE,
    CONSTRAINT fk_rev_client
        FOREIGN KEY (client_id)       REFERENCES clients(id)       ON DELETE CASCADE,
    CONSTRAINT fk_rev_prest
        FOREIGN KEY (prestataire_id)  REFERENCES prestataires(id)  ON DELETE CASCADE,
    CONSTRAINT fk_rev_moderator
        FOREIGN KEY (moderated_by)    REFERENCES admins(id)        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Avis et notes des clients sur les prestataires';

-- ============================================================
-- 14. NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
    id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED      NOT NULL,
    type            VARCHAR(100)         NOT NULL COMMENT 'Ex: booking.confirmed',
    title           VARCHAR(255)         NOT NULL,
    body            TEXT                 NULL,
    data            JSON                 NULL     COMMENT 'Payload métier',
    is_read         TINYINT(1)           NOT NULL DEFAULT 0,
    read_at         DATETIME             NULL,
    created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_notif_user  (user_id),
    INDEX idx_notif_read  (is_read),
    INDEX idx_notif_type  (type),
    CONSTRAINT fk_notif_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Notifications in-app pour tous les utilisateurs';

-- ============================================================
-- 15. TOKENS (authentification + vérification email + reset)
-- ============================================================
CREATE TABLE tokens (
    id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED      NOT NULL,
    type            ENUM('EMAIL_VERIFY','PASSWORD_RESET','API_ACCESS',
                         'REFRESH')     NOT NULL,
    token           VARCHAR(512)         NOT NULL,
    expires_at      DATETIME             NOT NULL,
    used_at         DATETIME             NULL,
    created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_tokens_token (token(191)),
    INDEX      idx_tokens_user (user_id),
    INDEX      idx_tokens_type (type),
    INDEX      idx_tokens_exp  (expires_at),
    CONSTRAINT fk_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tokens JWT, vérification email, reset mot de passe';

-- ============================================================
-- 16. AUDIT_LOGS — Traçabilité admin
-- ============================================================
CREATE TABLE audit_logs (
    id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
    admin_id        BIGINT UNSIGNED      NULL,
    user_id         BIGINT UNSIGNED      NULL     COMMENT 'Utilisateur concerné',
    action          VARCHAR(150)         NOT NULL COMMENT 'Ex: user.banned',
    entity_type     VARCHAR(100)         NULL     COMMENT 'Ex: bookings',
    entity_id       BIGINT UNSIGNED      NULL,
    old_values      JSON                 NULL,
    new_values      JSON                 NULL,
    ip_address      VARCHAR(45)          NULL,
    user_agent      VARCHAR(512)         NULL,
    created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_audit_admin   (admin_id),
    INDEX idx_audit_user    (user_id),
    INDEX idx_audit_action  (action),
    INDEX idx_audit_entity  (entity_type, entity_id),
    CONSTRAINT fk_audit_admin
        FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_user
        FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Journal d_actions administrateurs (RGPD)';

-- ============================================================
-- 17. SETTINGS — Configuration dynamique
-- ============================================================
CREATE TABLE settings (
    id              INT UNSIGNED         NOT NULL AUTO_INCREMENT,
    key_name        VARCHAR(150)         NOT NULL,
    value           TEXT                 NOT NULL,
    type            ENUM('STRING','INTEGER','FLOAT','BOOLEAN','JSON')
                                         NOT NULL DEFAULT 'STRING',
    description     VARCHAR(255)         NULL,
    updated_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                  ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_settings_key (key_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Paramètres dynamiques de la plateforme';

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- DONNÉES INITIALES
-- ============================================================

-- Catégories de base
INSERT INTO categories (name, slug, description) VALUES
('Compagnie & Sorties',  'compagnie-sorties',  'Accompagnement événements, soirées, voyages'),
('Massage & Bien-être',  'massage-bien-etre',  'Massages relaxants et thérapeutiques'),
('Coaching Personnel',   'coaching-personnel', 'Coaching, mentorat et développement personnel'),
('Divertissement',       'divertissement',     'Spectacles, animations privées'),
('Autres Services',      'autres-services',    'Services divers sur demande');

-- Paramètres plateforme
INSERT INTO settings (key_name, value, type, description) VALUES
('commission_rate_default',  '15.00',         'FLOAT',   'Taux de commission par défaut (%)'),
('commission_rate_min',      '10.00',         'FLOAT',   'Taux de commission minimum (%)'),
('commission_rate_max',      '30.00',         'FLOAT',   'Taux de commission maximum (%)'),
('client_premium_price',     '3500.00',       'FLOAT',   'Prix abonnement client premium (FCFA/mois)'),
('prest_premium_price',      '7500.00',       'FLOAT',   'Prix abonnement prestataire premium (FCFA/mois)'),
('prest_boost_price',        '2500.00',       'FLOAT',   'Prix boost profil (FCFA)'),
('photos_max_per_profile',   '20',            'INTEGER', 'Nombre max de photos par profil'),
('min_booking_amount',       '5000.00',       'FLOAT',   'Montant minimum d_une réservation (FCFA)'),
('platform_name',            'StoryX',        'STRING',  'Nom de la plateforme'),
('maintenance_mode',         'false',         'BOOLEAN', 'Mode maintenance activé/désactivé'),
('payment_methods_active',   '["MOBILE_MONEY","ORANGE_MONEY","MTN_MOMO","WAVE"]',
                                              'JSON',    'Méthodes de paiement actives');

-- ============================================================
-- VUES UTILES
-- ============================================================

-- Vue : prestataires actifs avec infos complètes
CREATE OR REPLACE VIEW vw_prestataires_actifs AS
SELECT
    p.id                    AS prestataire_id,
    u.id                    AS user_id,
    p.display_name,
    p.description,
    p.tarif_min,
    p.tarif_max,
    p.is_premium,
    p.is_verified,
    p.badge_verified,
    p.rating_avg,
    p.rating_count,
    pr.localisation,
    pr.ville,
    pr.disponibilites,
    pr.categories,
    pr.cover_photo_url,
    pr.view_count,
    u.created_at            AS member_since
FROM prestataires p
INNER JOIN users u     ON u.id = p.user_id
LEFT  JOIN profiles pr ON pr.prestataire_id = p.id
WHERE u.is_active = 1
  AND u.deleted_at IS NULL;

-- Vue : statistiques globales admin
CREATE OR REPLACE VIEW vw_admin_stats AS
SELECT
    (SELECT COUNT(*) FROM users   WHERE role = 'CLIENT'      AND deleted_at IS NULL) AS total_clients,
    (SELECT COUNT(*) FROM users   WHERE role = 'PRESTATAIRE' AND deleted_at IS NULL) AS total_prestataires,
    (SELECT COUNT(*) FROM bookings WHERE status = 'COMPLETED')                        AS total_bookings_done,
    (SELECT COUNT(*) FROM bookings WHERE status = 'PENDING')                          AS bookings_en_attente,
    (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status = 'SUCCESS')           AS total_revenus_fcfa,
    (SELECT COUNT(*) FROM subscriptions WHERE status = 'ACTIVE')                      AS abonnements_actifs,
    (SELECT COUNT(*) FROM reviews WHERE is_approved = 0 AND is_flagged = 0)           AS avis_en_attente,
    (SELECT COUNT(*) FROM photos  WHERE is_approved = 0)                              AS photos_en_attente;

-- ============================================================
-- TRIGGERS
-- ============================================================

DELIMITER $$

-- Recalcul automatique de la note moyenne après INSERT review
CREATE TRIGGER trg_review_insert_update_rating
AFTER INSERT ON reviews
FOR EACH ROW
BEGIN
    UPDATE prestataires
    SET
        rating_avg   = (
            SELECT ROUND(AVG(rating), 2)
            FROM reviews
            WHERE prestataire_id = NEW.prestataire_id
              AND is_approved = 1
        ),
        rating_count = (
            SELECT COUNT(*)
            FROM reviews
            WHERE prestataire_id = NEW.prestataire_id
              AND is_approved = 1
        )
    WHERE id = NEW.prestataire_id;
END$$

-- Recalcul après UPDATE review (ex: modération approuve)
CREATE TRIGGER trg_review_update_rating
AFTER UPDATE ON reviews
FOR EACH ROW
BEGIN
    IF NEW.is_approved != OLD.is_approved THEN
        UPDATE prestataires
        SET
            rating_avg   = (
                SELECT ROUND(AVG(rating), 2)
                FROM reviews
                WHERE prestataire_id = NEW.prestataire_id
                  AND is_approved = 1
            ),
            rating_count = (
                SELECT COUNT(*)
                FROM reviews
                WHERE prestataire_id = NEW.prestataire_id
                  AND is_approved = 1
            )
        WHERE id = NEW.prestataire_id;
    END IF;
END$$

-- Mise à jour last_message_at sur la conversation
CREATE TRIGGER trg_message_update_conversation
AFTER INSERT ON messages
FOR EACH ROW
BEGIN
    UPDATE conversations
    SET last_message_at = NEW.sent_at
    WHERE id = NEW.conversation_id;
END$$

-- Mise à jour is_premium client après activation subscription
CREATE TRIGGER trg_subscription_activate_client
AFTER UPDATE ON subscriptions
FOR EACH ROW
BEGIN
    IF NEW.status = 'ACTIVE' AND NEW.type = 'CLIENT_PREMIUM' THEN
        UPDATE clients
        SET is_premium   = 1,
            premium_since = NOW()
        WHERE user_id = NEW.user_id;
    END IF;
    IF NEW.status IN ('CANCELLED','EXPIRED') AND NEW.type = 'CLIENT_PREMIUM' THEN
        UPDATE clients SET is_premium = 0 WHERE user_id = NEW.user_id;
    END IF;
END$$

DELIMITER ;

-- ============================================================
-- FIN DU SCRIPT — STORYX DATABASE v1.0
-- ============================================================
