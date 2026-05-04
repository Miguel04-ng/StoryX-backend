/**
 * Upload middleware — gestion des photos d'inscription prestataire
 * Stockage en mémoire → envoi vers service cloud (Cloudinary ou base64 en DB)
 * En production : remplacer par Cloudinary/S3
 */

const path = require('path');
const fs   = require('fs');

// Dossier uploads local (dev seulement)
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/**
 * Middleware d'upload simple sans multer (base64 depuis le body JSON).
 * Le frontend envoie les images en base64 dans le corps JSON.
 * En production, utiliser multer + Cloudinary.
 */
const saveBase64Image = (base64String, filename) => {
  if (!base64String) return null;

  // Extraire les données base64
  const matches = base64String.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches) return null;

  const ext      = matches[1].split('/')[1] || 'jpg';
  const data     = matches[2];
  const fname    = `${filename}_${Date.now()}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, fname);

  fs.writeFileSync(filepath, Buffer.from(data, 'base64'));

  // En dev : URL locale. En prod : URL Cloudinary
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  return `${baseUrl}/uploads/${fname}`;
};

/**
 * Valide qu'une chaîne est bien une image base64 valide.
 */
const isValidBase64Image = (str) => {
  if (!str || typeof str !== 'string') return false;
  return /^data:image\/(jpeg|jpg|png|webp);base64,/.test(str);
};

/**
 * Middleware pour servir les fichiers uploads.
 * À monter dans app.js : app.use('/uploads', express.static(UPLOAD_DIR))
 */
const serveUploads = (app) => {
  const express = require('express');
  app.use('/uploads', express.static(UPLOAD_DIR));
};

module.exports = { saveBase64Image, isValidBase64Image, serveUploads };
