const Q96 = 2 ** 96

export function ethPerTokenFromSqrtPrice({ tokenIs0, tokenDecimals, sqrtPriceX96 }) {
  const decimals = Number(tokenDecimals)
  const sqrt = Number(sqrtPriceX96) / Q96
  if (!Number.isFinite(sqrt) || sqrt <= 0 || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) return 0
  const rawPrice1Per0 = sqrt * sqrt
  if (!Number.isFinite(rawPrice1Per0) || rawPrice1Per0 <= 0) return 0

  if (tokenIs0) {
    return rawPrice1Per0 * (10 ** (decimals - 18))
  }

  const tokenPerEth = rawPrice1Per0 * (10 ** (18 - decimals))
  return tokenPerEth > 0 ? 1 / tokenPerEth : 0
}

export function marketCapUsdFromPoolPrice({ ethPerToken, ethUsd, totalSupply, tokenDecimals }) {
  const decimals = Number(tokenDecimals)
  const supplyRaw = Number(totalSupply)
  if (!(ethPerToken > 0) || !(ethUsd > 0) || !Number.isFinite(supplyRaw) || supplyRaw <= 0) return 0
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return 0
  const supply = supplyRaw / (10 ** decimals)
  const mcap = ethPerToken * ethUsd * supply
  return Number.isFinite(mcap) && mcap > 0 ? mcap : 0
}

export function classifyMarketCap(marketCapUsd) {
  if (!Number.isFinite(marketCapUsd) || marketCapUsd < 0) return null
  if (marketCapUsd < 100_000) return 'PRIME_EARLY'
  if (marketCapUsd < 300_000) return 'EARLY'
  if (marketCapUsd < 600_000) return 'MOMENTUM'
  if (marketCapUsd < 1_000_000) return 'LATE_EARLY'
  return null
}
