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

  const errors = [];

  // =====================================================
  // 1. GEMINI IMAGE
  // =====================================================

  try {
    if (process.env.GEMINI_API_KEY) {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY,
          },

          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: cleanPrompt,
                  },
                ],
              },
            ],

            generationConfig: {
              responseModalities: ["IMAGE"],
            },
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        const parts =
          data?.candidates?.[0]?.content?.parts || [];

        for (const part of parts) {
          const inlineData =
            part.inlineData || part.inline_data;

          if (inlineData?.data) {
            const mimeType =
              inlineData.mimeType ||
              inlineData.mime_type ||
              "image/png";

            return res.status(200).json({
              image:
                `data:${mimeType};base64,${inlineData.data}`,
              provider: "gemini",
            });
          }
        }

        errors.push(
          "Gemini: response received but no image data returned"
        );
      } else {
        const message =
          data?.error?.message ||
          JSON.stringify(data);

        errors.push(
          `Gemini ${response.status}: ${message}`
        );
      }
    } else {
      errors.push(
        "Gemini: GEMINI_API_KEY missing"
      );
    }
  } catch (error) {
    errors.push(
      "Gemini error: " + error.message
    );
  }


  // =====================================================
  // 2. OPENAI IMAGE
  // =====================================================

  try {
    if (process.env.OPENAI_API_KEY) {
      const response = await fetch(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${process.env.OPENAI_API_KEY}`,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            model: "gpt-image-1",
            prompt: cleanPrompt,
            size: "1024x1024",
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        const item =
          data?.data?.[0];

        if (item?.b64_json) {
          return res.status(200).json({
            image:
              "data:image/png;base64," +
              item.b64_json,
            provider: "openai",
          });
        }

        if (item?.url) {
          return res.status(200).json({
            image: item.url,
            provider: "openai",
          });
        }

        errors.push(
          "OpenAI: response received but no image returned"
        );
      } else {
        const message =
          data?.error?.message ||
          JSON.stringify(data);

        errors.push(
          `OpenAI ${response.status}: ${message}`
        );
      }
    } else {
      errors.push(
        "OpenAI: OPENAI_API_KEY missing"
      );
    }
  } catch (error) {
    errors.push(
      "OpenAI error: " + error.message
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
          Buffer
            .from(arrayBuffer)
            .toString("base64");

        return res.status(200).json({
          image:
            `data:${contentType};base64,${base64}`,
          provider: "huggingface",
        });
      }

      const errorText =
        await response.text();

      errors.push(
        `Hugging Face ${response.status}: ${errorText}`
      );
    } else {
      errors.push(
        "Hugging Face: HF_TOKEN missing"
      );
    }
  } catch (error) {
    errors.push(
      "Hugging Face error: " +
      error.message
    );
  }


  // =====================================================
  // ALL PROVIDERS FAILED
  // =====================================================

  return res.status(500).json({
    error:
      "Image generation failed on all providers.",

    details:
      errors,
  });
              }
