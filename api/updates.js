/*
 * Vercel Serverless Function — /api/updates
 * Acts as a secure proxy for admin write operations.
 * Uses the Supabase SERVICE ROLE KEY server-side (never exposed to browser).
 * RLS is completely bypassed because service role ignores all policies.
 *
 * !! IMPORTANT: Set these environment variables in your Vercel project:
 *    SUPABASE_URL        = https://jaldxqqplawmexwbpark.supabase.co
 *    SUPABASE_SERVICE_KEY = your-service-role-key (from Supabase > Settings > API)
 *
 * The service role key MUST stay in Vercel env vars — never in browser code.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Simple admin password check (same password you use to log in to the admin panel)
const ADMIN_PASSWORD = process.env.ADMIN_SECRET || 'Labourites@68';

function getAdminClient() {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false }
    });
}

module.exports = async function handler(req, res) {
    // CORS headers so the browser can call this from any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Auth: every write request must include the admin secret header
    const secret = req.headers['x-admin-secret'];
    if (req.method !== 'GET' && secret !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const sb = getAdminClient();
    const { method, body, query } = req;

    try {
        // GET /api/updates — fetch all updates (admin sees drafts too)
        if (method === 'GET' && !query.slug) {
            const { data, error } = await sb
                .from('updates')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return res.status(200).json(data);
        }

        // GET /api/updates?slug=xxx — single update (public, only published)
        if (method === 'GET' && query.slug) {
            const { data, error } = await sb
                .from('updates')
                .select('*')
                .eq('slug', query.slug)
                .eq('is_published', true)
                .maybeSingle();
            if (error) throw error;
            return res.status(200).json(data);
        }

        // POST /api/updates — insert
        if (method === 'POST') {
            const { data, error } = await sb
                .from('updates')
                .insert([body])
                .select()
                .single();
            if (error) throw error;
            return res.status(201).json(data);
        }

        // PUT /api/updates?id=xxx — update
        if (method === 'PUT' && query.id) {
            const { data, error } = await sb
                .from('updates')
                .update(body)
                .eq('id', query.id)
                .select()
                .single();
            if (error) throw error;
            return res.status(200).json(data);
        }

        // DELETE /api/updates?id=xxx — delete
        if (method === 'DELETE' && query.id) {
            const { error } = await sb
                .from('updates')
                .delete()
                .eq('id', query.id);
            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (err) {
        console.error('API error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
