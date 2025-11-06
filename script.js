// 전역 변수 및 설정
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const chatEndpoint = "https://api.openai.com/v1/chat/completions";



const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let ideaHistory = []; // 생성된 아이디어 객체를 저장할 배열
let currentIdeaIndex = -1;


const LS_KEYS = {
  apiKey: "apiKey",
  username: "USERNAME",
  project: "PROJECT_CONTEXT"
};

function saveToLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readFromLS(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

// OpenAI API 호출 함수-------------------------------------------
const callGPT = (prompt, callback) => {
  toggleLoadingSpinner(true);

    
  $.ajax({
    url: chatEndpoint,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    data: JSON.stringify({
      model: "gpt-4-turbo", 
      messages: [{ role: "user", content: prompt }],
    }),
    success: (data) => {
      toggleLoadingSpinner(false);
      if (callback) callback(data.choices[0].message.content);
    },
    error: () => {
      toggleLoadingSpinner(false);
      alert("Error occurred while calling GPT");
    },
  });
  updateQuestion(currentStep);

};

async function loadIdeasFromDB() {
  const username = readFromLS(LS_KEYS.username);
  if (!username) return;

  try {
    const ideasCol = collection(db, "ideas");
    const q = query(
      ideasCol,
      where("username", "==", username),
      orderBy("createdAt", "desc"), // 최신 아이디어가 먼저 오도록 정렬
      limit(20) // 최근 10개만 불러오는 예시
    );

    const ideasSnapshot = await getDocs(q);

    // DB에서 불러온 아이디어를 ideaHistory에 저장
    ideaHistory = ideasSnapshot.docs.map(doc => doc.data()).reverse(); // 오래된 순으로 다시 정렬
    
    if (ideaHistory.length > 0) {
      currentIdeaIndex = ideaHistory.length - 1; // 가장 최신 아이디어로 인덱스 설정
      updateMainCard(ideaHistory[currentIdeaIndex]);
      showStep('step4');
      $('.step4-btn-1, .step4-btn-2').css('display', 'block');
      $('#viewAllCards').removeClass('hidden');
      updateNavigationButtons(); // 버튼 상태 업데이트
    }
  } catch (e) {
    console.error("아이디어 불러오기 중 오류 발생:", e);
  }
}

// 💡 [수정] Firestore에 아이디어 저장 (v9 문법)
async function saveIdeaToDB(idea) {
  const username = readFromLS(LS_KEYS.username);
  if (!username) {
    console.error("사용자 이름을 찾을 수 없습니다. DB 저장을 건너뜁니다.");
    return;
  }

  const ideaData = {
    ...idea,
    username: username,
    createdAt: serverTimestamp() 
  };

  try {
    // 'ideas' 컬렉션에 새 문서를 추가 (v9 문법으로 수정)
    await addDoc(collection(db, "ideas"), ideaData);
    console.log("아이디어가 성공적으로 저장되었습니다.");
    
   const ideaWithTimestamp = {
      ...idea,
      createdAt: { seconds: Math.floor(Date.now() / 1000) } 
    }

    // DB 저장 성공 시에만 히스토리 배열에 추가
    ideaHistory.push(ideaWithTimestamp);
    currentIdeaIndex = ideaHistory.length - 1; // 가장 최신 아이디어로 인덱스 설정
    updateNavigationButtons(); // 버튼 상태 업데이트

  } catch (e) {
    console.error("아이디어 저장 중 오류 발생:", e);
    alert("아이디어 저장에 실패했습니다.");
  }
}

// 💡 [추가] 네비게이션 버튼 상태 업데이트 함수
function updateNavigationButtons() {
    $('#cardNavigation').removeClass('hidden-nav'); // 네비게이션 표시

    // 현재 인덱스가 가장 오래된(0)이면 prev 버튼 비활성화
    $('#prevCard').prop('disabled', currentIdeaIndex <= 0);
    $('#prevCard').css('opacity', currentIdeaIndex <= 0 ? 0.5 : 1);

    // 현재 인덱스가 가장 최신(length - 1)이면 next 버튼 비활성화
    $('#nextCard').prop('disabled', currentIdeaIndex >= ideaHistory.length - 1);
    $('#nextCard').css('opacity', currentIdeaIndex >= ideaHistory.length - 1 ? 0.5 : 1);
}


function showStep(stepId) {
  $('.step').addClass('hidden');
  $(`#${stepId}`).removeClass('hidden');
}
console.log("불러온 API 키:", readFromLS("apiKey"));


async function simulateGPTResponse(projectData) {
  const prompt = `
당신은 혁신적인 문제 해결을 이끄는 시니어 디자이너입니다.
디지털, 제품, 서비스, 공간, 제도 등 모든 영역에서 자유롭게 상상할 수 있다. 
아래 정보를 바탕으로 ${projectData.title}에 대한 창의적인 아이디어를 생성해주세요.
응답은 모두 **한국어**로 작성해주세요.

[배경 정보]
${projectData.background}

[예상 효과]
${projectData.expected}

[대상 사용자]
${projectData.target}

[요청 포맷]
- 제목 (한 줄)
- 한 줄 요약 (마침표 ‘.’ 기준으로 첫 번째 문장만 출력하며 반드시 줄바꿈 없이 한 문장만 생성할 것/예:
             입력: 이 앱은 약 복용을 돕는 인터페이스입니다. 사용자는 쉽게 복용 시간을 인지할 수 있습니다.
             출력: 이 앱은 약 복용을 돕는 인터페이스입니다.)
- 키워드 3개 (리스트 형태)
- 상세 아이디어 설명 (3~4문장)

→ 응답은 반드시 영어 key(JSON key)로 해줘 (title, summary, keywords, detail)

응답은 JSON 형식으로 구성해주세요.
`;

  // ✅ 프롬프트 콘솔 확인용
  console.log("[🧠 전달된 프롬프트]", prompt);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${readFromLS("apiKey")}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "당신은 창의적인 UX 디자이너입니다." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    }),
  });

  const result = await response.json();

  // ✅ GPT 응답 확인용
  console.log("[📦 GPT 응답]", result.choices?.[0]?.message?.content);

  let gptOutput = result.choices?.[0]?.message?.content;

  // ✅ JSON 파싱 전에 코드블럭 제거 (필수!)
  if (gptOutput.startsWith("```")) {
    gptOutput = gptOutput.replace(/```json\s*([\s\S]*?)\s*```/, '$1').trim();
  }

  return JSON.parse(gptOutput); // 응답을 JSON으로 파싱해서 반환
}

