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
        
        const additionalLength = (((tileWidth**2+tileHeight**2) ** 0.5) - winWidth)/2

        ctx.beginPath()

        ctx.moveTo(tileWidth*i + tileWidth/2, tileHeight*j - additionalLength)

        ctx.lineTo(tileWidth*i + tileWidth + additionalLength, tileHeight*j + tileHeight/2)
        ctx.lineTo(tileWidth*i + tileWidth/2, tileHeight*j + tileHeight + additionalLength)
        ctx.lineTo(tileWidth*i - additionalLength, tileHeight*j + tileHeight/2)
        ctx.lineTo(tileWidth*i + tileWidth/2, tileHeight*j - additionalLength)

        ctx.closePath()    

        ctx.stroke() 
    }
}
