# Debugging: User Not Created in auth.users

## Issue
Users are not appearing in the `auth.users` table after phone OTP verification.

## Enhanced Logging Added

I've added comprehensive logging to the `verify-otp` edge function to track exactly what's happening. The logs will show:

1. ✅ OTP verification with MSG91
2. 🔍 Checking if user exists
3. 🆕 Creating new user (if needed)
4. 📋 All parameters being used
5. ❌ Any errors that occur

## How to Check the Logs

### Step 1: Deploy the Updated Function

Make sure the updated `verify-otp` function is deployed:

```bash
cd dost-college-space-06860-87390-99909-04-48214
supabase functions deploy verify-otp
```

### Step 2: Test the Phone Login Flow

1. Go to your app's login page
2. Enter a phone number (e.g., 9876543210)
3. Click "Send Code"
4. Enter the OTP received
5. Click "Verify Code"

### Step 3: Check Edge Function Logs

#### Option A: Using Supabase CLI
```bash
supabase functions logs verify-otp --follow
```

#### Option B: Using Supabase Dashboard
1. Go to Supabase Dashboard
2. Navigate to **Edge Functions** → **verify-otp**
3. Click on **Logs** tab
4. Look for the most recent invocation

### Step 4: What to Look For in Logs

#### Success Pattern (User Created):
```
📞 Starting OTP verification for phone: +919876543210
Calling MSG91 verify API for phone: 919876543210
MSG91 Response Status: 200, Data: { type: "success", ... }
✅ OTP verified successfully for +919876543210
📋 Formatted phone for Supabase: +919876543210
📧 Temporary email: phone_919876543210@temp.collegedost.com
🔍 Checking if user exists in auth.users...
Total users in database: 5
🆕 User does not exist. Creating new user in auth.users...
Creating user with phone: +919876543210, email: phone_919876543210@temp.collegedost.com
Create user response - Has data: true, Has error: false
✅ Successfully created new user in auth.users!
   User ID: abc-123-def-456
   Phone: +919876543210
   Email: phone_919876543210@temp.collegedost.com
```

#### Error Pattern (User Creation Failed):
```
❌ Error creating user: [error message]
Error details - Message: [detailed error], Status: [status code]
```

## Common Issues and Solutions

### 1. Missing Environment Variables

**Symptoms:**
- Log shows: "Missing required environment variables"
- Function returns: "Server configuration error"

**Solution:**
```bash
# Check if all required secrets are set
supabase secrets list

# Required secrets:
# - MSG91_API_KEY
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - SUPABASE_ANON_KEY

# Set missing secrets:
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
supabase secrets set SUPABASE_ANON_KEY="your-anon-key"
```

### 2. Phone Number Format Issues

**Symptoms:**
- User creation seems to succeed but user not found in dashboard
- Duplicate phone format issues

**Check:**
- Logs show: "📋 Formatted phone for Supabase: +919876543210"
- Verify the phone format matches Supabase's expected format

**Solution:**
Phone numbers should be in E.164 format: `+[country_code][number]`
Example: `+919876543210`

### 3. Duplicate Email Address

**Symptoms:**
- Error: "User with this email already exists"
- Log shows email like: `phone_919876543210@temp.collegedost.com`

**Solution:**
This shouldn't happen with unique phone numbers, but if it does:
1. Check if a user with that email already exists in auth.users
2. If yes, the phone number is already registered

### 4. Supabase Auth Settings

**Check these settings in Supabase Dashboard:**

1. **Navigate to:** Authentication → Settings
2. **Verify:**
   - ✅ "Enable Phone Sign-up" is ON
   - ✅ "Enable Email Sign-up" is ON (needed for temp email)
   - ✅ No email confirmation required for temp emails

### 5. RLS Policies

**Check if there are any RLS policies blocking user creation:**

1. Go to: Authentication → Policies
2. Make sure admin operations are not blocked
3. The edge function uses the service role key, which should bypass RLS

## Manual Verification Steps

### Check if User Was Actually Created

1. **Via Supabase Dashboard:**
   - Go to Authentication → Users
   - Search for the phone number (e.g., +919876543210)
   - Check if user exists

2. **Via SQL Editor:**
   ```sql
   -- Check auth.users table
   SELECT id, phone, email, created_at 
   FROM auth.users 
   WHERE phone = '+919876543210';
   
   -- Check all users created today
   SELECT id, phone, email, created_at 
   FROM auth.users 
   WHERE created_at > CURRENT_DATE
   ORDER BY created_at DESC;
   ```

## Testing with curl (Optional)

You can test the edge function directly:

```bash
# Get an OTP first (use your actual endpoint)
curl -X POST https://your-project.supabase.co/functions/v1/send-otp \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'

# Then verify (replace with actual OTP received)
curl -X POST https://your-project.supabase.co/functions/v1/verify-otp \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "code": "1234"}'
```

## Next Steps

1. **Deploy the updated function** with enhanced logging
2. **Test the phone login flow**
3. **Check the edge function logs** immediately after testing
4. **Share the logs** if the issue persists - the detailed logs will show exactly where it's failing

The logs will tell us:
- ✅ If MSG91 verification succeeded
- ✅ If Supabase Admin client was created
- ✅ If the createUser API was called
- ✅ What response we got from createUser
- ❌ Any errors that occurred

With these detailed logs, we can pinpoint the exact issue!

