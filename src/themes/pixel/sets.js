// Pixelwelt Sets (CHE-239): named combinations of a sky and a backdrop, as data. The Sets row in Options applies one of these;
// ?set=<id> applies one for this load (an explicit ?sky= or ?backdrop= still wins). Inselmorgen is the default for new players.
export const SETS = [
  { id: 'sturmburg', en: 'Storm castle', de: 'Sturmburg', sky: 'storm', backdrop: 'castle', line: 'Regen und Blitze, unten eine Burg mit erleuchteten Fenstern.' },
  { id: 'inselmorgen', en: 'Island morning', de: 'Inselmorgen', sky: 'sunrise', backdrop: 'islands', line: 'Die Sonne geht auf, weitere Inseln schweben im Morgenlicht.' },
  { id: 'winterdorf', en: 'Winter village', de: 'Winterdorf', sky: 'snow', backdrop: 'castle', line: 'Schnee fällt auf ein Dorf mit warmen Lichtern.' },
];
