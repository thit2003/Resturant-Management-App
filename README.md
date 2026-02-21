
  # Restaurant Management App

  This is a code bundle for Restaurant Management App. The original project is available at https://www.figma.com/design/ee5qyBs9MTQ6OMZnE3LFcG/Restaurant-Management-App.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Backend + MongoDB (local)

  1. Start MongoDB with Docker:
     - `cd backend`
     - `docker compose up -d`
  2. Create a single environment file at project root:
     - Create `.env` in the workspace root
     - Add:
       - `MONGODB_URI=<your mongo connection string>`
       - `MONGODB_DB=<your database name>`
      - `VITE_API_BASE_URL=http://localhost:3001`
  3. Start the backend:
     - `cd backend`
     - `npm i`
     - `npm run dev`
     - Backend runs on `http://localhost:3001`

  The API expects:
  - `MONGODB_URI` (Mongo connection string)
  - `MONGODB_DB` (database name)
  
