-- ============================================================
--  STORYX — DONNÉES DE DÉMONSTRATION
--  15 prestataires fictives prêtes pour le frontend
--  Mot de passe : Password1A (bcrypt hash ci-dessous)
-- ============================================================

-- Hash bcrypt de "Password1A" (généré avec salt 12)
SET @pwd = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGqSJ7G6Vz1G5PQWZ2Ib6lhfHe';

-- ── 1. USERS prestataires ─────────────────────────────────────────────────────
INSERT INTO users (email, password, role, is_active, email_verified_at) VALUES
('emma.douala@storyx.cm',    @pwd, 'PRESTATAIRE', 1, NOW()),
('leila.yaounde@storyx.cm',  @pwd, 'PRESTATAIRE', 1, NOW()),
('maya.douala@storyx.cm',    @pwd, 'PRESTATAIRE', 1, NOW()),
('clara.bafoussam@storyx.cm',@pwd, 'PRESTATAIRE', 1, NOW()),
('sara.yaounde@storyx.cm',   @pwd, 'PRESTATAIRE', 1, NOW()),
('nadia.douala@storyx.cm',   @pwd, 'PRESTATAIRE', 1, NOW()),
('aisha.garoua@storyx.cm',   @pwd, 'PRESTATAIRE', 1, NOW()),
('fatou.bertoua@storyx.cm',  @pwd, 'PRESTATAIRE', 1, NOW()),
('chloe.kribi@storyx.cm',    @pwd, 'PRESTATAIRE', 1, NOW()),
('nina.douala@storyx.cm',    @pwd, 'PRESTATAIRE', 1, NOW()),
('rose.yaounde@storyx.cm',   @pwd, 'PRESTATAIRE', 1, NOW()),
('diane.douala@storyx.cm',   @pwd, 'PRESTATAIRE', 1, NOW()),
('laura.limbe@storyx.cm',    @pwd, 'PRESTATAIRE', 1, NOW()),
('sophie.ngaoundere@storyx.cm', @pwd, 'PRESTATAIRE', 1, NOW()),
('alice.douala@storyx.cm',   @pwd, 'PRESTATAIRE', 1, NOW());

-- ── 2. PRESTATAIRES ──────────────────────────────────────────────────────────
-- On récupère les IDs qu'on vient d'insérer
SET @u1  = (SELECT id FROM users WHERE email='emma.douala@storyx.cm');
SET @u2  = (SELECT id FROM users WHERE email='leila.yaounde@storyx.cm');
SET @u3  = (SELECT id FROM users WHERE email='maya.douala@storyx.cm');
SET @u4  = (SELECT id FROM users WHERE email='clara.bafoussam@storyx.cm');
SET @u5  = (SELECT id FROM users WHERE email='sara.yaounde@storyx.cm');
SET @u6  = (SELECT id FROM users WHERE email='nadia.douala@storyx.cm');
SET @u7  = (SELECT id FROM users WHERE email='aisha.garoua@storyx.cm');
SET @u8  = (SELECT id FROM users WHERE email='fatou.bertoua@storyx.cm');
SET @u9  = (SELECT id FROM users WHERE email='chloe.kribi@storyx.cm');
SET @u10 = (SELECT id FROM users WHERE email='nina.douala@storyx.cm');
SET @u11 = (SELECT id FROM users WHERE email='rose.yaounde@storyx.cm');
SET @u12 = (SELECT id FROM users WHERE email='diane.douala@storyx.cm');
SET @u13 = (SELECT id FROM users WHERE email='laura.limbe@storyx.cm');
SET @u14 = (SELECT id FROM users WHERE email='sophie.ngaoundere@storyx.cm');
SET @u15 = (SELECT id FROM users WHERE email='alice.douala@storyx.cm');

