import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadSpecialElite } from "@remotion/google-fonts/SpecialElite";

const montserrat = loadMontserrat("normal", {
  weights: ["600", "700", "800"],
  subsets: ["latin"],
});
const anton = loadAnton("normal", {
  weights: ["400"],
  subsets: ["latin"],
});
const specialElite = loadSpecialElite("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

export const FONT_POP = montserrat.fontFamily;
export const FONT_HIPHOP = anton.fontFamily;
export const FONT_ROCK = specialElite.fontFamily;

export async function waitForPromoFonts() {
  await Promise.all([
    montserrat.waitUntilDone(),
    anton.waitUntilDone(),
    specialElite.waitUntilDone(),
  ]);
}

export function fontForStyle(visualStyle) {
  if (visualStyle === "hiphop") return FONT_HIPHOP;
  if (visualStyle === "rock") return FONT_ROCK;
  return FONT_POP;
}

export function fontForChoice(fontId) {
  if (fontId === "display") return FONT_HIPHOP;
  if (fontId === "grunge") return FONT_ROCK;
  return FONT_POP;
}
