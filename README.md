# November Command Centre

A private, mobile-friendly personal operating dashboard for the November goals plan.

## Stack
- Next.js App Router + React + TypeScript
- Supabase Auth, Postgres with Row Level Security, and private Storage for trade screenshots
- Vercel deployment, connected to this GitHub repository

## Features
- Overview dashboard, monthly targets and progress
- Goals, tasks and separate project workspaces for Prime Study, PrimeFlow and ClientFlow
- Income log for every amount collected (including very small amounts), pending income and refunds
- Expenses and net-profit tracking (collected income minus refunds and expenses)
- Analytics across income sources, expenses and net profit
- Trading journal with trade notes, risk/reward fields and private screenshot attachments
- Settings for profile, target, currency, exchange rates, timezone, theme and accent

## Setup
1. Create a Supabase project.
2. Run `supabase/migrations/20261101000000_initial_schema.sql` in the Supabase SQL Editor.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to Vercel.
4. Deploy from the connected `main` branch.
5. Sign up with your email to create a private account.

See `.env.example` for local environment variables. Do not put a Supabase service-role key in this app.
