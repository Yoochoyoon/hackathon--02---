// features.js — 차별화 기능 (검색 / 월별 통계). 담당: 신찬영
//
// app.js(핵심 CRUD)를 건드리지 않고 <script> 로 얹기만 하면 동작하도록 만들었다.
// HTML 스켈레톤이 아직 없어도 되게, 필요한 요소가 나타나면 그때 붙는다.

(function () {
  'use strict';

  var STORAGE_KEY = 'activities';

  // 검색어. 목록을 다시 그릴 때마다 이 값으로 거른다.
  var keyword = '';

  // localStorage 에서 활동 목록을 읽는다. app.js 와 같은 키를 쓴다.
  function loadActivities() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      // 저장값이 깨졌을 때 화면 전체가 죽지 않도록 빈 목록으로 넘긴다
      console.warn('[features] 활동 목록을 읽지 못했습니다:', e);
      return [];
    }
  }

  // 활동명·장소에 검색어가 들어 있는지 본다
  function matchesKeyword(activity, word) {
    if (!word) return true;
    var target = ((activity.title || '') + ' ' + (activity.place || '')).toLowerCase();
    return target.indexOf(word.toLowerCase()) !== -1;
  }

  // 검색어에 맞지 않는 항목을 화면에서 숨긴다.
  // 목록 DOM 을 다시 만들지 않고 display 만 건드린다 — app.js 의 렌더 결과를
  // 훼손하지 않기 위해서다.
  function applySearch() {
    var items = document.querySelectorAll('[data-activity-id]');
    var shown = 0;
    var all = loadActivities();
    var byId = {};
    all.forEach(function (a) { byId[String(a.id)] = a; });

    items.forEach(function (el) {
      var activity = byId[el.getAttribute('data-activity-id')];
      var ok = activity ? matchesKeyword(activity, keyword) : true;
      el.style.display = ok ? '' : 'none';
      if (ok) shown += 1;
    });

    var empty = document.querySelector('#searchEmpty');
    if (empty) {
      var noResult = keyword && items.length > 0 && shown === 0;
      empty.style.display = noResult ? '' : 'none';
      empty.textContent = '"' + keyword + '" 와(과) 일치하는 활동이 없습니다.';
    }
    return shown;
  }

  // 활동을 "YYYY-MM" 별로 세어 [{month, count}] 로 돌려준다
  function countByMonth(list) {
    var bucket = {};
    list.forEach(function (a) {
      var d = String(a.date || '').slice(0, 7); // YYYY-MM
      if (d.length !== 7) return;
      bucket[d] = (bucket[d] || 0) + 1;
    });
    return Object.keys(bucket).sort().map(function (m) {
      return { month: m, count: bucket[m] };
    });
  }

  // 월별 활동 횟수를 막대그래프로 그린다.
  // 외부 차트 라이브러리를 쓰지 않는다 — CDN 이 막히면 시연 자체가 안 되고,
  // 이 정도 그래프는 canvas 로 충분하다.
  function drawChart() {
    var canvas = document.querySelector('#statsChart');
    if (!canvas || !canvas.getContext) return;

    var data = countByMonth(loadActivities());
    var ctx = canvas.getContext('2d');
    var ratio = window.devicePixelRatio || 1;
    var cssWidth = canvas.clientWidth || 320;
    var cssHeight = canvas.clientHeight || 180;

    canvas.width = cssWidth * ratio;
    canvas.height = cssHeight * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    if (data.length === 0) {
      ctx.fillStyle = '#888';
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('표시할 활동이 없습니다', cssWidth / 2, cssHeight / 2);
      return;
    }

    var padL = 28, padB = 26, padT = 12, padR = 8;
    var plotW = cssWidth - padL - padR;
    var plotH = cssHeight - padT - padB;
    var max = Math.max.apply(null, data.map(function (d) { return d.count; }));
    var step = plotW / data.length;
    var barW = Math.min(38, step * 0.6);

    // 세로축 눈금 — 1건 단위가 너무 촘촘하면 건너뛴다
    var tick = max <= 5 ? 1 : Math.ceil(max / 5);
    ctx.strokeStyle = '#e5e5e5';
    ctx.fillStyle = '#999';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (var v = 0; v <= max; v += tick) {
      var y = padT + plotH - (v / max) * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(cssWidth - padR, y);
      ctx.stroke();
      ctx.fillText(String(v), padL - 6, y + 4);
    }

    data.forEach(function (d, i) {
      var h = (d.count / max) * plotH;
      var x = padL + step * i + (step - barW) / 2;
      var y = padT + plotH - h;

      ctx.fillStyle = '#2f5597';
      ctx.fillRect(x, y, barW, h);

      ctx.fillStyle = '#333';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(d.count), x + barW / 2, y - 4);

      // 가로축 라벨은 "MM월"만 — 칸이 좁아 연도까지 넣으면 겹친다
      ctx.fillStyle = '#666';
      ctx.fillText(Number(d.month.slice(5, 7)) + '월', x + barW / 2, cssHeight - 8);
    });
  }

  // 검색과 차트를 한꺼번에 갱신한다. app.js 가 목록을 다시 그린 뒤 호출하면 된다.
  function refresh() {
    applySearch();
    drawChart();
  }

  // 검색창이 화면에 나타나면 이벤트를 붙인다.
  // 이미 붙였으면 다시 붙이지 않는다(중복 호출 방지).
  function bindSearchBox() {
    var box = document.querySelector('#searchBox');
    if (!box || box.dataset.featuresBound === '1') return;
    box.dataset.featuresBound = '1';
    box.addEventListener('input', function (e) {
      keyword = e.target.value.trim();
      applySearch();
    });
  }

  // HTML 스켈레톤이 아직 안 올라왔을 수 있다. 요소가 생기면 그때 붙도록
  // DOM 변화를 지켜본다. 이렇게 해두면 index.html 이 나중에 합쳐져도
  // features.js 를 고칠 필요가 없다.
  function watchDom() {
    var observer = new MutationObserver(function () {
      bindSearchBox();
      refresh();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function init() {
    bindSearchBox();
    refresh();
    watchDom();
    window.addEventListener('resize', drawChart);
    // 다른 탭에서 활동을 바꿔도 이 화면이 따라가게 한다
    window.addEventListener('storage', refresh);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // app.js 에서 등록·삭제 뒤에 window.Features.refresh() 를 부르면 즉시 반영된다.
  window.Features = { refresh: refresh, drawChart: drawChart, applySearch: applySearch };
})();
