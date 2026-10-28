// The two items the extension picks in X's post menu have no stable test id, only a
// visible label. These are X's own labels for them, in every language the web client
// ships them in (X's translation bundles, keys dc73eb40 and hb568af4). In another
// interface language the item is not found and the post is only hidden.

export const NOT_INTERESTED_LABELS: readonly string[] = [
  "Not interested in this post", // en
  "Ce post ne m'intéresse pas", // fr
  "No me interesa este post", // es
  "Kein Interesse an diesem Post", // de
  "Il post non mi interessa", // it
  "Esse post não me interessa", // pt
  "Niet geïnteresseerd in deze post", // nl
  "Nie interesuje mnie ten wpis", // pl
  "غير مهتم بهذا المنشور", // ar
  "Bu gönderi ilgimi çekmiyor", // tr
];

export const MUTE_LABELS: readonly string[] = [
  "Mute", // en
  "Masquer", // fr
  "Silenciar", // es, pt
  "Stummschalten", // de
  "Silenzia", // it
  "Negeren", // nl
  "Wycisz", // pl
  "كتم", // ar
  "Sessize al", // tr
];

// Case, spacing and the two apostrophes X uses must not matter.
export function normalizeLabel(text: string): string {
  return text.normalize("NFC").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

// True when a menu item's text is one of the labels, or that label followed by the
// author's "@handle" (X has shown "Mute" both bare and as "Mute @handle").
export function matchesLabel(text: string, labels: readonly string[]): boolean {
  const n = normalizeLabel(text);
  return labels.some((l) => {
    const m = normalizeLabel(l);
    return n === m || n.startsWith(`${m} @`);
  });
}
