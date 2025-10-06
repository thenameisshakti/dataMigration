const dotenv = require("dotenv")
const connectDB = require('./src/db/connectDB.js')
const app = require('./app.js')
const getEnv = require('./src/config/config.js')

const PORT = getEnv("PORT")
console.log(PORT)

 connectDB()
 .then (() => {
    app.listen(PORT || 3000 , () => {
        console.log(` server is listening at the :: ${PORT}`)
    })
 })
 .catch((error) => {
    console.log(`server is failed to listening the port`,error)
 })


