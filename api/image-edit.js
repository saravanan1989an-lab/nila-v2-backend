import { InferenceClient } from "@huggingface/inference";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { image, prompt } = req.body || {};

    if (!image) {
      return res.status(400).json({
        error: "Image is required",
      });
    }

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({
        error: "Edit instruction is required",
      });
    }

    const hfToken = process.env.HF_TOKEN;

    if (!hfToken) {
      return res.status(500).json({
        error: "HF_TOKEN is not configured in Vercel",
      });
    }

    const match = String(image).match(
      /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
    );

    if (!match) {
      return res.status(400).json({
        error: "Invalid image format",
      });
    }

    const mimeType = match[1];
    const base64Data = match[2];

    const imageBuffer = Buffer.from(base64Data, "base64");

    const client = new InferenceClient(hfToken);

    const result = await client.imageToImage({
      model: "black-forest-labs/FLUX.1-Kontext-dev",
      inputs: new Blob([imageBuffer], {
        type: mimeType,
      }),
      parameters: {
        prompt: String(prompt).trim(),
      },
    });

    const outputBuffer = Buffer.from(
      await result.arrayBuffer()
    );

    const outputType =
      result.type || "image/png";

    const editedImage =
      `data:${outputType};base64,` +
      outputBuffer.toString("base64");

    return res.status(200).json({
      image: editedImage,
      provider: "huggingface",
    });

  } catch (error) {
    console.error("HF IMAGE EDIT ERROR:", error);

    const message =
      error?.message ||
      "Image editing failed";

    return res.status(500).json({
      error: message,
    });
  }
}
