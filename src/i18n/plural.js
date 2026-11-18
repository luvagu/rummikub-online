// en and es both use the plain -s plural: "1 tile", "2 tiles" / "1 ficha", "2 fichas"
const PLURALS = new Intl.PluralRules('en')
export const s1 = n => (PLURALS.select(n) === 'one' ? '' : 's')
