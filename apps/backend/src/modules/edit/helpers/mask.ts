export const mask = (...bits: number[]) => bits.reduce((acc, b) => acc | (1n << BigInt(b)), 0n)
export const hasBit = (mask: bigint, bit: number) => (mask & (1n << BigInt(bit))) !== 0n

export const maskOf = (...bits: number[]) => bits.reduce((acc, b) => acc | (1n << BigInt(b)), 0n)
