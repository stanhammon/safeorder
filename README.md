# SafeOrder (dining_tracker)

A mobile-first web app for a household to track what each person orders at restaurants and the modifications that avoid their food allergies. The full product spec is in [SPEC.md](SPEC.md).

**Status:** Milestone 1 (Foundation): sign-in, households and invites, profiles, and allergy setup.

## Stack

React 19 + Vite + TypeScript, Tailwind CSS v4, React Router, TanStack Query, and Supabase (Postgres with row-level security, magic-link auth).

## First-time setup

1. **Create a Supabase project** at <https://supabase.com> (the free tier is fine). Save the database password.
2. **Configure auth** in the Supabase dashboard:
   - Under **Authentication → URL Configuration**, set **Site URL** to `http://localhost:5173` and add `http://localhost:5173/**` to **Redirect URLs**.
   - Under **Authentication → Emails → Magic Link**, add the code to the template so people can sign in by typing it (needed for the installed phone app):
     ```html
     <h2>Sign in to SafeOrder</h2>
     <p><a href="{{ .ConfirmationURL }}">Sign in</a></p>
     <p>Or enter this code: <strong>{{ .Token }}</strong></p>
     ```
     Apply the same change to the **Confirm signup** template, which new users receive.
3. **Add your keys:** copy `.env.example` to `.env.local` and fill in the Project URL and the anon/publishable key from **Project Settings → API Keys**.
4. **Create the database tables.** Either:
   - with the CLI (recommended, since later milestones add more migrations):
     ```
     npx supabase login
     npx supabase link --project-ref <your-project-ref>
     npx supabase db push
     ```
   - or paste the contents of `supabase/migrations/20261013000000_initial_schema.sql` into the dashboard's **SQL Editor** and run it.
5. **Install and run:**
   ```
   npm install
   npm run dev
   ```
   Open <http://localhost:5173>. To test on a phone on the same Wi-Fi, run `npm run dev -- --host` and open the Network address it prints.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with oxlint |

## Notes

- Supabase's built-in email sender is rate-limited to a few emails per hour. If sign-in emails stop arriving while testing, wait, or set up custom SMTP under **Authentication → Emails → SMTP Settings**.
- Invites don't send email: the app shares an invite message for you to send. The invited person signs in with the invited email and is offered to join.
