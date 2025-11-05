# Park Chain — Backend

A small, focused Express backend for the Park Chain project. This README explains how to set the project up locally, run it in development, run tests, and the recommended branching workflow for feature work.

## Quick overview

- Language: JavaScript (Node.js)
- Web framework: Express
- Database: PostgreSQL (optional — the app will run without a DB but some features will throw until configured)

## Prerequisites

- Node.js 18.x or later is recommended (Node 16+ will work in many cases).
- Git (for branching and source control)

## Get the code

Open a terminal and run:

```cmd
cd \path\to\your\projects
git clone <repo-url> park-chain-backend
cd "park-chain-backend"
```

Replace `<repo-url>` with the repository clone URL.

## Install dependencies

In the project folder:

```cmd
npm install
```

## Environment

Copy the example env file and edit values locally:

```cmd
copy .env.example .env
```

Edit `.env` and set at least the following values if you want DB- or auth-related features to work:

- NODE_ENV=development
- PORT=3000
- DATABASE_URL=postgres://user:password@host:5432/dbname
- JWT_SECRET=your_jwt_secret

Notes:
- If `DATABASE_URL` is not set the app will skip creating a real DB pool and will run but database operations will throw helpful errors. This is useful for front-end or API-only work when you don't need DB access.

## Run the app

Start in development with auto-reload (recommended):

```cmd
npm run dev
```

Start normally:

```cmd
npm start
```

The server listens on `PORT` (default 3000). Visit `http://localhost:3000/` or the endpoints under `/api/*` described by the routes.

## Tests

Run the test suite:

```cmd
npm test
```

If you plan to convert the codebase between CommonJS and ESM, note that test tooling (Jest) may need adjustment. See the `CONTRIBUTING` notes below.

## Branching & working on features (recommended workflow)

1. Create a branch for each feature or fix. Use descriptive names:

```cmd
git checkout -b feature/add-login
```

2. Work locally, run the server and tests frequently:

```cmd
npm run dev   # runs with nodemon
npm test      # run tests while changing code
```

3. Write tests for new behavior or bug fixes. Keep changes small and focused.

4. Commit with useful messages:

```cmd
git add .
git commit -m "feat(auth): add JWT refresh endpoint"
```

5. Push and open a Pull Request to your main branch. Use PR descriptions to explain the change, list manual test steps, and mention any migration/config changes.

## Converting to ESM / module system notes

The project may contain either CommonJS (`require/module.exports`) or ESM (`import/export`) files. Converting the whole project to ESM is possible and common, but requires:

- Setting `"type": "module"` in `package.json` or using `.mjs` extensions.
- Updating imports to include file extensions (e.g. `./app.js`) and migrating `module.exports` to `export` syntax.
- Replacing `__dirname` / `__filename` uses with `import.meta.url` utilities.
- Adjusting test tooling (Jest requires config or babel; Vitest is ESM-first).

If you plan to migrate, do it on a feature branch and update README and CI accordingly.

## Troubleshooting

- Error in `pg-connection-string` about `searchParams`: this usually means `DATABASE_URL` is missing or malformed. Make sure `.env` includes a valid `DATABASE_URL` or run without DB.
- If tests hang: ensure the server isn't auto-starting when tests import modules. Tests should import the Express `app` without launching an http server (the project uses that pattern in tests).

## Helpful commands summary

```cmd
npm install        # install deps
npm run dev        # dev server with nodemon
npm start          # production start
npm test           # run tests
copy .env.example .env    # create local .env
```

## Contributing and PR checklist

- Create a feature branch
- Add/adjust tests for new behavior
- Run `npm test` locally and ensure all tests pass
- Describe the change in the PR and any environment vars required

---

If you'd like, I can update this README further with API endpoint documentation, examples of request/response payloads, or a Postman collection. Which would you prefer next?
