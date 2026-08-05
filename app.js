// app.js — 핵심 기능 (등록/조회/삭제/수정/기간필터/검증). 담당: 유초윤
//
// features.js(검색·통계)는 이 파일이 만드는 #activityList의 data-activity-id를
// 읽어서 동작한다. 목록을 다시 그린 뒤 window.Features.refresh()를 호출해준다.

(function () {
  'use strict';

  var STORAGE_KEY = 'activities';
  var editingId = null; // 수정 중인 활동 id. null이면 신규 등록 모드

  function loadActivities() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      console.warn('[app] 활동 목록을 읽지 못했습니다:', e);
      return [];
    }
  }

  function saveActivities(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  // 문제가 있으면 오류 메시지를, 없으면 빈 문자열을 반환한다
  function validate(data) {
    if (!data.title) return '활동명을 입력해주세요.';
    if (!data.date || data.date > todayStr()) return '날짜는 오늘 이전이어야 합니다.';
    if (!Number.isInteger(data.memberCount) || data.memberCount < 1) {
      return '참여 인원은 1 이상의 정수여야 합니다.';
    }
    return '';
  }

  function showError(message) {
    document.querySelector('#formError').textContent = message;
  }

  // 메모칸을 입력 내용 길이에 맞춰 늘린다
  function autoGrowMemo() {
    var el = document.querySelector('#memo');
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  // "홍길동, 김철수" 같은 입력을 ["홍길동", "김철수"]로 바꾼다. 빈 항목은 버린다
  function parseAttendees(text) {
    return text.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function readForm() {
    var costVal = parseInt(document.querySelector('#cost').value, 10);
    return {
      title: document.querySelector('#title').value.trim(),
      date: document.querySelector('#date').value,
      place: document.querySelector('#place').value.trim(),
      memberCount: parseInt(document.querySelector('#memberCount').value, 10),
      category: document.querySelector('#category').value,
      attendees: parseAttendees(document.querySelector('#attendees').value),
      cost: Number.isInteger(costVal) && costVal >= 0 ? costVal : 0,
      memo: document.querySelector('#memo').value.trim()
    };
  }

  // 같은 날짜에 같은 활동명이 이미 있으면 true (수정 중인 항목 자신은 제외)
  function isDuplicate(data) {
    return loadActivities().some(function (a) {
      return a.id !== editingId && a.title === data.title && a.date === data.date;
    });
  }

  function resetForm() {
    document.querySelector('#activityForm').reset();
    document.querySelector('#memo').style.height = '';
    editingId = null;
    document.querySelector('#submitBtn').textContent = '등록';
  }

  function handleSubmit(e) {
    e.preventDefault();
    var data = readForm();
    var error = validate(data);
    showError(error);
    if (error) return;

    if (isDuplicate(data)) {
      var proceed = window.confirm('같은 날짜에 같은 이름의 활동이 이미 있습니다. 그래도 등록할까요?');
      if (!proceed) return;
    }

    var list = loadActivities();
    if (editingId) {
      list = list.map(function (a) {
        return a.id === editingId ? Object.assign({}, a, data) : a;
      });
    } else {
      list.push({
        id: String(Date.now()),
        title: data.title,
        date: data.date,
        place: data.place,
        memberCount: data.memberCount,
        category: data.category,
        attendees: data.attendees,
        cost: data.cost,
        memo: data.memo,
        createdAt: new Date().toISOString()
      });
    }
    saveActivities(list);
    resetForm();
    renderList();
  }

  function startEdit(activity) {
    editingId = activity.id;
    document.querySelector('#title').value = activity.title;
    document.querySelector('#date').value = activity.date;
    document.querySelector('#place').value = activity.place;
    document.querySelector('#memberCount').value = activity.memberCount;
    document.querySelector('#category').value = activity.category || '정기모임';
    document.querySelector('#attendees').value = (activity.attendees || []).join(', ');
    document.querySelector('#cost').value = activity.cost || '';
    document.querySelector('#memo').value = activity.memo;
    document.querySelector('#submitBtn').textContent = '수정 완료';
    showError('');
    autoGrowMemo();
  }

  function deleteActivity(id) {
    if (!window.confirm('이 활동을 삭제할까요?')) return;
    var list = loadActivities().filter(function (a) { return a.id !== id; });
    saveActivities(list);
    if (editingId === id) resetForm();
    renderList();
  }

  // 기간 필터: from/to 둘 다 비어있으면 전체를 보여준다
  function applyDateFilter(list) {
    var fromVal = document.querySelector('#filterFrom').value;
    var toVal = document.querySelector('#filterTo').value;
    return list.filter(function (a) {
      if (fromVal && a.date < fromVal) return false;
      if (toVal && a.date > toVal) return false;
      return true;
    });
  }

  function createItem(activity) {
    var li = document.createElement('li');
    li.setAttribute('data-activity-id', activity.id);

    var title = document.createElement('span');
    title.className = 'title';
    title.textContent = activity.title + ' (' + activity.date + ')';

    var badge = document.createElement('span');
    badge.className = 'category-badge';
    badge.textContent = activity.category || '기타';

    var meta = document.createElement('div');
    meta.className = 'meta';
    var metaText = activity.place + ' · ' + activity.memberCount + '명';
    if (activity.attendees && activity.attendees.length > 0) {
      metaText += ' (' + activity.attendees.join(', ') + ')';
    }
    if (activity.cost) {
      metaText += ' · 회비 ' + activity.cost.toLocaleString() + '원';
    }
    meta.textContent = metaText;

    var memo = document.createElement('p');
    memo.textContent = activity.memo;

    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = '수정';
    editBtn.addEventListener('click', function () { startEdit(activity); });

    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.textContent = '삭제';
    deleteBtn.addEventListener('click', function () { deleteActivity(activity.id); });

    var actions = document.createElement('div');
    actions.className = 'item-actions';
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(title);
    li.appendChild(badge);
    li.appendChild(meta);
    li.appendChild(memo);
    li.appendChild(actions);
    return li;
  }

  function renderList() {
    var listEl = document.querySelector('#activityList');
    var emptyEl = document.querySelector('#emptyMessage');
    listEl.innerHTML = '';

    var all = loadActivities().sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
    var filtered = applyDateFilter(all);

    emptyEl.style.display = filtered.length === 0 ? '' : 'none';
    filtered.forEach(function (a) { listEl.appendChild(createItem(a)); });

    var totalCost = filtered.reduce(function (sum, a) { return sum + (a.cost || 0); }, 0);
    document.querySelector('#listCount').textContent =
      filtered.length === 0 ? '' : filtered.length + '개 활동';
    document.querySelector('#costSummary').textContent =
      filtered.length === 0 ? '' : '회비 사용 합계 ' + totalCost.toLocaleString() + '원';

    if (window.Features) window.Features.refresh();
  }

  function init() {
    document.querySelector('#activityForm').addEventListener('submit', handleSubmit);
    document.querySelector('#filterFrom').addEventListener('change', renderList);
    document.querySelector('#filterTo').addEventListener('change', renderList);
    document.querySelector('#memo').addEventListener('input', autoGrowMemo);
    renderList();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