$(function () {
  loadIdeasFromDB();
  $('#sort-latest').addClass('active');
    $('#sort-oldest').removeClass('active');
    
  $('#toStep2').on('click', () => {
    const username = $('#username').val().trim();
    const apiKey = $('#apiKey').val().trim();
    if (!username || !apiKey) {
      alert('이름과 API Key를 입력해주세요.');
      return;
    }
    saveToLS(LS_KEYS.apiKey, apiKey);
    saveToLS(LS_KEYS.username, username);
    showStep('step2');
  });

  $('#toStep3').on('click', () => {
    const title = $('#projectTitle').val().trim();
    const background = $('#background').val().trim();
    const expected = $('#expected').val().trim();
    const target = $('#target').val().trim();

    if (!title || !background || !expected || !target) {
      alert('모든 항목을 입력해주세요.');
      return;
    }

    const project = { title, background, expected, target };
    saveToLS(LS_KEYS.project, project);

    const username = readFromLS(LS_KEYS.username);
    $('#loadingText').text(`${username}님의 아이디어 행성을 찾는 중입니다. 잠시만 기다려주세요.`);
    showStep('step3');
    

simulateGPTResponse(project).then((idea) => {
 saveIdeaToDB(idea).then(() => { 
 updateMainCard(idea); // if (ideaHistory.length > 0) {

  showStep('step4');
  $('.step4-btn-1, .step4-btn-2').css('display', 'block');
  $('#viewAllCards').removeClass('hidden');
  updateNavigationButtons();
      });
  });
 });
 

  
  $('#retry').on('click', () => {
    showStep('step2');
  });


function updateMainCard(idea) {
  $('#ideaTitle').text(idea.title);
  $('#ideaSummary').text(idea.summary);

  $('#ideaKeywords').empty();
  if (Array.isArray(idea.keywords)) {
    idea.keywords.forEach(k => $('<span>').addClass('chip').text(k).appendTo('#ideaKeywords'));
  }

  $('#ideaDetails').empty();
  if (typeof idea.detail === "string") {
    idea.detail.split('\n').forEach(d => {
      if (d.trim()) $('<li>').text(d.trim()).appendTo('#ideaDetails');
    });
  }
  // 💡 [추가] 카드 내용 업데이트 후 버튼 상태도 업데이트
  updateNavigationButtons();
}


// 💡 Firestore에 아이디어 저장
// Firestore에 데이터를 저장하고, 성공하면 history에 추가하는 함수
// async function saveIdeaToDB(idea) {
//   const username = readFromLS(LS_KEYS.username);
//   if (!username) {
//     console.error("사용자 이름을 찾을 수 없습니다. DB 저장을 건너뜁니다.");
//     return;
//   }

//   const ideaData = {
//     ...idea,
//     username: username,
//     createdAt: firebase.firestore.FieldValue.serverTimestamp()
//   };

//   try {
//     // 'ideas' 컬렉션에 새 문서를 추가
//     const docRef = await db.collection("ideas").add(ideaData);
//     console.log("아이디어가 성공적으로 저장되었습니다. ID:", docRef.id);
    
//     // DB 저장 성공 시에만 히스토리 배열에 추가
//     ideaHistory.push(idea);
//     currentIdeaIndex = ideaHistory.length - 1; // 가장 최신 아이디어로 인덱스 설정

//   } catch (e) {
//     console.error("아이디어 저장 중 오류 발생:", e);
//     alert("아이디어 저장에 실패했습니다.");
//   }
// }


// //







function animateMainCard(direction = "top") {
  const card = document.getElementById("mainCard");
  card.classList.remove("slide-from-top", "slide-from-bottom");

  void card.offsetWidth; // 강제 리플로우 트릭으로 애니메이션 재적용 가능하게 함

  if (direction === "top") {
    card.classList.add("slide-from-top");
  } else {
    card.classList.add("slide-from-bottom");
  }
}

  
  // 버튼 클릭 이벤트
$('#findNewPlanet').on('click', function () {
  $('#gpt-modal-overlay').removeClass('hidden');
  $('#gpt-question-box').removeClass('hidden');
  $('#gpt-questions').html('<div class="loading-spinner"></div>');

  //발산
  const prompt = `
## 역할 (Role)
당신은 혁신적 컨셉을 발굴하는 미래 지향적 시니어 디자이너입니다. 
디지털, 제품, 서비스, 공간, 제도 등 모든 영역에서 자유롭게 상상할 수 있습니다. 
현실적 제약은 고려하지 않고, 최대한 폭넓고 참신한 아이디어를 제안해야 합니다.
실험 데이터와 초기 아이디어를 바탕으로 발산 과정에서 아이디어를 참신하게 발전시킬 수 있는 보조 질문을 만들어야 합니다.

## 목표 (Objective)
다음 실험 평가 기준과 실험 결과, 인사이트를 기반으로 아이디어 발산에 알맞은 질문을 1개 생성하세요. 

## 실험 평가기준
-참신성: 아이디어가 얼마나 새롭거나 독특한 접근을 보여주는지를 평가하기 위한 기준입니다.
-가치성: 아이디어가 사용자에게 또는 사회문화적으로 얼마나 가치를 지니는지를 평가하기 위한 기준입니다.
-실현가능성: 아이디어가 실제로 구현될 가능성이 얼마나 있는지를 평가하기 위한 기준입니다.
-예측가능성: 아이디어가 얼마나 예상 가능한 범위 내에서 제안되었는지를 평가하기 위한 기준입니다.
-의도일치성: 아이디어가 사용자의 입력 내용과 얼마나 관련되어 있는지를 평가하기 위한 기준입니다.
-활용가능성: 아이디어가 나에게 얼마나 유용할 수 있는지를 평가하기 위한 기준입니다.
-명확성: 아이디어의 설명이 얼마나 구체적이고 이해하기 쉬운지를 평가하기 위한 기준입니다.

## 실험 데이터 (Data)
- Q1. 배경/니즈:
가치성: 4.04
명확성: 4.36
실현 가능성: 3.94
예측 가능성: 3.94
의도일치성: 4.38
창의성: 2.89
활용가능성: 3.79
Q2. 기대 효과:
가치성: 3.81
명확성: 4.11
실현 가능성: 3.53
예측 가능성: 3.74
의도일치성: 3.96
창의성: 2.91
활용가능성: 3.53
Q3. 결과물 형태:
가치성: 3.83
명확성: 4.30
실현 가능성: 3.68
예측 가능성: 3.98
의도일치성: 4.04
창의성: 3.04
활용가능성: 3.74
Q4. 필요 기술:
가치성: 3.89
명확성: 4.09
실현 가능성: 3.77
예측 가능성: 3.89
의도일치성: 3.89
창의성: 3.11
활용가능성: 3.57
Q5. 고려 사항:
가치성: 3.83
명확성: 4.11
실현 가능성: 3.57
예측 가능성: 3.68
의도일치성: 3.83
창의성: 3.19
활용가능성: 3.43

## 실험 인사이트 (Insight)
- 발산에서는 고려사항(Q5)이 본질적으로 문제를 꼬이게 만드는 요소라서 이를 해결하려는 시도가 참신하다고 보아서 고려사항에 대한 질문이 아이디어 발산에 도움이 될 것이다.
- 고려사항(Q5)은 실현 과정에서 고려를 해야할 조건으로 비용과 시간, 인력, 환경적 제약 등 아이디어를 생성할 때 필요한 고려사항이다.

## 출력 형식 (Output Format)
아이디어를 참신하게 발전시킬 수 있도록, 비용, 시간, 인력, 환경 외에도 다양한 각도에서 질문을 확장해야 합니다.
예를 들어 “무엇을 줄이면 좋을까요?”, “이 아이디어가 실패한다면 이유는 무엇일까요?”처럼 간접적 또는 전환적 사고를 
유도하는 질문도 허용되며 필요한 비용과 시간, 인력, 환경 등 구체적인 자원 제약을 중심으로 한 질문도 허용됩니다.

하나의 주제(예: 고려사항)에 대해서도 다양한 방향성의 질문이 생성될 수 있도록 해주세요.
위 정보를 바탕으로 발산 과정에서 고려사항에 해당하는 질문 한개를 생성하세요.
질문은 사용자의 디자인 과제를 명확히 하되 구체화할 수 있는 여지를 남기며 바로 이해할 수 있도록 직관적으로 작성하세요.
`;

  const apiKey = readFromLS("apiKey"); // 저장된 키 불러오기

  $.ajax({
    url: "https://api.openai.com/v1/chat/completions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    data: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
    success: function (res) {
      const content = res.choices[0].message.content;
      const questions = content.split("\n").filter((line) => line.trim() !== "");

      let html = "<h3>GPT가 제안한 질문들 👇</h3><ul>";
      questions.forEach((q) => {
        html += `<li>${q}</li>`;
      });
      html += "</ul>";

      $('#gpt-questions').html(html);
    },
    error: function (err) {
      $('#gpt-questions').html("<p style='color:red;'>질문을 불러오는 데 실패했어요. API 키 확인해줘!</p>");
      console.error(err);
    },
  });
  
$("#submit-idea").off("click").one("click", async function () {
  const userInput = $("#user-response").val().trim();
  if (!userInput) return alert("응답을 입력해주세요!");

  $('#gpt-question-box').addClass('hidden');  // 질문창 숨기기
$('#gpt-loading').css('display', 'flex');

  const lastQuestion = localStorage.getItem("lastGPTQuestion") || "(질문 없음)";
  const projectData = readFromLS(LS_KEYS.project);

  const prompt = `
## 역할 (Role)
당신은 혁신적 컨셉을 발굴하는 미래 지향적 시니어 디자이너입니다.
디지털, 제품, 서비스, 공간, 제도 등 모든 영역에서 자유롭게 상상할 수 있으며 최대한 폭넓고 참신한 아이디어를 제안해야 합니다.
아이디어 배경 정보와 GPT가 사용자에게 한 질문, 사용자의 응답을 바탕으로 발산 과정에서 아이디어를 참신하게 발전시킬 수 있는 아이디어를 생성해야 합니다.

## 목표 (Objective)
아래의 아이디어 배경 정보와 GPT가 사용자에게 한 질문, 사용자의 응답을 바탕으로 사용자의 응답을 반영한 새로운 아이디어를 생성하십시오. 발산적 사고를 기반으로 폭넓고, 참신한 아이디어를 제안하는 것이 목표입니다.

## 아이디어 배경 정보
[배경 정보]
${projectData.background}

[예상 효과]
${projectData.expected}

[대상 사용자]
${projectData.target}

## GPT가 사용자에게 한 질문
- 질문: ${lastQuestion}

## 사용자의 응답
- 응답: ${userInput}

## 출력 형식 (Output Format)
다음의 조건을 충족하는 아이디어 1개를 작성하십시오:
- 발산적 관점으로 참신한 방향 제시
- 사용자의 응답이 반영되어야 함
- 아이디어 배경 정보와 GPT가 사용자에게 한 질문, 사용자의 응답에서의 내용 고려
응답은 모두 **한국어**로 작성해주세요.

[요청 포맷]
- 제목 (한 줄)
- 한 줄 요약 (마침표 ‘.’ 기준으로 첫 번째 문장만 출력하며 반드시 줄바꿈 없이 한 문장만 생성할 것/예:
             입력: 이 앱은 약 복용을 돕는 인터페이스입니다. 사용자는 쉽게 복용 시간을 인지할 수 있습니다.
             출력: 이 앱은 약 복용을 돕는 인터페이스입니다.)
- 키워드 3개 (리스트 형태)
- 상세 아이디어 설명 (3~4문장)

→ 응답은 반드시 영어 key(JSON key)로 해줘 (title, summary, keywords, detail)

응답은 JSON 형식으로 구성해주세요.
`;

try {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${readFromLS("apiKey")}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });


  
  const result = await response.json();
  let output = result.choices?.[0]?.message?.content;

  if (output.startsWith("```")) {
    output = output.replace(/```json\s*([\s\S]*?)\s*```/, '$1').trim();
  }

  const card = document.createElement("div");
card.className = "idea-card"; // 이거 누락되면 스타일 안 먹음


const idea = JSON.parse(output);

await saveIdeaToDB(idea);

updateMainCard(idea);
$("#user-response").val('');
$('#gpt-loading').css('display', 'none');
$('#gpt-modal-overlay').addClass('hidden');
 animateMainCard("top");

} catch (err) {
  console.error(err);
}
});
});

