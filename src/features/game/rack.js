import { T } from "../../engine/game.js";
import { local } from "../../utils/store.js";

const CMP = {
  num: (x, y) => x.n - y.n || x.c - y.c,
  col: (x, y) => x.c - y.c || x.n - y.n,
};
export const orderRack = (r, m) =>
  m
    ? r.toSorted((a, b) => {
        const x = T(a),
          y = T(b);
        return (x.j ? 1 : 0) - (y.j ? 1 : 0) || CMP[m](x, y);
      })
    : r; // jokers last
export const loadSort = () => local.get("rmkSort") || null;
