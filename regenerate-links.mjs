import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = '/home/paul/Documents/codes/portfolio/.env.local';
const env = readFileSync(envPath, 'utf8');
function getVar(name) {
  const m = env.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return m ? m[1].trim() : null;
}

const SUPABASE_URL = getVar('NEXT_PUBLIC_SUPABASE_URL');
const ANON_KEY = getVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const SERVICE_ROLE_KEY = getVar('SUPABASE_SERVICE_ROLE_KEY');
const ADMIN_EMAIL = 'paulhartman.bassist@gmail.com';
const PROD_BASE = 'https://www.loveondev.com';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const anon = createClient(SUPABASE_URL, ANON_KEY);

async function main() {
  // 1. Generate a magic link for the admin user
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: ADMIN_EMAIL,
  });
  if (linkError) throw linkError;

  const hashed_token = linkData.properties?.hashed_token;
  if (!hashed_token) throw new Error('No hashed_token returned');

  // 2. Verify OTP to get a real session
  const { data: sessionData, error: verifyError } = await anon.auth.verifyOtp({
    token_hash: hashed_token,
    type: 'magiclink',
  });
  if (verifyError) throw verifyError;

  const { access_token, refresh_token } = sessionData.session;

  // 3. POST to set-session on production to get HttpOnly cookies
  const setSessionRes = await fetch(`${PROD_BASE}/api/auth/set-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token, refresh_token }),
  });
  if (!setSessionRes.ok) {
    throw new Error('set-session failed: ' + (await setSessionRes.text()));
  }
  const setCookieHeaders = setSessionRes.headers.getSetCookie
    ? setSessionRes.headers.getSetCookie()
    : [setSessionRes.headers.get('set-cookie')].filter(Boolean);

  const cookieHeader = setCookieHeaders
    .map((c) => c.split(';')[0])
    .join('; ');

  console.log('Session established. Cookie count:', setCookieHeaders.length);

  // 4. Regenerate payment links for both proposals
  const proposalIds = [
    { id: '4000e70e-f848-480e-b131-f4ef60bf702f', label: 'ATG' },
    { id: '23c4c784-ac40-4543-bc6b-58af35631e30', label: 'CGT test' },
  ];

  for (const { id, label } of proposalIds) {
    const res = await fetch(`${PROD_BASE}/api/admin/proposals/${id}/payment-link`, {
      method: 'POST',
      headers: { Cookie: cookieHeader },
    });
    const body = await res.json();
    if (!res.ok) {
      console.error(`[${label}] FAILED:`, body);
    } else {
      console.log(`[${label}] New link:`, body.url);
    }
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
