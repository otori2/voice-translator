import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OpenAI APIキーが設定されていません。' }, { status: 500 });
  }

  const { text } = await req.json();
  if (!text) {
    return NextResponse.json({ error: '翻訳するテキストがありません。' }, { status: 400 });
  }

  const input = `あなたは優秀な英日翻訳者です。与えられた英語テキストを自然な日本語に翻訳してください。\n\n${text}`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error }, { status: 500 });
  }

  const data = await response.json();
  // output_textがあればそれを、なければoutput[0].content[0].textを使う
  const translation = data.output_text || (Array.isArray(data.output) && data.output[0]?.content?.[0]?.text) || '';
  return NextResponse.json({ translation });
}
