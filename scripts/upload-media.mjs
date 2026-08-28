#!/usr/bin/env node
// Uploads new files from a local media folder to Cloudinary and maintains
// src/media.json (the file the Control feature's client/admin read from).
// Safe to re-run: existing entries are matched by `filename` and left
// untouched (upload skipped, name/desc/index/type preserved) — only files
// not yet recorded get uploaded and appended.
//
// Usage: npm run media:upload [-- <sourceDir>]

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Not a static top-level import: the Cloudinary SDK reads
// process.env.CLOUDINARY_URL as a side effect of its own module load (deep
// in its internals, unrelated to anything we call), so importing it eagerly
// would capture an empty config from before loadDotEnv() below ever runs.
// Deferring the import until after .env is loaded avoids that.
let cloudinary;

const ROOT = process.cwd();
const DEFAULT_SOURCE_DIR = path.join(ROOT, 'media');
const OUTPUT_PATH = path.join(ROOT, 'src', 'media.json');
const DEFAULT_CLOUDINARY_FOLDER = 'bert48/party-2026';
const DELIVERY_WIDTH = 1080;

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.webp', '.gif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.3gp', '.mkv', '.avi', '.webm']);

function loadDotEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function getMediaType(ext) {
  const lower = ext.toLowerCase();
  if (IMAGE_EXTENSIONS.has(lower)) return 'image';
  if (VIDEO_EXTENSIONS.has(lower)) return 'video';
  return null;
}

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildDeliveryUrl(publicId, type) {
  if (type === 'video') {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      format: 'mp4',
      quality: 'auto',
      width: DELIVERY_WIDTH,
      crop: 'limit',
      secure: true
    });
  }
  return cloudinary.url(publicId, {
    resource_type: 'image',
    fetch_format: 'auto',
    quality: 'auto',
    width: DELIVERY_WIDTH,
    crop: 'limit',
    secure: true
  });
}

async function loadExistingMedia() {
  if (!existsSync(OUTPUT_PATH)) return [];
  const raw = await readFile(OUTPUT_PATH, 'utf8');
  if (!raw.trim()) return [];
  return JSON.parse(raw);
}

async function saveMedia(media) {
  await writeFile(OUTPUT_PATH, JSON.stringify(media, null, 2) + '\n', 'utf8');
}

function uploadFile(filePath, type, publicId, folder) {
  const options = {
    folder,
    public_id: publicId,
    resource_type: type,
    overwrite: false,
    use_filename: false,
    unique_filename: false
  };

  if (type === 'video') {
    // upload_large reports its result via a callback, not a Promise/await —
    // `await`-ing it directly resolves immediately with a stream object,
    // regardless of whether the upload actually succeeded. Wrap it.
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_large(filePath, options, (error, result) =>
        error ? reject(error) : resolve(result)
      );
    });
  }
  return cloudinary.uploader.upload(filePath, options);
}

async function main() {
  loadDotEnv();

  if (!process.env.CLOUDINARY_URL) {
    console.error(
      'CLOUDINARY_URL is not set. Add it to .env (see .env.example) before running this script.'
    );
    process.exitCode = 1;
    return;
  }

  ({ v2: cloudinary } = await import('cloudinary'));
  cloudinary.config({ analytics: false });

  const folder = process.env.CLOUDINARY_FOLDER || DEFAULT_CLOUDINARY_FOLDER;
  const sourceDir = process.argv[2]
    ? path.resolve(ROOT, process.argv[2])
    : DEFAULT_SOURCE_DIR;

  if (!existsSync(sourceDir)) {
    console.error(`Source folder not found: ${sourceDir}`);
    process.exitCode = 1;
    return;
  }

  const media = await loadExistingMedia();
  const existingFilenames = new Set(media.map((item) => item.filename));
  let nextIndex = media.length
    ? Math.max(...media.map((item) => item.index)) + 1
    : 0;

  const entries = await readdir(sourceDir);
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(sourceDir, entry);
    const stats = await stat(fullPath);
    if (stats.isFile()) files.push(entry);
  }
  files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  let uploaded = 0;
  let skippedExisting = 0;
  let skippedUnrecognized = 0;

  for (const filename of files) {
    if (existingFilenames.has(filename)) {
      skippedExisting++;
      continue;
    }

    const ext = path.extname(filename);
    const type = getMediaType(ext);
    if (!type) {
      console.warn(`Skipping unrecognized file: ${filename}`);
      skippedUnrecognized++;
      continue;
    }

    const publicId = slugify(path.basename(filename, ext));
    const filePath = path.join(sourceDir, filename);

    console.log(`Uploading ${filename}...`);
    try {
      const result = await uploadFile(filePath, type, publicId, folder);
      const url = buildDeliveryUrl(result.public_id, type);

      media.push({
        index: nextIndex++,
        name: '',
        desc: '',
        url,
        filename,
        type
      });
      await saveMedia(media);
      uploaded++;
      console.log(`  done -> ${url}`);
    } catch (err) {
      const message = err?.error?.message || err?.message || String(err);
      console.error(`  failed: ${message}`);
    }
  }

  const writeNote = uploaded > 0 ? ` Wrote ${OUTPUT_PATH}.` : '';
  console.log(
    `\nDone. Uploaded ${uploaded}, skipped ${skippedExisting} already recorded, skipped ${skippedUnrecognized} unrecognized.${writeNote}`
  );
}

main();
