# Phone + OTP Login Setup Guide

This guide will help you set up the complete OTP-based phone authentication system using MSG91 API.

## 🏗️ Architecture

- **Frontend**: React app with OTP verification UI
- **Backend**: Express.js proxy server (localhost:5000)
- **OTP Service**: MSG91 API
- **Session**: localStorage-based authentication

## 📋 Prerequisites

- Node.js installed
- npm or yarn package manager
- MSG91 API Key (configured in server/index.js)

## 🚀 Setup Instructions

### Step 1: Install Backend Dependencies

```bash
cd server
npm install
```

### Step 2: Start the Backend Server

```bash
npm start
```

The server will run on `http://localhost:5000`

You should see:
```
✅ OTP Backend running on http://localhost:5000
```

### Step 3: Start the Frontend

In a new terminal:

```bash
cd dost-college-space-06860-87390-99909-04-48214
npm run dev
```

## 🧪 How to Use

1. **Navigate to `/auth`** page
2. **Select a country** from the dropdown (default: India 🇮🇳)
3. **Enter your phone number** (e.g., 9876543210)
4. **Click "Send Code"** - OTP will be sent to your phone
5. **Enter the 4-digit code** you received
6. **Click "Verify Code"** to complete login
7. You'll be redirected to the home page

## 🔄 Features

- ✅ Country code selector (100+ countries)
- ✅ Phone number validation
- ✅ OTP input with 4-digit slots
- ✅ Resend OTP with 30s timer
- ✅ Error handling and toast notifications
- ✅ Loading states
- ✅ Session persistence via localStorage
- ✅ Backend proxy to avoid CORS issues

## 📝 API Endpoints (Backend)

### POST `/api/send-otp`
Sends OTP to phone number

**Request:**
```json
{
  "phone": "+919876543210"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

### POST `/api/verify-otp`
Verifies OTP code

**Request:**
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

## 🔧 Configuration

### Backend Configuration

MSG91 API key is configured in `server/index.js`:

```javascript
const MSG91_API_KEY = "344090AZC6C4ZXC66dee3c2P1";
const MSG91_BASE_URL = "https://control.msg91.com/api/v5/otp";
```

**Optional:** If you have a template_id from MSG91 dashboard, you can set it as an environment variable:
```bash
export MSG91_TEMPLATE_ID=your_template_id
```

The system will automatically use the template_id if available, otherwise it will use a default message format.

### Frontend Configuration

Backend URL is configured in `src/pages/Auth.tsx`:

```typescript
const BACKEND_URL = "http://localhost:5000";
```

## 🐛 Troubleshooting

### Backend not starting
- Check if port 5000 is available
- Try changing the port in `server/index.js`

### OTP not sending
- Verify MSG91 API key is correct
- Check MSG91 account status and balance
- Check server console logs for MSG91 API responses
- Ensure phone number is in correct format (digits only, with country code)

### CORS errors
- Make sure backend server is running
- Verify `BACKEND_URL` in frontend

### Phone number validation
- Minimum 10 digits required
- Country code automatically added

## 🔐 Security Notes

- MSG91 API key is stored in server-side code
- All requests go through backend proxy
- No direct frontend-to-MSG91 communication
- Session stored in localStorage
- Phone numbers are formatted automatically (digits only)

## 📱 Testing

1. Use a real phone number to receive OTP
2. Test with different country codes
3. Test OTP resend functionality
4. Verify session persistence after reload

## 🎯 Next Steps

- Add logout functionality
- Implement session expiry
- Add profile page for phone-authenticated users
- Consider adding 2FA support
- Add analytics for OTP success rates

