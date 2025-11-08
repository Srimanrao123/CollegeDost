# Setting Up Secrets for Edge Functions

This guide explains how to set up the required environment variables (secrets) for the Supabase Edge Functions.

## Required Secrets

### MSG91 Configuration
- `MSG91_API_KEY` - Your MSG91 API key
- `MSG91_TEMPLATE_ID` - Your MSG91 OTP template ID
- `MSG91_OTP_BASE_URL` - MSG91 OTP API base URL (default: `https://control.msg91.com/api/v5/otp`)
- `MSG91_OTP_EXPIRY` - OTP expiry time in minutes (default: `30`)

### Supabase Configuration
- `SUPABASE_URL` - Your Supabase project URL (usually auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (usually auto-set)

## Setting Secrets via CLI

### Option 1: Set All Secrets at Once

```bash
cd dost-college-space-06860-87390-99909-04-48214

supabase secrets set \
  MSG91_API_KEY="your-msg91-api-key" \
  MSG91_TEMPLATE_ID="your-template-id" \
  MSG91_OTP_BASE_URL="https://control.msg91.com/api/v5/otp" \
  MSG91_OTP_EXPIRY="30"
```

### Option 2: Set Secrets Individually

```bash
# MSG91 secrets
supabase secrets set MSG91_API_KEY="your-msg91-api-key"
supabase secrets set MSG91_TEMPLATE_ID="your-template-id"
supabase secrets set MSG91_OTP_BASE_URL="https://control.msg91.com/api/v5/otp"
supabase secrets set MSG91_OTP_EXPIRY="30"
```

Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are typically set automatically by Supabase CLI, but you can verify them:

```bash
# Check if secrets are set
supabase secrets list
```

## Local Development Setup

For local testing, create a `.env` file in the `supabase` directory:

```bash
# Create .env file
cat > supabase/.env << EOF
MSG91_API_KEY=your-msg91-api-key
MSG91_TEMPLATE_ID=your-template-id
MSG91_OTP_BASE_URL=https://control.msg91.com/api/v5/otp
MSG91_OTP_EXPIRY=30
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
EOF
```

Then run functions locally:

```bash
supabase functions serve --env-file ./supabase/.env
```

## Getting Your MSG91 Credentials

1. **MSG91_API_KEY**: 
   - Log in to your MSG91 dashboard
   - Go to API Settings
   - Copy your API key

2. **MSG91_TEMPLATE_ID**:
   - Log in to your MSG91 dashboard
   - Go to Templates section
   - Find your OTP template
   - Copy the Template ID

3. **MSG91_OTP_BASE_URL**:
   - Default: `https://control.msg91.com/api/v5/otp`
   - Only change if using a custom endpoint

## Getting Your Supabase Credentials

1. **SUPABASE_URL**:
   - Go to your Supabase project dashboard
   - Settings → API
   - Copy the "Project URL"

2. **SUPABASE_SERVICE_ROLE_KEY**:
   - Go to your Supabase project dashboard
   - Settings → API
   - Copy the "service_role" key (⚠️ Keep this secret!)

## Verifying Secrets

After setting secrets, verify they're configured:

```bash
# List all secrets (values are hidden)
supabase secrets list

# Test a function locally
supabase functions serve send-otp --env-file ./supabase/.env
```

## Security Notes

- ⚠️ Never commit `.env` files to version control
- ⚠️ Never share your `SUPABASE_SERVICE_ROLE_KEY` publicly
- ⚠️ Never share your `MSG91_API_KEY` publicly
- ✅ Use Supabase secrets for production (not `.env` files)
- ✅ Secrets are encrypted and stored securely by Supabase

## Troubleshooting

### "Secret not found" error
- Make sure you've set the secret using `supabase secrets set`
- Verify you're in the correct project directory
- Check with `supabase secrets list`

### "MSG91_API_KEY is not configured" error
- Verify the secret name is exactly `MSG91_API_KEY` (case-sensitive)
- Re-set the secret if needed
- For local dev, check your `.env` file

### Functions work locally but not in production
- Make sure secrets are set in Supabase (not just locally)
- Verify secret names match exactly
- Check Supabase project settings

