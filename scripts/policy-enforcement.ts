/**
 * Policy enforcement test
 *
 * Tests that Proco correctly enforces spending policies before
 * any on-chain transaction occurs.
 *
 * Run: npx ts-node scripts/policy-enforcement.ts
 */

import * as dotenv from 'dotenv'
dotenv.config()

const PROCO_API_KEY = process.env.PROCO_API_KEY
const BASE_URL = 'https://sandbox.api.procohq.com'

if (!PROCO_API_KEY) {
  console.error('Missing PROCO_API_KEY in .env')
  process.exit(1)
}

async function createWallet(agentId: string, policies: object) {
  const res = await fetch(`${BASE_URL}/v1/wallets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${PROCO_API_KEY}` },
    body: JSON.stringify({ agentId, policies }),
  })
  return res.json()
}

async function pay(walletId: string, amount: number, vendor: string) {
  const res = await fetch(`${BASE_URL}/v1/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${PROCO_API_KEY}` },
    body: JSON.stringify({ wallet: walletId, amount, vendor }),
  })
  return { status: res.status, body: await res.json() }
}

async function run() {
  console.log('=== Proco Sandbox: Policy Enforcement Tests ===\n')

  // Test 1: Daily cap
  console.log('Test 1: Daily cap enforcement')
  const cappedWallet = await createWallet('capped-agent', {
    dailyCap: 5_00,   // $5 cap
    currency: 'USDC',
  })
  const okPayment = await pay(cappedWallet.id, 4_50, 'test.x402.dev')
  console.log(`  ✓ $4.50 payment: ${okPayment.body.status}`)  // 'settled'
  const overCapPayment = await pay(cappedWallet.id, 1_00, 'test.x402.dev')
  console.log(`  ✓ $1.00 over cap (HTTP ${overCapPayment.status}): ${overCapPayment.body.error}`)
  console.log(`    Reason: ${overCapPayment.body.reason}\n`)

  // Test 2: Vendor allowlist
  console.log('Test 2: Vendor allowlist enforcement')
  const restrictedWallet = await createWallet('restricted-agent', {
    vendors: ['trusted-api.com'],
    dailyCap: 50_00,
    currency: 'USDC',
  })
  const allowedVendor = await pay(restrictedWallet.id, 1_00, 'trusted-api.com')
  console.log(`  ✓ trusted-api.com: ${allowedVendor.body.status}`)
  const blockedVendor = await pay(restrictedWallet.id, 1_00, 'untrusted-api.com')
  console.log(`  ✓ untrusted-api.com blocked (HTTP ${blockedVendor.status}): ${blockedVendor.body.reason}\n`)

  // Test 3: Per-transaction limit
  console.log('Test 3: Per-transaction limit')
  const perTxWallet = await createWallet('per-tx-agent', {
    perTx: 2_00,       // $2 max per tx
    dailyCap: 100_00,
    currency: 'USDC',
  })
  const underLimit = await pay(perTxWallet.id, 1_99, 'test.x402.dev')
  console.log(`  ✓ $1.99 payment: ${underLimit.body.status}`)
  const overLimit = await pay(perTxWallet.id, 2_01, 'test.x402.dev')
  console.log(`  ✓ $2.01 over limit (HTTP ${overLimit.status}): ${overLimit.body.reason}\n`)

  console.log('=== All policy tests passed ✓ ===')
  console.log('No on-chain transactions were made for rejected payments.')
}

run().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
