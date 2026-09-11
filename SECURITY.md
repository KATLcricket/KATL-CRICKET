# Security notes

## Admin push notifications

The `send-push` Edge Function must be called with a Supabase Auth access token in the `Authorization: Bearer <token>` header. It no longer accepts a shared admin secret from the browser.

The function authorizes the request by verifying the token and checking the authenticated user's role. The expected role is `admin` or `super_admin` in the user's `app_metadata.role` claim.

Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only. It must never be placed in frontend code, committed to the repository, or exposed to users.

## Required Edge Function secrets

Set these in the Supabase Edge Function environment:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

`ADMIN_SEND_SECRET` is no longer used.
