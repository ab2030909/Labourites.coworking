/*
 * Shared Supabase client for the LABOURITES website.
 * Reuses the same project/config used by the contact form.
 *
 * Requires the Supabase JS library to be loaded BEFORE this file:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *
 * SECURITY: Only the public "anon" key is used here. Never put the
 * service_role key in frontend code.
 *
 * ── If your URL / anon key ever change, update them here once. ──
 */

const SUPABASE_URL = 'https://jaldxqqplawmexwbpark.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphbGR4cXFwbGF3bWV4d2JwYXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2Nzg1NTIsImV4cCI6MjA5MjI1NDU1Mn0.d2H-P4i3xtsm2X0N9spJzyk3S652HAbZG0Us6GcHr9o';

// Name of the storage bucket used for update images.
const UPDATES_BUCKET = 'updates';

let supabaseClient = null;

if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,       // keep session alive across page loads
            autoRefreshToken: true,     // auto-refresh the JWT before it expires
            detectSessionInUrl: true    // pick up session from URL on redirect
        }
    });
} else {
    console.error('Supabase library not loaded. Add the CDN <script> before supabaseClient.js');
}
