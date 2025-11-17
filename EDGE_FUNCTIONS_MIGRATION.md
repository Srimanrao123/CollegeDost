# Edge Functions Migration Summary

## Overview

This document summarizes the migration of backend/Node.js logic to Supabase Edge Functions. All sensitive operations (R2 uploads, Gemini API calls) have been moved from the frontend to secure Edge Functions.

## Created Edge Functions

### 1. `upload-post-image`
**Location:** `supabase/functions/upload-post-image/index.ts`

**Purpose:** Upload post images to Cloudflare R2 storage

**API:**
- **Method:** `POST`
- **URL:** `https://<project-ref>.functions.supabase.co/upload-post-image`
- **Headers:** 
  - `Authorization: Bearer <access_token>` (required)
- **Body:** `multipart/form-data`
  - `file`: File (required)
  - `postId`: string (optional, for path organization)
- **Response:**
  ```json
  {
    "data": {
      "key": "post-upload/post-123/image-1234567890.webp",
      "url": "https://cdn.collegedost.in/post-upload/post-123/image-1234567890.webp"
    },
    "message": "Image uploaded successfully"
  }
  ```

**Environment Variables Required:**
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME` (default: "post-upload")
- `R2_PUBLIC_DOMAIN` (optional)

---

### 2. `generate-slug`
**Location:** `supabase/functions/generate-slug/index.ts`

**Purpose:** Generate SEO-friendly URL slugs using Google Gemini AI

**API:**
- **Method:** `POST`
- **URL:** `https://<project-ref>.functions.supabase.co/generate-slug`
- **Headers:**
  - `Authorization: Bearer <access_token>` (required)
  - `Content-Type: application/json`
- **Body:**
  ```json
  {
    "title": "string (required)",
    "content": "string (optional)",
    "examType": "string (optional)",
    "imageBase64": "string (optional)",
    "imageMimeType": "string (optional)"
  }
  ```
- **Response:**
  ```json
  {
    "data": {
      "slug": "seo-friendly-slug"
    },
    "message": "Slug generated successfully"
  }
  ```

**Environment Variables Required:**
- `GEMINI_API_KEY`

---

### 3. `create-post`
**Location:** `supabase/functions/create-post/index.ts`

**Purpose:** Create a new post with tag processing and slug generation

**API:**
- **Method:** `POST`
- **URL:** `https://<project-ref>.functions.supabase.co/create-post`
- **Headers:**
  - `Authorization: Bearer <access_token>` (required)
  - `Content-Type: application/json` or `multipart/form-data`
- **Body:** (JSON or FormData)
  ```json
  {
    "title": "string (required)",
    "content": "string (optional)",
    "category": "string (required)",
    "examType": "string (required)",
    "postType": "string (default: 'Text')",
    "linkUrl": "string (optional)",
    "topicId": "string (optional)",
    "image": "File (optional)",
    "imageBase64": "string (optional)",
    "imageMimeType": "string (optional)"
  }
  ```
- **Response:**
  ```json
  {
    "data": {
      "post": { /* Post object */ },
      "imageR2Key": "string | null",
      "hashtags": ["tag1", "tag2"]
    },
    "message": "Post created successfully"
  }
  ```

**Environment Variables Required:**
- `SUPABASE_URL` (auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-set)
- `GEMINI_API_KEY` (optional, for slug generation)

---

## Frontend Changes

### Before (Direct R2 Upload)

```typescript
// ❌ OLD: Direct R2 upload with credentials in frontend
import { uploadImageToR2 } from "@/lib/r2Upload";

const result = await uploadImageToR2({
  file: imageFile,
  userId: user.id,
  postId: postId,
  folder: 'post-upload',
});
// R2 credentials exposed in frontend bundle!
```

### After (Edge Function)

```typescript
// ✅ NEW: Edge Function call
const { data: { session } } = await supabase.auth.getSession();
const formData = new FormData();
formData.append("file", imageFile);
formData.append("postId", postId);

const response = await fetch(`${supabaseUrl}/functions/v1/upload-post-image`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${session.access_token}`,
  },
  body: formData,
});

const result = await response.json();
// R2 credentials secure on server!
```

---

### Before (Direct Gemini API)

```typescript
// ❌ OLD: Direct Gemini API call with key in frontend
import { generateSlugWithGemini } from "@/lib/geminiSlug";

