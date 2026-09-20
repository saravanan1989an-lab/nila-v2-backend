const SYSTEM_PROMPT =
  "You are Nila, a helpful personal AI assistant. " +
  "Reply clearly, accurately and practically. " +
  "Understand Tamil and English. " +
  "Prefer the user's language unless they ask for another language.";

function parseBody(req) {
  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  return req.body || {};
}

function getLanguage(body) {
  if (body.language === "en") return "English";
  if (body.language === "ta") return "Tamil";
  return "the user's language";
}


/* ================================
   1. OPENAI — FIRST PRIORITY
================================ */

async function askOpenAI(message, language) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY missing");
  }

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        model:
          process.env.OPENAI_MODEL ||
          "gpt-5.6-luna",

        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  SYSTEM_PROMPT +
                  ` Prefer ${language}.`
              }
            ]
          },

          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: message
              }
            ]
          }
        ]
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      "OpenAI request failed"
    );
  }

  if (
    typeof data.output_text === "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  let reply = "";

  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (!Array.isArray(item?.content)) {
        continue;
      }

      for (const part of item.content) {
        if (
          part?.type === "output_text" &&
          typeof part?.text === "string"
        ) {
          reply += part.text;
        }
      }
    }
  }

  if (!reply.trim()) {
    throw new Error(
      "OpenAI returned empty response"
    );
  }

  return reply.trim();
}


/* ================================
   2. GEMINI — SECOND PRIORITY
================================ */

async function askGemini(message, language) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY missing");
  }

  const model =
    process.env.GEMINI_MODEL ||
    "gemini-2.5-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },

      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                SYSTEM_PROMPT +
                ` Prefer ${language}.`
            }
          ]
        },

        contents: [
          {
            role: "user",
            parts: [
              {
                text: message
              }
            ]
          }
        ]
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      "Gemini request failed"
    );
  }

  const parts =
    data?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    throw new Error(
      "Gemini returned no content"
    );
  }

  const reply = parts
    .map(part => part?.text || "")
    .join("")
    .trim();

  if (!reply) {
    throw new Error(
      "Gemini returned empty response"
    );
  }

  return reply;
}


/* ================================
   3. GROQ — THIRD PRIORITY
================================ */

async function askGroq(message, language) {
  const apiKey =
    process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY missing"
    );
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        model:
          process.env.GROQ_MODEL ||
          "openai/gpt-oss-120b",

        messages: [
          {
            role: "system",
            content:
              SYSTEM_PROMPT +
              ` Prefer ${language}.`
          },

          {
            role: "user",
            content: message
          }
        ],

        temperature: 0.3
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      "Groq request failed"
    );
  }

  const reply =
    data?.choices?.[0]
      ?.message?.content?.trim();

  if (!reply) {
    throw new Error(
      "Groq returned empty response"
    );
  }

  return reply;
}


/* ================================
   4. HUGGING FACE — LAST FALLBACK
================================ */

async function askHuggingFace(
  message,
  language
) {
  const apiKey =
    process.env.HF_TOKEN ||
    process.env.HUGGINGFACE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "HF_TOKEN missing"
    );
  }

  const response = await fetch(
    "https://router.huggingface.co/v1/chat/completions",
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        model:
          process.env.HF_MODEL ||
          "openai/gpt-oss-120b:fastest",

        messages: [
          {
            role: "system",
            content:
              SYSTEM_PROMPT +
              ` Prefer ${language}.`
          },

          {
            role: "user",
            content: message
          }
        ],

        stream: false
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      "Hugging Face request failed"
    );
  }

  const reply =
    data?.choices?.[0]
      ?.message?.content?.trim();

  if (!reply) {
    throw new Error(
      "Hugging Face returned empty response"
    );
  }

  return reply;
}


/* ================================
   MAIN API HANDLER
================================ */

export default async function handler(
  req,
  res
) {

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );


  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }


  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }


  let body;

  try {
    body = parseBody(req);
  } catch (error) {
    return res.status(400).json({
      error: "Invalid JSON"
    });
  }


  const message =
    String(body.message || "").trim();

  const language =
    getLanguage(body);


  if (!message) {
    return res.status(400).json({
      error: "Message is required"
    });
  }


  const providers = [
    {
      name: "openai",
      run: askOpenAI
    },

    {
      name: "gemini",
      run: askGemini
    },

    {
      name: "groq",
      run: askGroq
    },

    {
      name: "huggingface",
      run: askHuggingFace
    }
  ];


  const failures = [];


  for (const provider of providers) {

    try {

      console.log(
        `Trying AI provider: ${provider.name}`
      );


      const reply =
        await provider.run(
          message,
          language
        );


      console.log(
        `AI success: ${provider.name}`
      );


      return res.status(200).json({

        reply: reply,

        provider:
          provider.name

      });


    } catch (error) {

      console.error(
        `${provider.name} failed:`,
        error?.message
      );


      failures.push({

        provider:
          provider.name,

        error:
          error?.message ||
          "Unknown error"

      });

    }

  }


  console.error(
    "All AI providers failed",
    failures
  );


  return res.status(503).json({

    error:
      "All AI providers are unavailable right now.",

    providersTried:
      failures.map(
        item => item.provider
      )

  });

      }
