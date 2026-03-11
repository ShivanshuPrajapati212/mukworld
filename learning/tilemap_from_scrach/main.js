const canvas = document.getElementById("gameCanvas")
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const ctx = canvas.getContext("2d")

const winHeight = window.innerHeight
const winWidth = window.innerWidth 

const tileHeight = 100
const tileWidth = 100

for (let i = 0; i <= winWidth/tileWidth; i++) {
    for (let j = 0; j <= winHeight/tileHeight; j++) {
        if ((i + j) % 2 === 0) {
            ctx.fillStyle = "green"
        } else {
            ctx.fillStyle = "white"
        }
        // ctx.fillRect(tileWidth*i, tileHeight*j, tileWidth, tileHeight)

        ctx.beginPath()

        ctx.moveTo(tileWidth*i, tileHeight*j)

        ctx.lineTo(tileWidth*i + tileWidth, tileHeight*j)
        ctx.lineTo(tileWidth*i + tileWidth, tileHeight*j + tileHeight)
        ctx.lineTo(tileWidth*i, tileHeight*j + tileHeight)
        ctx.lineTo(tileWidth*i, tileHeight*j)

        ctx.closePath()    

        ctx.fill() 
    }
}