const slug = await generateSlugWithGemini({
  title: trimmedTitle,
  content: trimmedContent,
  examType: selectedExamType,
  imageBase64: imageBase64,
  imageMimeType: imageMimeType,
});
// Gemini API key exposed in frontend bundle!
```

### After (Edge Function)

```typescript
// ✅ NEW: Edge Function call
const { data: { session } } = await supabase.auth.getSession();
const response = await fetch(`${supabaseUrl}/functions/v1/generate-slug`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    title: trimmedTitle,
    content: trimmedContent,
    examType: selectedExamType,
    imageBase64: imageBase64,
    imageMimeType: imageMimeType,
  }),
});

const result = await response.json();
// Gemini API key secure on server!
```

---

## Files Modified

### Frontend
- ✅ `src/pages/CreatePostPage.tsx` - Updated to use Edge Functions

### Files to Remove (Optional)
- ⚠️ `src/lib/r2Upload.ts` - Can be removed (no longer used)
- ⚠️ `src/lib/geminiSlug.ts` - Can be removed (no longer used, except `generateSimpleSlug` fallback)

**Note:** Keep `generateSimpleSlug` function in `geminiSlug.ts` as a fallback, or move it to a separate utility file.

---

## Environment Variables

### Remove from Frontend `.env`:
```bash
# ❌ Remove these (no longer needed in frontend)
VITE_R2_ACCOUNT_ID=
VITE_R2_ACCESS_KEY_ID=
VITE_R2_SECRET_ACCESS_KEY=
VITE_R2_BUCKET_NAME=
VITE_GEMINI_API_KEY=
```

### Keep in Frontend `.env`:
```bash
# ✅ Keep these (still needed)
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_R2_PUBLIC_DOMAIN=cdn.collegedost.in  # For image URL construction
```

### Set in Supabase Dashboard (Edge Functions):
```bash
# Set via: supabase secrets set <KEY>=<VALUE>
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=post-upload
R2_PUBLIC_DOMAIN=cdn.collegedost.in
GEMINI_API_KEY=your-gemini-api-key
```

---

## Deployment Steps

1. **Set Environment Variables in Supabase:**
   ```bash
   cd dost-college-space-06860-87390-99909-04-48214
   supabase secrets set R2_ACCOUNT_ID="your-value"
   supabase secrets set R2_ACCESS_KEY_ID="your-value"
   supabase secrets set R2_SECRET_ACCESS_KEY="your-value"
   supabase secrets set R2_BUCKET_NAME="post-upload"
   supabase secrets set R2_PUBLIC_DOMAIN="cdn.collegedost.in"
   supabase secrets set GEMINI_API_KEY="your-value"
   ```

2. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy upload-post-image
   supabase functions deploy generate-slug
   supabase functions deploy create-post
   ```

3. **Update Frontend Environment:**
   - Remove R2 and Gemini credentials from `.env`
   - Keep only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_R2_PUBLIC_DOMAIN`

4. **Test:**
   - Create a post with an image
   - Verify image uploads to R2
   - Verify slug generation works
   - Check browser console for any errors

---

## Security Improvements

1. ✅ **R2 Credentials:** Moved from frontend bundle to server-side Edge Functions
2. ✅ **Gemini API Key:** Moved from frontend bundle to server-side Edge Functions
3. ✅ **Authentication:** All Edge Functions require valid Supabase auth token
4. ✅ **Validation:** Server-side validation for file types, sizes, and data
5. ✅ **Error Handling:** Proper error responses with appropriate HTTP status codes

---

## Testing Checklist

- [ ] Deploy all Edge Functions
- [ ] Set all required environment variables
- [ ] Test image upload via `upload-post-image`
- [ ] Test slug generation via `generate-slug`
- [ ] Test post creation with image
- [ ] Test post creation without image
- [ ] Verify R2 credentials are NOT in frontend bundle
- [ ] Verify Gemini API key is NOT in frontend bundle
- [ ] Test error handling (invalid auth, missing file, etc.)
- [ ] Test with different image formats
- [ ] Test with large images (should fail gracefully)

---

## Rollback Plan

If issues occur, you can temporarily revert to the old implementation:

1. Restore `src/lib/r2Upload.ts` and `src/lib/geminiSlug.ts`
2. Revert changes in `src/pages/CreatePostPage.tsx`
3. Re-add R2 and Gemini credentials to frontend `.env`

However, this is **NOT RECOMMENDED** for production due to security concerns.

---

## Notes

- The `create-post` Edge Function is optional. The current implementation keeps post creation in the frontend but uses Edge Functions for image upload and slug generation.
- Image compression still happens client-side (in `src/lib/imageCompression.ts`) which is fine and improves UX.
- The `backend/index.js` migration script remains as-is (one-time admin task).

