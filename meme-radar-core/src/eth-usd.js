import { MAINNET_ADDRESSES } from 'hoodchain'
import { parseAbi } from 'viem'
import { quotePerTokenFromSqrtPrice } from './v4math.js'

const ZERO = '0x0000000000000000000000000000000000000000'
const FACTORY_ABI = parseAbi([
  'function getPool(address tokenA,address tokenB,uint24 fee) view returns (address)'
])
const POOL_ABI = parseAbi([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)',
  'function liquidity() view returns (uint128)'
])

const lower = (v) => String(v ?? '').toLowerCase()
const isAddress = (v) => /^0x[a-f0-9]{40}$/.test(lower(v))

export async function readEthUsdFromV3(publicClient, {
  factory = MAINNET_ADDRESSES.uniswapV3Factory,
  weth = MAINNET_ADDRESSES.weth,
  usdg = MAINNET_ADDRESSES.usdg,
  feeTiers = [100, 500, 3000, 10_000]
} = {}) {
  const candidates = await Promise.all(feeTiers.map(async (fee) => {
    try {
      const pool = lower(await publicClient.readContract({
        address: factory,
        abi: FACTORY_ABI,
        functionName: 'getPool',
        args: [weth, usdg, fee]
      }))
      if (!isAddress(pool) || pool === ZERO) return null

      const [token0, token1, slot0, liquidity] = await Promise.all([
        publicClient.readContract({ address: pool, abi: POOL_ABI, functionName: 'token0' }),
        publicClient.readContract({ address: pool, abi: POOL_ABI, functionName: 'token1' }),
        publicClient.readContract({ address: pool, abi: POOL_ABI, functionName: 'slot0' }),
        publicClient.readContract({ address: pool, abi: POOL_ABI, functionName: 'liquidity' })
      ])

      const t0 = lower(token0)
      const t1 = lower(token1)
      const wethLower = lower(weth)
      const usdgLower = lower(usdg)
      if (!((t0 === wethLower && t1 === usdgLower) || (t1 === wethLower && t0 === usdgLower))) return null

      const sqrtPriceX96 = Array.isArray(slot0) ? slot0[0] : slot0?.sqrtPriceX96
      const price = quotePerTokenFromSqrtPrice({
        tokenIs0: t0 === wethLower,
        tokenDecimals: 18,
        quoteDecimals: 6,
        sqrtPriceX96
      })
      const liq = BigInt(liquidity ?? 0n)
      if (!(price > 0) || liq <= 0n) return null
      return { price, pool, fee: Number(fee), liquidity: liq }
    } catch {
      return null
    }
  }))

  const viable = candidates.filter(Boolean)
  if (!viable.length) throw new Error('no live WETH/USDG Uniswap v3 pool with positive liquidity')
  viable.sort((a, b) => a.liquidity === b.liquidity ? 0 : (a.liquidity > b.liquidity ? -1 : 1))
  return viable[0]
}
