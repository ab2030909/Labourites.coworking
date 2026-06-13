/*
 * Vercel Serverless Function — /api/uploads
 * Receives an image file and uploads it to Supabase Storage.
 * Uses the service role key so storage RLS policies are bypassed.
 *
 * Env vars required in Vercel:
 *   SUPABASE_URL         = https://...
 *   SUPABASE_SERVICE_KEY = your-service-role-key
 *   ADMIN_SECRET         = Labourites@68
 */

const { createClient } = require('@supabase/supabase-js');
const Busboy = require('busboy');

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_PASSWORD       = process.env.ADMIN_SECRET || 'Labourites@68';
const BUCKET               = 'updates';

// Disable Vercel's default body parser so we can handle the stream ourselves
module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'x-admin-secret');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

    const secret = req.headers['x-admin-secret'];
    if (secret !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });

    return new Promise((resolve) => {
        const bb = Busboy({ headers: req.headers });
        const chunks = [];
        let mimeType = 'application/octet-stream';
        let ext = 'jpg';

        bb.on('file', (_field, file, info) => {
            mimeType = info.mimeType || mimeType;
            ext = (info.filename || '').split('.').pop() || ext;
            file.on('data', d => chunks.push(d));
        });

        bb.on('finish', async () => {
            try {
                const buffer = Buffer.concat(chunks);
                const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
                const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY,
                    { auth: { persistSession: false } });

                const { error } = await sb.storage.from(BUCKET)
                    .upload(path, buffer, { contentType: mimeType, cacheControl: '3600' });

                if (error) throw error;

                const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
                res.status(200).json({ url: data.publicUrl });
                resolve();
            } catch (err) {
                res.status(500).json({ error: err.message || 'Upload failed' });
                resolve();
            }
        });

        bb.on('error', (err) => {
            res.status(500).json({ error: err.message });
            resolve();
        });

        req.pipe(bb);
    });
};
