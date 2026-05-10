export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const body = await request.json();
    const { selectedPlaces, days, hotel, transport } = body;
    
    if (!selectedPlaces || selectedPlaces.length === 0) {
      return new Response(JSON.stringify({ error: "장소를 선택해주세요." }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const placesInfo = JSON.stringify(selectedPlaces, null, 2);
    const model = env.CF_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
    
    const prompt = `당신은 파리 전문 여행 플래너입니다. 아래의 장소 목록과 조건을 바탕으로 최적의 ${days}일 여행 일정을 짜주세요.

## 조건
- 여행 일수: ${days}일
- 숙소 위치: ${hotel}
- 선호 이동 수단: ${transport}

## 선택된 장소 목록 (JSON)
${placesInfo}

## 지침
1. **일정 구성**: 
   - 아침(09:00), 오전(11:00), 점심(13:00), 오후(15:00), 저녁(19:00) 등으로 시간을 배정하세요.
   - 하루에 3~4개의 장소를 방문하는 것이 적당합니다.
2. 장소 간 이동 시간을 고려하여 동선을 효율적으로 짜세요.
3. 식사 및 휴식 시간에는 레스토랑, 카페, 빵집을 적절히 배치하세요.
4. **추천 메뉴**: 레스토랑, 카페, 빵집의 경우 대표 메뉴 하나와 예상 가격을 \`recommended_menu\` 필드에 적어주세요.
5. **지출 계산**: 해당 일자의 모든 입장료와 추천 메뉴 가격을 합산하여 \`daily_expenses\`를 산출하세요. (환율: 1유로 = 1,500원 기준)
6. **준비물**: 뻔한 내용(수분 보충, 날씨 확인 등)은 제외하고, 장소별 특성에 따른 실무적인 준비물만 추천하세요.
7. **골든 아워(Golden Hour) 판정 및 최적화 (절대 엄격)**: 
   - 각 장소의 \`golden_hour\` 시간 범위(예: 19:00 - 21:00)와 귀하가 배치한 \`time\`(예: 12:00)을 **반드시 대조**하세요.
   - 만약 배치한 시간이 골든 아워 범위에 속하지 않는다면(예: 낮 12:00), **절대로 \`is_golden_hour\`를 true로 설정하지 마세요.** 또한 \`golden_hour_reason\`도 절대 사용하지 마세요.
   - 낮 12시에 야경을 보라는 식의 앞뒤가 맞지 않는 계획은 **치명적인 오류**로 간주합니다. 골든 아워는 오직 일몰이나 조명 쇼가 있는 저녁 시간대에만 엄격히 적용하세요.
   - 골든 아워가 아닌 시간에 방문할 경우, \`tip\` 필드에는 "낮 시간대의 한적한 분위기"와 같이 해당 시간대에 맞는 합리적이고 논리적인 이유를 적으세요.
   - **중복 제거 (매우 엄격히)**: \`golden_hour_reason\`에 포함된 정보는 \`tip\` 필드에서 완전히 제외하세요.
8. 반드시 아래 JSON 형식으로만 응답하고, 마크다운 코드 블록이나 설명 텍스트는 절대 포함하지 마세요.

## 응답 형식
{
  "title": "나만의 파리 ${days}일 여행",
  "summary": "전체 일정 한 줄 요약",
  "days": [
    {
      "day": 1,
      "theme": "이 날의 테마",
      "preparation": ["준비물1", "준비물2"],
      "daily_expenses": { "euro": 0, "krw": 0 },
      "schedule": [
        {
          "time": "09:00",
          "name": "장소명",
          "category": "관광지/레스토랑/카페/빵집/액티비티 중 하나",
          "location": "간략한 위치 설명",
          "recommended_menu": "메뉴명 (가격)",
          "tip": "활동 상세 내용 및 유용한 팁",
          "is_golden_hour": true,
          "golden_hour_reason": "여기가 왜 지금 예쁜지 설명",
          "golden_hour_alert": "골든아워를 놓쳤을 경우의 안내 텍스트 (없으면 생략)"
        }
      ]
    }
  ]
}`;

    const aiResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are a Paris travel expert. Respond ONLY with valid JSON." },
            { role: "user", content: prompt },
          ],
          max_tokens: 4096
        }),
      }
    );

    const result = await aiResponse.json();
    let rawText = result.result.response;
    
    // Simple JSON extraction
    const match = rawText.match(/(\{[\s\S]*\})/);
    if (match) {
      const plan = JSON.parse(match[1]);
      return new Response(JSON.stringify({ success: true, plan }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    throw new Error("Invalid AI response format");

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
