// 보험처리 · 자비처리 손익 판정기.
//
// 사고가 나면 다들 같은 걸 묻는다. "보험으로 할까 그냥 내 돈으로 낼까."
// 계산기는 없고 설명 글만 있는데, 전부 "3년 할증분과 수리비를 비교하세요"
// 라고만 하고 그 비교를 대신 해주지 않는다.
//
// 만들면서 알게 된 것이 하나 있다. 계산해 보면 등급 할증만으로는
// 웬만해선 보험처리가 이긴다. "소액 사고는 자비가 낫다"는 통념은
// 등급 할증이 아니라 사고건수 요율과 무사고 할인 소멸에서 나온다.
// 그런데 이 둘은 공개된 수치가 없다. 보험사 내부 요율이다.
//
// 그래서 길을 둘로 냈다.
//   정확한 길   보험사에 갱신 보험료를 물어 그 숫자를 넣는다. 세 요인이
//               한꺼번에 반영되므로 계산이 정확해진다. 전화 한 통이면 된다.
//   대략의 길   안 물어봤으면 등급 할증만 7~12% 로 잡아 범위로 보여주고,
//               빠진 것이 무엇인지 명시한다. 결과는 보험처리 쪽에 유리하게
//               기운 값이라는 것까지 적는다.
//
// 근거: 자동차보험 표준약관, 보험개발원 할인할증 제도

