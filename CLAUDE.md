# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack web application with:
- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS, and App Router
- **Backend**: Node.js with Express, TypeScript, and REST API
- **Shared**: Common types and utilities between frontend and backend

## Development Commands

### Start Development Servers
```bash
# Start both frontend and backend concurrently
npm run dev

# Start individual services
npm run dev:frontend  # Next.js dev server on :3000
npm run dev:backend   # Express API server on :3001
```

### Build & Production
```bash
# Build both frontend and backend
npm run build

# Build individual services
npm run build:frontend
npm run build:backend

# Start production servers
npm run start
```

### Individual Service Commands
```bash
# Frontend (Next.js)
cd frontend
npm run dev        # Development with Turbopack
npm run build      # Production build
npm run start      # Start production server
npm run lint       # ESLint

# Backend (Express)
cd backend
npm run dev        # Development with nodemon
npm run build      # TypeScript compilation
npm run start      # Start compiled server
```

## Project Structure

```
coding-project/
├── frontend/          # Next.js application
│   ├── src/
│   │   ├── app/       # App Router pages and layouts
│   │   └── components/
├── backend/           # Express.js API
│   ├── src/
│   │   └── index.ts   # Main server file
│   └── dist/          # Compiled TypeScript output
└── shared/            # Shared types and utilities
    └── types.ts       # Common TypeScript types
```

## API Endpoints

- `GET /api/health` - Health check endpoint
- `GET /api/hello` - Test endpoint returning greeting

## Environment Variables

### Backend (.env)
- `PORT` - Server port (default: 3001)
- `FRONTEND_URL` - Frontend URL for CORS (default: http://localhost:3000)
- `NODE_ENV` - Environment (development/production)

## Key Technologies

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, ESLint
- **Backend**: Express.js, TypeScript, CORS, Helmet, Morgan
- **Dev Tools**: Nodemon, Concurrently, ts-node