// api/waitlist.js
// Vercel Serverless Function — speichert Anmeldungen in Supabase

import { createClient } from '@supabase/supabase-js';

// SUPABASE_SECRET_KEY = neuer Name ("sb_secret_...")
// Bei älteren Projekten heißt er noch "service_role" — beide funktionieren.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};

  // Validierung
  if (!email || typeof email !== 'string' || !/.+@.+\..+/.test(email)) {
    return res.status(400).json({ error: 'Ungültige Email' });
  }

  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254) {
    return res.status(400).json({ error: 'Email zu lang' });
  }

  try {
    // Schon angemeldet? Dann Position zurückgeben, nicht doppelt speichern
    const { data: existing, error: fetchErr } = await supabase
      .from('waitlist')
      .select('id')
      .eq('email', normalized)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (existing) {
      const { count: existingPos, error: countErr } = await supabase
        .from('waitlist')
        .select('*', { count: 'exact', head: true })
        .lte('id', existing.id);
      if (countErr) throw countErr;
      return res.status(200).json({ position: existingPos, existing: true });
    }

    // Neu eintragen
    const { data: inserted, error: insertErr } = await supabase
      .from('waitlist')
      .insert([{ email: normalized }])
      .select('id')
      .single();

    if (insertErr) throw insertErr;

    // Gesamtanzahl = Position des neuen Eintrags
    const { count: total, error: totalErr } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });
    if (totalErr) throw totalErr;

    return res.status(200).json({ position: total, existing: false });

  } catch (err) {
    console.error('Waitlist error:', err);
    return res.status(500).json({ error: 'Serverfehler' });
  }
}
