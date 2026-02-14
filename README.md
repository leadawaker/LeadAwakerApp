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

### Running the App

To start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5000`.

## 📦 Deployment

### On Replit

1. Click the **Deploy** button in the Replit interface.
2. Follow the setup instructions for provisioning a database and setting environment variables.
3. The platform handles building and hosting automatically.

### Manual Build

To create a production build:

```bash
npm run build
```

Then start the production server:

```bash
npm start
```

## 📄 License

MIT
