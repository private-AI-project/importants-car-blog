// 자동차세 연납 할인 계산기.
//
// 연납 공제액은 연세액에 신청 시기별 공제율을 곱해서 나온다. 문제는 대부분
// 자기 연세액을 모른다는 것이다. 그래서 배기량과 차령으로 연세액을 먼저 세운다.
//
// 상수는 아래 한 곳에 모았다. 세율이나 공제율이 바뀌면 여기만 고치면 된다.

(function () {
  "use strict";

  // ── 상수 ──────────────────────────────────────────────────

  // 비영업용 승용차 cc당 세액. 지방세법 기준.
  // 근거: 서초구청 자동차세(소유분) 안내
  // https://www.seocho.go.kr/site/tax/02/10201050000002023050810.jsp
  var CC_RATES = [
    { upTo: 1000, won: 80 },
    { upTo: 1600, won: 140 },
    { upTo: Infinity, won: 200 },
  ];

  // 자가용 승용차에 붙는 지방교육세. 본세의 30%.
  var EDU_TAX_RATE = 0.30;

  // 차령별 경감율. 3년차부터 매년 5%씩, 12년차 이상 50%로 고정.
  // 본세에만 걸리고 지방교육세는 경감된 본세를 기준으로 다시 계산된다.
  function ageDiscountRate(age) {
    if (age < 3) return 0;
    if (age >= 12) return 0.50;
    return (age - 2) * 0.05;
  }

  // 신청 시기별 공제율. 2026년 기준율 5%에 남은 개월 수가 반영된 값이다.
  // 근거: 2026-09-04 자동차세 연납 글 (세종시 공고)
  var PERIODS = [
    { key: "jan",  label: "1월", window: "1월 16일 ~ 2월 2일",  rate: 0.0458 },
    { key: "mar",  label: "3월", window: "3월 16일 ~ 3월 31일", rate: 0.0376 },
    { key: "jun",  label: "6월", window: "6월 16일 ~ 6월 30일", rate: 0.0251 },
    { key: "sep",  label: "9월", window: "9월 16일 ~ 9월 30일", rate: 0.0125 },
  ];

  var MAX_CC = 8000;   // 승용차 범위를 넘는 입력을 막는다

  // ── 계산 ──────────────────────────────────────────────────

  function baseTax(cc) {
    var rate = 0;
    for (var i = 0; i < CC_RATES.length; i += 1) {
      if (cc <= CC_RATES[i].upTo) { rate = CC_RATES[i].won; break; }
    }
    return cc * rate;
  }

  function calculate(input) {
    var cc = input.cc;
    var age = input.age;

    var base = baseTax(cc);
    var cut = ageDiscountRate(age);
    var baseAfter = Math.floor(base * (1 - cut));
    var eduTax = Math.floor(baseAfter * EDU_TAX_RATE);
    var yearly = baseAfter + eduTax;

    var rows = PERIODS.map(function (p) {
      return {
        key: p.key, label: p.label, window: p.window, rate: p.rate,
        discount: Math.floor(yearly * p.rate),
      };
    });

    var picked = rows.filter(function (r) { return r.key === input.period; })[0] || rows[3];

    return {
      cc: cc, age: age,
      base: base, ageCut: cut, baseAfter: baseAfter, eduTax: eduTax,
      yearly: yearly,
      rows: rows,
      picked: picked,
      // 9월은 올해 마지막 창구다. 1월과 견주면 얼마를 더 아낄 수 있었는지 보인다.
      janDiscount: rows[0].discount,
    };
  }

  // ── 화면 ──────────────────────────────────────────────────

  function won(n) { return Math.round(n).toLocaleString("ko-KR") + "원"; }
  function pct(r) { return (r * 100).toFixed(2).replace(/\.?0+$/, "") + "%"; }

  // 추정치라 한 값으로 못 박지 않는다. 연세액은 지자체 조회값과 몇백원 단위로
  // 어긋날 수 있어서 범위로 보여준다.
  function range(n) {
    var lo = Math.floor(n * 0.95 / 100) * 100;
    var hi = Math.ceil(n * 1.05 / 100) * 100;
    return won(lo) + " ~ " + won(hi);
  }

  function render(r) {
    var box = document.getElementById("calc-result");
    var html = "";

    html += '<p class="calc-label">' + r.picked.label + ' 신청 시 할인액</p>';
    html += '<p class="calc-amount">' + won(r.picked.discount) + "</p>";
    html += '<p class="calc-sub">연세액 추정 ' + range(r.yearly) +
            " · 공제율 " + pct(r.picked.rate) + "</p>";

    html += '<ul class="calc-notes">';
    html += "<li>배기량 " + r.cc.toLocaleString("ko-KR") + "cc 기준 본세 " + won(r.base) +
            (r.ageCut > 0 ? ", 차령 " + r.age + "년 경감 " + pct(r.ageCut) + " 적용" : ", 차령 경감 없음") +
            "</li>";
    html += "<li>경감 후 본세 " + won(r.baseAfter) + " + 지방교육세 " + won(r.eduTax) +
            " = 연세액 약 " + won(r.yearly) + "</li>";
    html += "<li>신청 기간은 " + r.picked.window + "입니다</li>";
    if (r.picked.key === "sep") {
      html += "<li>9월은 올해 마지막 창구입니다. 1월에 신청하면 " + won(r.janDiscount) +
              "까지 받을 수 있으니, 이번에 못 하시면 내년 1월을 기억해 두세요</li>";
    }
    html += "</ul>";

    html += '<div class="calc-table-wrap"><table class="calc-table"><thead><tr>' +
            "<th>신청 시기</th><th>공제율</th><th>할인액</th></tr></thead><tbody>";
    r.rows.forEach(function (row) {
      var on = row.key === r.picked.key ? ' class="on"' : "";
      html += "<tr" + on + "><td>" + row.label + "</td><td>" + pct(row.rate) +
              "</td><td>" + won(row.discount) + "</td></tr>";
    });
    html += "</tbody></table></div>";

    html += '<div class="calc-actions">';
    html += '<a class="calc-btn primary" href="https://www.wetax.go.kr" target="_blank" rel="noopener">위택스에서 내 차량 연납 신청</a>';
    html += "</div>";

    html += '<div class="calc-share">';
    html += '<span class="calc-share-label">결과 공유하기</span>';
    html += '<div class="calc-share-btns">';
    html += '<button class="share-btn kakao" type="button" data-share="native">카카오톡·메시지</button>';
    html += '<button class="share-btn x" type="button" data-share="x">X</button>';
    html += '<button class="share-btn link" type="button" data-share="copy">링크 복사</button>';
    html += "</div></div>";

    html += '<p class="calc-disclaimer">비영업용 승용차 기준 <strong>간이 계산</strong>입니다. 승합·화물·영업용 차량과 전기차는 세액 체계가 달라 이 계산에 맞지 않습니다. 지자체 조례나 차량 등록 시점에 따라 실제 금액이 달라질 수 있으니, 확정 금액은 위택스(서울은 ETAX)에서 차량번호로 조회한 값을 기준으로 삼으세요.</p>';

    box.innerHTML = html;
    box.hidden = false;
    if (window.gtag) gtag("event", "tool_result", { tool_path: location.pathname });

    var url = "https://car.importants-studio.com/tools/car-tax-prepay-calculator/";
    var shareText = "자동차세 연납 " + r.picked.label + " 신청하면 " + won(r.picked.discount) +
                    " 할인이래요 (차곡차곡 간이계산기)";

    box.querySelectorAll("[data-share]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var mode = btn.getAttribute("data-share");
        if (mode === "native") {
          if (navigator.share) {
            navigator.share({ title: "자동차세 연납 할인 계산기", text: shareText, url: url }).catch(function () {});
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

    // 스크롤은 마지막에 한다. 위에 두면 이게 터질 때 공유 버튼 연결까지 같이 죽는다.
    if (box.scrollIntoView) box.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("car-tax-prepay-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var cc = parseInt(form.elements.cc.value, 10);
      if (!cc || cc < 1 || cc > MAX_CC) { form.elements.cc.select(); return; }
      var age = parseInt(form.elements.age.value, 10);
      if (isNaN(age) || age < 0) age = 0;
      render(calculate({ cc: cc, age: age, period: form.elements.period.value }));
    });
  });

  // 테스트용 노출
  window.__carTaxPrepay = { calculate: calculate, PERIODS: PERIODS, ageDiscountRate: ageDiscountRate };
})();
