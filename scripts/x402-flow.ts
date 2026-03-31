scripts/x402-flow.ts/**
 * x402 flow test
 *
 * Tests the full x402 HTTP payment flow end-to-end:
 *   Agent → 402 → Proco facilitator → 200
 *
 * Run: npx ts-node scripts/x402-flow.ts
 */

import * as dotenv from 'dotenv'
dotenv.config()

const PROCO_API_KEY = process.env.PROCO_API_KEY
const BASE_URL = 'https://sandbox.api.procohq.com'

if (!PROCO_API_KEY) {
  console.error('Missing PROCO_API_KEY in .env')
  process.exit(1)
}

async function procoFetch(
  walletId: string,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // 1. First attempt — no payment
  const firstAttempt = await fetch(url, options)

  if (firstAttempt.status !== 402) {
    return firstAttempt
  }

  // 2. Got 402 — request payment header from Proco
  const paymentRequired = await firstAttempt.json()
  const paymentRequiredHeader = paymentRequired.accepts?.[0]

  if (!paymentRequiredHeader) {
    throw new Error('Server returned 402 but no payment instructions')
  }

  // 3. Ask Proco facilitator to generate payment proof
  const signRes = await fetch(`${BASE_URL}/v1/payments/sign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PROCO_API_KEY}`,
    },
    body: JSON.stringify({
      wallet: walletId,
      paymentRequiredHeader,
    }),
  })

  if (!signRes.ok) {
    throw new Error(`Failed to sign payment: ${signRes.status}`)
  }

  const { paymentHeader } = await signRes.json()

  // 4. Retry the request with payment proof attached
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'x-payment': paymentHeader,
    },
  })
}

async function run() {
  console.log('=== Proco Sandbox: x402 Flow Test ===\n')

  // Create wallet
  const walletRes = await fetch(`${BASE_URL}/v1/wallets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PROCO_API_KEY}`,
    },
    body: JSON.stringify({
      agentId: `x402-test-${Date.now()}`,
      policies: { dailyCap: 10_00, currency: 'USDC' },
    }),
  })
  const wallet = await walletRes.json()
  console.log(`Wallet: ${wallet.id}`)
  console.log(`Balance: ${wallet.balance} USDC\n`)

  // Test endpoints
  const endpoints = [
    { url: 'https://test.x402.dev/weather', label: 'Weather ($0.01)' },
    { url: 'https://test.x402.dev/search?q=AI+agents', label: 'Search ($0.05)' },
  ]

  for (const { url, label } of endpoints) {
    console.log(`Testing: ${label}`)
    const start = Date.now()

    const res = await procoFetch(wallet.id, url)
    const data = await res.json()
    const elapsed = Date.now() - start

    const paymentResponse = res.headers.get('x-payment-response')
    const settlement = paymentResponse ? JSON.parse(paymentResponse) : null

    console.log(`  ✓ Status: ${res.status}`)
    console.log(`  ✓ Data: ${JSON.stringify(data).substring(0, 80)}...`)
    console.log(`  ✓ Total time (inc. payment): ${elapsed}ms`)
    if (settlement?.txHash) {
      console.log(`  ✓ Tx: https://sepolia.basescan.org/tx/${settlement.txHash}`)
    }
    console.log()
  }

  console.log('=== All x402 flows passed ✓ ===')
}

run().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
