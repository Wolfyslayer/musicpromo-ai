import { LANGUAGES } from "@/services/constants";

/** Song language from create flow / Song entity (never omit for AI calls). */
export function resolveSongLanguage(song) {
  const raw = String(song?.language || song?.lang || "").trim();
  if (raw) return raw;
  return "English";
}

export function isInstrumentalLanguage(language) {
  return String(language || "").trim().toLowerCase() === "instrumental";
}

/** Language used for promo copy when Instrumental is selected. */
export function promoOutputLanguage(song) {
  const lang = resolveSongLanguage(song);
  if (!isInstrumentalLanguage(lang)) return lang;
  return "English";
}

/** Ensure AI payloads always carry language (and artist display name). */
export function normalizeSongForAI(song, artistName) {
  if (!song || typeof song !== "object") return { language: "English", artistName: artistName || "" };
  return {
    ...song,
    language: resolveSongLanguage(song),
    artistName: artistName || song.artistName || song.artist_name || "",
  };
}

const FALLBACK_COPY = {
  English: {
    hook: (title) => `${title} — don't scroll past this`,
    cta: "Link in bio — stream now",
    hashtags: "#newmusic #indieartist #musicpromo #fyp #songwriter",
  },
  Spanish: {
    hook: (title) => `${title} — no te lo pierdas`,
    cta: "Enlace en bio — escúchala ya",
    hashtags: "#musicanueva #artistaindependiente #promomusical #fyp #cantautor",
  },
  French: {
    hook: (title) => `${title} — ne fais pas défiler`,
    cta: "Lien en bio — écoute maintenant",
    hashtags: "#nouvellemusique #artisteindé #promomusicale #fyp #auteur",
  },
  German: {
    hook: (title) => `${title} — nicht weiterscrollen`,
    cta: "Link in Bio — jetzt streamen",
    hashtags: "#neuemusik #indieartist #musikpromo #fyp #songwriter",
  },
  Swedish: {
    hook: (title) => `${title} — scrolla inte förbi`,
    cta: "Länk i bio — lyssna nu",
    hashtags: "#nymusik #indieartist #musikpromo #fyp #låtskrivare",
  },
  Norwegian: {
    hook: (title) => `${title} — ikke scroll forbi`,
    cta: "Lenke i bio — lytt nå",
    hashtags: "#nymusikk #indieartist #musikkpromo #fyp #låtskriver",
  },
  Portuguese: {
    hook: (title) => `${title} — não passe reto`,
    cta: "Link na bio — ouça agora",
    hashtags: "#musicanova #artistaindependente #promomusical #fyp #autor",
  },
  Italian: {
    hook: (title) => `${title} — non scorrere oltre`,
    cta: "Link in bio — ascolta ora",
    hashtags: "#nuovamusica #artistaindie #promomusicale #fyp #cantautore",
  },
  Dutch: {
    hook: (title) => `${title} — scroll niet voorbij`,
    cta: "Link in bio — luister nu",
    hashtags: "#nieuwmuziek #indieartiest #muziekpromo #fyp #songwriter",
  },
  Japanese: {
    hook: (title) => `${title} — 見逃さないで`,
    cta: "プロフィールのリンクから今すぐ聴いてね",
    hashtags: "#新曲 #インディーアーティスト #音楽プロモ #fyp #シンガーソングライター",
  },
  Korean: {
    hook: (title) => `${title} — 놓치지 마세요`,
    cta: "프로필 링크에서 지금 들어보세요",
    hashtags: "#새음악 #인디아티스트 #음악홍보 #fyp #싱어송라이터",
  },
  Hindi: {
    hook: (title) => `${title} — इसे मत छोड़ो`,
    cta: "बायो में लिंक — अभी सुनो",
    hashtags: "#नयागाना #इंडीकलाकार #musicpromo #fyp #गीतकार",
  },
  Arabic: {
    hook: (title) => `${title} — لا تمرّ بدون مشاهدة`,
    cta: "الرابط في البايو — استمع الآن",
    hashtags: "#موسيقى_جديدة #فنان_مستقل #ترويج_موسيقى #fyp #كاتب_أغاني",
  },
  Instrumental: {
    hook: (title) => `${title} — feel this one`,
    cta: "Link in bio — listen now",
    hashtags: "#instrumental #newmusic #producer #beats #fyp",
  },
};

export function getPlanCopyFallbacks(song) {
  const lang = promoOutputLanguage(song);
  const pack = FALLBACK_COPY[lang] || FALLBACK_COPY.English;
  return pack;
}

export function isKnownLanguage(language) {
  return LANGUAGES.includes(language);
}
