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
- [x] **Frontend Init**: Scaffold a Vite project using Vanilla JS (`npm create vite@latest frontend -- --template vanilla`).
   - [x] Install `phaser`, `vitest`.
- [x] **Backend Init**: Scaffold a Node.js + Express project (`npm init -y` in a `backend` folder).
   - [x] Install `express`, `cors`, `nodemon`, `vitest` (for backend testing).
- [x] **Frontend Architecture**: Setup folders for `src/assets`, `src/scenes`, `src/objects`, `src/api`, `src/ui`, and `tests/`.
- [x] **Basic Phaser Setup**: Create the main Phaser Game config, rendering a simple empty scene.

## Phase 2: Authoritative State & Backend API
- [x] **Database/State**: For now, implement in-memory Game State on the Express Server (or a simple SQLite/JSON store), keeping track of each player's Money, Compute, Data, Users, Models, and Grid Layout.
- [x] **REST API**: Build routes:
   - [x] `GET /api/state` - Fetch current game state.
   - [x] `POST /api/build` - Request to place a building. Subtracts money if valid.
   - [x] `POST /api/train` - Request to start training a model.
   - [x] `POST /api/sell` - Request to sell data.
- [x] **Game Loop (Server-Side Tick)**: Implement a background tick system on the Node.js server (e.g., every 1 second) to calculate resource generation and user acquisition.

## Phase 3: Isometric Grid & Base Building (Frontend)
- [x] **Grid Setup**: Implement an isometric tilemap system in Phaser using placeholder graphics.
- [x] **Camera Controls**: Add panning and semantic zooming.
- [x] **Placement System**: "Build Mode" to place structural entities (Servers, Trainers) onto the grid.
- [x] **Server Validation**: When placing a building, send a request to `POST /api/build`. Only render the building permanently if the server responds with a success status.
- [x] **Room Expansion**: API endpoint to spend money to unlock more tiles in the room.

## Phase 4: Core Simulation & UI Interaction
- [x] **State Syncing**: Frontend periodically polls `GET /api/state` (or uses WebSockets) to update the HTML HUD (Money, Data, Users, Compute, Model Quality).
- [x] **Model Training System**: UI to allocate Compute to train the AI model via the API.
- [x] **Build Menu**: HTML menu to select buildings and expansions.
- [x] **Interaction**: Click handlers on placed infrastructure to view details/upgrade.

## Phase 5: Multiplayer & Leaderboards
- [x] **Authentication (Basic)**: Simple user accounts or session tokens to distinguish players.
- [x] **Leaderboard API**: `GET /api/leaderboard` returns the top ranked players.
- [x] **Leaderboard UI**: HTML overlay showing top players fetched from the server.

## Phase 5.5: Player Base Visits & World Map
- [x] **Backend API**: Endpoints to fetch a player's base state, list players (paginated), search players, and pick a random player.
- [x] **Visit Mode**: `MainScene` read-only mode to view a visited player's layout and real-time stats (Money, Compute, Users, Quality) while hiding build buttons.
- [x] **World Map Scene**: Isometric overworld showing miniature previews of other players' bases. Allows zooming, panning, and finding players to visit. Includes search panel and random "scout" button.
- [x] **Testing**: Extensive tests added to Vite + Vitest covering both backend authentication & map visiting endpoints, and frontend mock responses.

## Phase 6: Polish
- [ ] **Sprites**: Replace placeholder blocks with actual pixel art sprites.
- [ ] **Persistence**: Ensure the backend database properly saves and loads player state.
- [ ] **Balance Pass**: Adjust costs, generation rates, and timers on the server.

