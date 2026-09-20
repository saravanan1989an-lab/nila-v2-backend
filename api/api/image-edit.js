export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "OPENAI_API_KEY is not configured"
    });
  }

  try {
    const { image, prompt } = req.body || {};

    if (!image) {
      return res.status(400).json({
        error: "Image is required"
      });
    }

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({
        error: "Edit instruction is required"
      });
    }

    const match = image.match(
      /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
    );

    if (!match) {
      return res.status(400).json({
        error: "Invalid image format"
      });
    }

    const mimeType = match[1];
    const base64Data = match[2];

    const imageBuffer = Buffer.from(
      base64Data,
      "base64"
    );

    const extension =
      mimeType.includes("png")
        ? "png"
        : mimeType.includes("webp")
        ? "webp"
        : "jpg";

    const form = new FormData();

    form.append(
      "model",
      "gpt-image-2"
    );

    form.append(
      "prompt",
      String(prompt).trim()
    );

    form.append(
      "size",
      "1024x1024"
    );

    form.append(
      "image",
      new Blob(
        [imageBuffer],
        { type: mimeType }
      ),
      `input.${extension}`
    );

    const response = await fetch(
      "https://api.openai.com/v1/images/edits",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${apiKey}`
        },

        body: form
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      return res
        .status(response.status)
        .json({
          error:
            data?.error?.message ||
            "Image editing failed"
        });
    }

    const item =
      data?.data?.[0];

    let editedImage = null;

    if (item?.b64_json) {
      editedImage =
        "data:image/png;base64," +
        item.b64_json;
    }

    if (
      !editedImage &&
      item?.url
    ) {
      editedImage =
        item.url;
    }

    if (!editedImage) {
      return res.status(500).json({
        error:
          "No edited image returned"
      });
    }

    return res.status(200).json({
      image: editedImage
    });

  } catch (error) {
    return res.status(500).json({
      error:
        error?.message ||
        "Server error"
    });
  }
          }
