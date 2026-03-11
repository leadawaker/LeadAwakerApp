# Real Estate & Lead Management Platform

A modern, high-performance web application built with React, Express, and Drizzle ORM. This platform features a polished design with 3D elements, interactive dashboards, and a multilingual interface.

## 🚀 Features

- **Interactive Dashboard**: Real-time sales metrics and pipeline visualization.
- **Lead Management**: Advanced lead tracking and reactivation tools.
- **Multilingual Support**: Built-in support for multiple languages (i18n).
- **Modern UI/UX**: Polished components using Tailwind CSS, Framer Motion, and Radix UI.
- **3D Visualizations**: Integrated 3D charts and animated components.

## 🛠️ Tech Stack

- **Frontend**: React (Vite), Tailwind CSS, Framer Motion, Lucide Icons.
- **Backend**: Node.js, Express.
- **Database**: PostgreSQL with Drizzle ORM.
- **State Management**: React Query (TanStack).
- **Routing**: Wouter.

## 💻 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or higher)
- [PostgreSQL](https://www.postgresql.org/) (if running locally)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` and fill in your `DATABASE_URL`.*

4. Push the database schema:
   ```bash
   npm run db:push
   ```

### Running the App Locally

To start the application in development mode:

```bash
npm run dev
```

This script:
- Sets `NODE_ENV` to `development`.
- Starts the backend server using `tsx` (running `server/index.ts`).
- Automatically starts the Vite development server to serve the frontend with hot-module replacement (HMR).
- The app will be available at `http://localhost:5000`.

Other useful scripts:
- `npm run dev:client`: Runs ONLY the Vite frontend development server on port 5000.
- `npm run check`: Runs TypeScript compiler to check for type errors.
- `npm run db:push`: Syncs your database schema with your Drizzle configuration.

## 📦 Deployment

### On Replit

1. Click the **Deploy** button in the Replit interface.
2. The platform handles building and hosting automatically using the configured scripts.

### Manual Build & Production

To prepare the app for production:

1. **Build**:
   ```bash
   npm run build
   ```
   This uses a custom script (`script/build.ts`) that bundles the frontend with Vite and the backend with esbuild into the `dist` directory.

2. **Start**:
   ```bash
   npm start
   ```
   This runs the production-bundled code from the `dist` folder using standard Node.js.

## 📄 License

MIT
