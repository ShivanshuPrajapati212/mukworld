import './style.css' 
import Phaser from "phaser"

class IsoScene extends Phaser.Scene {
  constructor() {
    super("IsoScene")
    this.tileWidth = 32 
    this.tileHeight = 16 
    this.isDragging = false
    this.lastPointerPos = { x: 0, y: 0 }
    this.hoveredTile = null
  }

  preload() {
    this.load.image("tile", "assets/tile.png")
  }

  create() {
    const mapWidth = 50
    const mapHeight = 50

    this.map = this.make.tilemap({ 
      tileWidth: this.tileWidth, 
      tileHeight: this.tileHeight, 
      width: mapWidth, 
      height: mapHeight 
    })
    
    const tileset = this.map.addTilesetImage("tile")
    this.layer = this.map.createBlankLayer("IsoLayer", tileset)

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        this.layer.putTileAt(0, x, y)
      }
    }

    this.isoOffsetX = this.scale.width / 2
    this.isoOffsetY = 100

    this.updateIsoPositions()

    this.cameras.main.setBounds(-2000, -2000, 6000, 6000)
    this.cameras.main.scrollX = 0
    this.cameras.main.scrollY = 0

    this.input.on('pointerdown', (pointer) => {
      this.isDragging = true
      this.lastPointerPos = { x: pointer.x, y: pointer.y }
    })

    this.input.on('pointerup', () => {
      this.isDragging = false
    })

    this.input.on('pointermove', (pointer) => {
      if (this.isDragging) {
        this.cameras.main.scrollX -= pointer.x - this.lastPointerPos.x
        this.cameras.main.scrollY -= pointer.y - this.lastPointerPos.y
        this.lastPointerPos = { x: pointer.x, y: pointer.y }
      } else {
        this.handleHover(pointer)
      }
    })

    this.input.on('pointerdown', (pointer) => {
      const tile = this.getTileAtPointer(pointer)
      if (tile) {
        console.log(`Clicked tile at grid: ${tile.x}, ${tile.y}`)
      }
    })
  }

  updateIsoPositions() {
    const cam = this.cameras.main
    
    this.layer.forEachTile(tile => {
      if (tile) {
        const isoX = (tile.x - tile.y) * this.tileWidth / 2 + this.isoOffsetX + cam.scrollX
        const isoY = (tile.x + tile.y) * this.tileHeight / 2 + this.isoOffsetY + cam.scrollY
        
        tile.pixelX = isoX
        tile.pixelY = isoY
        
        if (!tile.baseY) {
          tile.baseY = isoY
        }
      }
    })
  }

  handleHover(pointer) {
    const tile = this.getTileAtPointer(pointer)
    
    if (this.hoveredTile && this.hoveredTile !== tile) {
      this.hoveredTile.pixelY = this.hoveredTile.baseY
      this.hoveredTile = null
    }
    
    if (tile) {
      if (this.hoveredTile !== tile) {
        tile.pixelY = tile.baseY - 8
        this.hoveredTile = tile
      }
    } else if (this.hoveredTile) {
      this.hoveredTile.pixelY = this.hoveredTile.baseY
      this.hoveredTile = null
    }
  }

  getTileAtPointer(pointer) {
    const cam = this.cameras.main
    const worldX = pointer.x + cam.scrollX
    const worldY = pointer.y + cam.scrollY

    const gridY = (worldY / this.tileHeight) - (worldX / this.tileWidth) + 0.5
    const gridX = (worldX / this.tileWidth) + (worldY / this.tileHeight) - 0.5

    return this.layer.getTileAt(Math.floor(gridX / 2), Math.floor(gridY / 2))
  }

  update() {
  }
}

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  scene: IsoScene,
  backgroundColor: "#1a1a2e",
  scale: {
    mode: Phaser.Scale.RESIZE
  }
}

new Phaser.Game(config)
