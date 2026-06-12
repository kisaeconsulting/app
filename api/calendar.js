const { google } = require('googleapis');

const APP_TAG = 'internal-reservation';

function env(name){ const v = process.env[name]; if(!v) throw new Error(`Missing environment variable: ${name}`); return v; }
function privateKey(){ return env('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n'); }

async function client(){
  const auth = new google.auth.JWT({
    email: env('GOOGLE_CLIENT_EMAIL'),
    key: privateKey(),
    scopes: ['https://www.googleapis.com/auth/calendar']
  });
  return google.calendar({ version: 'v3', auth });
}

function toTimes(date, time, duration){
  const start = new Date(`${date}T${time}:00+09:00`);
  const end = new Date(start.getTime() + Number(duration || 60) * 60000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function summaryFor(teacher, booked){ return booked ? `[예약완료] ${teacher}` : `예약 가능 - ${teacher}`; }

function props(teacher, duration, booked, memo){
  const p = { app: APP_TAG, teacher: String(teacher), duration: String(duration || 60), status: booked ? 'booked' : 'available' };
  if(memo) p.memo = String(memo).slice(0, 500);
  return { private: p };
}

function descFor(teacher, date, time, booked, memo){
  let d = `내부 예약 시스템\n선생님: ${teacher}\n날짜: ${date}\n시간: ${time}\n상태: ${booked ? '예약 완료' : '예약 가능'}`;
  if(memo) d += `\n메모: ${memo}`;
  return d;
}

module.exports = async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try{
    const calendar = await client();
    const calendarId = env('GOOGLE_CALENDAR_ID');
    const { action, slot, eventId, range } = req.body || {};

    if(action === 'list'){
      if(!range || !range.start || !range.end) return res.status(400).json({ error: 'Missing range' });
      const items = [];
      let pageToken;
      do {
        const r = await calendar.events.list({
          calendarId,
          timeMin: new Date(`${range.start}T00:00:00+09:00`).toISOString(),
          timeMax: new Date(`${range.end}T23:59:59+09:00`).toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 2500,
          timeZone: 'Asia/Seoul',
          privateExtendedProperty: `app=${APP_TAG}`,
          pageToken
        });
        items.push(...(r.data.items || []));
        pageToken = r.data.nextPageToken;
      } while(pageToken);

      const slots = items
        .filter(ev => ev.start && ev.start.dateTime)
        .map(ev => {
          const p = (ev.extendedProperties && ev.extendedProperties.private) || {};
          const start = ev.start.dateTime;
          const end = ev.end && ev.end.dateTime;
          const duration = p.duration ? Number(p.duration)
            : (end ? Math.round((new Date(end) - new Date(start)) / 60000) : 60);
          return {
            eventId: ev.id,
            date: start.slice(0, 10),
            time: start.slice(11, 16),
            duration,
            teacher: p.teacher || String(ev.summary || '').replace(/^(\[예약완료\]\s*|예약 (가능|완료) - )/, ''),
            booked: p.status === 'booked' || /\[예약\s*완료\]/.test(String(ev.summary || '')),
            memo: p.memo || ''
          };
        });
      return res.status(200).json({ ok: true, slots });
    }

    if(action === 'create'){
      if(!slot || !slot.date || !slot.time || !slot.teacher) return res.status(400).json({ error: 'Missing slot data' });
      const t = toTimes(slot.date, slot.time, slot.duration);
      const event = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: summaryFor(slot.teacher, false),
          description: descFor(slot.teacher, slot.date, slot.time, false),
          start: { dateTime: t.start, timeZone: 'Asia/Seoul' },
          end: { dateTime: t.end, timeZone: 'Asia/Seoul' },
          extendedProperties: props(slot.teacher, slot.duration, false)
        }
      });
      return res.status(200).json({ ok: true, eventId: event.data.id });
    }

    if(action === 'book' || action === 'reopen'){
      if(!eventId || !slot || !slot.teacher) return res.status(400).json({ error: 'Missing eventId or slot data' });
      const booked = action === 'book';
      const memo = booked ? (slot.memo || '') : '';
      await calendar.events.patch({
        calendarId,
        eventId,
        requestBody: {
          summary: summaryFor(slot.teacher, booked),
          description: descFor(slot.teacher, slot.date || '', slot.time || '', booked, memo),
          colorId: booked ? '11' : null,
          extendedProperties: props(slot.teacher, slot.duration, booked, memo)
        }
      });
      return res.status(200).json({ ok: true });
    }

    if(action === 'bulkCreate'){
      const list = (req.body && req.body.slots) || [];
      if(!Array.isArray(list) || !list.length) return res.status(400).json({ error: 'Missing slots array' });
      if(list.length > 25) return res.status(400).json({ error: 'Max 25 slots per request' });
      let created = 0;
      for(const s of list){
        if(!s || !s.date || !s.time || !s.teacher) continue;
        const t = toTimes(s.date, s.time, s.duration);
        const booked = !!s.booked;
        await calendar.events.insert({
          calendarId,
          requestBody: {
            summary: summaryFor(s.teacher, booked),
            description: descFor(s.teacher, s.date, s.time, booked, s.memo) + '\n(엑셀 일정표에서 일괄 등록됨)',
            start: { dateTime: t.start, timeZone: 'Asia/Seoul' },
            end: { dateTime: t.end, timeZone: 'Asia/Seoul' },
            ...(booked ? { colorId: '11' } : {}),
            extendedProperties: props(s.teacher, s.duration, booked, s.memo)
          }
        });
        created++;
      }
      return res.status(200).json({ ok: true, created });
    }

    if(action === 'delete'){
      if(!eventId) return res.status(400).json({ error: 'Missing eventId' });
      await calendar.events.delete({ calendarId, eventId });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch(err){
    return res.status(500).json({ error: err.message || 'Unknown server error' });
  }
};
