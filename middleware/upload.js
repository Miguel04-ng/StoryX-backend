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
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const saveBase64Image = async (base64String, filename) => {
  if (!base64String) return null;

  try {
    // Détecter si c'est une vidéo ou une image
    const isVideo = base64String.startsWith('data:video/');
    const resourceType = isVideo ? 'video' : 'image';

    const result = await cloudinary.uploader.upload(base64String, {
      folder: 'storyx',
      public_id: `${filename}_${Date.now()}`,
      resource_type: resourceType,
    });

    return result.secure_url;
  } catch (error) {
    console.error('Erreur upload Cloudinary:', error);
    return null;
  }
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
