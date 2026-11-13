// Monotonic UUIDv7 IDs for the fake services (RFC 9562, section 6.2,
// method 1). Like the backend's IDs, they sort in creation order as strings,
// which the fakes rely on for newest-first ordering and keyset cursors.
//
// The 48-bit timestamp is followed by a 12-bit counter in rand_a. A new
// millisecond starts the counter at a random value in its lower half; each
// further ID in the same millisecond increments it. When the counter runs
// out, or the clock goes backwards, the timestamp moves one millisecond
// ahead of the last one used, so IDs never stop increasing. rand_b is random.

const COUNTER_MAX = 0xfff
// A new millisecond starts the counter below this value, which leaves at
// least 2048 increments before it overflows.
const COUNTER_START_LIMIT = 0x800

let lastMs = -1
let counter = 0

export function uuidv7(): string {
  const now = Date.now()
  if (now > lastMs) {
    lastMs = now
    counter = randomCounterStart()
  } else if (counter < COUNTER_MAX) {
    counter += 1
  } else {
    lastMs += 1
    counter = randomCounterStart()
  }

  const rand = crypto.getRandomValues(new Uint8Array(8))
  // The variant takes the top two bits of rand_b: 0b10.
  rand[0] = 0x80 | (rand[0]! & 0x3f)

  const time = lastMs.toString(16).padStart(12, '0')
  const randA = counter.toString(16).padStart(3, '0')
  const randB = hex(rand)
  return [
    time.slice(0, 8),
    time.slice(8, 12),
    `7${randA}`,
    randB.slice(0, 4),
    randB.slice(4, 16),
  ].join('-')
}

function randomCounterStart(): number {
  const [value] = crypto.getRandomValues(new Uint16Array(1))
  return value! % COUNTER_START_LIMIT
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
