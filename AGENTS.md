# Repository Guidelines

## Project Structure & Module Organization
Visium is split into `backend` (Express + Prisma) and `frontend` (React + Vite). `backend/src/server.ts` wires routes from `src/routes`, persistence helpers in `src/database.ts`, and LLM adapters in `src/llm` and `src/related`. Data models live in `backend/prisma/schema.prisma`. The client renders from `frontend/src`; feature views sit in `src/pages`, styling in `App.css`, and static files in `frontend/public`. Artifacts under `frontend/dist` and `backend/dist` are build outputs only.

## Build, Test, and Development Commands
- `cd backend && npm install` (repeat for `frontend`) installs dependencies.
- `npm run dev` inside each package starts the Express API (`tsx watch`) or the Vite dev server.
- `npm run build` then `npm run start` in `backend` compiles to `dist/`; `npm run preview` smoke-tests the frontend bundle.
- Prisma: `npm run db:generate`, `npm run db:push`, `npm run db:migrate` run from `backend` against the database declared in `.env`.
- `cd frontend && npm run lint` applies the shared ESLint rules before committing UI work.

## Coding Style & Naming Conventions
Write TypeScript with ES modules, 2-space indentation, and semicolons, mirroring existing files. Use `PascalCase` for React components and Prisma models, `camelCase` for functions and variables, and `SCREAMING_SNAKE_CASE` for env keys. Keep route-specific logic under `backend/src/routes/<feature>` and colocate lightweight helpers nearby. Ensure `npm run lint` (frontend) and `npm run build` (backend) succeed pre-PR.

## Testing Guidelines
Automated suites are not yet present—add them alongside new features. Prefer `vitest` for UI units (`*.test.tsx` adjacent to components) and `supertest` or integration scripts under `backend/src/__tests__`. Document any new `npm test` script in the relevant `README`. Meanwhile, validate the API with `curl http://localhost:3001/api/health` and exercise flows via `npm run preview` to capture regressions.

## Commit & Pull Request Guidelines
Existing commits (`Implement first objective extraction`, `Describe project vision, mission and mvp`) use short, imperative subjects—continue that style and reference tickets with `Fixes #123` when applicable. PRs should outline the problem, solution, schema or config changes, and test evidence. Add screenshots or terminal logs for UI/API updates and request review before merging.

## Environment & Configuration
Backend configuration comes from `backend/.env`. Define `DATABASE_URL`, `OLLAMA_URL`, `OLLAMA_MODEL`, `EMBEDDINGS_ENABLED`, and `PORT`; defaults are enforced in `src/config.ts`. Keep secrets out of version control and rotate shared values via secure channels. Use disposable databases when running `npm run db:migrate`, and align Ollama endpoints with the values you advertise in PR notes.
