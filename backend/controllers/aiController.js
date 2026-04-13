import { clerkClient } from "@clerk/express";
import OpenAI from "openai";
import sql from "../config/db.js";
import "dotenv/config.js";
import { v2 as cloudinary } from "cloudinary";
import axios from "axios";
import fs from "fs";
import pdf from "pdf-parse-fork";

const AI = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

export const generateArticle = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { prompt, length } = req.body;
    const plan = req.plan;
    const free_usage = req.free_usage;

    if (plan != "premium_plan" && free_usage >= 10) {
      return res.json({ success: false, message: "Limit reached" });
    }
    const response = await AI.chat.completions.create({
      model: "gemini-3-flash-preview",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: Math.max(1500, length * 3),
    });
    const content = response.choices[0].message.content;

    await sql` INSERT INTO creations (user_id,prompt,content,type)
    VALUES (${userId},${prompt},${content},'article')`;

    if (plan != "premium_plan") {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          free_usage: free_usage + 1,
        },
      });
    }

    res.json({ success: true, content });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

export const generateBlogTitle = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { prompt } = req.body;
    const plan = req.plan;
    const free_usage = req.free_usage;

    if (plan != "premium_plan" && free_usage >= 10) {
      return res.json({ success: false, message: "Limit reached" });
    }
    const response = await AI.chat.completions.create({
      model: "gemini-3-flash-preview",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 600,
    });
    const content = response.choices[0].message.content;

    await sql` INSERT INTO creations (user_id,prompt,content,type)
    VALUES (${userId},${prompt},${content},'blog-title')`;

    if (plan != "premium_plan") {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          free_usage: free_usage + 1,
        },
      });
    }

    res.json({ success: true, content });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

export const generateImage = async (req, res) => {
  try {
    const { userId } = await req.auth;
    const { prompt, publish } = req.body;
    const plan = req.plan;

    if (plan != "premium_plan") {
      return res.json({
        success: false,
        message: "Available for Premium Only",
      });
    }

    const formData = new FormData();
    formData.append("prompt", prompt);
    const { data } = await axios.post(
      "https://clipdrop-api.co/text-to-image/v1",
      formData,
      {
        headers: { "x-api-key": process.env.CLIPDROP_API_KEY },
        responseType: "arraybuffer",
      },
    );

    const buffer = Buffer.from(data, "binary");

    const { secure_url } = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: "image",
            timeout: 120000, // 2 minutes
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        )
        .end(buffer);
    });

    await sql`INSERT INTO creations (user_id,prompt,content,type,publish)
    VALUES (${userId},${prompt},${secure_url},'image',${publish ?? false})`;

    res.json({ success: true, content: secure_url });
  } catch (error) {
    console.log("ERROR:", error);
    res.json({ success: false, message: error.message });
  }
};

export const removeBackgroundImage = async (req, res) => {
  try {
    const { userId } = await req.auth;
    const  image = req.file;
    const plan = req.plan;

    if (plan != "premium_plan") {
      return res.json({
        success: false,
        message: "Available for Premium Only",
      });
    }

    const { secure_url } = await cloudinary.uploader.upload(image.path, {
      transformation: [
        {
          effect: "background_removal",
          background_removal: "remove_the_background",
        },
      ],
    });

    await sql`INSERT INTO creations (user_id,prompt,content,type)
    VALUES (${userId},'remove background from image',${secure_url},'image')`;

    res.json({ success: true, content: secure_url });
  } catch (error) {
    console.log("ERROR:", error);
    res.json({ success: false, message: error.message });
  }
};

export const removeBackgroundObject = async (req, res) => {
  try {
    const { userId } = await req.auth;
    const  image  = req.file;
    const { object } = req.body;
    const plan = req.plan;

    if (plan != "premium_plan") {
      return res.json({
        success: false,
        message: "Available for Premium Only",
      });
    }

    const { public_id } = await cloudinary.uploader.upload(image.path);

    const imageUrl = cloudinary.url(public_id, {
      transformation: [{ effect: `gen_remove:prompt_Remove ${object}` }],
      resource_type: "image",
    });

    await sql`INSERT INTO creations (user_id,prompt,content,type)
    VALUES (${userId},${`Removed ${object} from image`},${imageUrl},'image')`;

    res.json({ success: true, content: imageUrl });
  } catch (error) {
    console.log("ERROR:", error);
    res.json({ success: false, message: error.message });
  }
};

export const reviewResume = async (req, res) => {
  try {
    const { userId } = await req.auth;
    const resume = req.file;
    const plan = req.plan;

    if (plan != "premium_plan") {
      return res.json({
        success: false,
        message: "Available for Premium Only",
      });
    }

    if (resume.size > 5 * 1024 * 1024) {
      return res.json({ success: false, message: "exceeds 5MB size" });
    }

    const dataBuffer = fs.readFileSync(resume.path);
    const pdfData = await pdf(dataBuffer);

    const prompt = `Review the following resume and provide constructive 
    feedback on its strengths, weaknesses, and areas for improvement. Resume 
    Content:\n\n${pdfData.text}`;

    const response = await AI.chat.completions.create({
      model: "gemini-3-flash-preview",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });
    const content = response.choices[0].message.content;

    await sql`INSERT INTO creations (user_id,prompt,content,type)
    VALUES (${userId},'Review the uploaded resume',${content},'resume-review')`;

    res.json({ success: true, content });
  } catch (error) {
    console.log("ERROR:", error);
    res.json({ success: false, message: error.message });
  }
};
