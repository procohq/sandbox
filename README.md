# Proco Sandbox

[![Status](https://img.shields.io/badge/status-live-green)](https://procohq.com/sandbox)
[![Network](https://img.shields.io/badge/network-Base%20Sepolia-blue)](https://sepolia.basescan.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Free developer environment for building and testing AI agent payments. Testnet USDC on Base Sepolia. No credit card. No real money.

**[→ Start for free at procohq.com/sandbox](https://procohq.com/sandbox)**

---

## What you can do in Sandbox

- Create agent wallets with testnet USDC balances
- Test payment policies (daily caps, vendor allowlists, per-tx limits)
- Run x402 payments against any x402-compatible test endpoint
- Test agent-to-agent invoice creation and settlement
- Simulate policy violations and error handling
- Build and iterate — without spending real money

Everything in Sandbox maps 1:1 to Production. Swap `env: 'sandbox'` → `env: 'production'` and your code ships as-is.

---

## Quick start

**1. Get a sandbox API key**

```bash
# Go to procohq.com/sandbox — takes 2 minutes, no card required
# You'll get: sk_sandbox_xxxx...
```

**2. Install the SDK**

```bash
npm install @proco/sdk
```

**3. Create your first agent wallet**

```typescript
import { Proco } from '@proco/sdk'

const proco = new Proco({
  apiKey: 'sk_sandbox_...',
  env: 'sandbox'             // ← testnet mode
})

const wallet = await proco.wallets.create({
  agentId: 'my-test-agent',
  policies: {
    dailyCap: 100_00,        // $100 test budget
    currency: 'USDC'
  }
})

console.log(wallet.id)       // → wal_test_...
console.log(wallet.balance)  // → 1000.00 USDC (free testnet balance)
```

**4. Make a test payment**

```typescript
const tx = await proco.payments.create({
  wallet: wallet.id,
  amount: 1_00,              // $1.00 USDC
  vendor: 'test.x402.dev',
  memo: 'test payment'
})

console.log(tx.status)       // → 'settled'
console.log(tx.settlementMs) // → 847
console.log(tx.txHash)       // → 0xabc... (Base Sepolia)
```

---

## Testing x402 flows

Use our public x402 test endpoints to simulate real API payment flows:

```typescript
const proco = new Proco({ apiKey: 'sk_sandbox_...', env: 'sandbox' })

const wallet = await proco.wallets.create({ agentId: 'x402-tester' })

// These endpoints return real 402s and accept testnet payments
const endpoints = {
  weather:  'https://test.x402.dev/weather',    // $0.01 USDC
  search:   'https://test.x402.dev/search',     // $0.05 USDC
  analysis: 'https://test.x402.dev/analyze',   // $0.50 USDC
}

const res = await proco.fetch(endpoints.weather, { wallet: wallet.id })
const data = await res.json()
// → { temp: 18, city: 'Dublin', paid: '$0.01 USDC' }
```

---

## Policy testing scenarios

Test edge cases without consequences:

```typescript
// 1. Daily cap enforcement
const cappedWallet = await proco.wallets.create({
  agentId: 'policy-test',
  policies: { dailyCap: 5_00, currency: 'USDC' }  // $5 cap
})

// Spend up to cap — works fine
await proco.payments.create({ wallet: cappedWallet.id, amount: 4_50, vendor: 'test.x402.dev' })

// This throws PolicyViolationError — cap exceeded
try {
  await proco.payments.create({ wallet: cappedWallet.id, amount: 1_00, vendor: 'test.x402.dev' })
} catch (e) {
  console.log(e.reason) // → 'exceeds daily cap ($5.00)'
}

// 2. Vendor allowlist
const restrictedWallet = await proco.wallets.create({
  agentId: 'restricted-agent',
  policies: {
    vendors: ['trusted-api.com'],   // only this vendor allowed
    dailyCap: 50_00
  }
})

// This throws — vendor not in allowlist
try {
  await proco.payments.create({ wallet: restrictedWallet.id, amount: 1_00, vendor: 'other-api.com' })
} catch (e) {
  console.log(e.reason) // → 'vendor not in allowlist'
}

// 3. Per-transaction limit
const perTxWallet = await proco.wallets.create({
  agentId: 'per-tx-test',
  policies: { perTx: 2_00, dailyCap: 100_00 }  // $2 max per transaction
})

try {
  await proco.payments.create({ wallet: perTxWallet.id, amount: 5_00, vendor: 'test.x402.dev' })
} catch (e) {
  console.log(e.reason) // → 'exceeds per-transaction limit ($2.00)'
}
```

---

## Agent-to-agent settlement testing

```typescript
const proco = new Proco({ apiKey: 'sk_sandbox_...', env: 'sandbox' })

// Orchestrator funds its own wallet
const orchestrator = await proco.wallets.create({ agentId: 'orchestrator' })
const worker       = await proco.wallets.create({ agentId: 'worker-01' })

// Worker submits invoice to orchestrator
const invoice = await proco.invoices.create({
  from: worker.agentId,
  to:   orchestrator.agentId,
  amount: 10_00,
  description: 'Data extraction — 50 records'
})

console.log(invoice.id)     // → inv_test_...
console.log(invoice.status) // → 'pending'

// Orchestrator settles
const settlement = await proco.invoices.settle(invoice.id, {
  wallet: orchestrator.id
})

console.log(settlement.status) // → 'settled'
console.log(settlement.txHash) // → 0xabc... (Base Sepolia)
```

---

## Sandbox vs Production

| Feature | Sandbox | Production |
|---------|---------|------------|
| Network | Base Sepolia (testnet) | Base mainnet |
| USDC | Testnet USDC (worthless) | Real USDC |
| Starting balance | 1,000 testnet USDC (free) | Your deposit |
| API key prefix | `sk_sandbox_` | `sk_live_` |
| API base | `sandbox.api.procohq.com` | `api.procohq.com` |
| Rate limits | Relaxed (for testing) | Standard |
| Settlement time | ~1s (Sepolia) | ~2s (Base mainnet) |
| Code change to go live | `env: 'sandbox'` → `env: 'production'` | — |

---

## Running test scripts locally

```bash
git clone https://github.com/procohq/sandbox
cd sandbox
npm install
cp .env.example .env
# Add your sandbox API key: PROCO_API_KEY=sk_sandbox_...

# Run all tests
npm test

# Individual scenarios
npx ts-node scripts/basic-payment.ts
npx ts-node scripts/policy-enforcement.ts
npx ts-node scripts/x402-flow.ts
npx ts-node scripts/a2a-settlement.ts
npx ts-node scripts/stress-test.ts
```

---

## Resetting your sandbox

Your sandbox balance automatically refreshes to 1,000 testnet USDC every 24 hours. You can also trigger a manual reset from [procohq.com/sandbox](https://procohq.com/sandbox).

---

## Getting a production key

When you're ready to go live:

1. Complete KYB/identity verification at procohq.com
2. Deposit USDC to your Proco treasury
3. Swap your API key and `env` setting
4. Deploy

Your agent wallets, policies, and all configuration carry over automatically.

---

## Related

- [`@proco/sdk`](https://github.com/procohq/proco-sdk) — full SDK
- [`procohq/x402`](https://github.com/procohq/x402) — x402 facilitator
- [`procohq/examples`](https://github.com/procohq/examples) — code examples
- [x402 standard](https://github.com/coinbase/x402) — the underlying protocol

---

MIT · Built by [Proco](https://procohq.com)