INSERT INTO prestataires (user_id, display_name, description, tarif_min, tarif_max, is_premium, is_verified, badge_verified, rating_avg, rating_count) VALUES
(@u1,  'Emma',   'Accompagnatrice élégante et discrète. Disponible pour soirées, voyages et moments privés. Basée à Douala, déplacement possible.',    18000, 35000, 1, 1, 1, 4.9, 47),
(@u2,  'Leila',  'Compagnie raffinée pour hommes exigeants. Bilingue français-anglais. Massage relaxant et bien-être à domicile ou hôtel.',            22000, 45000, 1, 1, 1, 4.8, 63),
(@u3,  'Maya',   'Jeune femme pétillante et cultivée. Idéale pour dîners, sorties et voyages d''affaires. Discrétion et professionnalisme garantis.',  15000, 28000, 1, 1, 0, 4.7, 29),
(@u4,  'Clara',  'Esthéticienne et accompagnatrice. Spécialisée massage thaïlandais et relaxation profonde. Disponible 7j/7 sur Bafoussam.',           12000, 25000, 0, 1, 1, 4.6, 18),
(@u5,  'Sara',   'Modèle et hôtesse événementielle. Présence soignée pour vos événements professionnels et privés à Yaoundé et environs.',             20000, 40000, 1, 1, 1, 4.8, 54),
(@u6,  'Nadia',  'Confidente et accompagnatrice premium. Écoute, partage et bons moments assurés. Portfolio photo disponible sur demande.',             17000, 32000, 0, 1, 0, 4.5, 22),
(@u7,  'Aisha',  'Femme du nord, charme authentique. Disponible pour rencontres privées et voyages. Discrétion absolue garantie à Garoua.',             10000, 20000, 0, 0, 0, 4.4, 11),
(@u8,  'Fatou',  'Escorte expérimentée, disponible nuit et week-end. Bertoua et environs. Photos vérifiées, profil authentique certifié.',              12000, 22000, 0, 0, 0, 4.3,  8),
(@u9,  'Chloé',  'Compagnie de luxe à Kribi. Plage, détente et moments exclusifs face à l''océan. Séjours de 24h à 72h possibles.',                   25000, 60000, 1, 1, 1, 4.9, 31),
(@u10, 'Nina',   'Diplômée en communication, polyglotte. Accompagne vos soirées d''affaires et galas. Style haut de gamme, Douala centre.',             20000, 38000, 1, 1, 1, 4.7, 42),
(@u11, 'Rose',   'Massage bien-être et accompagnement sensoriel. Certifiée en aromathérapie. Déplacement à domicile ou hôtel Yaoundé.',                14000, 28000, 0, 1, 0, 4.6, 16),
(@u12, 'Diane',  'Hôtesse de charme, accueil VIP. Longue expérience dans l''hospitalité premium. Douala-Akwa, disponible dès 18h.',                    18000, 35000, 1, 1, 1, 4.8, 38),
(@u13, 'Laura',  'Jeune professionnelle à Limbé. Mer, détente et bonne humeur. Escapades de 1 à 3 jours. Très bonne réputation sur la plateforme.',    15000, 30000, 0, 1, 0, 4.5, 14),
(@u14, 'Sophie', 'Accompagnatrice nordiste, chaleur et authenticité. Disponible Ngaoundéré et grand nord. Voyages acceptés.',                           10000, 20000, 0, 0, 0, 4.2,  6),
(@u15, 'Alice',  'Escort premium multilangues. Ancienne hôtesse de l''air. Service 5 étoiles, tenue impeccable. Douala uniquement.',                   30000, 70000, 1, 1, 1, 5.0, 89);

-- ── 3. PROFILES ──────────────────────────────────────────────────────────────
SET @p1  = (SELECT id FROM prestataires WHERE user_id=@u1);
SET @p2  = (SELECT id FROM prestataires WHERE user_id=@u2);
SET @p3  = (SELECT id FROM prestataires WHERE user_id=@u3);
SET @p4  = (SELECT id FROM prestataires WHERE user_id=@u4);
SET @p5  = (SELECT id FROM prestataires WHERE user_id=@u5);
SET @p6  = (SELECT id FROM prestataires WHERE user_id=@u6);
SET @p7  = (SELECT id FROM prestataires WHERE user_id=@u7);
SET @p8  = (SELECT id FROM prestataires WHERE user_id=@u8);
SET @p9  = (SELECT id FROM prestataires WHERE user_id=@u9);
SET @p10 = (SELECT id FROM prestataires WHERE user_id=@u10);
SET @p11 = (SELECT id FROM prestataires WHERE user_id=@u11);
SET @p12 = (SELECT id FROM prestataires WHERE user_id=@u12);
SET @p13 = (SELECT id FROM prestataires WHERE user_id=@u13);
SET @p14 = (SELECT id FROM prestataires WHERE user_id=@u14);
SET @p15 = (SELECT id FROM prestataires WHERE user_id=@u15);

