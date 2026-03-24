import * as Phaser from 'phaser';
import { fetchPlayers, searchPlayers, fetchRandomPlayer } from '../api/index.js';

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

// World map layout constants
const NODE_SPACING_X = 400; // Horizontal spacing between player nodes
const NODE_SPACING_Y = 300; // Vertical spacing between player nodes
const COLS = 5; // Number of columns in the grid
const MINI_SCALE = 0.25; // Scale of miniature base preview

export class WorldMapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WorldMapScene' });
    this.players = [];
    this.loadedPages = new Set();
    this.currentPage = 1;
    this.totalPages = 1;
    this.isLoading = false;
    this.playerNodes = []; // { container, username, x, y }
  }

  preload() {
    this.generateWorldMapGraphics();
  }

  generateWorldMapGraphics() {
    const graphics = this.add.graphics();
    this.textureOrigins = {};

    // Ground tile for world map (larger, muted green)
    graphics.fillStyle(0x2a5a3a, 1);
    graphics.lineStyle(1, 0x3a7a5a, 0.5);
    this.drawIsoDiamond(graphics, TILE_WIDTH, TILE_HEIGHT);
    graphics.generateTexture('world-tile', TILE_WIDTH, TILE_HEIGHT);
    graphics.clear();

    // Player platform tile (darker, slightly different color)
    graphics.fillStyle(0x444444, 1);
    graphics.lineStyle(1, 0x666666, 0.8);
    this.drawIsoDiamond(graphics, TILE_WIDTH, TILE_HEIGHT);
    graphics.generateTexture('platform-tile', TILE_WIDTH, TILE_HEIGHT);
    graphics.clear();

    // Mini building textures for preview (tiny versions)
    this.generateMiniBlock('mini-server', graphics, 1, 1, 40, 0x3498db);
    this.generateMiniBlock('mini-server2', graphics, 2, 1, 40, 0x9b59b6);
    this.generateMiniBlock('mini-server2r', graphics, 1, 2, 40, 0x9b59b6);
    this.generateMiniBlock('mini-desk', graphics, 1, 1, 15, 0x2ecc71);
    this.generateMiniBlock('mini-seller1', graphics, 1, 1, 30, 0xe67e22);
    this.generateMiniBlock('mini-seller2', graphics, 1, 1, 35, 0xd35400);
    this.generateMiniBlock('mini-seller3', graphics, 2, 1, 40, 0xc0392b);
    this.generateMiniBlock('mini-seller3r', graphics, 1, 2, 40, 0xc0392b);
    this.generateMiniBlock('mini-trainer1', graphics, 1, 1, 30, 0x1abc9c);
    this.generateMiniBlock('mini-trainer2', graphics, 1, 1, 35, 0x16a085);
    this.generateMiniBlock('mini-trainer3', graphics, 2, 1, 40, 0x0e6655);
    this.generateMiniBlock('mini-trainer3r', graphics, 1, 2, 40, 0x0e6655);
  }

  // Same iso block generation as MainScene but for mini textures
  generateMiniBlock(key, graphics, w, h, z, baseColor) {
    graphics.clear();
    const colorObj = Phaser.Display.Color.IntegerToColor(baseColor);
    const topColor = colorObj.clone().lighten(15).color;
    const leftColor = colorObj.color;
    const rightColor = colorObj.clone().darken(15).color;

    const minX = -h * 32;
    const minY = -z;
    const shiftX = -minX;
    const shiftY = -minY;

    const pT = { x: shiftX, y: shiftY };
    const pR = { x: w * 32 + shiftX, y: w * 16 + shiftY };
    const pB = { x: (w - h) * 32 + shiftX, y: (w + h) * 16 + shiftY };
    const pL = { x: -h * 32 + shiftX, y: h * 16 + shiftY };

    if (z > 0) {
      graphics.fillStyle(rightColor, 1);
      graphics.lineStyle(1, 0x000000, 0.2);
      graphics.beginPath();
      graphics.moveTo(pR.x, pR.y);
      graphics.lineTo(pB.x, pB.y);
      graphics.lineTo(pB.x, pB.y - z);
      graphics.lineTo(pR.x, pR.y - z);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
    }

    if (z > 0) {
      graphics.fillStyle(leftColor, 1);
      graphics.lineStyle(1, 0x000000, 0.2);
      graphics.beginPath();
      graphics.moveTo(pL.x, pL.y);
      graphics.lineTo(pB.x, pB.y);
      graphics.lineTo(pB.x, pB.y - z);
      graphics.lineTo(pL.x, pL.y - z);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
    }

    graphics.fillStyle(topColor, 1);
    graphics.lineStyle(1, 0x000000, 0.2);
    graphics.beginPath();
    graphics.moveTo(pT.x, pT.y - z);
    graphics.lineTo(pR.x, pR.y - z);
    graphics.lineTo(pB.x, pB.y - z);
    graphics.lineTo(pL.x, pL.y - z);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();

    const texWidth = (w + h) * 32;
    const texHeight = (w + h) * 16 + z;
    graphics.generateTexture(key, texWidth, texHeight);
    graphics.clear();

    this.textureOrigins[key] = {
      originX: shiftX / texWidth,
      originY: shiftY / texHeight
    };
  }

  drawIsoDiamond(graphics, width, height) {
    graphics.beginPath();
    graphics.moveTo(width / 2, 0);
    graphics.lineTo(width, height / 2);
    graphics.lineTo(width / 2, height);
    graphics.lineTo(0, height / 2);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }

  cartesianToIsometric(x, y) {
    return {
      x: (x - y) * (TILE_WIDTH / 2),
      y: (x + y) * (TILE_HEIGHT / 2)
    };
  }

  async create() {
    this.cameras.main.setBackgroundColor('#1B2F1B');
    this.cameras.main.setZoom(0.8);
    this.cameras.main.centerOn(0, 0);

    // World ground layer
    this.groundGroup = this.add.group();
    this.nodeGroup = this.add.group();

    // Draw a large world ground
    this.drawWorldGround();

    // Setup controls
    this.setupInputs();

    // Setup HTML UI for world map
    this.setupWorldMapUI();

    // Load first page of players
    await this.loadPlayersPage(1);
  }

  drawWorldGround() {
    // Draw a large isometric ground plane
    for (let x = -10; x < 20; x++) {
      for (let y = -10; y < 20; y++) {
        const isoPos = this.cartesianToIsometric(x * 3, y * 3);
        const tile = this.add.sprite(isoPos.x, isoPos.y, 'world-tile')
          .setOrigin(0.5, 0)
          .setAlpha(0.3)
          .setDepth(0);
        this.groundGroup.add(tile);
      }
    }
  }

  async loadPlayersPage(page) {
    if (this.loadedPages.has(page) || this.isLoading) return;
    this.isLoading = true;

    try {
      const res = await fetchPlayers(page, 20);
      if (!res.success) {
        this.isLoading = false;
        return;
      }

      this.loadedPages.add(page);
      this.totalPages = res.totalPages;
      this.currentPage = page;

      // Add players to the list
      res.players.forEach((player, index) => {
        const globalIndex = (page - 1) * 20 + index;
        this.players.push(player);
        this.createPlayerNode(player, globalIndex);
      });

      // Update load more button visibility
      this.updateLoadMoreButton();
    } catch (e) {
      console.error('Failed to load players', e);
    }

    this.isLoading = false;
  }

  createPlayerNode(player, index) {
    const col = index % COLS;
    const row = Math.floor(index / COLS);

    // Position in world space
    const worldX = col * NODE_SPACING_X - (COLS * NODE_SPACING_X) / 2;
    const worldY = row * NODE_SPACING_Y;

    const container = this.add.container(worldX, worldY);
    container.setDepth(10 + row);

    // Platform base (5x5 mini tiles)
    for (let px = 0; px < 5; px++) {
      for (let py = 0; py < 5; py++) {
        const tileIso = this.cartesianToIsometric(px, py);
        const tile = this.add.sprite(tileIso.x, tileIso.y, 'platform-tile')
          .setOrigin(0.5, 0)
          .setScale(0.8)
          .setAlpha(0.6);
        container.add(tile);
      }
    }

    // Render miniature buildings
    const miniTexMap = {
      'SERVER_T1': 'mini-server',
      'SERVER_T2': 'mini-server2',
      'SERVER_T2_ROTATED': 'mini-server2r',
      'DESK': 'mini-desk',
      'SELLER_T1': 'mini-seller1',
      'SELLER_T2': 'mini-seller2',
      'SELLER_T3': 'mini-seller3',
      'SELLER_T3_ROTATED': 'mini-seller3r',
      'TRAINER_T1': 'mini-trainer1',
      'TRAINER_T2': 'mini-trainer2',
      'TRAINER_T3': 'mini-trainer3',
      'TRAINER_T3_ROTATED': 'mini-trainer3r'
    };

    // We only have grid summary (buildingCount), not actual grid data
    // So we generate representative buildings based on count
    const buildingCount = player.gridSummary.buildingCount;
    for (let i = 0; i < Math.min(buildingCount, 8); i++) {
      // Place buildings in a mini pattern
      const bx = (i % 4);
      const by = Math.floor(i / 4);
      const bIso = this.cartesianToIsometric(bx + 0.5, by + 0.5);

      // Pick a representative building texture based on money
      let texKey = 'mini-server';
      if (player.money > 5000) texKey = 'mini-trainer2';
      else if (player.money > 1000) texKey = 'mini-seller1';
      else if (player.money > 500) texKey = 'mini-desk';

      const origin = this.textureOrigins[texKey] || { originX: 0.5, originY: 1 };
      const bSprite = this.add.sprite(bIso.x, bIso.y, texKey)
        .setOrigin(origin.originX, origin.originY)
        .setScale(MINI_SCALE);
      container.add(bSprite);
    }

    // Username label
    const nameText = this.add.text(0, -30, player.username, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center'
    }).setOrigin(0.5, 1);
    container.add(nameText);

    // Money label
    const moneyText = this.add.text(0, -14, `$${Math.floor(player.money)}`, {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#f1c40f',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center'
    }).setOrigin(0.5, 1);
    container.add(moneyText);

    // Stats label
    const statsText = this.add.text(0, 100, `👥 ${Math.floor(player.users)} | ⭐ ${player.modelQuality.toFixed(1)}`, {
      fontSize: '10px',
      fontFamily: 'Arial',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center'
    }).setOrigin(0.5, 0);
    container.add(statsText);

    // Make clickable — overlay a transparent hit area
    const hitZone = this.add.zone(0, 30, 150, 130).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
    container.add(hitZone);

    hitZone.on('pointerdown', () => {
      this.visitPlayer(player.username);
    });

    hitZone.on('pointerover', () => {
      nameText.setColor('#4CAF50');
      container.setScale(1.05);
    });

    hitZone.on('pointerout', () => {
      nameText.setColor('#ffffff');
      container.setScale(1.0);
    });

    this.playerNodes.push({ container, username: player.username, worldX, worldY });
  }

  visitPlayer(username) {
    // Switch to MainScene and trigger visit mode
    this.hideWorldMapUI();
    this.scene.start('MainScene', { visitUsername: username });
  }

  setupInputs() {
    // Zooming
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const zoomValue = this.cameras.main.zoom - (deltaY * 0.001);
      this.cameras.main.setZoom(Phaser.Math.Clamp(zoomValue, 0.3, 1.5));
    });

    // Panning (Drag)
    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;
      this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
      this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
    });
  }

  setupWorldMapUI() {
    // Hide main game UI, show world map UI
    const buildControls = document.getElementById('build-controls');
    const visitBanner = document.getElementById('visit-banner');
    const leaderboardMini = document.getElementById('leaderboard-mini');
    const hud = document.querySelector('.hud');
    const topActions = document.querySelector('.top-actions');
    const searchPanel = document.getElementById('search-panel');

    if (buildControls) buildControls.style.display = 'none';
    if (visitBanner) visitBanner.style.display = 'none';
    if (leaderboardMini) leaderboardMini.style.display = 'none';
    if (searchPanel) searchPanel.style.display = 'none';

    // Modify HUD to show world map title
    if (hud) {
      hud.innerHTML = `
        <div style="font-size:20px;font-weight:bold;color:#4CAF50;">🗺️ World Map</div>
        <div style="font-size:14px;color:#aaa;">Click a company to visit</div>
      `;
    }

    // Update top actions for world map context
    if (topActions) {
      topActions.innerHTML = `
        <button id="wm-btn-my-base" style="background:#4CAF50;">🏠 My Base</button>
        <button id="wm-btn-search">🔍 Search</button>
        <button id="wm-btn-scout">🎲 Scout</button>
        <button id="wm-btn-load-more" style="display:none;">📥 Load More</button>
      `;
    }

    // My Base button
    const btnMyBase = document.getElementById('wm-btn-my-base');
    if (btnMyBase) {
      btnMyBase.onclick = () => {
        this.hideWorldMapUI();
        this.scene.start('MainScene');
      };
    }

    // Search button
    const wmSearchBtn = document.getElementById('wm-btn-search');
    const wmSearchPanel = document.getElementById('search-panel');
    if (wmSearchBtn && wmSearchPanel) {
      wmSearchBtn.onclick = () => {
        wmSearchPanel.style.display = wmSearchPanel.style.display === 'block' ? 'none' : 'block';
      };
    }

    // Setup search panel for world map
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const searchResults = document.getElementById('search-results');
    if (searchBtn && searchInput && searchResults) {
      searchBtn.onclick = async () => {
        const query = searchInput.value.trim();
        if (!query) return;
        try {
          const res = await searchPlayers(query);
          if (!res.success) { searchResults.innerHTML = '<div style="color:red">Error</div>'; return; }
          if (res.players.length === 0) { searchResults.innerHTML = '<div>No players found</div>'; return; }
          const myUsername = localStorage.getItem('username');
          searchResults.innerHTML = res.players.map(p =>
            `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #444;">
              <span>${p.username} — $${Math.floor(p.money)}</span>
              ${p.username !== myUsername ? `<button class="wm-search-visit-btn" data-username="${p.username}" style="padding:2px 8px;font-size:11px;background:#2196F3;border:none;color:white;border-radius:3px;cursor:pointer;">Visit</button>` : '<span style="color:#4CAF50;font-size:11px;">You</span>'}
            </div>`
          ).join('');
          searchResults.querySelectorAll('.wm-search-visit-btn').forEach(btn => {
            btn.onclick = () => {
              const username = btn.getAttribute('data-username');
              wmSearchPanel.style.display = 'none';
              this.visitPlayer(username);
            };
          });
        } catch (e) {
          searchResults.innerHTML = '<div style="color:red">Server error</div>';
        }
      };
      searchInput.onkeydown = (e) => { if (e.key === 'Enter') searchBtn.click(); };
    }

    // Scout button
    const wmScoutBtn = document.getElementById('wm-btn-scout');
    if (wmScoutBtn) {
      wmScoutBtn.onclick = async () => {
        try {
          const res = await fetchRandomPlayer();
          if (res.success) {
            // Try to find and pan to the player on the map first
            const node = this.playerNodes.find(n => n.username === res.username);
            if (node) {
              this.cameras.main.pan(node.worldX, node.worldY, 500, 'Power2');
            } else {
              // Player not loaded on map, visit directly
              this.visitPlayer(res.username);
            }
          }
        } catch (e) {
          console.error('Scout failed', e);
        }
      };
    }

    // Load more button
    const btnLoadMore = document.getElementById('wm-btn-load-more');
    if (btnLoadMore) {
      btnLoadMore.onclick = async () => {
        const nextPage = Math.max(...this.loadedPages) + 1;
        if (nextPage <= this.totalPages) {
          await this.loadPlayersPage(nextPage);
        }
      };
    }
  }

  updateLoadMoreButton() {
    const btn = document.getElementById('wm-btn-load-more');
    if (!btn) return;
    const maxLoaded = Math.max(...this.loadedPages);
    btn.style.display = maxLoaded < this.totalPages ? 'inline-block' : 'none';
  }

  hideWorldMapUI() {
    // Restore HUD content (will be re-initialized by MainScene)
    const hud = document.querySelector('.hud');
    if (hud) {
      hud.innerHTML = `
        <div id="hud-money">Money: $Loading...</div>
        <div id="hud-compute">Compute: -</div>
        <div id="hud-users">Users: -</div>
        <div id="hud-quality">Quality: -</div>
      `;
    }

    // Restore top actions
    const topActions = document.querySelector('.top-actions');
    if (topActions) {
      topActions.innerHTML = `
        <button id="btn-world-map">🗺️ World Map</button>
        <button id="btn-search-visit">🔍 Search</button>
        <button id="btn-scout">🎲 Scout</button>
      `;
    }
  }

  update(time, delta) {
    // Lazy load more players as camera pans down
    if (!this.isLoading && this.playerNodes.length > 0) {
      const cam = this.cameras.main;
      const bottomEdge = cam.scrollY + cam.height / cam.zoom;
      const lastNode = this.playerNodes[this.playerNodes.length - 1];
      if (lastNode && bottomEdge > lastNode.worldY - 200) {
        const nextPage = Math.max(...this.loadedPages) + 1;
        if (nextPage <= this.totalPages) {
          this.loadPlayersPage(nextPage);
        }
      }
    }
  }
}
