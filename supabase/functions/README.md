# Supabase Edge Functions - API Migration

This directory contains Supabase Edge Functions that have been migrated from the Express.js server.

## Functions

### 1. `send-otp`
Sends OTP via MSG91 API.

**Endpoint:** `POST /functions/v1/send-otp`

**Request Body:**
```json
{
  "phone": "+919876543210"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully...",
  "requestId": "optional-request-id"
}
```

### 2. `verify-otp`
Verifies OTP via MSG91 API.

**Endpoint:** `POST /functions/v1/verify-otp`

**Request Body:**
```json
{
  "phone": "+919876543210",
  "code": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully"
}
```

### 3. `create-profile`
Creates or updates user profile in Supabase profiles table. Also creates the user in Supabase Auth if they don't exist.

**Endpoint:** `POST /functions/v1/create-profile`

**Request Body:**
```json
{
  "phone": "+919876543210",
  "username": "john_doe"
}
```

**Response:**
```json
{
  "success": true,
  "userId": "user-uuid",
  "profileId": "user-uuid",
  "message": "User account and profile created successfully"
}
```

## Setup

### 1. Set Environment Variables (Secrets)

Set the required secrets in Supabase:

```bash
# Navigate to your Supabase project directory
cd dost-college-space-06860-87390-99909-04-48214

# Set MSG91 credentials
supabase secrets set MSG91_API_KEY="your-msg91-api-key"
supabase secrets set MSG91_TEMPLATE_ID="your-template-id"
supabase secrets set MSG91_OTP_BASE_URL="https://control.msg91.com/api/v5/otp"
supabase secrets set MSG91_OTP_EXPIRY="30"

# Supabase credentials (these are usually auto-set, but verify)
supabase secrets set SUPABASE_URL="https://your-project.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### 2. Local Development

For local testing, create a `.env` file in the `supabase` directory:

```env
MSG91_API_KEY=your-msg91-api-key
MSG91_TEMPLATE_ID=your-template-id
MSG91_OTP_BASE_URL=https://control.msg91.com/api/v5/otp
MSG91_OTP_EXPIRY=30
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Then run:

```bash
supabase functions serve --env-file ./supabase/.env
```

This will start the functions locally at:
- `http://localhost:54321/functions/v1/send-otp`
- `http://localhost:54321/functions/v1/verify-otp`
- `http://localhost:54321/functions/v1/create-profile`

### 3. Deploy to Production

Deploy all functions:

```bash
supabase functions deploy send-otp
supabase functions deploy verify-otp
supabase functions deploy create-profile
```

Or deploy all at once:

```bash
supabase functions deploy send-otp verify-otp create-profile
```

## Frontend Integration

Update your frontend API calls to use the new Supabase Edge Function endpoints:

**Before (Express):**
```typescript
const response = await fetch(`${BACKEND_URL}/api/send-otp`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone: fullPhoneNumber }),
});
```

**After (Supabase Edge Functions):**
```typescript
const { data, error } = await supabase.functions.invoke('send-otp', {
  body: { phone: fullPhoneNumber }
});
```

Or using direct fetch:

```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}` // or service role key if needed
  },
  body: JSON.stringify({ phone: fullPhoneNumber }),
});
```

## Response Format

All functions maintain the same response format as the original Express endpoints:

- **Success:** `{ success: true, ... }`
- **Error:** `{ success: false, error: "error message" }`

This ensures no breaking changes to the frontend code.

## CORS

All functions include CORS headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`

## Notes

- All functions use Deno runtime (not Node.js)
- Environment variables are accessed via `Deno.env.get()`
- Supabase client is created using `createClient` from `@supabase/supabase-js@2.39.0`
- Functions use the Service Role Key for admin operations (create-profile)
- Error handling and logging match the original Express implementation

