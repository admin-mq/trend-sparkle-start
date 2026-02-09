

## Fix: Blank Screen After Google Login

### Problem
After Google OAuth login, the dashboard appears briefly then goes completely blank. Two issues are causing this:

1. The `ProfileCompletionWrapper` component is placed **outside** the router, but it renders a dialog that requires router context (`useNavigate`). When it activates for new OAuth users, it crashes and blanks the screen.

2. There is a race condition in the authentication state management where the profile completion check triggers prematurely during the OAuth callback, causing the crash to happen even for returning users.

### Solution

#### 1. Move ProfileCompletionWrapper inside BrowserRouter (App.tsx)
Move the `ProfileCompletionWrapper` from its current position (outside `BrowserRouter`) to inside it, so the `CompleteProfileDialog` has access to the router context when it calls `useNavigate()`.

#### 2. Fix race condition in AuthContext (AuthContext.tsx)
- Remove the `setTimeout` wrapper around the profile fetch in `onAuthStateChange` -- it creates a timing gap where `needsProfileCompletion` can flash as `true` before the profile is actually checked.
- Ensure `needsProfileCompletion` only becomes `true` after the profile fetch completes and confirms no profile exists.
- Separate initial auth load from ongoing changes (per the proven pattern): only set `loading = false` after all async work is done during initialization.

#### 3. Guard CompleteProfileDialog against missing router (CompleteProfileDialog.tsx)
- Add a safety check so that if `useNavigate` is unavailable, the component doesn't crash the entire app tree.

### Technical Details

**App.tsx changes:**
- Move `<ProfileCompletionWrapper />` from line 33 to inside the `<BrowserRouter>` block (after `<Routes>` or as a sibling within it).

**AuthContext.tsx changes:**
- Remove `setTimeout` on line 76 in the `onAuthStateChange` handler.
- Restructure so that the `onAuthStateChange` listener does not set `needsProfileCompletion = true` during the initial session bootstrap -- only after the initial load completes.
- Ensure `loading` stays `true` until both session and profile data are resolved on first load.

**CompleteProfileDialog.tsx changes:**
- Wrap the `useNavigate` call in a try/catch or conditionally use it, so a missing router context does not crash the app.

