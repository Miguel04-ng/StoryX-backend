-- ============================================================
--  STORYX v3 — Migration SQL
--  Nouvelles tables : posts, post_media, favorites, payout_requests
-- ============================================================

USE storyx;

-- ── 1. POSTS — Publications prestataires ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
    id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
    prestataire_id  BIGINT UNSIGNED      NOT NULL,
    content         TEXT                 NULL     COMMENT 'Texte de la publication',
    type            ENUM('TEXT','PHOTO','VIDEO','MIXED')
                                         NOT NULL DEFAULT 'TEXT',
    is_premium_only TINYINT(1)           NOT NULL DEFAULT 0
                                                  COMMENT '1 = visible uniquement premium',
    is_approved     TINYINT(1)           NOT NULL DEFAULT 1,
    views_count     INT UNSIGNED         NOT NULL DEFAULT 0,
    created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                  ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_posts_prest   (prestataire_id),
    INDEX idx_posts_type    (type),
    INDEX idx_posts_created (created_at DESC),
    CONSTRAINT fk_posts_prest
        FOREIGN KEY (prestataire_id) REFERENCES prestataires(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Publications texte/photo/vidéo des prestataires';

-- ── 2. POST_MEDIA — Médias attachés aux posts ─────────────────────────────────
CREATE TABLE IF NOT EXISTS post_media (
    id          BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
    post_id     BIGINT UNSIGNED      NOT NULL,
    type        ENUM('PHOTO','VIDEO') NOT NULL DEFAULT 'PHOTO',
    url         VARCHAR(1000)        NOT NULL,
    url_blurred VARCHAR(1000)        NULL     COMMENT 'Version floutée non-premium',
    thumbnail   VARCHAR(1000)        NULL     COMMENT 'Miniature pour les vidéos',
    duration    INT UNSIGNED         NULL     COMMENT 'Durée vidéo en secondes',
    sort_order  SMALLINT UNSIGNED    NOT NULL DEFAULT 0,
    created_at  DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_pm_post (post_id),
    CONSTRAINT fk_pm_post
        FOREIGN KEY (post_id) REFERENCES posts(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Médias (photos/vidéos) attachés aux publications';

-- ── 3. FAVORITES — Favoris clients ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorites (
    id             BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    client_id      BIGINT UNSIGNED  NOT NULL,
    prestataire_id BIGINT UNSIGNED  NOT NULL,
    created_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_fav (client_id, prestataire_id),
    INDEX idx_fav_client (client_id),
    INDEX idx_fav_prest  (prestataire_id),
    CONSTRAINT fk_fav_client
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    CONSTRAINT fk_fav_prest
        FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Profils prestataires mis en favoris par les clients';

-- ── 4. PAYOUT_REQUESTS — Reversements admin → prestataires ───────────────────
CREATE TABLE IF NOT EXISTS payout_requests (
    id             BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
    booking_id     BIGINT UNSIGNED      NOT NULL,
    prestataire_id BIGINT UNSIGNED      NOT NULL,
    amount_total   DECIMAL(10,2)        NOT NULL COMMENT 'Montant total payé par client',
    commission_pct DECIMAL(5,2)         NOT NULL DEFAULT 20.00,
    commission_amt DECIMAL(10,2)        NOT NULL COMMENT 'Part admin',
    payout_amt     DECIMAL(10,2)        NOT NULL COMMENT 'Part prestataire (80%)',
    status         ENUM('PENDING','PAID','FAILED')
                                         NOT NULL DEFAULT 'PENDING',
    paid_at        DATETIME             NULL,
    note           TEXT                 NULL,
    created_at     DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                  ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_payout_booking (booking_id),
    INDEX idx_payout_prest  (prestataire_id),
    INDEX idx_payout_status (status),
    CONSTRAINT fk_payout_booking
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
    CONSTRAINT fk_payout_prest
        FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Reversements dus aux prestataires après paiement client';

-- ── 5. Modifier bookings — ajouter champ payment_status et location ──────────
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS payment_status
        ENUM('UNPAID','PAID','REFUNDED') NOT NULL DEFAULT 'UNPAID'
        COMMENT 'Statut paiement de la réservation'
        AFTER status,
    ADD COLUMN IF NOT EXISTS payment_id
        BIGINT UNSIGNED NULL
        COMMENT 'Référence au paiement'
        AFTER payment_status;

-- ============================================================
--  FIN MIGRATION v3
-- ============================================================
