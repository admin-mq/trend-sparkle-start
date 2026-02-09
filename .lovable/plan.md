

## Fix: Google OAuth Redirecting Back to Login Page

### Root Cause

The `onAuthStateChange` listener fires an `INITIAL_SESSION` event immediately when set up. During an OAuth redirect flow, the Lovable auth module hasn't finished processing the tokens from the URL yet, so `INITIAL_SESSION` arrives with a **null session**. This causes:

1. `loading` becomes `false` with `user = null`
2. The `ProtectedRoute` on `/dashboard` sees no user and redirects to `/auth`
3. Later, `SIGNED_IN` fires with the real session, but by then the user is already on the auth page
4. Auth page's redirect effect *should* catch this, but due to React rendering timing, it may not trigger reliably

### Solution: Two-Phase Auth Initialization

Restructure `AuthContext.tsx` to separate initial session loading from ongoing auth state changes, following the proven Supabase pattern:

**Phase 1 - Initial Load (controls `loading` state):**
- Set up `onAuthStateChange` listener first (required by Supabase)
- Then call `supabase.auth.getSession()` explicitly
- Only set `loading = false` after `getSession()` + profile fetch complete
- This ensures we wait for the session to be established before rendering

**Phase 2 - Ongoing Changes (listener handles OAuth callbacks):**
- The `onAuthStateChange` listener handles `SIGNED_IN`, `TOKEN_REFRESHED`, `SIGNED_OUT` events
- On `SIGNED_IN` (from OAuth), update user/session, fetch profile, and set `loading = false` (as a fallback in case `getSession()` returned null during OAuth processing)
- Skip `INITIAL_SESSION` in the listener since `getSession()` handles it

### Files to Change

**`src/contexts/AuthContext.tsx`** (main fix):
- Remove the single-listener approach that handles everything in `onAuthStateChange`
- Add explicit `getSession()` call for initial session detection
- Listener ignores `INITIAL_SESSION` events (handled by `getSession()`)
- Listener handles `SIGNED_IN` by updating state AND setting `loading = false`
- Session expiry check moves to the `getSession()` phase
- Preserve all existing sign-in, sign-up, sign-out methods unchanged

### Technical Details

```text
Current Flow (broken):
  Page Load → onAuthStateChange(INITIAL_SESSION, null) → loading=false, user=null
  → ProtectedRoute redirects to /auth → SIGNED_IN fires too late

Fixed Flow:
  Page Load → onAuthStateChange listener registered (but INITIAL_SESSION ignored)
  → getSession() called → waits for session → fetches profile → loading=false
  → If OAuth: SIGNED_IN also fires → updates state, sets loading=false as fallback
  → ProtectedRoute sees user → renders Dashboard
```

No changes needed to `App.tsx`, `Auth.tsx`, `CompleteProfileDialog.tsx`, or `ProtectedRoute.tsx` -- the fix is entirely within `AuthContext.tsx`.
