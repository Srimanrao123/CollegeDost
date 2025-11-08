# Migration Guide: Express.js to Supabase Edge Functions

This guide documents the migration of Express.js API endpoints to Supabase Edge Functions.

## Migration Summary

Three Express.js endpoints have been successfully migrated to Supabase Edge Functions:

| Original Express Endpoint | New Supabase Edge Function | Status |
|---------------------------|----------------------------|--------|
| `POST /api/send-otp` | `POST /functions/v1/send-otp` | ✅ Complete |
| `POST /api/verify-otp` | `POST /functions/v1/verify-otp` | ✅ Complete |
| `POST /api/create-phone-user` | `POST /functions/v1/create-profile` | ✅ Complete |

## Key Changes

### 1. Runtime Environment
- **Before:** Node.js + Express
- **After:** Deno runtime

### 2. HTTP Handling
- **Before:** `res.status(200).json({ ... })`
- **After:** `new Response(JSON.stringify({ ... }), { status: 200, headers: {...} })`

### 3. Environment Variables
- **Before:** `process.env.MSG91_API_KEY`
- **After:** `Deno.env.get("MSG91_API_KEY")`

### 4. Supabase Client
- **Before:** Direct fetch calls to Supabase REST API
- **After:** `createClient` from `@supabase/supabase-js@2.39.0` (for create-profile)

### 5. Request Parsing
- **Before:** `req.body` (Express middleware)
- **After:** `await req.json()`

### 6. Headers
- **Before:** `req.headers.authorization`
- **After:** `req.headers.get("Authorization")`

## Response Format Compatibility

All functions maintain **identical response formats** to ensure zero frontend breaking changes:

### send-otp
```json
{
  "success": true,
  "message": "OTP sent successfully...",
  "requestId": "optional-id"
}
```

### verify-otp
```json
{
  "success": true,
  "message": "OTP verified successfully"
}
```

### create-profile
```json
{
  "success": true,
  "userId": "uuid",
  "profileId": "uuid",
  "message": "User account and profile created successfully"
}
```

## Testing Checklist

### Local Testing

1. **Set up local environment:**
   ```bash
   cd dost-college-space-06860-87390-99909-04-48214
   # Create supabase/.env with required secrets (see SETUP_SECRETS.md)
   ```

2. **Start local Supabase:**
   ```bash
   supabase start
   ```

3. **Serve functions locally:**
   ```bash
   supabase functions serve --env-file ./supabase/.env
   ```

4. **Test each endpoint:**
   ```bash
   # Test send-otp
   curl -X POST http://localhost:54321/functions/v1/send-otp \
     -H "Content-Type: application/json" \
     -d '{"phone": "+919876543210"}'

   # Test verify-otp
   curl -X POST http://localhost:54321/functions/v1/verify-otp \
     -H "Content-Type: application/json" \
     -d '{"phone": "+919876543210", "code": "1234"}'

   # Test create-profile
   curl -X POST http://localhost:54321/functions/v1/create-profile \
     -H "Content-Type: application/json" \
     -d '{"phone": "+919876543210", "username": "test_user"}'
   ```

### Production Deployment

1. **Set secrets in Supabase:**
   ```bash
   supabase secrets set MSG91_API_KEY="..." MSG91_TEMPLATE_ID="..." ...
   ```

2. **Deploy functions:**
   ```bash
   supabase functions deploy send-otp verify-otp create-profile
   ```

3. **Update frontend API calls:**
   - Replace `${BACKEND_URL}/api/*` with Supabase function URLs
   - See README.md for integration examples

## Frontend Integration

### Option 1: Using Supabase Client (Recommended)

```typescript
import { supabase } from '@/integrations/supabase/client';

// Send OTP
const { data, error } = await supabase.functions.invoke('send-otp', {
  body: { phone: fullPhoneNumber }
});

// Verify OTP
const { data, error } = await supabase.functions.invoke('verify-otp', {
  body: { phone: fullPhoneNumber, code: otpCode }
});

// Create Profile
const { data, error } = await supabase.functions.invoke('create-profile', {
  body: { phone: fullPhoneNumber, username: username }
});
```

### Option 2: Direct Fetch

```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Send OTP
const response = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
  },
  body: JSON.stringify({ phone: fullPhoneNumber })
});
```

## Benefits of Migration

1. **No separate server needed** - Functions run on Supabase infrastructure
2. **Better scalability** - Automatic scaling with Edge Functions
3. **Lower latency** - Edge Functions run closer to users
4. **Simplified deployment** - No server maintenance required
5. **Cost efficiency** - Pay only for function invocations
6. **Integrated with Supabase** - Direct access to Supabase services

## Rollback Plan

If issues arise, you can:

1. Keep the Express server running as a fallback
2. Use environment variables to switch between endpoints:
   ```typescript
   const API_BASE = import.meta.env.VITE_USE_EDGE_FUNCTIONS 
     ? `${SUPABASE_URL}/functions/v1`
     : BACKEND_URL;
   ```
3. Gradually migrate endpoints one at a time

## Next Steps

1. ✅ All three functions created and tested locally
2. ⏳ Set secrets in Supabase production
3. ⏳ Deploy functions to production
4. ⏳ Update frontend to use new endpoints
5. ⏳ Monitor for any issues
6. ⏳ Decommission Express server (optional)

## Support

For issues or questions:
- Check function logs: `supabase functions logs <function-name>`
- Review SETUP_SECRETS.md for configuration issues
- Verify response formats match original endpoints

