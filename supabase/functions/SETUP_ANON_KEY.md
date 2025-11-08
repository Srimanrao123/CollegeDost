# Setup SUPABASE_ANON_KEY for Edge Functions

The `verify-otp` edge function now requires the `SUPABASE_ANON_KEY` environment variable to properly generate session tokens for authenticated users.

## Why is this needed?

When exchanging a magic link token for a session, the Supabase Auth API requires the **anon key** (not the service role key) to generate client-side sessions. This is a security best practice to ensure sessions have the appropriate permissions.

## How to set it up

### Option 1: Using Supabase CLI (Recommended)

1. Find your Supabase Anon Key:
   - Go to your Supabase Dashboard
   - Navigate to **Settings** → **API**
   - Copy the `anon` `public` key

2. Set the secret using the CLI:

```bash
supabase secrets set SUPABASE_ANON_KEY="your-anon-key-here"
```

3. Verify the secret was set:

```bash
supabase secrets list
```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions**
3. Click on **Secrets**
4. Add a new secret:
   - Name: `SUPABASE_ANON_KEY`
   - Value: Your anon/public key from Settings → API

### Option 3: Using .env file (Local Development Only)

For local testing with `supabase functions serve`:

1. Create or update `supabase/.env.local`:

```env
SUPABASE_ANON_KEY=your-anon-key-here
```

2. The local function will automatically pick up this variable.

## Verify the setup

After setting the secret, test the phone login flow:

1. Go to your app's login page
2. Enter a phone number and click "Send Code"
3. Enter the OTP received
4. Check the browser console for detailed logs
5. Look for these success messages:
   - ✅ Generated session via magic link for user: [user_id]
   - OR ✅ Generated session via password for user: [user_id]

## Troubleshooting

If you see errors in the logs:

- **"Missing required environment variables"**: The anon key is not set
- **"Failed to exchange magic link token"**: Check that you're using the correct anon key
- **"Failed to set session"**: The session token may be invalid

Check the Supabase edge function logs:

```bash
supabase functions logs verify-otp
```

Look for detailed console logs that show:
- 🔑 Starting session generation
- Magic link token extraction status
- Session exchange response status
- Final session status (PRESENT or MISSING)

