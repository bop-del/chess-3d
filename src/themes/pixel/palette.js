// The Pixelwelt palette: heroes (White) in iron, blue and gold against monsters (Black) in bone, moss and violet with a lime glow.
// Heroes are the light side and monsters the dark side so the teams still read apart in greyscale.
import { shade } from './shade.js';

/** Fills every slot the figures use from a short spec. */
function slots(s) {
  const main = s.main;
  return {
    main, dark: s.dark ?? shade(main, 0.7), light: s.light ?? shade(main, 1.45),
    iron: s.iron, ironD: s.ironD ?? shade(s.iron, 0.72),
    trim: s.trim, trimD: s.trimD ?? shade(s.trim, 0.78),
    cloth: s.cloth, robe: s.robe, robeD: s.robeD ?? shade(s.robe, 0.72),
    skin: s.skin, skinD: s.skinD ?? shade(s.skin, 0.82), hair: s.hair, boots: s.boots,
    horse: s.horse ?? 0xe4dfd0, horseD: s.horseD ?? shade(s.horse ?? 0xe4dfd0, 0.84), mane: s.mane ?? main, hoof: s.hoof ?? 0x4a423c,
    glow: s.glow, bone: s.bone, boneD: s.boneD ?? shade(s.bone, 0.78), flesh: s.flesh, fleshD: s.fleshD ?? shade(s.flesh, 0.76),
    void: s.void ?? 0x17151d, crystal: s.crystal ?? main, crystalL: s.crystalL ?? shade(s.crystal ?? main, 1.5), wood: s.wood ?? 0x8a5f33,
    spider: s.spider, spiderD: s.spiderD ?? shade(s.spider, 0.7),
  };
}

export const PAL = {
  w: slots({ main: 0x2f67c8, iron: 0xcfd4dc, trim: 0xf2c53a, cloth: 0xf0ece2, robe: 0x8a6a45, skin: 0xe6b78f, hair: 0x6a4527, boots: 0x5a4632, glow: 0x9fe6ff, bone: 0xe8e4d2, flesh: 0xe6b78f, crystal: 0x4fa6ff, spider: 0x4a4a55 }),
  b: slots({ main: 0x6f3fc0, dark: 0x3d2272, light: 0xb58cf0, iron: 0x4a4f5a, trim: 0x8e7ac0, cloth: 0x3a3830, robe: 0x2c2a32, skin: 0x7f9f5a, hair: 0x1f1d24, boots: 0x232027, glow: 0xb8f040, bone: 0x938d76, flesh: 0x547a36, fleshD: 0x3d5c27, crystal: 0x7a48d0, spider: 0x24282a, void: 0x121016, horse: 0x24282a, mane: 0x6f3fc0 }),
};
