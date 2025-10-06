const mongoose = require("mongoose")
const getEnv = require("../config/config.js")
const connectDB = async() => {
    const DB_Name = "Data_Migration"
    const mongodbUri = "MONGODB_URI"
        try {
            const connecitonInstance = await mongoose.connect(`${getEnv(mongodbUri)}/${DB_Name}`)
            console.log("connnection Instance has been created", connecitonInstance.connection.host)
        } catch(error) {
            console.log("error in creating the instance ", error )
            process.exit(1)
        }
}

module.exports = connectDB