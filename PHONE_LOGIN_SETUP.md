# Phone Login Setup - Complete

## ✅ Changes Implemented

### 1. Fixed verify-otp Edge Function
**File**: `supabase/functions/verify-otp/index.ts`

**Changes**:
- Added `SUPABASE_ANON_KEY` environment variable
- Changed session token exchange to use anon key instead of service role key (line 148)
- Added fallback password-based authentication if magic link fails
- Added comprehensive logging throughout the function:
  - Session generation start/completion
  - Magic link token extraction status
  - Token exchange response status
  - Error details for debugging

### 2. Enhanced Auth.tsx Logging
**File**: `src/pages/Auth.tsx`

**Changes**:
- Added detailed console logging for OTP verification response
- Logs session token presence/absence
- Logs user information retrieval status
- Logs navigation decisions (existing vs new user)
- Added better error messages with specific failure points

## 🔧 Required Setup

### Set SUPABASE_ANON_KEY Environment Variable

**CRITICAL**: The verify-otp edge function requires the `SUPABASE_ANON_KEY` to be set.

#### Step 1: Get your Anon Key
1. Go to your Supabase Dashboard
2. Navigate to **Settings → API**
3. Copy the `anon` `public` key

#### Step 2: Set the Secret

**Option A - Using Supabase CLI (Recommended):**
```bash
supabase secrets set SUPABASE_ANON_KEY="your-anon-key-here"
```

**Option B - Using Supabase Dashboard:**
1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Add new secret:
   - Name: `SUPABASE_ANON_KEY`
   - Value: Your anon key from Step 1

**Option C - Local Development (.env.local):**
Create `supabase/.env.local`:
```env
SUPABASE_ANON_KEY=your-anon-key-here
```

#### Step 3: Verify Setup
```bash
supabase secrets list
```

See `supabase/functions/SETUP_ANON_KEY.md` for detailed instructions.

## 📊 Testing & Debugging

### Test the Flow
1. Open your app and go to the login page
2. Enter a phone number and click "Send Code"
3. Enter the OTP received
4. **Open Browser Console** (F12) to see detailed logs

### Expected Console Logs

**Success Flow:**
```
📥 Verify OTP Response: { success: true, hasUser: true, hasSession: true, ... }
✅ OTP verified successfully
🔐 Setting Supabase session...
✅ Session set successfully
👤 Fetching authenticated user...
Get user result: { hasUser: true, userId: "...", hasError: false }
✅ Successfully got authenticated user: [user-id]
```

**For Existing Users:**
```
👤 Existing user flow
Profile fetched: true
➡️ Redirecting to home
```

**For New Users:**
```
🆕 New user flow
➡️ Redirecting to create profile
```

### Edge Function Logs

Check the edge function logs:
```bash
supabase functions logs verify-otp
```

Look for:
```
✅ OTP verified for [phone]
✅ Found existing user: [id] OR ✅ Created new user: [id]
🔑 Starting session generation for user: [id]
Attempting magic link token generation...
Magic link token extracted: YES
Exchanging magic link token for session...
Session exchange response status: 200
✅ Generated session via magic link for user: [id]
Final session status - Token: PRESENT, Refresh: PRESENT
```

## 🔍 Troubleshooting

### Error: "Server configuration error"
- The `SUPABASE_ANON_KEY` is not set
- Run: `supabase secrets set SUPABASE_ANON_KEY="your-key"`

### Error: "Failed to get user information"
- Check edge function logs for session generation errors
- Verify the anon key is correct
- Check browser console for detailed error logs

### Session token is MISSING
- Magic link method failed, should fallback to password method
- Check edge function logs for password method status
- Verify Supabase Auth is properly configured

### User redirected but not authenticated
- Session may not be set properly
- Check browser console for "Failed to set session" errors
- Verify the session token format is valid

## 📝 Flow Summary

1. **User enters phone number** → OTP sent via MSG91
2. **User enters OTP** → MSG91 verifies OTP
3. **Edge function**:
   - Checks if user exists in auth.users by phone
   - Creates new user if not exists
   - Generates session token (magic link or password method)
   - Returns: user data, session token, userExists flag
4. **Client**:
   - Sets session with received token
   - Gets authenticated user
   - Navigates based on userExists:
     - Existing user → Home (/)
     - New user → Create Profile (/create-profile)

## 🎯 Next Steps

1. **Set the SUPABASE_ANON_KEY** (see instructions above)
2. **Test the phone login flow**
3. **Check console logs** for any errors
4. **Review edge function logs** if issues persist

If you encounter any issues, the detailed logging will help identify exactly where the problem occurs.

