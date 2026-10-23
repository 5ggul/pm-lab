const Q96 = 2 ** 96

export function quotePerTokenFromSqrtPrice({ tokenIs0, tokenDecimals, quoteDecimals, sqrtPriceX96 }) {
  const tDecimals = Number(tokenDecimals)
  const qDecimals = Number(quoteDecimals)
  const sqrt = Number(sqrtPriceX96) / Q96
  if (!Number.isFinite(sqrt) || sqrt <= 0) return 0
  if (!Number.isInteger(tDecimals) || tDecimals < 0 || tDecimals > 36) return 0
  if (!Number.isInteger(qDecimals) || qDecimals < 0 || qDecimals > 36) return 0

  const rawPrice1Per0 = sqrt * sqrt
  if (!Number.isFinite(rawPrice1Per0) || rawPrice1Per0 <= 0) return 0

  if (tokenIs0) {
    return rawPrice1Per0 * (10 ** (tDecimals - qDecimals))
  }

  const tokenPerQuote = rawPrice1Per0 * (10 ** (qDecimals - tDecimals))
  return tokenPerQuote > 0 ? 1 / tokenPerQuote : 0
}

export function marketCapUsdFromQuotePrice({ quotePerToken, quoteUsd, totalSupply, tokenDecimals }) {
  const decimals = Number(tokenDecimals)
  const supplyRaw = Number(totalSupply)
  if (!(quotePerToken > 0) || !(quoteUsd > 0) || !Number.isFinite(supplyRaw) || supplyRaw <= 0) return 0
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return 0
  const supply = supplyRaw / (10 ** decimals)
  const mcap = quotePerToken * quoteUsd * supply
  return Number.isFinite(mcap) && mcap > 0 ? mcap : 0
}

export function ethPerTokenFromSqrtPrice({ tokenIs0, tokenDecimals, sqrtPriceX96 }) {
  return quotePerTokenFromSqrtPrice({ tokenIs0, tokenDecimals, quoteDecimals: 18, sqrtPriceX96 })
}

export function marketCapUsdFromPoolPrice({ ethPerToken, ethUsd, totalSupply, tokenDecimals }) {
  return marketCapUsdFromQuotePrice({
    quotePerToken: ethPerToken,
    quoteUsd: ethUsd,
    totalSupply,
    tokenDecimals
  })
}

export function classifyMarketCap(marketCapUsd) {
  if (!Number.isFinite(marketCapUsd) || marketCapUsd < 0) return null
  if (marketCapUsd < 100_000) return 'PRIME_EARLY'
  if (marketCapUsd < 300_000) return 'EARLY'
  if (marketCapUsd < 600_000) return 'MOMENTUM'
  if (marketCapUsd < 1_000_000) return 'LATE_EARLY'
  return null
}
