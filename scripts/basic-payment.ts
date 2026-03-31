/**
 * Basic payment test
 *
 * Tests a simple agent wallet creation and payment flow
 * against the Proco sandbox environment.
 *
 * Run: npx ts-node scripts/basic-payment.ts
 */

import * as dotenv from 'dotenv'
dotenv.config()

const PROCO_API_KEY = process.env.PROCO_API_KEY

if (!PROCO_API_KEY) {
  console.error('Missing PROCO_API_KEY in .env')
  process.exit(1)
}

const BASE_URL = 'https://sandbox.api.procohq.com'

async function run() {
  console.log('=== Proco Sandbox: Basic Payment Test ===\n')

  // 1. Create an agent wallet
  console.log('1. Creating agent wallet...')
  const walletRes = await fetch(`${BASE_URL}/v1/wallets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PROCO_API_KEY}`,
    },
    body: JSON.stringify({
      agentId: `test-agent-${Date.now()}`,
      policies: {
        dailyCap: 100_00,   // $100 test budget
        currency: 'USDC',
      },
    }),
  })

  if (!walletRes.ok) {
    throw new Error(`Failed to create wallet: ${walletRes.status} ${await walletRes.text()}`)
  }

  const wallet = await walletRes.json()
  console.log(`   ✓ Wallet created: ${wallet.id}`)
  console.log(`   ✓ Balance: ${wallet.balance} USDC (testnet)\n`)

  // 2. Make a test payment
  console.log('2. Creating test payment ($1.00 USDC)...')
  const paymentRes = await fetch(`${BASE_URL}/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PROCO_API_KEY}`,
    },
    body: JSON.stringify({
      wallet: wallet.id,
      amount: 1_00,       // $1.00 in cents
      vendor: 'test.x402.dev',
      memo: 'basic-payment-test',
    }),
  })

  if (!paymentRes.ok) {
    throw new Error(`Payment failed: ${paymentRes.status} ${await paymentRes.text()}`)
  }

  const payment = await paymentRes.json()
  console.log(`   ✓ Payment settled: ${payment.status}`)
  console.log(`   ✓ Settlement time: ${payment.settlementMs}ms`)
  console.log(`   ✓ Tx hash: ${payment.txHash}`)
  console.log(`   ✓ Explorer: https://sepolia.basescan.org/tx/${payment.txHash}\n`)

  // 3. Check updated balance
  console.log('3. Checking updated balance...')
  const balanceRes = await fetch(`${BASE_URL}/v1/wallets/${wallet.id}`, {
    headers: { 'Authorization': `Bearer ${PROCO_API_KEY}` },
  })
  const updatedWallet = await balanceRes.json()
  console.log(`   ✓ New balance: ${updatedWallet.balance} USDC`)
  console.log(`   ✓ Total spent today: ${updatedWallet.spentToday} USDC\n`)

  console.log('=== Test passed ✓ ===')
}

run().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