(function () {
  "use strict";

  // ── 기준값 ────────────────────────────────────────────────

  // 물적사고 할증기준금액. 가입할 때 고른 값이고 증권에 적혀 있다.
  // 최소 자기부담금은 이 금액의 10% 로 붙는다.
  var MIN_RATIO = 0.1;
  var MAX_DEDUCT = 500000;      // 최대 자기부담금은 기준금액과 무관하게 50만원

  // 사고점수 1점 = 1등급 하락. 1등급당 인상폭은 보험사마다 달라 범위로 쓴다.
  var SURCHARGE_LOW = 0.07;
  var SURCHARGE_HIGH = 0.12;
  var YEARS = 3;

  // ── 계산 ──────────────────────────────────────────────────

  // 자기부담금 = 손해액 × 정률, 단 최소·최대 사이로 자른다.
  function deductible(loss, rate, threshold) {
    var min = Math.round(threshold * MIN_RATIO);
    return Math.min(Math.max(loss * rate, min), MAX_DEDUCT);
  }

  // 3년간 늘어나는 보험료.
  //   갱신 보험료를 알면 그 차액이 답이다. 등급 할증·사고건수 요율·
  //   할인 소멸이 이미 다 들어 있는 숫자다.
  //   모르면 등급 할증만 추정한다. 할증기준금액 이하면 등급이 안 떨어지니 0 이다.
  function extraPremium(loss, threshold, premium, renewal, surchargeRate) {
    if (renewal > 0) return Math.max(0, renewal - premium) * YEARS;
    return loss > threshold ? premium * surchargeRate * YEARS : 0;
  }

  function insuredCost(loss, rate, threshold, premium, renewal, surchargeRate) {
    var d = deductible(loss, rate, threshold);
    var extra = extraPremium(loss, threshold, premium, renewal, surchargeRate);
    return { deductible: d, over: loss > threshold, extra: extra, total: d + extra };
  }

  // 손익분기 수리비. 이 아래면 자비, 위면 보험이 싸다.
  // 할증이 기준금액에서 계단으로 뛰고 자기부담금도 50만원에서 막혀
  // 식을 풀면 구간마다 답이 갈린다. 1만원 단위로 훑는 편이 틀릴 여지가 없다.
  function breakEven(rate, threshold, premium, renewal, surchargeRate) {
    for (var loss = 10000; loss <= 100000000; loss += 10000) {
      var ins = insuredCost(loss, rate, threshold, premium, renewal, surchargeRate);
      if (ins.total < loss) return loss;
    }
    return null;
  }

  function calculate(i) {
    var known = i.renewal > 0;
    var low = insuredCost(i.loss, i.rate, i.threshold, i.premium, i.renewal, SURCHARGE_LOW);
    var high = insuredCost(i.loss, i.rate, i.threshold, i.premium, i.renewal, SURCHARGE_HIGH);

    var verdict;
    if (known) {
      // 갱신 보험료를 알면 범위가 없다. 한 값으로 갈린다.
      verdict = low.total < i.loss ? "insurance" : "self";
    } else if (!low.over) {
      // 등급 할증이 없는 구간. 사고건수 요율과 할인 소멸이 빠져 있어
      // 표면상 보험이 싸 보여도 승자를 단정하면 안 된다.
      verdict = "under";
    } else if (high.total < i.loss) verdict = "insurance";
    else if (low.total > i.loss) verdict = "self";
    else verdict = "close";

    return {
      loss: i.loss, premium: i.premium, renewal: i.renewal,
      threshold: i.threshold, rate: i.rate, known: known,
      deductible: low.deductible,
      over: low.over,
      extraLow: low.extra, extraHigh: high.extra,
      insuredLow: low.total, insuredHigh: high.total,
      gap: i.loss - low.total,
      verdict: verdict,
      breakEvenLow: breakEven(i.rate, i.threshold, i.premium, i.renewal, SURCHARGE_LOW),
      breakEvenHigh: breakEven(i.rate, i.threshold, i.premium, i.renewal, SURCHARGE_HIGH),
    };
  }

  // ── 화면 ──────────────────────────────────────────────────

  function won(n) { return Math.round(n).toLocaleString("ko-KR") + "원"; }

  function render(r) {
    var box = document.getElementById("calc-result");
    var html = "";

    html += '<p class="calc-label">수리비 ' + won(r.loss) + " · 연 보험료 " + won(r.premium) +
            (r.known ? " → 갱신 " + won(r.renewal) : "") + "</p>";

    if (r.verdict === "under") {
      html += '<p class="calc-amount none">등급 할증은 없는 사고입니다</p>';
      html += '<p class="calc-sub">다만 빠진 항목이 있어 한쪽을 못 정합니다</p>';
    } else if (r.verdict === "insurance") {
      html += '<p class="calc-amount">보험처리가 유리합니다</p>';
      html += '<p class="calc-sub">' + (r.known ? "갱신 보험료를 반영한 결과입니다" : "3년 할증을 12%로 잡아도 자비보다 쌉니다") + "</p>";
    } else if (r.verdict === "self") {
      html += '<p class="calc-amount none">자비처리가 유리합니다</p>';
      html += '<p class="calc-sub">' + (r.known ? "갱신 보험료를 반영한 결과입니다" : "3년 할증을 7%로 잡아도 자비보다 비쌉니다") + "</p>";
    } else {
      html += '<p class="calc-amount none">갈리는 구간입니다</p>';
      html += '<p class="calc-sub">할증폭이 얼마로 잡히느냐에 따라 뒤집힙니다</p>';
    }

    html += '<div class="calc-breakdown"><h4>3년 총부담 비교</h4><ul>';
    html += '<li><span class="bd-label">자비처리</span><span class="bd-value">' + won(r.loss) +
            '</span><span class="bd-note">수리비 전액. 보험료는 그대로입니다</span></li>';
    html += '<li><span class="bd-label">보험처리 · 자기부담금</span><span class="bd-value">' + won(r.deductible) +
            '</span><span class="bd-note">수리비의 ' + Math.round(r.rate * 100) + "% (최소 " +
            won(r.threshold * MIN_RATIO) + " · 최대 " + won(MAX_DEDUCT) + ")</span></li>";

    if (r.known) {
      html += '<li><span class="bd-label">보험처리 · 3년 보험료 증가</span><span class="bd-value">' +
              won(r.extraLow) + '</span><span class="bd-note">갱신 보험료와의 차이 ' +
              won(r.renewal - r.premium) + " × 3년. 등급 할증·사고건수 요율·할인 소멸이 모두 들어 있습니다</span></li>";
    } else if (r.over) {
      html += '<li><span class="bd-label">보험처리 · 3년 등급 할증</span><span class="bd-value">' +
              won(r.extraLow) + " ~ " + won(r.extraHigh) +
              '</span><span class="bd-note">할증기준금액 ' + won(r.threshold) +
              " 를 넘어 1등급 떨어집니다. 1등급당 7~12%, 3년 유지</span></li>";
    } else {
      html += '<li><span class="bd-label">보험처리 · 3년 등급 할증</span><span class="bd-value">0원</span>' +
              '<span class="bd-note">할증기준금액 ' + won(r.threshold) +
              " 이하라 등급은 안 떨어집니다. 다만 아래를 보세요</span></li>";
    }
    html += '<li><span class="bd-label">보험처리 합계</span><span class="bd-value"><strong>' +
            won(r.insuredLow) + (!r.known && r.over ? " ~ " + won(r.insuredHigh) : "") +
            '</strong></span></li>';
    html += "</ul></div>";

    html += '<ul class="calc-notes">';

    if (!r.known) {
      html += "<li><strong>정확히 알고 싶으면 보험사에 전화 한 통이면 됩니다.</strong> " +
              "\"이 사고로 처리하면 내년 갱신 보험료가 얼마가 되느냐\"고 물어보세요. " +
              "그 숫자를 위 칸에 넣으면 아래에서 빠진 것들이 한꺼번에 반영돼 계산이 정확해집니다</li>";
      html += "<li><strong>지금 빠져 있는 것 둘.</strong> 사고건수 요율(할증기준금액 이하 사고도 '사고 1건'으로 기록됩니다)과 " +
              "무사고 할인 소멸(3년 이상 무사고면 15~20% 할인을 받고 있는 경우가 많습니다)입니다. " +
              "보험사 내부 요율이라 공개된 수치가 없어 넣지 못했습니다. " +
              "<strong>둘 다 자비처리 쪽에 유리하게 작용하므로, 위 결과는 보험처리를 실제보다 좋게 보여주고 있습니다</strong></li>";
      html += "<li>계산해 보면 등급 할증만으로는 웬만해선 보험처리가 이깁니다. " +
              "그런데도 \"소액 사고는 자비가 낫다\"는 말이 도는 이유가 방금 그 두 가지입니다</li>";
    }

    if (!r.over && !r.known) {
      html += "<li>표면상으로는 보험처리가 " + won(Math.max(0, r.gap)) +
              " 싸 보입니다. 위 두 가지를 더하면 뒤집힐 수 있는 차이입니다</li>";
    }

    if (r.breakEvenLow) {
      var be = r.breakEvenLow === r.breakEvenHigh
        ? won(r.breakEvenLow)
        : won(r.breakEvenLow) + " ~ " + won(r.breakEvenHigh);
      html += "<li>이 조건에서 손익분기 수리비는 <strong>" + be + "</strong> 입니다" +
              (r.known ? "" : " (등급 할증만 반영한 값입니다)") + "</li>";
    }

    html += "<li>할증은 <strong>3년</strong> 갑니다. 첫 해만 오르는 게 아니라 갱신할 때마다 3년 동안 반영됩니다</li>";
    html += "<li>물적사고 할증기준금액은 가입할 때 고른 값입니다. 보험증권이나 보험사 앱에서 확인하실 수 있습니다</li>";
    html += "<li>보험처리한 뒤에도 보험금을 돌려주면 사고 기록을 없애는 <strong>환입 제도</strong>가 있습니다. 갱신 안내를 받고 나서 후회될 때 쓰는 장치입니다</li>";
    html += "<li>대인사고(사람이 다친 사고)는 점수 체계가 완전히 다릅니다. 이 도구는 <strong>물적사고 전용</strong>입니다</li>";
    html += "</ul>";

    html += '<div class="calc-actions">';
    html += '<a class="calc-btn primary" href="https://kidi.or.kr" target="_blank" rel="noopener">보험개발원에서 내 사고이력 조회</a>';
    html += "</div>";

    html += '<div class="calc-share">';
    html += '<span class="calc-share-label">결과 공유하기</span>';
    html += '<div class="calc-share-btns">';
    html += '<button class="share-btn kakao" type="button" data-share="native">카카오톡·메시지</button>';
    html += '<button class="share-btn x" type="button" data-share="x">X</button>';
    html += '<button class="share-btn link" type="button" data-share="copy">링크 복사</button>';
    html += "</div></div>";

    html += '<p class="calc-disclaimer">자동차보험 할인할증 제도의 공개된 구조를 반영한 <strong>간이 판정</strong>입니다. 갱신 보험료를 넣지 않으셨다면 사고건수 요율과 무사고 할인 소멸이 빠진 계산이라 보험처리 쪽에 유리하게 기울어 있습니다. 1등급당 인상폭(7~12%)도 보험사와 개인 등급에 따라 갈립니다. 보험처리 전에 보험사에 갱신 예상 보험료를 직접 확인하세요.</p>';

    box.innerHTML = html;
    box.hidden = false;
    if (window.gtag) gtag("event", "tool_result", { tool_path: location.pathname });

    var url = "https://car.importants-studio.com/tools/insurance-vs-selfpay/";
    var shareText = r.verdict === "under"
      ? "수리비 " + won(r.loss) + "이면 등급 할증은 없는 사고라고 합니다 (차곡차곡 판정기)"
      : r.verdict === "insurance"
        ? "수리비 " + won(r.loss) + "이면 보험처리가 낫다고 합니다 (차곡차곡 판정기)"
        : r.verdict === "self"
          ? "수리비 " + won(r.loss) + "이면 자비처리가 낫다고 합니다 (차곡차곡 판정기)"
          : "수리비 " + won(r.loss) + "이면 갈리는 구간이라고 합니다 (차곡차곡 판정기)";

    box.querySelectorAll("[data-share]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var mode = btn.getAttribute("data-share");
        if (mode === "native") {
          if (navigator.share) {
            navigator.share({ title: "자동차보험 할증·자기부담금 계산기", text: shareText, url: url }).catch(function () {});
          } else {
            copyTo(btn, shareText + "\n" + url, "복사됨 (카톡에 붙여넣기)");
          }
        } else if (mode === "x") {
          window.open(
            "https://twitter.com/intent/tweet?text=" + encodeURIComponent(shareText) + "&url=" + encodeURIComponent(url),
            "_blank", "noopener"
          );
        } else {
          copyTo(btn, url, "링크 복사됨");
        }
      });
    });

    function copyTo(btn, text, done) {
      var original = btn.textContent;
      navigator.clipboard.writeText(text).then(function () {
        btn.textContent = done;
        setTimeout(function () { btn.textContent = original; }, 2000);
      });
    }

    if (box.scrollIntoView) box.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ── 입력 ──────────────────────────────────────────────────

  function num(el) {
    if (!el) return 0;
    var v = parseInt(String(el.value).replace(/[,\s원]/g, ""), 10);
    return isNaN(v) || v < 0 ? 0 : v;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("insurance-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      render(calculate({
        loss: num(form.elements.loss),
        premium: num(form.elements.premium),
        renewal: num(form.elements.renewal),
        threshold: parseInt(form.elements.threshold.value, 10) || 2000000,
        rate: parseFloat(form.elements.rate.value) || 0.2,
      }));
    });
  });

  window.__insuranceVsSelfpay = {
    calculate: calculate, deductible: deductible, insuredCost: insuredCost,
    extraPremium: extraPremium, breakEven: breakEven,
    SURCHARGE_LOW: SURCHARGE_LOW, SURCHARGE_HIGH: SURCHARGE_HIGH,
  };
})();
