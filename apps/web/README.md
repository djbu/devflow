# Devflow web

Angular frontend in the root npm workspace. Follow the root README for setup,
Node.js selection, MongoDB, environment settings, and root commands.

Run `npm run dev -w @devflow/web` from the repository root to start the web
server alone. The development proxy forwards /api/** to http://127.0.0.1:3000.
The backend must be started separately when using this command.
