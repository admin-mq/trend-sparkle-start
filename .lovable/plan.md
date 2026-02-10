

## Fix: Google OAuth Login Redirects Back to Login Page

### Root Cause Analysis

After thorough investigation of the auth logs, code flow, and the Lovable Cloud auth module, I've identified **two critical bugs** working together:

**Bug 1: `INITIAL_SESSION` is always skipped (line 67 of AuthContext.tsx)**

The Lovable Cloud auth module (`createLovableAuth({})`) processes OAuth callback tokens during its initialization (at import/module load time). By the time `AuthProvider` mounts, `supabase.auth.setSession()` has already been called. So when the `onAuthStateChange` listener fires `INITIAL_SESSION`, it contains the **valid OAuth session** -- but the code skips it unconditionally with `if (event === 'INITIAL_SESSION') return;`.

**Bug 2: `SIGNED_OUT` from stale token kills the grace period**

Auth logs show "Invalid Refresh Token: Refresh Token Not Found" errors. If the user had a previous session with stale tokens in localStorage, when the app loads after OAuth redirect, Supabase internally tries to refresh the old token, fails, and fires a `SIGNED_OUT` event. The current handler:
- Sets `sessionResolved.current = true` (prevents grace period from working)
- Clears the grace timeout (cancels the safety net)
- Sets `loading = false` with `user = null`
- `ProtectedRoute` immediately redirects to `/auth`

Even if `SIGNED_IN` fires later with the real session, the user is already on `/auth`. The Auth page has a redirect effect, but React rendering timing can cause it to miss the update.

### Failure Sequence

```text
1. User clicks "Continue with Google" -> redirected to Google
2. Google redirects back to origin
3. Lovable auth module processes callback -> calls setSession()
4. AuthProvider mounts:
   a. Listener fires INITIAL_SESSION (with valid session) -> SKIPPED  [BUG 1]
   b. Old stale token triggers refresh failure -> SIGNED_OUT fires
   c. SIGNED_OUT handler: sessionResolved=true, loading=false, user=null  [BUG 2]
   d. ProtectedRoute redirects to /auth
   e. getSession() returns null (stale token was invalidated)
   f. SIGNED_IN might fire later but user is already on /auth
```

### Solution: 3 Targeted Fixes in AuthContext.tsx

**Fix 1: Handle INITIAL_SESSION when it has a valid session**

Instead of unconditionally skipping `INITIAL_SESSION`, check if it carries a session. If it does (meaning the lovable module already processed OAuth tokens), use it.

**Fix 2: Don't let SIGNED_OUT during initial load cancel the grace period**

Track whether the initial load has completed. During the initial load phase, a `SIGNED_OUT` event from a stale token refresh should NOT set `sessionResolved = true` or cancel the grace timeout. Only after initialization is complete should `SIGNED_OUT` be treated as a real sign-out.

**Fix 3: Ensure Auth.tsx redirect is robust**

The Auth page's redirect effect (`if (!authLoading && user) navigate('/dashboard')`) should already work, but add a safety mechanism: if user is set while on the auth page, always redirect regardless of loading state transitions.

### Files to Change

**`src/contexts/AuthContext.tsx`** (primary fix):
- Handle `INITIAL_SESSION` with a valid session by calling `handleSession()` on it
- Add an `initialLoadDone` ref to distinguish initial loading from ongoing state changes
- In the `SIGNED_OUT` handler, only cancel grace period and resolve session if `initialLoadDone` is true
- Set `initialLoadDone = true` after `initSession()` completes

### Technical Implementation

The `onAuthStateChange` handler changes:

```text
INITIAL_SESSION event:
  - If session exists: call handleSession() (OAuth tokens already processed)
  - If session is null: skip (let getSession + grace period handle it)

SIGNED_OUT event:
  - If initialLoadDone: full cleanup (current behavior)
  - If NOT initialLoadDone: ignore (stale token failure, don't cancel grace)

SIGNED_IN / TOKEN_REFRESHED event:
  - Same as current: cancel grace timeout, call handleSession()
```

No changes needed to `App.tsx`, `Auth.tsx`, `ProtectedRoute.tsx`, or `CompleteProfileDialog.tsx`.

