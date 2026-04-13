import express from "express"
import { auth } from "../middlewares/auth.js"
import { generateArticle,generateBlogTitle, generateImage, removeBackgroundImage, removeBackgroundObject, reviewResume } from "../controllers/aiController.js"
import upload from "../config/multer.js"

const aiRouter=express.Router()

aiRouter.post('/generate-article',auth,generateArticle)
aiRouter.post('/generate-blog-title',auth,generateBlogTitle)
aiRouter.post('/generate-images',auth,generateImage)
aiRouter.post('/remove-image-background',upload.single('image'),auth,removeBackgroundImage)
aiRouter.post('/remove-image-object',upload.single('image'),auth,removeBackgroundObject)
aiRouter.post('/resume-review',upload.single('resume'),auth,reviewResume)

export default aiRouter
