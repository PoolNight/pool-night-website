const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const strings = (value) =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const id = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
const slot = (value) => value === null || id(value);
const count = (value) => Number.isSafeInteger(value) && value >= 0;
const optional = (value, check) => value === undefined || check(value);
const matches = (value) =>
  Array.isArray(value) &&
  value.every(
    (match) =>
      object(match) &&
      slot(match.a) &&
      slot(match.b) &&
      slot(match.w) &&
      optional(match.tb, id) &&
      optional(match.ts, count) &&
      optional(match.t, count) &&
      optional(match.live, (live) => typeof live === "boolean"),
  );

function section(value) {
  return (
    object(value) &&
    typeof value.t === "string" &&
    strings(value.titles) &&
    Array.isArray(value.rounds) &&
    value.rounds.length > 0 &&
    value.titles.length === value.rounds.length &&
    value.rounds.every((round) => matches(round) && round.length > 0)
  );
}

function knockout(rounds) {
  return (
    rounds.at(-1).length === 1 &&
    rounds
      .slice(1)
      .every((round, index) => rounds[index].length === 2 * round.length)
  );
}

function bracket(value) {
  if (
    !(
      object(value) &&
      typeof value.name === "string" &&
      typeof value.level === "string" &&
      Array.isArray(value.secs) &&
      value.secs.every(section)
    )
  )
    return false;

  const [first, losers, finals] = value.secs;
  if (!first || !knockout(first.rounds)) return false;
  if (value.type === "de") {
    return (
      value.secs.length === 3 &&
      first.refs == null &&
      losers.rounds.length === 2 * first.rounds.length - 2 &&
      Array.isArray(losers.desc) &&
      losers.desc.length === losers.rounds.length &&
      losers.rounds.every((round, index) => {
        const desc = losers.desc[index];
        if (!object(desc) || !count(desc.r)) return false;
        if (index === 0)
          return (
            desc.t === "pair" && round.length * 2 === first.rounds[0].length
          );
        if (desc.t === "pair")
          return round.length * 2 === losers.rounds[index - 1].length;
        return (
          desc.t === "drop" &&
          round.length === losers.rounds[index - 1].length &&
          round.length === first.rounds[desc.r]?.length
        );
      }) &&
      losers.rounds.at(-1).length === 1 &&
      finals.rounds.length === 2 &&
      finals.rounds.every((round) => round.length === 1)
    );
  }
  if (value.secs.length !== 1) return false;
  if (value.type === "se") return first.refs == null;
  return (
    value.type === "po" &&
    count(value.q) &&
    Array.isArray(value.groups) &&
    value.groups.length > 0 &&
    value.groups.every(
      (group) =>
        object(group) &&
        Array.isArray(group.ps) &&
        group.ps.every(id) &&
        matches(group.ms),
    ) &&
    Array.isArray(first.refs) &&
    first.refs.length === 2 * first.rounds[0].length &&
    first.refs.every(
      (ref) =>
        ref === "-" ||
        (object(ref) &&
          count(ref.g) &&
          ref.g < value.groups.length &&
          count(ref.pos)),
    )
  );
}

export function isTournament(value) {
  return (
    object(value) &&
    ["all", "level"].includes(value.mode) &&
    Array.isArray(value.players) &&
    value.players.every(
      (player) =>
        object(player) &&
        id(player.id) &&
        [player.p, player.n, player.l].every(
          (text) => typeof text === "string",
        ),
    ) &&
    (value.brackets === null ||
      (Array.isArray(value.brackets) && value.brackets.every(bracket))) &&
    optional(value.format, (format) => ["se", "de", "po"].includes(format)) &&
    optional(value.size, (size) => [3, 4, 5].includes(size)) &&
    optional(value.q, (q) => [1, 2, 3].includes(q)) &&
    optional(value.tmin, (minutes) => count(minutes) && minutes <= 240) &&
    optional(
      value.tables,
      (tables) =>
        Array.isArray(tables) &&
        tables.length <= 30 &&
        tables.every(
          (table) =>
            object(table) &&
            id(table.id) &&
            typeof table.name === "string" &&
            typeof table.ready === "boolean" &&
            optional(table.acc, count),
        ),
    )
  );
}
