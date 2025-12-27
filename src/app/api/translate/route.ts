import translate from "@iamtraction/google-translate";
import { NextRequest, NextResponse } from "next/server";

type TranslationEngine = "openai" | "google" | "ollama";

// 設定の型定義
interface OpenAIConfig {
  apiKey: string;
  endpoint: string;
  modelName: string;
}

interface OllamaConfig {
  endpoint: string;
  modelName: string;
  apiKey?: string;
}

async function translateWithOpenAI(text: string, config?: OpenAIConfig) {
  // 設定の優先順位: フロントエンド設定 > 環境変数 > デフォルト値
  const apiKey =
    config?.apiKey ||
    process.env.TRANSLATE_OPENAI_API_KEY ||
    process.env.NEXT_PUBLIC_TRANSLATE_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY;
  const endpoint =
    config?.endpoint ||
    process.env.TRANSLATE_OPENAI_ENDPOINT ||
    process.env.NEXT_PUBLIC_TRANSLATE_OPENAI_ENDPOINT ||
    process.env.ENDPOINT ||
    "https://api.openai.com";
  const model =
    config?.modelName ||
    process.env.TRANSLATE_OPENAI_MODEL_NAME ||
    process.env.NEXT_PUBLIC_TRANSLATE_OPENAI_MODEL_NAME ||
    process.env.MODEL_NAME ||
    "gpt-5-nano";
  
  if (!apiKey) {
    throw new Error("OpenAI APIキーが設定されていません。");
  }

  const input = `あなたは優秀な英日翻訳者です。与えられた英語テキストを自然な日本語に翻訳してください。翻訳された日本語以外は出力しないでください。\n\n${text}`;

  let response: Response;
  try {
    response = await fetch(`${endpoint}/v1/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input,
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OpenAI互換API呼び出しに失敗しました。";
    throw new Error(msg);
  }

  const textResp = await response.text();

  if (!response.ok) {
    throw new Error(`OpenAI APIエラー: ${textResp}`);
  }

  let data: unknown = {};
  try {
    data = JSON.parse(textResp);
  } catch {
    throw new Error(`OpenAIレスポンスのJSON解析に失敗: ${textResp}`);
  }

  const parsed = data as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  return parsed.output_text || (Array.isArray(parsed.output) && parsed.output[0]?.content?.[0]?.text) || '';
}

async function translateWithOllama(text: string, config?: OllamaConfig) {
  const endpoint = config?.endpoint || process.env.OLLAMA_ENDPOINT || "http://localhost:11434";
  const model = config?.modelName || process.env.OLLAMA_MODEL_NAME || "llama3.1:8b";
  const apiKey = config?.apiKey || process.env.OLLAMA_API_KEY; // 任意

  const prompt = `You are a skilled English to Japanese translator. Translate the following English text into natural Japanese.\n\n${text}`;

  let response: Response;
  try {
    response = await fetch(`${endpoint}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ollama API呼び出しに失敗しました。";
    throw new Error(msg);
  }

  const textResp = await response.text();

  if (!response.ok) {
    throw new Error(`Ollama APIエラー: ${textResp}`);
  }

  let data: unknown = {};
  try {
    data = JSON.parse(textResp) as { response?: string; output?: string };
  } catch {
    throw new Error(`OllamaレスポンスのJSON解析に失敗: ${textResp}`);
  }
  const parsed = data as { response?: string; output?: string };
  return parsed.response || parsed.output || "";
}

async function translateWithGoogle(text: string) {
  const res = await translate(text, { from: "en", to: "ja" });
  return res.text;
}

export async function POST(req: NextRequest) {
  try {
    const { text, engine = "openai", openaiConfig, ollamaConfig } = (await req.json()) as {
      text: string;
      engine?: TranslationEngine;
      openaiConfig?: OpenAIConfig;
      ollamaConfig?: OllamaConfig;
    };

    if (!text) {
      return NextResponse.json(
        { error: "翻訳するテキストがありません。" },
        { status: 400 },
      );
    }

    let translation = "";
    if (engine === "google") {
      translation = await translateWithGoogle(text);
    } else if (engine === "ollama") {
      translation = await translateWithOllama(text, ollamaConfig);
    } else {
      translation = await translateWithOpenAI(text, openaiConfig);
    }

    return NextResponse.json({ translation });
  } catch (e) {
    const message = e instanceof Error ? e.message : "翻訳中に不明なエラーが発生しました。";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