// 닫기 버튼
$('#close-question-box').on('click', function () {
  $('#gpt-modal-overlay').addClass('hidden');
});


//수렴 아이디어

$('#exploreMore').on('click', function () {
  $('#gpt-modal-overlay').removeClass('hidden');
  $('#gpt-question-box').removeClass('hidden');
  $('#gpt-questions').html('<div class="loading-spinner"></div>');

  const prompt = `
## 역할 (Role)
당신은 다양한 아이디어를 구조화하고 핵심을 도출하는 데 능숙한 시니어 디자이너입니다.  
디지털, 제품, 서비스, 공간, 제도 등 모든 영역에서 제안된 아이디어들을 현실적이고 구체적인 방향으로 정리하고 구체화할 수 있습니다.  
실험 평가기준과 실험 데이터와 초기 아이디어를 바탕으로 가장 실현 가능성이 높고 가치 있는 아이디어를 구체화하거나 개선할 수 있는 보조 질문을 만들어야 합니다.

## 목표 (Objective)
다음 실험 평가 기준과 실험 결과, 인사이트를 기반으로 아이디어 발산에 알맞은 질문을 1개 생성하세요.

## 실험 평가기준
-참신성: 아이디어가 얼마나 새롭거나 독특한 접근을 보여주는지를 평가하기 위한 기준입니다.
-가치성: 아이디어가 사용자에게 또는 사회문화적으로 얼마나 가치를 지니는지를 평가하기 위한 기준입니다.
-실현가능성: 아이디어가 실제로 구현될 가능성이 얼마나 있는지를 평가하기 위한 기준입니다.
-예측가능성: 아이디어가 얼마나 예상 가능한 범위 내에서 제안되었는지를 평가하기 위한 기준입니다.
-의도일치성: 아이디어가 사용자의 입력 내용과 얼마나 관련되어 있는지를 평가하기 위한 기준입니다.
-활용가능성: 아이디어가 나에게 얼마나 유용할 수 있는지를 평가하기 위한 기준입니다.
-명확성: 아이디어의 설명이 얼마나 구체적이고 이해하기 쉬운지를 평가하기 위한 기준입니다.


## 실험 데이터 (Data)
- Q1. 배경/니즈:
가치성: 4.04
명확성: 4.36
실현 가능성: 3.94
예측 가능성: 3.94
의도일치성: 4.38
창의성: 2.89
활용가능성: 3.79
Q2. 기대 효과:
가치성: 3.81
명확성: 4.11
실현 가능성: 3.53
예측 가능성: 3.74
의도일치성: 3.96
창의성: 2.91
활용가능성: 3.53
Q3. 결과물 형태:
가치성: 3.83
명확성: 4.30
실현 가능성: 3.68
예측 가능성: 3.98
의도일치성: 4.04
창의성: 3.04
활용가능성: 3.74
Q4. 필요 기술:
가치성: 3.89
명확성: 4.09
실현 가능성: 3.77
예측 가능성: 3.89
의도일치성: 3.89
창의성: 3.11
활용가능성: 3.57
Q5. 고려 사항:
가치성: 3.83
명확성: 4.11
실현 가능성: 3.57
예측 가능성: 3.68
의도일치성: 3.83
창의성: 3.19
활용가능성: 3.43

## 실험 인사이트 (Insight)
- 수렴에서는 결과물 형태(Q3)가 구체적으로 제시될 경우, 아이디어를 구체화시키는데 도움이 된다.
- 수렴에서는 필요 기술(Q4)을 제시하면 현실적인 제안이 생성되므로 사용자가 원하는 방향성으로 아이디어를 구체화해준다.
- 결과물 형태(Q3)는 아이디어의 최종 결과물은 어떤 형태로 제공되는지에 대한 질문이였으며 제품, 서비스, 시스템 등 결과물이 어떤 모습인지에 대한 내용이다.
- 필요 기술(Q4)은 이 아이디어를 구현하기 위해 필요한 핵심 기술에 대한 질문이였으며 개발이나 제작 과정에 활용될 기술이나 도구, 방법론 등에 대한 내용이다.

## 출력 형식 (Output Format)
위 정보를 바탕으로 수렴 과정에서 고려사항에 해당하는 질문 한개를 생성하세요.
질문에는 인사이트에 포함되었던 질문번호(Q3, Q4)는 포함되지 않아야 합니다.
수렴 단계에서는 창의적인 확산보다 아이디어를 구체적이고 실행 가능한 방향으로 정제하는 것이 중요합니다.
따라서 질문은 사용자의 디자인 과제를 명확히 구체화할 수 있도록 작성하되,
세부 아이디어를 자유롭게 발전시킬 여지를 일부 남기는 형태로 구성하세요

`;

  const apiKey = readFromLS("apiKey");

  $.ajax({
    url: "https://api.openai.com/v1/chat/completions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    data: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
    success: function (res) {
      const content = res.choices[0].message.content;
      const questions = content.split("\n").filter((line) => line.trim() !== "");

      let html = "<h3>GPT가 제안한 수렴형 질문 👇</h3><ul>";
      questions.forEach((q) => {
        html += `<li>${q}</li>`;
      });
      html += "</ul>";

      $('#gpt-questions').html(html);
    },
    error: function (err) {
      $('#gpt-questions').html("<p style='color:red;'>질문을 불러오는 데 실패했어요. API 키 확인해줘!</p>");
      console.error(err);
    },
  });



  $("#submit-idea").off("click").one("click", async function () {
  const userInput = $("#user-response").val().trim();
  if (!userInput) return alert("응답을 입력해주세요!");

  $('#gpt-question-box').addClass('hidden');  // 질문창 숨기기
$('#gpt-loading').css('display', 'flex');

  const lastQuestion = localStorage.getItem("lastGPTQuestion") || "(질문 없음)";
  const projectData = readFromLS(LS_KEYS.project);

  const prompt = `
## 역할 (Role)
당신은 다양한 아이디어를 구조화하고 핵심을 도출하는 데 능숙한 시니어 디자이너입니다.  
디지털, 제품, 서비스, 공간, 제도 등 모든 영역에서 제안된 아이디어들을 현실적이고 구체적인 방향으로 정리하고 구체화할 수 있습니다.  
아이디어 배경 정보와 GPT가 사용자에게 한 질문, 사용자의 응답을 바탕으로 발산 과정에서  가장 실현 가능성이 높고 가치 있는 아이디어를 구체화하거나 개선할 수 있는 아이디어를 생성해야 합니다.

## 목표 (Objective)
아래의 아이디어 배경 정보와 GPT가 사용자에게 한 질문, 사용자의 응답을 바탕으로 사용자의 응답을 반영한 구체적인 아이디어를 생성하십시오. 수렴적 사고를 기반으로 구체적이고 실현가능한 아이디어를 제안하는 것이 목표입니다.

## 아이디어 배경 정보
[배경 정보]
${projectData.background}

[예상 효과]
${projectData.expected}

[대상 사용자]
${projectData.target}

## GPT가 사용자에게 한 질문
- 질문: ${lastQuestion}

## 사용자의 응답
- 응답: ${userInput}

## 출력 형식 (Output Format)
다음의 조건을 충족하는 아이디어 1개를 작성하십시오:
- 수렴적 관점으로 실현 가능한 방향 제시
- 사용자의 응답이 반영되어야 함
- 아이디어 배경 정보와 GPT가 사용자에게 한 질문, 사용자의 응답에서의 내용 고려
응답은 모두 **한국어**로 작성해주세요.

[요청 포맷]
- 제목 (한 줄)
- 한 줄 요약 (마침표 ‘.’ 기준으로 첫 번째 문장만 출력하며 반드시 줄바꿈 없이 한 문장만 생성할 것/예:
             입력: 이 앱은 약 복용을 돕는 인터페이스입니다. 사용자는 쉽게 복용 시간을 인지할 수 있습니다.
             출력: 이 앱은 약 복용을 돕는 인터페이스입니다.)
- 키워드 3개 (리스트 형태)
- 상세 아이디어 설명

→ 응답은 반드시 영어 key(JSON key)로 해줘 (title, summary, keywords, detail)

응답은 JSON 형식으로 구성해주세요.
`;

try {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${readFromLS("apiKey")}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });


  
  const result = await response.json();
  let output = result.choices?.[0]?.message?.content;

  if (output.startsWith("```")) {
    output = output.replace(/```json\s*([\s\S]*?)\s*```/, '$1').trim();
  }

  const card = document.createElement("div");
card.className = "idea-card"; // 이거 누락되면 스타일 안 먹음


const idea = JSON.parse(output);
await saveIdeaToDB(idea);

updateMainCard(idea);
$("#user-response").val('');
$('#gpt-loading').css('display', 'none');
$('#gpt-modal-overlay').addClass('hidden');
animateMainCard("bottom");

 



  $("#user-response").val('');
} catch (err) {
  console.error(err);
}
});
});



