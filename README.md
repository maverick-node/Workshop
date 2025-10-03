# Talent Forge - Separated Frontend & Backend

This project is now organized with separate frontend and backend folders.

## Project Structure

```
talent-forge-book-main/
├── frontend/          # React + Vite frontend
│   ├── src/           # Source code
│   ├── public/        # Static assets
│   ├── package.json   # Frontend dependencies
│   ├── vite.config.ts # Vite configuration
│   └── .env           # Frontend environment variables
├── backend/           # Express.js backend
│   ├── server/        # Server code
│   ├── package.json   # Backend dependencies
│   └── .env           # Backend environment variables
└── README.md          # This file
```

## Running the Application

### Backend (Port 3001)
```bash
cd backend
npm install
npm start
```

### Frontend (Port 8089)
```bash
cd frontend
npm install
npm run dev
```

## Configuration

- **Frontend**: Points to remote backend at `http://57.130.11.69:3001`
- **Backend**: Runs on localhost:3001 (or deploy to remote server)

## Using with ngrok

1. Start frontend: `cd frontend && npm run dev`
2. Start ngrok: `ngrok http 8089`
3. Access app via ngrok URL

The frontend will make API requests to the remote backend server.
