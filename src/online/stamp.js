// The time stamp of chat bubbles and the "Last connected" line (CHE-425): pure, the clock is injected. Today only HH:MM, then
// Yesterday, the short weekday up to 6 days back, the short date in the same year, else with the year. Local day boundaries.
import { t } from '../i18n.js';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function stamp(ms, now = Date.now()) {
  const d = new Date(ms), n = new Date(now);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const back = Math.round((dayStart(n) - dayStart(d)) / 86400000);   // calendar days, safe over a daylight saving change
  if (back <= 0) return time;
  if (back === 1) return t('online.stamp.yesterday', 'Yesterday {time}', { time });
  if (back <= 6) return t('online.stamp.weekday', '{day} {time}', { day: t('online.wd.' + d.getDay(), WD[d.getDay()]), time });
  const month = t('online.mo.' + d.getMonth(), MO[d.getMonth()]);
  if (d.getFullYear() === n.getFullYear()) return t('online.stamp.date', '{month} {d} {time}', { month, d: d.getDate(), time });
  return t('online.stamp.dateYear', '{month} {d}, {y} {time}', { month, d: d.getDate(), y: d.getFullYear(), time });
}
