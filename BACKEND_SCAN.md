# Backend/Node.js Logic Scan Results

## 1. Files with Backend/Node.js Logic

### 🔴 **CRITICAL - Must Move to Edge Functions**

#### 1.1 `src/lib/r2Upload.ts`
- **What it does:** Uploads images to Cloudflare R2 using S3-compatible API with AWS Signature V4
- **Why move:** 
  - **Security:** Exposes R2 credentials (`VITE_R2_ACCOUNT_ID`, `VITE_R2_ACCESS_KEY_ID`, `VITE_R2_SECRET_ACCESS_KEY`) in frontend bundle
  - **Node-only APIs:** Uses crypto APIs that should be server-side
  - **Secret key usage:** R2 credentials should never be in client code

#### 1.2 `src/lib/geminiSlug.ts`
- **What it does:** Generates SEO-friendly slugs using Google Gemini AI API
- **Why move:**
  - **Security:** Exposes `VITE_GEMINI_API_KEY` in frontend bundle
  - **API key usage:** Gemini API key should be server-side only
  - **Cost control:** Better rate limiting and cost management on server

#### 1.3 `src/pages/CreatePostPage.tsx` (Post Creation Logic)
- **What it does:** 
  - Creates posts in Supabase database
  - Uploads images to R2 (calls `r2Upload.ts`)
  - Processes hashtags and creates tag relationships
  - Generates slugs using Gemini API
- **Why move:**
  - **Security:** Currently exposes R2 and Gemini credentials
  - **Privileged operations:** Tag creation/upsert should be validated server-side
  - **Data integrity:** Better validation and error handling on server

### 🟡 **ADMIN/ONE-TIME SCRIPTS** (Can stay as-is)

#### 1.4 `backend/index.js`
- **What it does:** One-time migration script to move images from Supabase Storage to R2
- **Why keep:** 
  - One-time admin task, not part of app runtime
  - Uses Node.js-specific APIs (`sharp`, `@aws-sdk/client-s3`, `Buffer`, `process.env`)
  - Can be run manually by admins

### 🟢 **SAFE - Can Stay in Frontend**

#### 1.5 `src/lib/imageCompression.ts`
- **What it does:** Client-side image compression using Canvas API
- **Why keep:** 
  - Uses browser-native Canvas API (no Node.js dependencies)
  - Reduces upload size before sending to server
  - Better UX (faster uploads)

#### 1.6 `src/lib/pagination.ts`
- **What it does:** Cursor-based pagination encoding/decoding
- **Why keep:**
  - Has browser fallback (`btoa`/`atob`) if `Buffer` not available
  - Pure utility function, no secrets or privileged operations

### ✅ **ALREADY MIGRATED**

#### 1.7 `supabase/functions/upload-avatar/index.ts`
- **Status:** ✅ Already an Edge Function
- **Note:** Uses R2 credentials from environment (correct approach)

#### 1.8 `supabase/functions/send-otp/index.ts`
- **Status:** ✅ Already an Edge Function

#### 1.9 `supabase/functions/verify-otp/index.ts`
- **Status:** ✅ Already an Edge Function

#### 1.10 `supabase/functions/create-profile/index.ts`
- **Status:** ✅ Already an Edge Function

#### 1.11 `supabase/functions/update-profile/index.ts`
- **Status:** ✅ Already an Edge Function

#### 1.12 `supabase/functions/recalculate-trends/index.ts`
- **Status:** ✅ Already an Edge Function

---

## 2. Proposed Supabase Edge Functions

### 2.1 `upload-post-image`
- **Purpose:** Upload post images to R2 (replaces `src/lib/r2Upload.ts`)
- **Method:** `POST`
- **Request:** `multipart/form-data` with `file` field and optional `postId`
- **Response:** `{ data: { key: string, url: string }, message?: string }`
- **Auth:** Requires `Authorization: Bearer <access_token>`
- **Env vars:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_DOMAIN`

### 2.2 `create-post`
- **Purpose:** Create post with image upload, tag processing, and slug generation
- **Method:** `POST`
- **Request:** JSON with post data + optional `image` (base64 or FormData)
- **Response:** `{ data: { post: Post, imageR2Key?: string }, message?: string }`
- **Auth:** Requires `Authorization: Bearer <access_token>`
- **Env vars:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `R2_*` (for image upload), `GEMINI_API_KEY` (for slug)

### 2.3 `generate-slug` (Optional - can be part of create-post)
- **Purpose:** Generate SEO-friendly slug using Gemini AI
- **Method:** `POST`
- **Request:** JSON with `title`, `content?`, `examType?`, `imageBase64?`, `imageMimeType?`
- **Response:** `{ data: { slug: string }, message?: string }`
- **Auth:** Requires `Authorization: Bearer <access_token>`
- **Env vars:** `GEMINI_API_KEY`

---

## 3. Frontend Changes Required

### 3.1 Replace `src/lib/r2Upload.ts` usage
- **File:** `src/pages/CreatePostPage.tsx`
- **Before:** Direct R2 upload with credentials in frontend
- **After:** Call `upload-post-image` Edge Function

### 3.2 Replace `src/lib/geminiSlug.ts` usage
- **File:** `src/pages/CreatePostPage.tsx`
- **Before:** Direct Gemini API call with API key in frontend
- **After:** Call `generate-slug` Edge Function (or include in `create-post`)

### 3.3 Refactor post creation flow
- **File:** `src/pages/CreatePostPage.tsx`
- **Before:** Multi-step: create post → upload image → update post → process tags
- **After:** Single call to `create-post` Edge Function (or keep multi-step but use Edge Functions)

---

## 4. Environment Variables Required

### For Edge Functions (set in Supabase Dashboard):
- `SUPABASE_URL` (auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-set)
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME` (default: `post-upload`)
- `R2_PUBLIC_DOMAIN` (e.g., `cdn.collegedost.in`)
- `GEMINI_API_KEY`

### For Frontend (remove from `.env`):
- ❌ Remove `VITE_R2_ACCOUNT_ID`
- ❌ Remove `VITE_R2_ACCESS_KEY_ID`
- ❌ Remove `VITE_R2_SECRET_ACCESS_KEY`
- ❌ Remove `VITE_R2_BUCKET_NAME`
- ❌ Remove `VITE_GEMINI_API_KEY`
- ✅ Keep `VITE_R2_PUBLIC_DOMAIN` (for image URL construction)

---

## 5. Security Improvements

1. **R2 Credentials:** Moved from frontend to Edge Functions (not exposed in bundle)
2. **Gemini API Key:** Moved from frontend to Edge Functions (not exposed in bundle)
3. **Tag Processing:** Server-side validation and rate limiting
4. **Image Upload:** Server-side validation (file type, size limits)
5. **Post Creation:** Server-side validation and sanitization

---

## 6. Migration Priority

1. **High Priority:**
   - `upload-post-image` Edge Function (security: R2 credentials)
   - `generate-slug` Edge Function (security: Gemini API key)

2. **Medium Priority:**
   - `create-post` Edge Function (consolidates logic, better validation)

3. **Low Priority:**
   - Keep `backend/index.js` as-is (one-time migration script)

