# AI Company Simulator: Isometric Game Plan

## Theme & Visuals
- **Art Style**: Pixel Art (starting with generic placeholder squares/sprites).
- **Control Scheme**: Keyboard and Mouse (Desktop only for now).
- **UI Architecture**: HTML/CSS overlaid on top of the Phaser canvas for menus, HUD, and leaderboards. This allows for rapid development of complex UIs.

## Core Mechanics & Loop
- **Infrastructure**: Start in a small room, expand it over time (similar to Township). Buy web servers (generate compute), model trainers, desks, etc.
- **Models & Users**: Users give Data based on time using the AI. Training a model increases its "Quality", which attracts more Users organically.
- **Economy**: Sell harvested Data for Money. Spend Money to buy more infrastructure and room expansions.
- **Authoritative Backend**: Node.js + Express backend. All critical actions (buying infrastructure, training, expanding rooms, generating money) are validated and updated on the server.
- **Multiplayer/Endgame**: Compete with other AI companies (players) in real-time or via Leaderboards (e.g., Highest Net Worth, Most Users).
- **Failures**: (Postponed for later iterations) Server failures, electricity overhead, etc.

---

## Phase 1: Project Setup & Foundation
1. **Frontend Init**: Scaffold a Vite project using Vanilla JS (`npm create vite@latest frontend -- --template vanilla`).
   - Install `phaser`, `vitest`.
2. **Backend Init**: Scaffold a Node.js + Express project (`npm init -y` in a `backend` folder).
   - Install `express`, `cors`, `nodemon`, `vitest` (for backend testing).
3. **Frontend Architecture**: Setup folders for `src/assets`, `src/scenes`, `src/objects`, `src/api`, `src/ui`, and `tests/`.
4. **Basic Phaser Setup**: Create the main Phaser Game config, rendering a simple empty scene.

## Phase 2: Authoritative State & Backend API
1. **Database/State**: For now, implement in-memory Game State on the Express Server (or a simple SQLite/JSON store), keeping track of each player's Money, Compute, Data, Users, Models, and Grid Layout.
2. **REST API**: Build routes:
   - `GET /api/state` - Fetch current game state.
   - `POST /api/build` - Request to place a building. Subtracts money if valid.
   - `POST /api/train` - Request to start training a model.
   - `POST /api/sell` - Request to sell data.
3. **Game Loop (Server-Side Tick)**: Implement a background tick system on the Node.js server (e.g., every 1 second) to calculate resource generation and user acquisition.

## Phase 3: Isometric Grid & Base Building (Frontend)
1. **Grid Setup**: Implement an isometric tilemap system in Phaser using placeholder graphics.
2. **Camera Controls**: Add panning and semantic zooming.
3. **Placement System**: "Build Mode" to place structural entities (Servers, Trainers) onto the grid.
4. **Server Validation**: When placing a building, send a request to `POST /api/build`. Only render the building permanently if the server responds with a success status.
5. **Room Expansion**: API endpoint to spend money to unlock more tiles in the room.

## Phase 4: Core Simulation & UI Interaction
1. **State Syncing**: Frontend periodically polls `GET /api/state` (or uses WebSockets) to update the HTML HUD (Money, Data, Users, Compute, Model Quality).
2. **Model Training System**: UI to allocate Compute to train the AI model via the API.
3. **Build Menu**: HTML menu to select buildings and expansions.
4. **Interaction**: Click handlers on placed infrastructure to view details/upgrade.

## Phase 5: Multiplayer & Leaderboards
1. **Authentication (Basic)**: Simple user accounts or session tokens to distinguish players.
2. **Leaderboard API**: `GET /api/leaderboard` returns the top ranked players.
3. **Leaderboard UI**: HTML overlay showing top players fetched from the server.

## Phase 6: Polish
1. **Sprites**: Replace placeholder blocks with actual pixel art sprites.
2. **Persistence**: Ensure the backend database properly saves and loads player state.
3. **Balance Pass**: Adjust costs, generation rates, and timers on the server.
