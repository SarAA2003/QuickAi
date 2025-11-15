import OpenAI from "openai";
import sql from "../configs/db.js";
import { clerkClient } from "@clerk/express";
import { v2 as cloudinary } from "cloudinary";
import axios from "axios";
import fs from "fs";
import { PDFExtract } from "pdf.js-extract";

const pdfExtract = new PDFExtract();

const AI = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

// ===================== GENERATE ARTICLE =====================

export const generateArticle = async (req, res) => {
    try {
        const { userId } = req.auth();

        const user = await clerkClient.users.getUser(userId);
        const plan = user.privateMetadata?.plan || "free";
        const free_usage = user.privateMetadata?.free_usage || 0;

        const { prompt, length } = req.body;

        if (plan !== "premium" && free_usage >= 10) {
            return res.json({ success: false, message: "Limit reached. Upgrade to continue." });
        }

        const response = await AI.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: length
        });

        const content = response.choices[0].message?.content || "";

        await sql`
            INSERT INTO creations (user_id, prompt, content, type)
            VALUES (${userId}, ${prompt}, ${content}, 'article')
        `;

        if (plan !== "premium") {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: { free_usage: free_usage + 1 }
            });
        }

        res.json({ success: true, content });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

// ===================== GENERATE BLOG TITLE =====================

export const generateBlogTitle = async (req, res) => {
    try {
        const { userId } = req.auth();

        const user = await clerkClient.users.getUser(userId);
        const plan = user.privateMetadata?.plan || "free";
        const free_usage = req.free_usage;

        const { prompt } = req.body;

        if (plan !== "premium" && free_usage >= 10) {
            return res.json({ success: false, message: "Limit reached. Upgrade to continue." });
        }

        const response = await AI.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 100
        });

        const content = response.choices[0].message.content;

        await sql`
            INSERT INTO creations (user_id, prompt, content, type)
            VALUES (${userId}, ${prompt}, ${content}, 'blog-title')
        `;

        if (plan !== "premium") {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: { free_usage: free_usage + 1 }
            });
        }

        res.json({ success: true, content });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

// ===================== GENERATE IMAGE =====================

export const generateImage = async (req, res) => {
    try {
        const { userId } = req.auth();
        const user = await clerkClient.users.getUser(userId);
        const plan = req.plan;

        const { prompt, publish } = req.body;

        if (plan !== "premium") {
            return res.json({ success: false, message: "This feature is only available for premium subscriptions." });
        }

        const formData = new FormData();
        formData.append("prompt", prompt);

        const { data } = await axios.post(
            "https://clipdrop-api.co/text-to-image/v1",
            formData,
            {
                headers: { "x-api-key": process.env.CLIPDROP_API_KEY },
                responseType: "arraybuffer"
            }
        );

        const base64Image = `data:image/png;base64,${Buffer.from(data, "binary").toString("base64")}`;

        const { secure_url } = await cloudinary.uploader.upload(base64Image);

        await sql`
            INSERT INTO creations (user_id, prompt, content, type, publish)
            VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${publish ?? false})
        `;

        res.json({ success: true, content: secure_url });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

// ===================== REMOVE BACKGROUND =====================

export const removeImageBackground = async (req, res) => {
    try {
        const { userId } = req.auth();
        const image = req.file;
        const plan = req.plan;

        if (plan !== "premium") {
            return res.json({ success: false, message: "This feature is only available for premium subscriptions." });
        }

        // Upload image with AI background removal
        const result = await cloudinary.uploader.upload(image.path, {
            format: "png", // output as PNG to support transparency
            transformation: [
                { width: 1000, height: 1000, crop: "limit" }, // optional
                { effect: "background_removal" } // AI-powered removal
            ]
        });

        const secure_url = result.secure_url;

        // Save to database
        await sql`
            INSERT INTO creations (user_id, prompt, content, type)
            VALUES (${userId}, 'Remove background from image', ${secure_url}, 'image')
        `;

        // Delete local file if needed
        fs.unlinkSync(image.path);

        res.json({ success: true, content: secure_url });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};


// ===================== REMOVE OBJECT =====================

export const removeImageObject = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { object } = req.body;
        const  image  = req.file;
        const plan = req.plan;

        if (plan !== "premium") {
            return res.json({ success: false, message: "This feature is only available for premium subscriptions." });
        }

        const { public_id } = await cloudinary.uploader.upload(image.path);

        const imageUrl = cloudinary.url(public_id, {
            transformation: [{ effect: `gen_remove:${object}` }],
            resource_type: "image"
        });

        await sql`
            INSERT INTO creations (user_id, prompt, content, type)
            VALUES (${userId}, ${`Removed ${object} from image`}, ${imageUrl}, 'image')
        `;

        res.json({ success: true, content: imageUrl });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

// ===================== RESUME REVIEW =====================

export const resumeReview = async (req, res) => {
  try {
    const { userId } = req.auth();
    const resume = req.file; // multer memoryStorage gives buffer here
    const plan = req.plan;

    if (!resume) {
      return res.json({ success: false, message: "No resume uploaded." });
    }

    if (plan !== "premium") {
      return res.json({ success: false, message: "This feature is only available for premium subscriptions." });
    }

    if (resume.size > 5 * 1024 * 1024) {
      return res.json({ success: false, message: "Resume file size exceeds allowed size (5MB)." });
    }

    // Use the buffer directly
    const dataBuffer = resume.buffer;

    const options = {};
    const data = await pdfExtract.extractBuffer(dataBuffer, options);

    const rawText = data.pages
      .map(page => page.content.map(item => item.str).join(" "))
      .join("\n\n");

    const prompt = `Review the following resume and provide constructive feedback on its strengths, weaknesses, and areas to improve. Resume Content:\n\n${rawText}`;

    const response = await AI.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000
    });

    const content = response.choices[0].message.content;

    await sql`
      INSERT INTO creations (user_id, prompt, content, type)
      VALUES (${userId}, 'Review the uploaded resume', ${content}, 'resume-review')
    `;

    res.json({ success: true, content });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

