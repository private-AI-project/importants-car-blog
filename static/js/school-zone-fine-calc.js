// 스쿨존(어린이보호구역) 과태료·범칙금 계산기
// 근거: content/posts/2026-08-30-school-zone-fines.md
//   - 속도위반 표: 법제처 생활법령정보 (easylaw.go.kr) 스쿨존 승용차 기준
//   - 신호위반: 한국도로교통공단 안전교육 자료 (trafficedu.koroad.or.kr)
//   - 주정차: 법제처 생활법령정보, 2021년 도로교통법 개정(전 구간 주정차 금지)
//   - 보험료 할증: 국토교통부·금융감독원 정책브리핑 (2021년 9월 개시 계약부터)
// 금액 단위는 원. 승용차 기준이며, 이륜차·화물차 등은 금액이 다를 수 있음.

(function () {
  "use strict";

  // 구간별 [과태료(무인카메라), 범칙금(현장적발), 벌점]
  var SPEED = {
    under20: { label: "20km/h 이하", fine: 70000, penalty: 60000, points: 15 },
    under40: { label: "20~40km/h", fine: 100000, penalty: 90000, points: 30 },
    under60: { label: "40~60km/h", fine: 130000, penalty: 120000, points: 60 },
    over60: { label: "60km/h 초과", fine: 160000, penalty: 150000, points: 120 }
  };

  var SIGNAL = { fine: 130000, penalty: 120000, points: 30 };

  var PARKING = { base: 120000, over2h: 130000 };

  var VOLUNTARY_DISCOUNT = 0.8; // 자진납부 시 과태료 20% 감경 (질서위반행위규제법)
  var SUSPENSION_THRESHOLD = 40; // 벌점 40점부터 면허 정지, 1점당 하루
  var NO_INSURANCE_SURCHARGE_BAND = "under20"; // 이 구간까지는 보험료 할증 대상 아님(20km/h 초과부터 할증)

  function calculate(input) {
    var result = { notes: [], isFine: false, points: 0 };

    if (input.violationType === "speed") {
      var band = SPEED[input.speedBand];
      result.label = "스쿨존 속도위반 (" + band.label + ")";
      if (input.enforcement === "camera") {
        result.isFine = true;
        result.amount = band.fine;
      } else {
        result.isFine = false;
        result.amount = band.penalty;
        result.points = band.points;
      }
      if (input.speedBand !== NO_INSURANCE_SURCHARGE_BAND) {
        result.notes.push(
          "스쿨존에서 시속 20km 초과 과속 이력이 있으면 다음 자동차보험 갱신 때 보험료가 1회 위반 시 5%, 2회 이상이면 10% 오릅니다."
        );
      }
    } else if (input.violationType === "signal") {
      result.label = "스쿨존 신호위반";
      if (input.enforcement === "camera") {
        result.isFine = true;
        result.amount = SIGNAL.fine;
      } else {
        result.isFine = false;
        result.amount = SIGNAL.penalty;
        result.points = SIGNAL.points;
      }
    } else {
      result.label = "스쿨존 주정차 위반";
      result.isFine = true;
      result.amount = input.parkingDuration === "over2h" ? PARKING.over2h : PARKING.base;
    }

    result.baseAmount = result.amount;

    if (result.isFine && input.voluntaryPay) {
      result.amount = Math.round(result.amount * VOLUNTARY_DISCOUNT);
      result.notes.push("자진납부 감경(20%)을 반영한 금액입니다.");
    } else if (!result.isFine && input.voluntaryPay) {
      result.notes.push("자진납부 감경은 과태료에만 적용됩니다. 범칙금(현장적발)은 감경 대상이 아닙니다.");
    }

    if (result.points >= SUSPENSION_THRESHOLD) {
      result.suspensionDays = result.points;
      result.notes.push(
        "벌점 " + result.points + "점은 면허 정지 대상입니다(40점부터 1점당 하루 정지). 약 " + result.suspensionDays + "일 정지될 수 있습니다."
      );
    }

    return result;
  }

  function won(v) {
    return v.toLocaleString() + "원";
  }

  function render(result) {
    var box = document.getElementById("calc-result");
    var html = "";

    html += '<p class="calc-label">' + result.label + (result.isFine ? " 과태료" : " 범칙금") + "</p>";
    html += '<p class="calc-amount">' + won(result.amount) + "</p>";
    if (!result.isFine) {
      html += '<p class="calc-sub">벌점 ' + result.points + "점</p>";
    }

    if (result.notes.length) {
      html += '<ul class="calc-notes">';
      result.notes.forEach(function (n) {
        html += "<li>" + n + "</li>";
      });
      html += "</ul>";
    }

    html += '<div class="calc-actions">';
    html += '<a class="calc-btn primary" href="https://www.efine.go.kr/" target="_blank" rel="noopener">교통민원24(이파인)에서 실제 단속 내역 확인</a>';
    html += "</div>";
    html += '<div class="calc-share">';
    html += '<span class="calc-share-label">결과 공유하기</span>';
    html += '<div class="calc-share-btns">';
    html += '<button class="share-btn kakao" type="button" data-share="native">카카오톡·메시지</button>';
    html += '<button class="share-btn x" type="button" data-share="x">X</button>';
    html += '<button class="share-btn link" type="button" data-share="copy">링크 복사</button>';
    html += "</div></div>";
    html +=
      '<p class="calc-disclaimer">이 계산기는 승용차·법정 기준표를 그대로 반영한 <strong>간이 계산</strong>입니다. 실제 부과액은 차종, 지자체, 감경·가중 사유에 따라 달라질 수 있으며, 확정 금액은 통지서나 교통민원24(이파인)에서 확인하세요.</p>';

    box.innerHTML = html;
    box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "center" });

    var url = "https://car.importants-studio.com/tools/school-zone-fine-calculator/";
    var shareText = "스쿨존 위반 시 " + result.label + " 예상 금액은 " + won(result.amount) + "이래요 (차곡차곡 간이계산기)";

    box.querySelectorAll("[data-share]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var mode = btn.getAttribute("data-share");
        if (mode === "native") {
          if (navigator.share) {
            navigator.share({ title: "스쿨존 과태료 계산기", text: shareText, url: url }).catch(function () {});
          } else {
            copyTo(btn, shareText + "\n" + url, "복사됨 (카톡에 붙여넣기)");
          }
        } else if (mode === "x") {
          window.open(
            "https://twitter.com/intent/tweet?text=" + encodeURIComponent(shareText) + "&url=" + encodeURIComponent(url),
            "_blank",
            "noopener"
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
        setTimeout(function () {
          btn.textContent = original;
        }, 2000);
      });
    }
  }

  function syncFieldVisibility(form) {
    var type = form.elements.violationType.value;
    var speedField = document.getElementById("speedBandField");
    var enforcementField = document.getElementById("enforcementField");
    var parkingField = document.getElementById("parkingDurationField");

    speedField.hidden = type !== "speed";
    enforcementField.hidden = type === "parking";
    parkingField.hidden = type !== "parking";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("school-zone-form");
    if (!form) return;

    syncFieldVisibility(form);
    form.elements.violationType.addEventListener("change", function () {
      syncFieldVisibility(form);
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = {
        violationType: form.elements.violationType.value,
        speedBand: form.elements.speedBand.value,
        enforcement: form.elements.enforcement.value,
        parkingDuration: form.elements.parkingDuration.value,
        voluntaryPay: form.elements.voluntaryPay.checked
      };
      render(calculate(input));
    });
  });

  // 테스트용 노출
  window.__schoolZoneCalc = { calculate: calculate, SPEED: SPEED, SIGNAL: SIGNAL, PARKING: PARKING };
})();
