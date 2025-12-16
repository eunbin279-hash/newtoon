// <mark>이 파일은 서버에서 실행되므로 API 키를 안전하게 Environment Variable에서 불러올 수 있습니다.</mark>
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash';

// Netlify Functions의 기본 핸들러 함수
exports.handler = async (event) => {
    // 1. 클라이언트(프런트엔드)에서 보낸 데이터를 파싱
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const body = JSON.parse(event.body);
    const prompt = body.prompt;

    if (!prompt) {
        return { statusCode: 400, body: 'Missing prompt in request body' };
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // API 키를 헤더를 통해 안전하게 전달
                    'x-goog-api-key': GEMINI_API_KEY,
                },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    // <mark>이전: config 였던 것을 generationConfig 로 변경</mark>
                    generationConfig: {
                        temperature: 0.7
                    }
                })
            }
        );

        if (!response.ok) {
            const errorBody = await response.text();
            // 서버 오류가 나면 500 에러와 함께 자세한 내용을 반환
            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: "AI API Error",
                    details: errorBody
                })
            };
        }

        const data = await response.json();
        const aiStory = data.candidates[0].content.parts[0].text;

        // 2. AI 결과를 클라이언트에게 응답
        return {
            statusCode: 200,
            body: JSON.stringify({ story: aiStory }),
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal Server Error", details: error.toString() })
        };
    }
};