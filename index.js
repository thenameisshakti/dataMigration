const dotenv = require("dotenv")
const {connect} = require('./src/db/connectDB.js')
const app = require('./app.js')

const PORT = 3000


 connect()
 .then (() => {
    app.listen(PORT || 3000 , () => {
        console.log(` server is listening at the :: ${PORT}`)
    })
 })
 .catch((error) => {
    console.log(`server is failed to listening the port`,error)
 })


