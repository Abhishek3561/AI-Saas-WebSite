import {v2 as cloudinary} from "cloudinary"
import "dotenv/config.js"

const connectCloudinary=async()=>{
    cloudinary.config({
        cloud_name:process.env.CLOUDINARY_CLOUD_NAME,
        api_key:process.env.CLOUDINARY_API_KEY,
        api_secret:process.env.CLOUDINARY_API_SECRET,
         timeout: 300000  // 5 minutes
    })
}

export default connectCloudinary