INSERT INTO profiles (prestataire_id, ville, localisation, pays, disponibilites, categories, is_photos_blurred, view_count) VALUES
(@p1,  'Douala',      'Douala-Akwa',         'Cameroun', 'Lun-Dim 09h-23h', '["Compagnie & Sorties","Massage & Bien-être"]',    0, 412),
(@p2,  'Yaoundé',     'Yaoundé-Centre',      'Cameroun', 'Mar-Dim 10h-00h', '["Compagnie & Sorties","Coaching Personnel"]',      0, 538),
(@p3,  'Douala',      'Douala-Bonanjo',      'Cameroun', 'Lun-Sam 12h-22h', '["Compagnie & Sorties","Divertissement"]',          0, 287),
(@p4,  'Bafoussam',   'Bafoussam-Centre',    'Cameroun', 'Mer-Dim 14h-23h', '["Massage & Bien-être"]',                           0, 164),
(@p5,  'Yaoundé',     'Yaoundé-Bastos',      'Cameroun', 'Lun-Dim 08h-23h', '["Compagnie & Sorties","Divertissement"]',          0, 621),
(@p6,  'Douala',      'Douala-Bali',         'Cameroun', 'Jeu-Dim 18h-02h', '["Compagnie & Sorties"]',                           1, 203),
(@p7,  'Garoua',      'Garoua-Centre',       'Cameroun', 'Lun-Sam 10h-20h', '["Compagnie & Sorties","Autres Services"]',         1, 98),
(@p8,  'Bertoua',     'Bertoua-Centre',      'Cameroun', 'Mer-Dim 12h-22h', '["Compagnie & Sorties"]',                           1, 76),
(@p9,  'Kribi',       'Kribi-Plage',         'Cameroun', 'Lun-Dim 09h-00h', '["Compagnie & Sorties","Massage & Bien-être"]',     0, 344),
(@p10, 'Douala',      'Douala-Akwa Nord',    'Cameroun', 'Lun-Dim 10h-23h', '["Compagnie & Sorties","Divertissement"]',          0, 489),
(@p11, 'Yaoundé',     'Yaoundé-Melen',       'Cameroun', 'Mar-Sam 14h-22h', '["Massage & Bien-être","Coaching Personnel"]',      0, 178),
(@p12, 'Douala',      'Douala-Akwa',         'Cameroun', 'Lun-Dim 18h-02h', '["Compagnie & Sorties","Divertissement"]',          0, 367),
(@p13, 'Limbé',       'Limbé-Down Beach',    'Cameroun', 'Jeu-Dim 10h-22h', '["Compagnie & Sorties","Autres Services"]',         0, 142),
(@p14, 'Ngaoundéré',  'Ngaoundéré-Centre',   'Cameroun', 'Lun-Sam 09h-20h', '["Compagnie & Sorties"]',                           1, 55),
(@p15, 'Douala',      'Douala-Bonapriso',    'Cameroun', 'Lun-Dim 09h-23h', '["Compagnie & Sorties","Divertissement"]',          0, 1247);

-- ── 4. PHOTOS (URLs Unsplash libres de droits) ────────────────────────────────
-- Photos cover pour chaque profil
INSERT INTO photos (profile_id, url, url_blurred, watermark, is_cover, is_approved, sort_order) VALUES
(@p1,  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600', 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&blur=80', 1, 1, 1, 0),
(@p2,  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600', 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&blur=80', 1, 1, 1, 0),
(@p3,  'https://images.unsplash.com/photo-1531891437562-4301cf35b7e4?w=600', 'https://images.unsplash.com/photo-1531891437562-4301cf35b7e4?w=600&blur=80', 1, 1, 1, 0),
(@p4,  'https://images.unsplash.com/photo-1488716820095-cbe80883c496?w=600', 'https://images.unsplash.com/photo-1488716820095-cbe80883c496?w=600&blur=80', 1, 1, 1, 0),
(@p5,  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&blur=80', 1, 1, 1, 0),
(@p6,  'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=600', 'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=600&blur=80', 1, 1, 1, 0),
(@p7,  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&blur=80', 1, 1, 1, 0),
(@p8,  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&blur=80', 1, 1, 1, 0),
(@p9,  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&blur=80', 1, 1, 1, 0),
(@p10, 'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?w=600', 'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?w=600&blur=80', 1, 1, 1, 0),
(@p11, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&blur=80', 1, 1, 1, 0),
(@p12, 'https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=600', 'https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=600&blur=80', 1, 1, 1, 0),
(@p13, 'https://images.unsplash.com/photo-1526510747491-58f928ec870f?w=600', 'https://images.unsplash.com/photo-1526510747491-58f928ec870f?w=600&blur=80', 1, 1, 1, 0),
(@p14, 'https://images.unsplash.com/photo-1503185912284-5271ff81b9a8?w=600', 'https://images.unsplash.com/photo-1503185912284-5271ff81b9a8?w=600&blur=80', 1, 1, 1, 0),
(@p15, 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&blur=80', 1, 1, 1, 0);

-- ── 5. ADMIN ACCOUNT ─────────────────────────────────────────────────────────
-- email: admin@storyx.cm | password: Admin2025!
INSERT INTO users (email, password, role, is_active, email_verified_at) VALUES
('admin@storyx.cm', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uho6RQLCK', 'ADMIN', 1, NOW())
ON DUPLICATE KEY UPDATE role = 'ADMIN';

SET @admin_uid = (SELECT id FROM users WHERE email='admin@storyx.cm');
INSERT INTO admins (user_id, first_name, last_name, permissions)
SELECT @admin_uid, 'Super', 'Admin', '{"all": true}'
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE user_id=@admin_uid);

-- ── 6. CLIENT DEMO ───────────────────────────────────────────────────────────
-- email: client@storyx.cm | password: Password1A
INSERT INTO users (email, password, role, is_active, email_verified_at) VALUES
('client@storyx.cm', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGqSJ7G6Vz1G5PQWZ2Ib6lhfHe', 'CLIENT', 1, NOW())
ON DUPLICATE KEY UPDATE role='CLIENT';

SET @client_uid = (SELECT id FROM users WHERE email='client@storyx.cm');
INSERT INTO clients (user_id, first_name, last_name, is_premium, premium_since)
SELECT @client_uid, 'John', 'Demo', 1, NOW()
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE user_id=@client_uid);