// 💡 [수정] 이전/다음 카드 버튼 클릭 이벤트 핸들러
$('#prevCard').on('click', () => {
  // '이전' 카드 (시간상 오래된 카드) = 인덱스 감소
  if (currentIdeaIndex > 0) {
    currentIdeaIndex--;
    updateMainCard(ideaHistory[currentIdeaIndex]);
    // 💡 [수정] 이전 카드 (오래된 것)을 볼 때의 애니메이션: 아래에서 올라오게
    animateMainCard("bottom"); 
  } else {
    alert("가장 오래된 아이디어입니다.");
  }
});

$('#nextCard').on('click', () => {
  // '다음' 카드 (시간상 최신 카드) = 인덱스 증가
  if (currentIdeaIndex < ideaHistory.length - 1) {
    currentIdeaIndex++;
    updateMainCard(ideaHistory[currentIdeaIndex]);
    // 💡 [수정] 다음 카드 (최신 것)을 볼 때의 애니메이션: 위에서 내려오게
    animateMainCard("top");
  } else {
    alert("가장 최신 아이디어입니다.");
  }
});



$('#viewAllCards').on('click', function() {
    // 1. 모달 표시
    $('#history-modal-overlay').removeClass('hidden');
  renderHistoryCards();
    // 2. 기존 목록 비우기
    $('#historyCardList').empty();

    // 3. 아이디어 히스토리 배열을 순회하며 카드 생성 및 추가
    if (ideaHistory.length === 0) {
        $('#historyCardList').html('<p style="text-align: center; color: #a0a0a0; font-size: 16px;">아직 생성된 아이디어가 없습니다.</p>');
        return;
    }

  
ideaHistory.forEach((idea, index) => {
    const cardHtml = `
        <div class="idea-card">
            <h2>${idea.title}</h2>
            <p class="summary">${idea.summary}</p>
            <div class="keywords">
                ${Array.isArray(idea.keywords) ? idea.keywords.map(k => `<span class="chip">${k}</span>`).join('') : ''}
            </div>
            <ul>
                ${typeof idea.detail === "string" ? idea.detail.split('\n').filter(d => d.trim()).map(d => `<li>${d.trim()}</li>`).join('') : ''}
            </ul>
        </div>
    `;
    $('#historyCardList').append(cardHtml);
});


});

