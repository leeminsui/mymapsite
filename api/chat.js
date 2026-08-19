/* ============================================================
   Vercel Serverless Function — Gemini 프록시
   경로: /api/chat
   ------------------------------------------------------------
   ⚠️ 이 파일에 키를 쓰지 마세요.
      Vercel 대시보드 → Settings → Environment Variables 에
      이름 GEMINI_KEY 로 저장합니다.
   ============================================================ */

const MODEL = "gemini-3.5-flash-lite";   // 404 시 "gemini-3.6-flash"

export default async function handler(req, res) {
  // 상태 확인용 (브라우저에서 /api/chat 직접 열기)
  if (req.method === "GET") {
    return res.status(200).json({
      status: "✅ 프록시 정상 동작",
      GEMINI_KEY: process.env.GEMINI_KEY ? "설정됨" : "❌ 없음 — 환경변수를 GEMINI_KEY 로 만드세요",
      model: MODEL,
      region: process.env.VERCEL_REGION || "unknown"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 허용됩니다" });
  }

  if (!process.env.GEMINI_KEY) {
    return res.status(500).json({
      error: "GEMINI_KEY 환경변수가 없습니다. Vercel → Settings → Environment Variables 에서 추가하세요."
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // 대화 기록 제한
    if (Array.isArray(body.contents) && body.contents.length > 20) {
      body.contents = body.contents.slice(-20);
    }
    // 최신 모델 미지원 파라미터 제거
    const gc = { ...(body.generationConfig || {}) };
    delete gc.temperature; delete gc.topP; delete gc.topK;
    gc.maxOutputTokens = 2048;
    body.generationConfig = gc;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_KEY}`;
    const opts = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    };

    // 붐빌 때 재시도
    let up, text;
    for (let i = 0; i < 3; i++) {
      up = await fetch(url, opts);
      text = await up.text();
      if (up.status !== 429 && up.status !== 503) break;
      if (i < 2) await new Promise(r => setTimeout(r, 900 * (i + 1)));
    }

    res.setHeader("Content-Type", "application/json");
    return res.status(up.status).send(text);

  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
