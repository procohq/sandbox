/**
 * Proco Sandbox — Mock x402 test server
 *
 * Simulates x402-protected API endpoints for local development.
 * Returns real 402 responses that the Proco SDK can pay against.
 *
 * Run: npx ts-node src/mock-server.ts
 */

import express from 'express'

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 4402
const NETWORK = process.env.NETWORK || 'base-sepolia'

// USDC contract on Base Sepolia
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

function buildPaymentRequiredHeader(params: {
  resource: string
  amountCents: number
  description: string
}) {
  return {
    version: '1',
    scheme: 'exact',
    network: NETWORK,
    maxAmountRequired: String(params.amountCents * 10_000),
    resource: params.resource,
    description: params.description,
    payTo: '0xProcoTestSettlementAddress',
    maxTimeoutSeconds: 60,
    asset: USDC_BASE_SEPOLIA,
  }
}

function requiresPayment(amountCents: number, description: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const paymentHeader = req.headers['x-payment']

    if (!paymentHeader) {
      const resource = `http://localhost:${PORT}${req.path}`
      res.status(402).json({
        error: 'Payment Required',
        accepts: [buildPaymentRequiredHeader({ resource, amountCents, description })],
      })
      return
    }

    // In sandbox: accept any X-PAYMENT header (no real verification)
    res.setHeader('x-payment-response', JSON.stringify({
      txHash: '0x' + Math.random().toString(16).slice(2).padEnd(64, '0'),
      network: NETWORK,
      payer: '0xTestAgentWallet',
      settledAt: new Date().toISOString(),
    }))

    next()
  }
}

/**
 * Test endpoints — mirror test.x402.dev
 */

// $0.01 USDC — weather data
app.get('/weather', requiresPayment(1, 'Weather data — $0.01 USDC'), (_req, res) => {
  res.json({
    temp: 18,
    city: 'Dublin',
    condition: 'Partly cloudy',
    humidity: 72,
    paid: '$0.01 USDC',
    network: NETWORK,
  })
})

// $0.05 USDC — search results
app.get('/search', requiresPayment(5, 'Search results — $0.05 USDC'), (req, res) => {
  const query = req.query.q || 'AI agents'
  res.json({
    query,
    results: [
      { title: 'Result 1', url: 'https://example.com/1', snippet: 'First result for ' + query },
      { title: 'Result 2', url: 'https://example.com/2', snippet: 'Second result for ' + query },
      { title: 'Result 3', url: 'https://example.com/3', snippet: 'Third result for ' + query },
    ],
    paid: '$0.05 USDC',
    network: NETWORK,
  })
})

// $0.50 USDC — AI analysis
app.post('/analyze', requiresPayment(50, 'AI analysis — $0.50 USDC'), (req, res) => {
  const { text = 'Sample text for analysis' } = req.body
  res.json({
    input: text,
    sentiment: 'positive',
    topics: ['AI', 'payments', 'agents'],
    summary: `Analysis of: "${String(text).substring(0, 50)}..."`,
    paid: '$0.50 USDC',
    network: NETWORK,
  })
})

// Health
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', network: NETWORK, endpoints: ['/weather ($0.01)', '/search ($0.05)', '/analyze ($0.50)'] })
})

app.listen(PORT, () => {
  console.log(`\nProco Sandbox mock server running on port ${PORT}`)
  console.log(`Network: ${NETWORK}`)
  console.log(`\nTest endpoints:`)
  console.log(`  GET  http://localhost:${PORT}/weather   — $0.01 USDC`)
  console.log(`  GET  http://localhost:${PORT}/search    — $0.05 USDC`)
  console.log(`  POST http://localhost:${PORT}/analyze   — $0.50 USDC`)
  console.log(`\nAny X-PAYMENT header is accepted in sandbox mode.\n`)
})

export default app
