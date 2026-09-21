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

  const { prompt } = req.body || {};

  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({
      error: "Prompt is required",
    });
  }

  const cleanPrompt = String(prompt).trim();

  // =====================================================
  // 1. OPENAI IMAGE
  // =====================================================

  try {
    if (process.env.OPENAI_API_KEY) {
      const response = await fetch(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-image-2",
            prompt: cleanPrompt,
            size: "1024x1024",
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        const item = data?.data?.[0];

        let image = null;

        if (item?.b64_json) {
          image =
            "data:image/png;base64," +
            item.b64_json;
        } else if (item?.url) {
          image = item.url;
        }

        if (image) {
          return res.status(200).json({
            image,
            provider: "openai",
          });
        }
      } else {
        console.log(
          "OpenAI image failed:",
          response.status,
          data?.error?.message || data
        );
      }
    }
  } catch (error) {
    console.log(
      "OpenAI image error:",
      error.message
    );
  }

  // =====================================================
  // 2. GEMINI IMAGE
  // =====================================================

  try {
    if (process.env.GEMINI_API_KEY) {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-image:generateContent",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key":
              process.env.GEMINI_API_KEY,
          },

          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: cleanPrompt,
                  },
                ],
              },
            ],

            generationConfig: {
              responseModalities: [
                "TEXT",
                "IMAGE",
              ],
            },
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        const parts =
          data?.candidates?.[0]
            ?.content?.parts || [];

        for (const part of parts) {
          const inlineData =
            part.inlineData ||
            part.inline_data;

          if (
            inlineData?.data
          ) {
            const mimeType =
              inlineData.mimeType ||
              inlineData.mime_type ||
              "image/png";

            const image =
              `data:${mimeType};base64,${inlineData.data}`;

            return res.status(200).json({
              image,
              provider: "gemini",
            });
          }
        }
      } else {
        console.log(
          "Gemini image failed:",
          response.status,
          JSON.stringify(data)
        );
      }
    }
  } catch (error) {
    console.log(
      "Gemini image error:",
      error.message
    );
  }

  // =====================================================
  // 3. HUGGING FACE IMAGE
  // =====================================================

  try {
    if (process.env.HF_TOKEN) {
      const response = await fetch(
        "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${process.env.HF_TOKEN}`,
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            inputs: cleanPrompt,
          }),
        }
      );

      if (response.ok) {
        const contentType =
          response.headers.get(
            "content-type"
          ) || "image/png";

        const arrayBuffer =
          await response.arrayBuffer();

        const base64 =
          Buffer.from(
            arrayBuffer
          ).toString("base64");

        const image =
          `data:${contentType};base64,${base64}`;

        return res.status(200).json({
          image,
          provider: "huggingface",
        });
      } else {
        const errorText =
          await response.text();

        console.log(
          "Hugging Face image failed:",
          response.status,
          errorText
        );
      }
    }
  } catch (error) {
    console.log(
      "Hugging Face image error:",
      error.message
    );
  }

  // =====================================================
  // ALL FAILED
  // =====================================================

  return res.status(500).json({
    error:
      "Image generation failed on all available providers.",
  });
      }
