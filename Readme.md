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

# Issues

- Relations are not detected
- Tags are not detected
- Rejected Statements still show up in the explore canvas/database (maybe)
- Nodes can't be deleted
- I assume nodes should be vertical, as the structure of OKRs is hierarchical and not procedural

## Feature Ideas
- There is no way to investigate the statments in a "list" where i may filter for tags, or relations, or states like open statments, or archived ones
- An onboarding might be useful (define entities, objectives, for me for instance career, health, relationships, etc.) to give a rough framing because not every organization is the same and we have an empty room problem.
- Full statements in the canvas overview are not human readable nor insightful. I don't yet have a solution for this. An idea is to capture categories, like tags (e.g. a certain product, business activity, employee, or other entities), Statement Titles (OKRs; however, currently we might store very granular knowledge so from Objectives -> Key Results -> ?; What is the question mark, a task?)
- Investigate knowledge e.g "What are the currenty objectives of our departments?" -> exec summary