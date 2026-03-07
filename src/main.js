import './style.css' 
import Phaser from "phaser"

class IsoScene extends Phaser.Scene {
  constructor() {
    super("IsoScene")
  }

  preload() {
    this.load.image("tile", "assets/tile.png")
  }

  create() {

    const tileWidth = 32
    const tileHeight = 16 

    for (let x = 0; x < 200; x++) {
      for (let y = 0; y < 200; y++) {

        const screenX = (x - y) * tileWidth / 2
        const screenY = (x + y) * tileHeight / 2

        this.add.image(
          window.innerWidth/2 + screenX,
          screenY - window.innerHeight/2,
          "tile"
        )
      }
    }

  }
}

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  scene: IsoScene
}

new Phaser.Game(config)
