# Visium MVP

An AI strategy assistant that transforms raw notes and discussions into structured objectives to form an evolving knowledge base.

## Vision

Visium is an AI-powered strategy assistant that transforms scattered discussions and fragmented notes into a structured knowledge base. By connecting everyday conversations to organizational goals, it helps teams and individuals see further into the future, align on priorities, and steer decisions with clarity.

## MVP Features

- Submit raw text → extract clear objectives via LLM → store them → return them with basic relatedness
- Two-tab interface: **Add Knowledge** (working) and **Knowledge** (placeholder)
- Local Ollama integration for LLM processing
- Keyword-based relatedness computation (embeddings optional)
- No authentication, minimal and robust

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Node 20 + Express + TypeScript + Prisma
- **Database:** PostgreSQL
- **LLM:** Ollama (local)

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL running locally
- [Ollama](https://ollama.ai/) installed and running locally

### Setup

1. **Install dependencies:**
   ```bash
   # Backend
   cd backend && npm install
   
   # Frontend
   cd ../frontend && npm install
   ```

2. **Setup environment:**
   ```bash
   # Copy and configure backend/.env
   cd backend
   cp .env.example .env
   # Update DATABASE_URL with your PostgreSQL connection string
   ```

3. **Setup database:**
   ```bash
   cd backend
   npm run db:push
   ```

4. **Start Ollama:**
   ```bash
   # Pull a model (if not already done)
   ollama pull llama3
   
   # Ollama should be running on http://localhost:11434
   ```

5. **Start development servers:**
   ```bash
   # Backend (in backend/ directory)
   npm run dev
   
   # Frontend (in frontend/ directory - new terminal)
   npm run dev
   ```

6. **Open the app:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
