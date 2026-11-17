// Each town runs its buses in its own colours (drawn from the Flow city-bus reference sheet, as
// colours only: every bus keeps the same Green City body shape from city-life.js drawBus).
// - body: the main panels.
// - top: the band around the windows (omit to use body).
// - stripe: the thin line under the windows; wave draws it as a rolling wave instead.
// - skirt: the strip along the bottom (omit to use body).
export const BUS_LIVERIES = {
  // Sage green below, cream around the windows, a darker green skirt.
  greenCity: { body: 0x8fa983, top: 0xe2dfc4, stripe: 0x5f7d58, skirt: 0x4f6849 },
  // Harbour navy with a white wave along the side.
  bayport: { body: 0x2f4664, stripe: 0xe6ecee, wave: true, skirt: 0x23354d },
  // Sand yellow with a terracotta stripe and skirt.
  sandport: { body: 0xdcbf78, stripe: 0xc0643e, skirt: 0xb0583a },
  // Brick red over a charcoal skirt.
  rivertown: { body: 0xa4473c, stripe: 0x3c3a3c, skirt: 0x4a484b },
  // Orchard green with an apple-wood brown stripe.
  orchard: { body: 0x4f7449, stripe: 0x8a5a3a, skirt: 0x3d5a39 },
  // Meadow sky blue with a sunflower stripe.
  windmill: { body: 0x7fa9c6, stripe: 0xe0c050, skirt: 0x5f89a6 },
  // Oasis teal with a bleached-sand stripe.
  palmOasis: { body: 0x4f8a80, stripe: 0xe4d8bc, skirt: 0x2f6a60 },
};