$('#sort-latest').on('click', function () {
  $(this).addClass('active');
  $('#sort-oldest').removeClass('active');
  ideaHistory = [...ideaHistory].sort((a, b) =>
    (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
  );
  renderHistoryCards();
});

$('#sort-oldest').on('click', function () {
  $(this).addClass('active');
  $('#sort-latest').removeClass('active');
  ideaHistory = [...ideaHistory].sort((a, b) =>
    (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
  );
  renderHistoryCards();
});

// 💡 [추가] 히스토리 모달 닫기 버튼 이벤트 핸들러'.step4-btn-1, .step4-btn-2
$('#close-history-box').on('click', function() {
    $('#history-modal-overlay').addClass('hidden');
});

});

function renderHistoryCards() {
  $('#historyCardList').empty();

  if (ideaHistory.length === 0) {
    $('#historyCardList').html('<p style="text-align: center; color: #a0a0a0; font-size: 16px;">아직 생성된 아이디어가 없습니다.</p>');
    return;
  }

  ideaHistory.forEach((idea) => {
    const cardHtml = `
      <div class="idea-card">
        <h2>${idea.title}</h2>
        <p class="summary">${idea.summary}</p>
        <div class="keywords">
          ${Array.isArray(idea.keywords) ? idea.keywords.map(k => `<span class="chip">${k}</span>`).join('') : ''}
        </div>
        <ul>
          ${typeof idea.detail === "string" ? idea.detail.split('\n').filter(d => d.trim()).map(d => `<li>${d.trim()}</li>`).join('') : ''}
        </ul>
      </div>
    `;
    $('#historyCardList').append(cardHtml);
  });
}


//async loadIdeasFromDB();


