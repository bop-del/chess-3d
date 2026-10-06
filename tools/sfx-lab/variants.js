// 9 battle voices x 6 new variants (sfx lab, CHE-261). Each fn has the signature of VOICES in src/battle/sfx.js:
// fn(e) draws into e (e.t, e.r(), ...) and returns its length in seconds, so a pick can be pasted into sfx.js unchanged
// (then import { bus, modal, ... } from kit as the shared helpers move into src/audio.js).
// Shape: { [voice]: { proposal, desc, variants: { a..f: { name, fn } } } }
import { tone as T, noise as N, bus, modal, snap, fm, shards, PARTIALS as P } from './kit.js';

export const VARIANTS = {
  whoosh: {
    proposal: 'a',
    desc: 'Luft bei einem grossen Schwung: der Anlauf vor einem Treffer, wenn eine Figur weit ausholt.',
    variants: {
      a: { name: 'Klinge', fn(e) {   // a narrow, singing band sweeping up with a thin whistle on top
        const b = bus(e, { wet: 0.12, room: 0.2, comp: 3 });
        N(b, { t: e.t, dur: 0.4, vol: 0.3, type: 'bandpass', f0: 500, f1: 4200, q: 2.4, a: 0.14 });
        T(b, { t: e.t + 0.02, dur: 0.34, vol: 0.03, type: 'sine', f0: 900, f1: 2800, sweep: 0.9, a: 0.1 });
        N(b, { t: e.t + 0.2, dur: 0.18, vol: 0.08, type: 'bandpass', f0: 3800, f1: 900, q: 1.2, a: 0.03 });
        return 0.42 + b.tail * 0.5;
      } },
      b: { name: 'Axt schwer', fn(e) {   // brown noise and a low pass-by
        const b = bus(e, { comp: 4 });
        N(b, { t: e.t, dur: 0.5, vol: 0.5, type: 'lowpass', f0: 180, f1: 1500, q: 0.8, a: 0.2, buf: 'brown' });
        N(b, { t: e.t + 0.22, dur: 0.26, vol: 0.18, type: 'lowpass', f0: 1400, f1: 250, q: 0.8, a: 0.04, buf: 'brown' });
        T(b, { t: e.t + 0.1, dur: 0.3, vol: 0.12, type: 'sine', f0: 60, f1: 45, a: 0.12 });
        return 0.55;
      } },
      c: { name: 'Fahne', fn(e) {   // a flutter: short rising puffs
        const b = bus(e, { wet: 0.1, room: 0.2 });
        for (let i = 0; i < 6; i++) N(b, { t: e.t + i * 0.045, dur: 0.07, vol: 0.2 * (1 - i * 0.07), type: 'bandpass', f0: 500 + i * 330, f1: 800 + i * 380, q: 1.3, a: 0.02 });
        N(b, { t: e.t + 0.05, dur: 0.28, vol: 0.1, type: 'highpass', f0: 1800, f1: 5000, a: 0.1 });
        return 0.34 + b.tail;
      } },
      d: { name: 'Pfeil', fn(e) {   // a thin whistle that bends up, a hiss behind it
        const b = bus(e, { wet: 0.1, room: 0.2 });
        T(b, { t: e.t, dur: 0.34, vol: 0.07, type: 'sine', f0: 2600, f1: 5200, sweep: 0.85, a: 0.1, wobble: [38, 25] });
        T(b, { t: e.t, dur: 0.34, vol: 0.025, type: 'sine', f0: 3900, f1: 7800, sweep: 0.85, a: 0.1 });
        N(b, { t: e.t, dur: 0.3, vol: 0.14, type: 'highpass', f0: 4500, f1: 8000, a: 0.12 });
        return 0.36 + b.tail;
      } },
      e: { name: 'Windstoss', fn(e) {   // a wide gust in a room
        const b = bus(e, { wet: 0.3, room: 0.3, dark: 0.7 });
        N(b, { t: e.t, dur: 0.5, vol: 0.34, type: 'bandpass', f0: 250, f1: 1300, q: 0.6, a: 0.22 });
        N(b, { t: e.t + 0.2, dur: 0.3, vol: 0.12, type: 'bandpass', f0: 1300, f1: 300, q: 0.6, a: 0.05, buf: 'brown' });
        return 0.48 + b.tail * 0.4;
      } },
      f: { name: 'Vorbeiflug', fn(e) {   // a narrow band that falls in pitch, like something passing
        const b = bus(e, { comp: 3 });
        N(b, { t: e.t, dur: 0.5, vol: 0.34, type: 'bandpass', f0: 2200, f1: 650, q: 5, a: 0.1 });
        N(b, { t: e.t, dur: 0.4, vol: 0.12, type: 'bandpass', f0: 1100, f1: 320, q: 3, a: 0.1 });
        return 0.52;
      } },
    },
  },

  swing: {
    proposal: 'a',
    desc: 'Ein kurzer Hieb in die Luft: ein Stich, ein Schlenker oder eine schnelle Drehung.',
    variants: {
      a: { name: 'Peitsche', fn(e) {
        const b = bus(e, { comp: 3 });
        N(b, { t: e.t, dur: 0.12, vol: 0.2, type: 'highpass', f0: 2000, f1: 7500, a: 0.05 });
        snap(b, { t: e.t + 0.1, vol: 0.09, hp: 5000, len: 0.02 });
        return 0.2;
      } },
      b: { name: 'Stoss', fn(e) {
        const b = bus(e, { comp: 3 });
        N(b, { t: e.t, dur: 0.15, vol: 0.2, type: 'bandpass', f0: 900, f1: 2800, q: 3, a: 0.06 });
        T(b, { t: e.t, dur: 0.13, vol: 0.04, type: 'sine', f0: 600, f1: 1500, a: 0.05 });
        return 0.18;
      } },
      c: { name: 'Flügelschlag', fn(e) {
        const b = bus(e, { wet: 0.1, room: 0.15 });
        N(b, { t: e.t, dur: 0.07, vol: 0.2, type: 'bandpass', f0: 700, f1: 1500, q: 1.2, a: 0.02 });
        N(b, { t: e.t + 0.07, dur: 0.08, vol: 0.14, type: 'bandpass', f0: 900, f1: 1900, q: 1.2, a: 0.02 });
        return 0.18 + b.tail * 0.3;
      } },
      d: { name: 'Rute', fn(e) {
        const b = bus(e, {});
        T(b, { t: e.t, dur: 0.12, vol: 0.09, type: 'sine', f0: 1300, f1: 3400, sweep: 0.9, a: 0.04 });
        N(b, { t: e.t, dur: 0.1, vol: 0.1, type: 'bandpass', f0: 3200, f1: 5200, q: 1.5, a: 0.04 });
        return 0.16;
      } },
      e: { name: 'Zisch', fn(e) {
        const b = bus(e, { wet: 0.2, room: 0.18, dark: 0.3 });
        N(b, { t: e.t, dur: 0.13, vol: 0.18, type: 'highpass', f0: 4200, f1: 9500, a: 0.04 });
        return 0.15 + b.tail * 0.7;
      } },
      f: { name: 'Dumpf', fn(e) {
        const b = bus(e, { comp: 3 });
        N(b, { t: e.t, dur: 0.18, vol: 0.3, type: 'lowpass', f0: 300, f1: 1000, a: 0.07, buf: 'brown' });
        T(b, { t: e.t, dur: 0.16, vol: 0.08, type: 'sine', f0: 150, f1: 90, a: 0.05 });
        return 0.2;
      } },
    },
  },

  clang: {
    proposal: 'a',
    desc: 'Metall trifft Metall: Schwerter, Äxte oder Rüstungen prallen aufeinander (Kampfszene, der Moment des Aufpralls).',
    variants: {
      a: { name: 'Schwert hell', fn(e) {
        const b = bus(e, { wet: 0.2, room: 0.3, comp: 3 });
        const base = 800 + e.r() * 120;
        modal(b, { f: base, parts: P.bar, dec: 0.85, vol: 0.2, beat: 0.003 });
        snap(b, { vol: 0.2, hp: 3500, body: 0.08, bodyF: 400 });
        return 0.85 + b.tail * 0.6;
      } },
      b: { name: 'Axt schwer', fn(e) {
        const b = bus(e, { wet: 0.15, room: 0.3, comp: 4, drive: 1.2 });
        const base = 240 + e.r() * 40;
        modal(b, { f: base, parts: P.plate, dec: 0.8, vol: 0.2, beat: 0.005 });
        snap(b, { vol: 0.22, hp: 1800, body: 0.3, bodyF: 90 });
        N(b, { dur: 0.1, vol: 0.12, type: 'bandpass', f0: 900, f1: 400, q: 1.5 });
        return 0.8 + b.tail * 0.4;
      } },
      c: { name: 'Kette', fn(e) {   // five quick links rattling, then a short settle
        const b = bus(e, { wet: 0.12, room: 0.2 });
        for (let i = 0; i < 6; i++) {
          const t0 = e.t + i * (0.028 + e.r() * 0.02);
          modal(b, { t: t0, f: 1700 + e.r() * 900, parts: P.bar, dec: 0.2 + e.r() * 0.1, vol: 0.12 * (1 - i * 0.1) });
          N(b, { t: t0, dur: 0.02, vol: 0.12, type: 'highpass', f0: 4000 });
        }
        N(b, { t: e.t + 0.1, dur: 0.3, vol: 0.05, type: 'bandpass', f0: 3200, f1: 2200, q: 2, a: 0.04 });
        return 0.5 + b.tail;
      } },
      d: { name: 'Glocke', fn(e) {
        const b = bus(e, { wet: 0.32, room: 0.4, dark: 0.6 });
        modal(b, { f: 560 + e.r() * 40, parts: P.bell, dec: 1.0, vol: 0.18, beat: 0.002 });
        snap(b, { vol: 0.07, hp: 4000, len: 0.015 });
        return 1.0 + b.tail * 0.4;
      } },
      e: { name: 'Eisen dumpf', fn(e) {
        const b = bus(e, { comp: 4, drive: 1.5 });
        modal(b, { f: 330 + e.r() * 40, parts: P.plate, dec: 0.3, vol: 0.28 });
        snap(b, { vol: 0.2, hp: 1500, body: 0.25, bodyF: 130 });
        T(b, { dur: 0.15, vol: 0.06, type: 'triangle', f0: 700, f1: 450 });
        return 0.32;
      } },
      f: { name: 'Tick', fn(e) {
        const b = bus(e, { comp: 3 });
        modal(b, { f: 2300 + e.r() * 300, parts: P.bar, dec: 0.13, vol: 0.2 });
        snap(b, { vol: 0.2, hp: 5000, len: 0.012 });
        return 0.18;
      } },
    },
  },

  slice: {
    proposal: 'a',
    desc: 'Eine Klinge fährt durch etwas hindurch: ein Schnitt im Kampf, kurz bevor der Treffer sichtbar wird.',
    variants: {
      a: { name: 'Klinge glatt', fn(e) {
        const b = bus(e, { wet: 0.1, room: 0.2, comp: 3 });
        N(b, { dur: 0.13, vol: 0.24, type: 'highpass', f0: 3000, f1: 9000, a: 0.01 });
        modal(b, { f: 3400, parts: P.tine, dec: 0.28, vol: 0.05 });
        N(b, { t: e.t + 0.05, dur: 0.16, vol: 0.08, type: 'bandpass', f0: 1300, f1: 400, q: 1.5 });
        return 0.3 + b.tail;
      } },
      b: { name: 'Fleisch nass', fn(e) {
        const b = bus(e, { comp: 3 });
        N(b, { dur: 0.13, vol: 0.26, type: 'bandpass', f0: 1500, f1: 380, q: 1.4, a: 0.01 });
        T(b, { dur: 0.14, vol: 0.2, type: 'sine', f0: 130, f1: 55, sweep: 0.8 });
        for (let i = 0; i < 3; i++) T(b, { t: e.t + 0.05 + e.r() * 0.08, dur: 0.04, vol: 0.07, type: 'sine', f0: 250 + e.r() * 200, f1: 110 });
        N(b, { dur: 0.06, vol: 0.1, type: 'highpass', f0: 3000 });
        return 0.25;
      } },
      c: { name: 'Seide', fn(e) {
        const b = bus(e, { wet: 0.15, room: 0.2, dark: 0.3 });
        N(b, { dur: 0.22, vol: 0.2, type: 'bandpass', f0: 5200, f1: 2400, q: 0.8, a: 0.07 });
        N(b, { t: e.t + 0.04, dur: 0.16, vol: 0.06, type: 'highpass', f0: 7000, a: 0.05 });
        return 0.26 + b.tail * 0.6;
      } },
      d: { name: 'Sense', fn(e) {   // a swish and a soft thunk at the end
        const b = bus(e, { comp: 3 });
        N(b, { dur: 0.1, vol: 0.22, type: 'bandpass', f0: 700, f1: 3800, q: 1.5, a: 0.05 });
        T(b, { t: e.t + 0.07, dur: 0.12, vol: 0.2, type: 'sine', f0: 170, f1: 70, sweep: 0.8 });
        N(b, { t: e.t + 0.07, dur: 0.06, vol: 0.12, type: 'lowpass', f0: 1400, f1: 300, buf: 'brown' });
        return 0.22;
      } },
      e: { name: 'Zerreissen', fn(e) {   // cloth: a string of tiny grains
        const b = bus(e, { comp: 3 });
        for (let i = 0; i < 12; i++) N(b, { t: e.t + i * 0.008 + e.r() * 0.006, dur: 0.015 + e.r() * 0.015, vol: 0.15 * (0.5 + e.r() * 0.5), type: 'bandpass', f0: 1800 + e.r() * 3200, q: 1.2, a: 0.004 });
        N(b, { dur: 0.12, vol: 0.06, type: 'highpass', f0: 3500, a: 0.03 });
        return 0.2;
      } },
      f: { name: 'Funken', fn(e) {
        const b = bus(e, { wet: 0.2, room: 0.25, comp: 3 });
        N(b, { dur: 0.12, vol: 0.18, type: 'highpass', f0: 3500, f1: 8000, a: 0.01 });
        modal(b, { f: 5200, parts: P.tine, dec: 0.12, vol: 0.05 });
        for (let i = 0; i < 4; i++) modal(b, { t: e.t + 0.03 + e.r() * 0.1, f: 3500 + e.r() * 4000, parts: P.tine, dec: 0.05, vol: 0.04 });
        return 0.25 + b.tail * 0.4;
      } },
    },
  },

  splat: {
    proposal: 'd',
    desc: 'Ein nasser Aufprall: die Figur platzt in Farbe, Schleim oder Saft (Treffer ohne Knochen).',
    variants: {
      a: { name: 'Matsch', fn(e) {
        const b = bus(e, { wet: 0.15, room: 0.25, dark: 0.8, comp: 3 });
        T(b, { dur: 0.3, vol: 0.32, type: 'sine', f0: 130, f1: 42, sweep: 0.8 });
        N(b, { dur: 0.4, vol: 0.3, type: 'lowpass', f0: 1000, f1: 120, q: 0.6, a: 0.005 });
        N(b, { dur: 0.1, vol: 0.1, type: 'bandpass', f0: 2500, q: 0.8 });
        for (let i = 0; i < 4; i++) T(b, { t: e.t + 0.12 + e.r() * 0.3, dur: 0.07, vol: 0.08, type: 'sine', f0: 220 + e.r() * 140, f1: 80 });
        return 0.5 + b.tail * 0.5;
      } },
      b: { name: 'Wasserbombe', fn(e) {
        const b = bus(e, { wet: 0.15, room: 0.25, comp: 3 });
        N(b, { dur: 0.28, vol: 0.26, type: 'bandpass', f0: 600, f1: 2600, q: 0.9, a: 0.01 });
        T(b, { dur: 0.22, vol: 0.22, type: 'sine', f0: 150, f1: 60, sweep: 0.8 });
        for (let i = 0; i < 6; i++) { const f = 300 + e.r() * 500; T(b, { t: e.t + 0.1 + i * 0.05 + e.r() * 0.03, dur: 0.06, vol: 0.07, type: 'sine', f0: f, f1: f * 1.9, sweep: 0.9 }); }
        return 0.55 + b.tail * 0.5;
      } },
      c: { name: 'Torte', fn(e) {   // soft, dark, no sparkle
        const b = bus(e, { comp: 3 });
        N(b, { dur: 0.36, vol: 0.38, type: 'lowpass', f0: 600, f1: 110, q: 0.5, a: 0.012, buf: 'brown' });
        T(b, { dur: 0.3, vol: 0.28, type: 'sine', f0: 95, f1: 42, sweep: 0.8, a: 0.008 });
        T(b, { t: e.t + 0.04, dur: 0.22, vol: 0.07, type: 'sine', f0: 210, f1: 80, wobble: [14, 90] });
        return 0.4;
      } },
      d: { name: 'Blubb', fn(e) {   // a thick body and bubbles popping up
        const b = bus(e, { wet: 0.12, room: 0.2, comp: 3 });
        T(b, { dur: 0.25, vol: 0.26, type: 'sine', f0: 120, f1: 50, sweep: 0.8 });
        N(b, { dur: 0.16, vol: 0.14, type: 'lowpass', f0: 900, f1: 150, a: 0.004 });
        let t0 = e.t + 0.06;
        for (let i = 0; i < 6; i++) {
          const f = 160 + e.r() * 260;
          T(b, { t: t0, dur: 0.05 + e.r() * 0.04, vol: 0.1, type: 'sine', f0: f, f1: f * 2.2, sweep: 0.9, a: 0.004 });
          t0 += 0.03 + e.r() * 0.07;
        }
        return Math.min(0.6, t0 - e.t + 0.08) + b.tail * 0.5;
      } },
      e: { name: 'Spritzer', fn(e) {
        const b = bus(e, { wet: 0.12, room: 0.25 });
        N(b, { dur: 0.3, vol: 0.2, type: 'highpass', f0: 2200, f1: 800, a: 0.006 });
        T(b, { dur: 0.18, vol: 0.2, type: 'sine', f0: 140, f1: 55, sweep: 0.8 });
        for (let i = 0; i < 10; i++) T(b, { t: e.t + 0.04 + e.r() * 0.38, dur: 0.04, vol: 0.06, type: 'sine', f0: 500 + e.r() * 800, f1: 250 });
        return 0.5 + b.tail * 0.5;
      } },
      f: { name: 'Knatsch', fn(e) {
        const b = bus(e, { comp: 5, drive: 1.3 });
        snap(b, { vol: 0.2, hp: 2000, body: 0.3, bodyF: 110 });
        N(b, { dur: 0.15, vol: 0.28, type: 'bandpass', f0: 800, f1: 300, q: 3 });
        N(b, { t: e.t + 0.05, dur: 0.2, vol: 0.12, type: 'lowpass', f0: 700, f1: 120, buf: 'brown' });
        return 0.32;
      } },
    },
  },

  crack: {
    proposal: 'a',
    desc: 'Etwas Hartes bricht entzwei: Marmor, Ebenholz, Knochen oder Eis (der Riss vor dem Zersplittern).',
    variants: {
      a: { name: 'Stein', fn(e) {
        const b = bus(e, { wet: 0.12, room: 0.2, comp: 4 });
        snap(b, { vol: 0.28, hp: 2500, body: 0.28, bodyF: 100 });
        modal(b, { t: e.t + 0.01, f: 520, parts: P.stone, dec: 0.3, vol: 0.12 });
        N(b, { t: e.t + 0.03, dur: 0.12, vol: 0.16, type: 'bandpass', f0: 1500, f1: 700, q: 2 });
        return 0.34 + b.tail * 0.5;
      } },
      b: { name: 'Holz', fn(e) {
        const b = bus(e, { comp: 4 });
        N(b, { dur: 0.04, vol: 0.28, type: 'bandpass', f0: 1800, q: 1.6 });
        modal(b, { f: 700 + e.r() * 80, parts: P.wood, dec: 0.16, vol: 0.2 });
        T(b, { dur: 0.15, vol: 0.2, type: 'sine', f0: 170, f1: 90, sweep: 0.8 });
        N(b, { t: e.t + 0.06, dur: 0.08, vol: 0.12, type: 'bandpass', f0: 2300, q: 2 });
        return 0.25;
      } },
      c: { name: 'Eis', fn(e) {
        const b = bus(e, { wet: 0.25, room: 0.3, dark: 0.3 });
        snap(b, { vol: 0.2, hp: 4500, len: 0.02 });
        modal(b, { f: 1900 + e.r() * 200, parts: P.glass, dec: 0.32, vol: 0.12 });
        T(b, { t: e.t + 0.02, dur: 0.1, vol: 0.05, type: 'sine', f0: 4800, f1: 2400 });
        return 0.34 + b.tail * 0.5;
      } },
      d: { name: 'Knochen', fn(e) {   // a first crack, a smaller second one
        const b = bus(e, { comp: 4 });
        snap(b, { vol: 0.28, hp: 2000, body: 0.2, bodyF: 130 });
        modal(b, { f: 480, parts: P.wood, dec: 0.12, vol: 0.14 });
        snap(b, { t: e.t + 0.07, vol: 0.16, hp: 2800, len: 0.02 });
        modal(b, { t: e.t + 0.07, f: 620, parts: P.wood, dec: 0.1, vol: 0.09 });
        return 0.25;
      } },
      e: { name: 'Donnerriss', fn(e) {   // a long splitting tear, dark
        const b = bus(e, { wet: 0.2, room: 0.3, dark: 0.7, comp: 4 });
        N(b, { dur: 0.32, vol: 0.34, type: 'lowpass', f0: 5000, f1: 300, q: 0.7, a: 0.005 });
        snap(b, { vol: 0.2, hp: 2200 });
        T(b, { dur: 0.3, vol: 0.26, type: 'sine', f0: 90, f1: 45, sweep: 0.8 });
        return 0.38 + b.tail * 0.6;
      } },
      f: { name: 'Tief', fn(e) {
        const b = bus(e, { comp: 5, drive: 1.5 });
        T(b, { dur: 0.3, vol: 0.4, type: 'sine', f0: 85, f1: 38, sweep: 0.8 });
        N(b, { dur: 0.1, vol: 0.22, type: 'bandpass', f0: 900, f1: 500, q: 2 });
        modal(b, { f: 300, parts: P.stone, dec: 0.18, vol: 0.14 });
        return 0.35;
      } },
    },
  },

  shatter: {
    proposal: 'a',
    desc: 'Ein Haufen Scherben fällt auseinander: ein Riss, ein Regen aus Splittern und ein dumpfes Setzen.',
    variants: {
      a: { name: 'Glas', fn(e) {
        const b = bus(e, { wet: 0.25, room: 0.4, comp: 3 });
        snap(b, { vol: 0.26, hp: 3000, body: 0.2, bodyF: 120 });
        shards(b, { t: e.t + 0.03, span: 0.65, n: 22, lo: 1800, hi: 7000, vol: 0.07, dec: 0.14 });
        N(b, { t: e.t + 0.3, dur: 0.4, vol: 0.08, type: 'lowpass', f0: 900, f1: 200, buf: 'brown' });
        return 1.0 + b.tail * 0.4;
      } },
      b: { name: 'Porzellan', fn(e) {   // fewer, bigger clinks and a roll at the end
        const b = bus(e, { wet: 0.2, room: 0.3, comp: 3 });
        snap(b, { vol: 0.22, hp: 2500, body: 0.25, bodyF: 110 });
        shards(b, { t: e.t + 0.04, span: 0.4, n: 8, lo: 1000, hi: 3200, vol: 0.12, parts: P.bar, dec: 0.17, power: 1.2 });
        for (let i = 0; i < 6; i++) { const t0 = e.t + 0.48 + i * 0.04 * (1 + i * 0.2); modal(b, { t: t0, f: 2800 + e.r() * 1000, parts: P.tine, dec: 0.05, vol: 0.05 }); }
        return 1.0 + b.tail * 0.3;
      } },
      c: { name: 'Eis splittert', fn(e) {
        const b = bus(e, { wet: 0.3, room: 0.35, dark: 0.4, comp: 3 });
        snap(b, { vol: 0.22, hp: 4000 });
        for (let i = 0; i < 16; i++) { const t0 = e.t + 0.03 + Math.pow(e.r(), 1.5) * 0.6, f = 900 + e.r() * 2400; T(b, { t: t0, dur: 0.08 + e.r() * 0.1, vol: 0.06, type: 'sine', f0: f * 1.6, f1: f, sweep: 0.6 }); }
        N(b, { t: e.t + 0.1, dur: 0.45, vol: 0.1, type: 'lowpass', f0: 3000, f1: 500, buf: 'brown' });
        return 0.95 + b.tail * 0.4;
      } },
      d: { name: 'Stein bricht', fn(e) {   // heavy chunks falling and dust
        const b = bus(e, { wet: 0.2, room: 0.35, dark: 0.7, comp: 4 });
        snap(b, { vol: 0.28, hp: 1800, body: 0.35, bodyF: 80 });
        for (let i = 0; i < 6; i++) { const t0 = e.t + 0.08 + Math.pow(e.r(), 1.3) * 0.6; modal(b, { t: t0, f: 180 + e.r() * 260, parts: P.stone, dec: 0.2, vol: 0.14 }); N(b, { t: t0, dur: 0.05, vol: 0.1, type: 'lowpass', f0: 1400, f1: 300 }); }
        N(b, { t: e.t + 0.2, dur: 0.6, vol: 0.1, type: 'lowpass', f0: 1200, f1: 150, buf: 'brown' });
        return 1.0 + b.tail * 0.3;
      } },
      e: { name: 'Kristall', fn(e) {   // fewer shards that ring on, in a hall
        const b = bus(e, { wet: 0.4, room: 0.5, dark: 0.5 });
        snap(b, { vol: 0.16, hp: 3500 });
        shards(b, { t: e.t + 0.02, span: 0.35, n: 8, lo: 1200, hi: 3600, vol: 0.09, parts: P.bell, dec: 0.5, power: 1.2 });
        return 0.9 + b.tail * 0.4;
      } },
      f: { name: 'Knusper', fn(e) {   // lots of tiny crunches
        const b = bus(e, { comp: 3 });
        snap(b, { vol: 0.24, hp: 2500, body: 0.25, bodyF: 120 });
        for (let i = 0; i < 40; i++) N(b, { t: e.t + 0.03 + Math.pow(e.r(), 1.4) * 0.75, dur: 0.012 + e.r() * 0.02, vol: 0.12 * (0.4 + e.r() * 0.6), type: 'bandpass', f0: 1200 + e.r() * 5000, q: 1.5, a: 0.003 });
        N(b, { t: e.t + 0.25, dur: 0.4, vol: 0.07, type: 'lowpass', f0: 800, f1: 180, buf: 'brown' });
        return 0.95;
      } },
    },
  },

  thud: {
    proposal: 'b',
    desc: 'Etwas Schweres landet auf dem Brett: die Figur kracht herunter oder wird zu Boden geworfen.',
    variants: {
      a: { name: 'Sack', fn(e) {
        const b = bus(e, { comp: 4 });
        T(b, { dur: 0.32, vol: 0.4, type: 'sine', f0: 95, f1: 40, sweep: 0.8, a: 0.004 });
        N(b, { dur: 0.16, vol: 0.2, type: 'lowpass', f0: 450, f1: 100, buf: 'brown', a: 0.004 });
        return 0.4;
      } },
      b: { name: 'Fels', fn(e) {
        const b = bus(e, { wet: 0.18, room: 0.25, dark: 0.8, comp: 4 });
        T(b, { dur: 0.32, vol: 0.4, type: 'sine', f0: 72, f1: 32, sweep: 0.85, a: 0.004 });
        modal(b, { f: 130, parts: P.stone, dec: 0.17, vol: 0.12 });
        snap(b, { vol: 0.1, hp: 1200, len: 0.03 });
        N(b, { dur: 0.1, vol: 0.12, type: 'lowpass', f0: 700, f1: 120, buf: 'brown' });
        return 0.36 + b.tail * 0.4;
      } },
      c: { name: 'Holz', fn(e) {
        const b = bus(e, { wet: 0.08, room: 0.15, comp: 4 });
        modal(b, { f: 190 + e.r() * 20, parts: P.wood, dec: 0.2, vol: 0.28 });
        T(b, { dur: 0.2, vol: 0.28, type: 'sine', f0: 110, f1: 60, sweep: 0.8 });
        N(b, { dur: 0.03, vol: 0.12, type: 'bandpass', f0: 1500, q: 1.5 });
        return 0.28 + b.tail * 0.5;
      } },
      d: { name: 'Erde', fn(e) {
        const b = bus(e, { comp: 4 });
        N(b, { dur: 0.36, vol: 0.4, type: 'lowpass', f0: 260, f1: 70, buf: 'brown', a: 0.012 });
        T(b, { dur: 0.34, vol: 0.34, type: 'sine', f0: 62, f1: 34, sweep: 0.85, a: 0.01 });
        return 0.42;
      } },
      e: { name: 'Trommel', fn(e) {
        const b = bus(e, { wet: 0.2, room: 0.3, comp: 4 });
        T(b, { dur: 0.3, vol: 0.38, type: 'sine', f0: 150, f1: 62, sweep: 0.5, a: 0.002 });
        T(b, { dur: 0.12, vol: 0.1, type: 'triangle', f0: 300, f1: 160 });
        N(b, { dur: 0.05, vol: 0.18, type: 'bandpass', f0: 1600, q: 1 });
        return 0.35 + b.tail * 0.5;
      } },
      f: { name: 'Doppelschlag', fn(e) {
        const b = bus(e, { comp: 4 });
        T(b, { dur: 0.28, vol: 0.38, type: 'sine', f0: 100, f1: 40, sweep: 0.8, a: 0.004 });
        N(b, { dur: 0.1, vol: 0.14, type: 'lowpass', f0: 700, f1: 120, buf: 'brown' });
        T(b, { t: e.t + 0.11, dur: 0.18, vol: 0.24, type: 'sine', f0: 120, f1: 50, sweep: 0.8, a: 0.004 });
        N(b, { t: e.t + 0.11, dur: 0.07, vol: 0.09, type: 'lowpass', f0: 800, f1: 150, buf: 'brown' });
        return 0.42;
      } },
    },
  },

  magic: {
    proposal: 'b',
    desc: 'Ein Zauber wirkt: Funkeln und steigende Töne, wenn eine Figur verwandelt oder verzaubert wird.',
    variants: {
      a: { name: 'Glitzer', fn(e) {
        const b = bus(e, { wet: 0.3, room: 0.4, dark: 0.4 });
        for (let i = 0; i < 14; i++) modal(b, { t: e.t + Math.pow(e.r(), 1.2) * 0.55, f: 1800 + e.r() * 3600, parts: P.tine, dec: 0.18 + e.r() * 0.15, vol: 0.07 });
        N(b, { dur: 0.55, vol: 0.04, type: 'highpass', f0: 6000, a: 0.2 });
        return 0.8 + b.tail * 0.3;
      } },
      b: { name: 'Harfe', fn(e) {   // a plucked pentatonic run
        const b = bus(e, { wet: 0.28, room: 0.45, dark: 0.5 });
        [784, 880, 1047, 1319, 1568, 1760, 2093].forEach((f, i) => modal(b, { t: e.t + i * 0.06, f, parts: P.tine, dec: 0.3, vol: 0.13 }));
        return 0.7 + b.tail * 0.5;
      } },
      c: { name: 'Zauberstab', fn(e) {   // an FM shimmer that climbs
        const b = bus(e, { wet: 0.25, room: 0.4, dark: 0.4 });
        fm(b, { dur: 0.6, vol: 0.09, f: 700, ratio: 1.5, index: 2.2, a: 0.1 });
        T(b, { dur: 0.6, vol: 0.05, type: 'sine', f0: 900, f1: 2800, sweep: 0.9, a: 0.1, wobble: [7, 30] });
        for (let i = 0; i < 6; i++) fm(b, { t: e.t + 0.15 + i * 0.07, dur: 0.18, vol: 0.05, f: 2200 + i * 380, ratio: 2.01, index: 1.5 });
        return 0.75 + b.tail * 0.3;
      } },
      d: { name: 'Glocken', fn(e) {
        const b = bus(e, { wet: 0.3, room: 0.4, dark: 0.5 });
        [1047, 1319, 1568, 2093].forEach((f, i) => modal(b, { t: e.t + i * 0.1, f: f * 0.5, parts: P.bell, dec: 0.5, vol: 0.1, beat: 0.002 }));
        return 0.8 + b.tail * 0.3;
      } },
      e: { name: 'Klangteppich', fn(e) {   // a chord that swells and fades with sparkles
        const b = bus(e, { wet: 0.4, room: 0.45, dark: 0.5 });
        [523, 659, 784, 1047].forEach((f, i) => { T(b, { dur: 0.75, vol: 0.06, type: 'triangle', f0: f, a: 0.28, detune: -6 }); T(b, { dur: 0.75, vol: 0.05, type: 'sine', f0: f * 2, a: 0.3, detune: 7 + i }); });
        for (let i = 0; i < 6; i++) modal(b, { t: e.t + 0.25 + i * 0.07, f: 2400 + e.r() * 2400, parts: P.tine, dec: 0.15, vol: 0.05 });
        return 0.8 + b.tail * 0.3;
      } },
      f: { name: 'Rückwärts', fn(e) {   // a reversed swell that ends in one ping
        const b = bus(e, { wet: 0.25, room: 0.4, dark: 0.4 });
        N(b, { dur: 0.55, vol: 0.14, type: 'bandpass', f0: 1500, f1: 6000, q: 1.5, a: 0.5 });
        T(b, { dur: 0.55, vol: 0.05, type: 'sine', f0: 600, f1: 2400, sweep: 1, a: 0.5 });
        modal(b, { t: e.t + 0.5, f: 2093, parts: P.tine, dec: 0.3, vol: 0.14 });
        return 0.8 + b.tail * 0.2;
      } },
    },
  },
};
