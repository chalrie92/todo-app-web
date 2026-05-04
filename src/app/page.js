'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

// Helpers
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const pad = (n) => String(n).padStart(2, '0');

const isOverdue = (t) => {
  if (!t.date || t.status === 'done') return false;
  if (t.time) return new Date(t.date + 'T' + t.time) < new Date();
  return t.date < todayStr();
};

const formatDateTime = (t) => {
  if (!t.date && !t.time) return '';
  const parts = [];
  if (t.date) {
    const d = new Date(t.date + 'T12:00:00');
    parts.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }
  if (t.time) parts.push(t.time);
  return parts.join(' ');
};

const parseNL = (raw) => {
  let text = raw;
  let date = '', time = '', client = '';

  text = text.replace(/([오전오후]{2})\s?(\d{1,2})시\s?(?:(\d{1,2})분)?/g, (_, ampm, h, m) => {
    let hh = parseInt(h);
    if (ampm === '오후' && hh < 12) hh += 12;
    if (ampm === '오전' && hh === 12) hh = 0;
    time = `${pad(hh)}:${pad(parseInt(m || 0))}`;
    return '';
  });

  text = text.replace(/(\d{1,2})시\s?(?:(\d{1,2})분)?/g, (_, h, m) => {
    let hh = parseInt(h);
    if (hh >= 1 && hh <= 9) hh += 12;
    time = `${pad(hh)}:${pad(parseInt(m || 0))}`;
    return '';
  });

  text = text.replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h, m) => {
    time = `${pad(parseInt(h))}:${m}`;
    return '';
  });

  const today = new Date();
  const todayD = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (/오늘/.test(text)) {
    date = todayStr();
    text = text.replace(/오늘/g, '');
  }
  if (/내일/.test(text)) {
    const d = new Date(todayD); d.setDate(d.getDate() + 1);
    date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    text = text.replace(/내일/g, '');
  }
  if (/모레/.test(text)) {
    const d = new Date(todayD); d.setDate(d.getDate() + 2);
    date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    text = text.replace(/모레/g, '');
  }

  const dayMap = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 0 };
  text = text.replace(/([월화수목금토일])요일/g, (_, d) => {
    const target = dayMap[d];
    const curr = todayD.getDay();
    let diff = target - curr;
    if (diff <= 0) diff += 7;
    const nd = new Date(todayD); nd.setDate(todayD.getDate() + diff);
    date = `${nd.getFullYear()}-${pad(nd.getMonth() + 1)}-${pad(nd.getDate())}`;
    return '';
  });

  text = text.replace(/(\d{1,2})월\s?(\d{1,2})일/g, (_, mo, da) => {
    const y = today.getFullYear();
    date = `${y}-${pad(parseInt(mo))}-${pad(parseInt(da))}`;
    return '';
  });

  text = text.replace(/@(\S+)/g, (_, c) => { client = c; return ''; });
  text = text.replace(/\s{2,}/g, ' ').trim();

  return { title: text, date, time, client };
};

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  
  const [qaInput, setQaInput] = useState('');
  const [qaOptsVisible, setQaOptsVisible] = useState(false);
  const [qaUrgent, setQaUrgent] = useState(false);
  const [qaDate, setQaDate] = useState('');
  const [qaTime, setQaTime] = useState('');
  const [qaClient, setQaClient] = useState('');
  const [qaStatus, setQaStatus] = useState('todo');
  
  const [detailId, setDetailId] = useState(null);
  const [dpTitle, setDpTitle] = useState('');
  const [dpClient, setDpClient] = useState('');
  const [dpDate, setDpDate] = useState('');
  const [dpTime, setDpTime] = useState('');
  const [dpStatus, setDpStatus] = useState('');
  const [dpNote, setDpNote] = useState('');
  const [dpUrgent, setDpUrgent] = useState(false);

  const qaInputRef = useRef(null);
  const wrapRef = useRef(null);

  // Load from API
  useEffect(() => {
    fetch('/api/tasks')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTasks(data);
      })
      .catch(e => console.error(e));
  }, []);

  // Save to API
  const persistTasks = async (newTasks) => {
    setTasks(newTasks);
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTasks)
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        if (document.activeElement === qaInputRef.current || qaOptsVisible) {
          e.preventDefault();
          submitQa();
        }
      }
      if (e.key === 'Escape') {
        resetQa();
        setDetailId(null);
        if (document.activeElement) document.activeElement.blur();
      }
    };
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target) && !qaInput.trim()) {
        setQaOptsVisible(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClick);
    };
  });

  const parsed = useMemo(() => parseNL(qaInput), [qaInput]);

  useEffect(() => {
    if (parsed.date) setQaDate(parsed.date);
    if (parsed.time) setQaTime(parsed.time);
    if (parsed.client) setQaClient(parsed.client);
  }, [parsed]);

  const showQaOpts = () => {
    setQaOptsVisible(true);
    if (!qaDate) setQaDate(todayStr());
  };

  const resetQa = () => {
    setQaInput(''); setQaClient(''); setQaDate(''); setQaTime(''); setQaStatus('todo');
    setQaUrgent(false); setQaOptsVisible(false);
  };

  const submitQa = () => {
    const raw = qaInput.trim();
    if (!raw) { qaInputRef.current?.focus(); return; }
    
    const client = qaClient.trim() || parsed.client;
    const date = qaDate || parsed.date;
    const time = qaTime || parsed.time;
    const title = parsed.title || raw;

    const newTask = {
      id: Date.now().toString(),
      title, client, date, time, status: qaStatus, note: '',
      urgent: qaUrgent, createdAt: Date.now()
    };

    persistTasks([newTask, ...tasks]);
    resetQa();
    setTimeout(() => qaInputRef.current?.focus(), 50);
  };

  const cycleStatus = (e, id) => {
    e.stopPropagation();
    const cycle = { todo: 'wait', wait: 'done', done: 'todo' };
    const newTasks = tasks.map(t => t.id === id ? { ...t, status: cycle[t.status] || 'todo' } : t);
    persistTasks(newTasks);
  };

  const openDetail = (id) => {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    setDetailId(id);
    setDpTitle(t.title); setDpClient(t.client || ''); setDpDate(t.date || '');
    setDpTime(t.time || ''); setDpStatus(t.status); setDpNote(t.note || '');
    setDpUrgent(!!t.urgent);
  };

  const saveDetail = () => {
    if (!detailId) return;
    const newTasks = tasks.map(t => {
      if (t.id !== detailId) return t;
      return {
        ...t,
        title: dpTitle.trim() || t.title,
        client: dpClient.trim(),
        date: dpDate, time: dpTime, status: dpStatus, note: dpNote.trim(),
        urgent: dpUrgent
      };
    });
    persistTasks(newTasks);
    setDetailId(null);
  };

  const delDetail = () => {
    if (!detailId || !confirm('이 업무를 삭제할까요?')) return;
    persistTasks(tasks.filter(x => x.id !== detailId));
    setDetailId(null);
  };

  const exportIcs = () => {
    if (!detailId) return;
    const t = tasks.find(x => x.id === detailId);
    if (!t || !t.date) { alert('날짜를 먼저 설정해주세요.'); return; }
    const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
    let dtstart, dtend;
    if (t.time) {
      const dt = new Date(t.date + 'T' + t.time);
      const fmt = d => d.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
      dtstart = `DTSTART:${fmt(dt)}`; dtend = `DTEND:${fmt(new Date(dt.getTime() + 3600000))}`;
    } else {
      const d = t.date.replace(/-/g, '');
      dtstart = `DTSTART;VALUE=DATE:${d}`; dtend = `DTEND;VALUE=DATE:${d}`;
    }
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AgencyTodo//KO', 'BEGIN:VEVENT',
      `UID:${t.id}@agencytodo`, `DTSTAMP:${stamp}`, dtstart, dtend,
      `SUMMARY:${t.title}${t.client ? ' [' + t.client + ']' : ''}`,
      `DESCRIPTION:${(t.note || '').replace(/\n/g, '\\n')}`,
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = t.title.replace(/\s+/g, '_') + '.ics'; a.click();
  };

  const counts = {
    all: tasks.filter(t => t.status !== 'done').length,
    today: tasks.filter(t => t.date === todayStr() && t.status !== 'done').length,
    todo: tasks.filter(t => t.status === 'todo').length,
    wait: tasks.filter(t => t.status === 'wait').length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  const filterMeta = {
    all: { label: '전체', color: '#007AFF' },
    today: { label: '오늘', color: '#007AFF' },
    todo: { label: '할 일', color: '#5856D6' },
    wait: { label: '피드백 대기', color: '#FF9500' },
    done: { label: '완료됨', color: '#34C759' },
  };

  let items = tasks.filter(t => {
    if (filter === 'all') return t.status !== 'done';
    if (filter === 'today') return t.date === todayStr() && t.status !== 'done';
    return t.status === filter;
  });
  
  if (searchQ) {
    const q = searchQ.toLowerCase();
    items = items.filter(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.client || '').toLowerCase().includes(q) ||
      (t.note || '').toLowerCase().includes(q)
    );
  }

  const groups = {};
  items.forEach(t => { const k = t.date || '__'; if (!groups[k]) groups[k] = []; groups[k].push(t); });
  const keys = Object.keys(groups).sort((a, b) => { if (a === '__') return 1; if (b === '__') return -1; return a < b ? -1 : 1; });
  const showGroups = filter === 'all' || filter === 'today';

  return (
    <div className="shell">
      <div className="sidebar">
        <div className="tiles">
          {['all', 'today', 'todo', 'wait'].map(f => (
            <div key={f} className={`tile ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              <div className="tile-icon" style={{ background: filterMeta[f].color }}></div>
              <div className="tile-count">{counts[f]}</div>
              <div className="tile-label">{filterMeta[f].label}</div>
            </div>
          ))}
        </div>
        <div className="section-label">나의 목록</div>
        <div className={`nav-row ${filter === 'done' ? 'active' : ''}`} onClick={() => setFilter('done')}>
          <div className="nav-icon" style={{ background: '#34C759' }}></div>
          <span className="nav-name">완료됨</span>
          <span className="nav-cnt">{counts.done}</span>
        </div>
      </div>

      <div className="main">
        <div className="topbar">
          <div className="search-wrap">
            <svg viewBox="0 0 20 20" strokeWidth="2.2" strokeLinecap="round"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M15 15l-3-3" /></svg>
            <input className="search-input" placeholder="검색" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
          </div>
        </div>

        <div className="section-head">
          <div className="section-title" style={{ color: filterMeta[filter].color }}>{filterMeta[filter].label}</div>
          <div className="section-sub">{items.length}개 업무</div>
        </div>

        <div className="quick-add-wrap" ref={wrapRef}>
          <div className="quick-add-row">
            <div className="qa-circle"></div>
            <input className="qa-input" ref={qaInputRef} value={qaInput} onChange={e => setQaInput(e.target.value)} onFocus={showQaOpts} placeholder="새 업무 — '내일 오후 3시 @클라이언트 업무명' 후 Enter" />
          </div>
          <div className={`quick-add-opts ${qaOptsVisible ? 'show' : ''}`}>
            <div className="qa-parsed-preview">
              {parsed.date && <span className="qa-pill p-date">📅 {new Date(parsed.date).getMonth() + 1}/{new Date(parsed.date).getDate()}</span>}
              {parsed.time && <span className="qa-pill p-time">⏰ {parsed.time}</span>}
              {parsed.client && <span className="qa-pill p-client">👤 {parsed.client}</span>}
            </div>
            <input className="qa-opt-input" placeholder="클라이언트" style={{ width: '110px' }} value={qaClient} onChange={e => setQaClient(e.target.value)} />
            <input className="qa-opt-input" type="date" style={{ width: '130px' }} value={qaDate} onChange={e => setQaDate(e.target.value)} />
            <input className="qa-opt-input" type="time" style={{ width: '100px' }} value={qaTime} onChange={e => setQaTime(e.target.value)} />
            <select className="qa-opt-select" style={{ width: '100px' }} value={qaStatus} onChange={e => setQaStatus(e.target.value)}>
              <option value="todo">할 일</option>
              <option value="wait">피드백 대기</option>
            </select>
            <button className={`qa-urgent-btn ${qaUrgent ? 'on' : ''}`} onClick={() => setQaUrgent(!qaUrgent)}>🔴 긴급</button>
            <div className="qa-actions">
              <button className="qa-cancel" onClick={resetQa}>취소</button>
              <button className="qa-submit" onClick={submitQa}>추가</button>
            </div>
          </div>
        </div>

        <div className="task-list">
          {!items.length ? (
            <div className="empty">
              <p>업무가 없어요</p>
            </div>
          ) : (
            keys.map(k => (
              <div key={k}>
                {showGroups && <div className="group-label">{k === '__' ? '날짜 없음' : k === todayStr() ? '오늘' : `${new Date(k).getMonth() + 1}월 ${new Date(k).getDate()}일`}</div>}
                {groups[k].map(t => {
                  const done = t.status === 'done', wait = t.status === 'wait', over = isOverdue(t);
                  return (
                    <div key={t.id} className="task-row" onClick={() => openDetail(t.id)}>
                      <button className={`circle ${done ? 'c-done' : wait ? 'c-wait' : ''}`} onClick={(e) => cycleStatus(e, t.id)}>
                        {done && <svg viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="white" fill="none"/></svg>}
                      </button>
                      <div className="task-body">
                        <div className={`task-title ${done ? 'struck' : ''}`}>{t.title}</div>
                        <div className="task-tags">
                          {t.client && <span className="tag t-client">{t.client}</span>}
                          {formatDateTime(t) && <span className={`tag t-time ${over ? 'od' : ''}`}>{formatDateTime(t)}</span>}
                          {wait && <span className="tag t-wait">피드백 대기</span>}
                          {t.urgent && <span className="tag t-urgent">긴급</span>}
                          {t.note && <span className="tag t-note">{t.note.slice(0, 22)}{t.note.length > 22 ? '…' : ''}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className={`detail ${detailId ? 'open' : ''}`}>
          <div className="dp-top">
            <span className="dp-top-label">업무 정보</span>
            <button className="dp-close" onClick={() => setDetailId(null)}>완료</button>
          </div>
          <input className="dp-title" value={dpTitle} onChange={e => setDpTitle(e.target.value)} placeholder="업무명" />
          <div className="dp-row2">
            <div className="dp-field">
              <div className="dp-label">클라이언트</div>
              <input className="dp-inp" value={dpClient} onChange={e => setDpClient(e.target.value)} placeholder="클라이언트명" />
            </div>
            <div className="dp-field">
              <div className="dp-label">상태</div>
              <select className="dp-sel" value={dpStatus} onChange={e => setDpStatus(e.target.value)}>
                <option value="todo">할 일</option>
                <option value="wait">피드백 대기</option>
                <option value="done">완료</option>
              </select>
            </div>
          </div>
          <div className="dp-row2">
            <div className="dp-field">
              <div className="dp-label">날짜</div>
              <input className="dp-inp" type="date" value={dpDate} onChange={e => setDpDate(e.target.value)} />
            </div>
            <div className="dp-field">
              <div className="dp-label">시간</div>
              <input className="dp-inp" type="time" value={dpTime} onChange={e => setDpTime(e.target.value)} />
            </div>
          </div>
          <div className="dp-field">
            <div className="dp-label">메모</div>
            <textarea className="dp-ta" value={dpNote} onChange={e => setDpNote(e.target.value)} placeholder="메모" />
          </div>
          <label className="dp-check">
            <input type="checkbox" checked={dpUrgent} onChange={e => setDpUrgent(e.target.checked)} />
            <span>긴급 표시</span>
          </label>
          <button className="dp-ics" onClick={exportIcs}>📅 애플 캘린더로 내보내기 (.ics)</button>
          <div className="dp-btns">
            <button className="dp-save" onClick={saveDetail}>저장</button>
            <button className="dp-del" onClick={delDetail}>삭제</button>
          </div>
        </div>
      </div>
    </div>
  );
}
