# Local Fraud Review App

## Overview
A minimal local web app to review orders, display fraud risk scores, and collect user feedback. Reads from the local SQLite database at the repository root (`shop.db`) and stores review decisions back into a `fraud_feedback` table.

## Features
- Displays all orders with a risk score and review band
- Allows the reviewer to mark orders as fraud or not fraud
- Stores feedback in a `fraud_feedback` table in `shop.db`
- Includes search, order detail view, and responsive layout

## Prerequisites
- Node.js (v18+ recommended)
- `shop.db` in the repository root

## Setup
1. Open a terminal in the `app` folder.
2. Install dependencies:
   ```sh
   npm install
   ```
3. Start the development server:
   ```sh
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure
- `pages/` — Next.js pages and API routes
- `lib/` — SQLite helpers and dashboard queries
- `styles/` — Global styling

## Notes
- No authentication or cloud dependencies
- All data is local
- If you need to point the app at a different database file, set `SHOP_DB_PATH`
