import * as Phaser from 'phaser';
import { fetchState, buildInfrastructure, expandRoom } from '../api/index.js';

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

export class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
    this.gameState = null;
    this.mode = 'idle'; // 'idle', 'build', 'expand'
    this.buildType = null;
    this.buildWidth = 1;
    this.buildHeight = 1;
  }

  preload() {
    // Generate placeholder graphics for tiles and buildings
    this.generateIsoGraphics();
  }

  generateIsoGraphics() {
    const graphics = this.add.graphics();
    this.textureOrigins = {};
    
    // Draw base tile
    graphics.fillStyle(0x888888, 1);
    graphics.lineStyle(1, 0xaaaaaa, 1);
    this.drawIsoDiamond(graphics, TILE_WIDTH, TILE_HEIGHT);
    graphics.generateTexture('tile', TILE_WIDTH, TILE_HEIGHT);
    graphics.clear();
    this.textureOrigins['tile'] = { originX: 0.5, originY: 0 };

    // Draw locked tile
    graphics.fillStyle(0x333333, 1);
    graphics.lineStyle(1, 0x555555, 1);
    this.drawIsoDiamond(graphics, TILE_WIDTH, TILE_HEIGHT);
    graphics.generateTexture('tile-locked', TILE_WIDTH, TILE_HEIGHT);
    graphics.clear();
    this.textureOrigins['tile-locked'] = { originX: 0.5, originY: 0 };

    // Draw SERVER_T1 shape (1x1, height 40, blue)
    this.generateIsoBlockTexture('SERVER_T1', graphics, 1, 1, 40, 0x3498db);

    // Draw SERVER_T2 shape (2x1, height 40, purple)
    this.generateIsoBlockTexture('SERVER_T2', graphics, 2, 1, 40, 0x9b59b6);

    // Draw DESK shape (1x1, height 15, green)
    this.generateIsoBlockTexture('DESK', graphics, 1, 1, 15, 0x2ecc71);
  }

  generateIsoBlockTexture(key, graphics, w, h, z, baseColor) {
    graphics.clear();
    
    // Lighten and darken helpers
    const colorObj = Phaser.Display.Color.IntegerToColor(baseColor);
    const topColor = colorObj.clone().lighten(15).color;
    const leftColor = colorObj.color;
    const rightColor = colorObj.clone().darken(15).color;

    // We need to shift all coordinates by (-minX, -minY) to fit on canvas
    const minX = -h * 32;
    const minY = -z;
    const shiftX = -minX;
    const shiftY = -minY;

    const pT = { x: shiftX, y: shiftY };
    const pR = { x: w * 32 + shiftX, y: w * 16 + shiftY };
    const pB = { x: (w - h) * 32 + shiftX, y: (w + h) * 16 + shiftY };
    const pL = { x: -h * 32 + shiftX, y: h * 16 + shiftY };

    // Draw Right Face
    if (z > 0) {
      graphics.fillStyle(rightColor, 1);
      graphics.lineStyle(1, 0x000000, 0.2); // subtle border
      graphics.beginPath();
      graphics.moveTo(pR.x, pR.y);
      graphics.lineTo(pB.x, pB.y);
      graphics.lineTo(pB.x, pB.y - z);
      graphics.lineTo(pR.x, pR.y - z);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
    }

    // Draw Left Face
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

    // Draw Top Face
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
    
    // Generate the texture
    graphics.generateTexture(key, texWidth, texHeight);
    graphics.clear();
    
    // Store origin info so we can set it when applying the texture
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

  async create() {
    // Basic camera setup
    this.cameras.main.setBackgroundColor('#2d2d2d');
    this.cameras.main.setZoom(1);

    // Fetch initial state
    try {
      this.gameState = await fetchState();
    } catch (e) {
      this.showError('Could not connect to server.');
      return;
    }

    this.gridGroup = this.add.group();
    this.buildingGroup = this.add.group();

    // Create a hover indicator
    this.hoverIndicator = this.add.sprite(0, 0, 'tile').setOrigin(0.5, 0).setAlpha(0.6).setDepth(100);
    this.hoverIndicator.setVisible(false);

    this.drawWorld();

    // Input handlers
    this.setupInputs();

    // Setup HTML UI bindings
    this.setupUI();

    // Poll server state every 2 seconds to keep HUD updated
    this.time.addEvent({
      delay: 2000,
      callback: async () => {
        try {
          this.gameState = await fetchState();
          this.updateHUD();
          // Ideally we'd only redraw what changed, but for now redraw world
          this.drawWorld();
        } catch (e) {
          // silent fail on poll if server goes down
        }
      },
      loop: true
    });
  }

  drawWorld() {
    if (!this.gameState) return;

    this.gridGroup.clear(true, true);
    this.buildingGroup.clear(true, true);

    const { gridWidth, gridHeight, unlockedTiles, grid } = this.gameState;

    // Draw grid map
    for (let x = 0; x < gridWidth; x++) {
      for (let y = 0; y < gridHeight; y++) {
        const isUnlocked = unlockedTiles.includes(`${x},${y}`);
        const tex = isUnlocked ? 'tile' : 'tile-locked';
        const isoPos = this.cartesianToIsometric(x, y);
        
        const tile = this.add.sprite(isoPos.x, isoPos.y, tex).setOrigin(0.5, 0);
        tile.setDepth(x + y);
        this.gridGroup.add(tile);
      }
    }

    // Sort grid by Y to render back-to-front
    this.gridGroup.children.entries.sort((a, b) => a.y - b.y);

    // Draw buildings
    grid.forEach(b => {
      const isoPos = this.cartesianToIsometric(b.x, b.y);
      const origin = this.textureOrigins[b.type] || { originX: 0.5, originY: 1 };
      const buildingSprite = this.add.sprite(isoPos.x, isoPos.y, b.type).setOrigin(origin.originX, origin.originY);
      // Adjust depth so it overlays tiles correctly
      buildingSprite.setDepth(b.x + b.width + b.y + b.height + 1);
      this.buildingGroup.add(buildingSprite);
    });

    this.updateHUD();
  }

  cartesianToIsometric(x, y) {
    return {
      x: (x - y) * (TILE_WIDTH / 2),
      y: (x + y) * (TILE_HEIGHT / 2)
    };
  }

  isometricToCartesian(screenX, screenY) {
    return {
      x: Math.floor((screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2),
      y: Math.floor((screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2)
    };
  }

  setupInputs() {
    this.input.mouseGroup = this.add.group();
    
    // Zooming
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
      const zoomValue = this.cameras.main.zoom - (deltaY * 0.001);
      this.cameras.main.setZoom(Phaser.Math.Clamp(zoomValue, 0.5, 2));
    });

    // Panning (Drag)
    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;
      // If we are in build/expand mode, don't pan on drag
      if (this.mode !== 'idle') return;

      this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
      this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
    });

    // Panning (Keyboard)
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');

    // Hover
    this.input.on('pointermove', (pointer) => {
      if (this.mode === 'idle') {
        this.hoverIndicator.setVisible(false);
        return;
      }

      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const cartPos = this.isometricToCartesian(worldPoint.x, worldPoint.y);
      
      const isoPos = this.cartesianToIsometric(cartPos.x, cartPos.y);
      this.hoverIndicator.setPosition(isoPos.x, isoPos.y);
      this.hoverIndicator.setVisible(true);

      if (this.mode === 'build') {
        // Change graphic depending on build size (using scaling or different texture)
        this.hoverIndicator.setTexture(this.buildType);
        const origin = this.textureOrigins[this.buildType] || { originX: 0.5, originY: 1 };
        this.hoverIndicator.setOrigin(origin.originX, origin.originY);
        this.hoverIndicator.setScale(1);
        this.hoverIndicator.setDepth(1000); // always on top
        
        let isValid = this.isValidPlacement(cartPos.x, cartPos.y, this.buildWidth, this.buildHeight);
        this.hoverIndicator.setTint(isValid ? 0x00ff00 : 0xff0000);
      } else if (this.mode === 'expand') {
        this.hoverIndicator.setTexture('tile');
        this.hoverIndicator.setOrigin(0.5, 0);
        this.hoverIndicator.setScale(1);
        this.hoverIndicator.setDepth(1000);
        
        let isValid = this.isValidExpansion(cartPos.x, cartPos.y);
        this.hoverIndicator.setTint(isValid ? 0x00ff00 : 0xff0000);
      }
    });

    // Click to place
    this.input.on('pointerdown', async (pointer) => {
      if (this.mode === 'idle') return;
      
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const cartPos = this.isometricToCartesian(worldPoint.x, worldPoint.y);
      
      if (this.mode === 'build') {
        if (!this.isValidPlacement(cartPos.x, cartPos.y, this.buildWidth, this.buildHeight)) {
          this.showError('Invalid placement or insufficient funds');
          return;
        }

        try {
          const res = await buildInfrastructure(this.buildType, cartPos.x, cartPos.y);
          if (res.success) {
            this.gameState = res.gameState;
            this.drawWorld();
          } else {
            this.showError(res.message);
          }
        } catch (e) {
          this.showError('Server Error');
        }
      } else if (this.mode === 'expand') {
        if (!this.isValidExpansion(cartPos.x, cartPos.y)) {
          this.showError('Invalid expansion or insufficient funds');
          return;
        }

        try {
          const res = await expandRoom(cartPos.x, cartPos.y);
          if (res.success) {
            this.gameState = res.gameState;
            this.drawWorld();
          } else {
            this.showError(res.message);
          }
        } catch (e) {
          this.showError('Server Error');
        }
      }
    });
  }

  isValidPlacement(x, y, w, h) {
    if (!this.gameState) return false;
    // Check bounds
    if (x < 0 || y < 0 || x + w > this.gameState.gridWidth || y + h > this.gameState.gridHeight) return false;
    
    // Check unlocked
    for (let bx = x; bx < x + w; bx++) {
      for (let by = y; by < y + h; by++) {
        if (!this.gameState.unlockedTiles.includes(`${bx},${by}`)) return false;
      }
    }
    
    // Check collision
    const isColliding = this.gameState.grid.some(b => {
      return x < b.x + b.width && x + w > b.x &&
             y < b.y + b.height && y + h > b.y;
    });

    if (isColliding) return false;
    return true;
  }

  isValidExpansion(x, y) {
    if (!this.gameState) return false;
    if (x < 0 || y < 0 || x >= this.gameState.gridWidth || y >= this.gameState.gridHeight) return false;
    if (this.gameState.unlockedTiles.includes(`${x},${y}`)) return false;
    
    const isAdjacent = 
      this.gameState.unlockedTiles.includes(`${x-1},${y}`) ||
      this.gameState.unlockedTiles.includes(`${x+1},${y}`) ||
      this.gameState.unlockedTiles.includes(`${x},${y-1}`) ||
      this.gameState.unlockedTiles.includes(`${x},${y+1}`);
      
    return isAdjacent;
  }

  update(time, delta) {
    const cam = this.cameras.main;
    const speed = 500 * (delta / 1000); // 500 pixels per sec

    if (this.cursors.left.isDown || this.keys.A.isDown) cam.scrollX -= speed / cam.zoom;
    else if (this.cursors.right.isDown || this.keys.D.isDown) cam.scrollX += speed / cam.zoom;

    if (this.cursors.up.isDown || this.keys.W.isDown) cam.scrollY -= speed / cam.zoom;
    else if (this.cursors.down.isDown || this.keys.S.isDown) cam.scrollY += speed / cam.zoom;
  }

  showError(msg) {
    const popup = document.getElementById('error-popup');
    if (!popup) return;
    popup.innerText = msg;
    popup.style.display = 'block';
    popup.style.opacity = 1;
    
    if (this.errorTimeout) clearTimeout(this.errorTimeout);
    this.errorTimeout = setTimeout(() => {
      popup.style.opacity = 0;
      setTimeout(() => popup.style.display = 'none', 300);
    }, 3000);
  }

  updateHUD() {
    if (!this.gameState) return;
    const moneyEl = document.getElementById('hud-money');
    const computeEl = document.getElementById('hud-compute');
    const dataEl = document.getElementById('hud-data');
    const usersEl = document.getElementById('hud-users');
    const qualityEl = document.getElementById('hud-quality');

    if (moneyEl) moneyEl.innerText = `Money: $${Math.floor(this.gameState.money)}`;
    if (computeEl) computeEl.innerText = `Compute: ${Math.floor(this.gameState.compute)}`;
    if (dataEl) dataEl.innerText = `Data: ${Math.floor(this.gameState.data)}`;
    if (usersEl) usersEl.innerText = `Users: ${Math.floor(this.gameState.users)}`;
    if (qualityEl) qualityEl.innerText = `Quality: ${this.gameState.models.quality.toFixed(2)}`;
  }

  setupUI() {
    const btnCancel = document.getElementById('btn-cancel');
    const btnBuildS1 = document.getElementById('btn-build-server1');
    const btnBuildS2 = document.getElementById('btn-build-server2');
    const btnBuildDesk = document.getElementById('btn-build-desk');
    const btnExpand = document.getElementById('btn-expand');
    
    const setMode = (mode, buildType = null, w = 1, h = 1) => {
      this.mode = mode;
      this.buildType = buildType;
      this.buildWidth = w;
      this.buildHeight = h;
      this.hoverIndicator.setVisible(false);

      [btnCancel, btnBuildS1, btnBuildS2, btnBuildDesk, btnExpand].forEach(b => b.classList.remove('active'));
    };

    btnCancel.onclick = () => { setMode('idle'); btnCancel.classList.add('active'); };
    btnBuildS1.onclick = () => { setMode('build', 'SERVER_T1', 1, 1); btnBuildS1.classList.add('active'); };
    btnBuildS2.onclick = () => { setMode('build', 'SERVER_T2', 2, 1); btnBuildS2.classList.add('active'); };
    btnBuildDesk.onclick = () => { setMode('build', 'DESK', 1, 1); btnBuildDesk.classList.add('active'); };
    btnExpand.onclick = () => { setMode('expand'); btnExpand.classList.add('active'); };
  }
}
