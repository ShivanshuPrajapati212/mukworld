const canvas = document.getElementById("gameCanvas")
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const ctx = canvas.getContext("2d")

const winHeight = window.innerHeight
const winWidth = window.innerWidth 

const tileHeight = 100
const tileWidth = 100

ctx.fillStyle = "blue"
for (let i = 0; i <= winWidth/tileWidth; i++) {
    for (let j = 0; j <= winHeight/tileHeight; j++) {
        ctx.fillRect(tileWidth*i, tileHeight*j, tileWidth, tileHeight)
        console.log(ctx.fillStyle)
        if (ctx.fillStyle == "#0000ff") {
            ctx.fillStyle = "white"
        } else {
            ctx.fillStyle = "blue"
        }
    }
}
