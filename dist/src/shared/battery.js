// A large change needs two distinct reports in the same range.
export function advanceBattery(previous, level, timestamp) {
 if (!Number.isFinite(level) || level < 0 || level > 100 || !Number.isFinite(timestamp) ||
     (previous && timestamp <= previous.checkedAt)) return previous;
 if (!previous || Math.abs(level - previous.level) <= 35 ||
     (previous.pending && timestamp - previous.checkedAt <= 600000 && Math.abs(level - previous.pending.level) <= 10 &&
      Math.sign(level - previous.level) === Math.sign(previous.pending.level - previous.level))) {
  return {level, timestamp, checkedAt: timestamp};
 }
 return {...previous, checkedAt: timestamp, pending: {level}};
}
