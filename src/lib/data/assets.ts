import { Asset } from '@/types'

// Popular NASDAQ stocks
const nasdaqStocks: Asset[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. Class A', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'GOOG', name: 'Alphabet Inc. Class C', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'META', name: 'Meta Platforms Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'AVGO', name: 'Broadcom Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'COST', name: 'Costco Wholesale Corporation', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'ASML', name: 'ASML Holding N.V.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'NFLX', name: 'Netflix Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'AMD', name: 'Advanced Micro Devices Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'ADBE', name: 'Adobe Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'PEP', name: 'PepsiCo Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'CSCO', name: 'Cisco Systems Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'INTC', name: 'Intel Corporation', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'CMCSA', name: 'Comcast Corporation', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'TMUS', name: 'T-Mobile US Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'INTU', name: 'Intuit Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'QCOM', name: 'QUALCOMM Incorporated', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'TXN', name: 'Texas Instruments Incorporated', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'AMAT', name: 'Applied Materials Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'AMGN', name: 'Amgen Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'ISRG', name: 'Intuitive Surgical Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'BKNG', name: 'Booking Holdings Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'LRCX', name: 'Lam Research Corporation', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'VRTX', name: 'Vertex Pharmaceuticals Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'MU', name: 'Micron Technology Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'ADI', name: 'Analog Devices Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'SBUX', name: 'Starbucks Corporation', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'REGN', name: 'Regeneron Pharmaceuticals Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'MDLZ', name: 'Mondelez International Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'PANW', name: 'Palo Alto Networks Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'KLAC', name: 'KLA Corporation', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'GILD', name: 'Gilead Sciences Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'SNPS', name: 'Synopsys Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'CDNS', name: 'Cadence Design Systems Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'MELI', name: 'MercadoLibre Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'PYPL', name: 'PayPal Holdings Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'MAR', name: 'Marriott International Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'ORLY', name: "O'Reilly Automotive Inc.", type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'CRWD', name: 'CrowdStrike Holdings Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'FTNT', name: 'Fortinet Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'MRVL', name: 'Marvell Technology Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'WDAY', name: 'Workday Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'ABNB', name: 'Airbnb Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'ADP', name: 'Automatic Data Processing Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'COIN', name: 'Coinbase Global Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'ZS', name: 'Zscaler Inc.', type: 'stock', exchange: 'NASDAQ' },
]

// Popular NYSE stocks
const nyseStocks: Asset[] = [
  { symbol: 'BRK.A', name: 'Berkshire Hathaway Inc. Class A', type: 'stock', exchange: 'NYSE' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway Inc. Class B', type: 'stock', exchange: 'NYSE' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'V', name: 'Visa Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'UNH', name: 'UnitedHealth Group Incorporated', type: 'stock', exchange: 'NYSE' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation', type: 'stock', exchange: 'NYSE' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', type: 'stock', exchange: 'NYSE' },
  { symbol: 'WMT', name: 'Walmart Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'MA', name: 'Mastercard Incorporated', type: 'stock', exchange: 'NYSE' },
  { symbol: 'PG', name: 'Procter & Gamble Company', type: 'stock', exchange: 'NYSE' },
  { symbol: 'HD', name: 'The Home Depot Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'CVX', name: 'Chevron Corporation', type: 'stock', exchange: 'NYSE' },
  { symbol: 'LLY', name: 'Eli Lilly and Company', type: 'stock', exchange: 'NYSE' },
  { symbol: 'MRK', name: 'Merck & Co. Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'ABBV', name: 'AbbVie Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'BAC', name: 'Bank of America Corporation', type: 'stock', exchange: 'NYSE' },
  { symbol: 'KO', name: 'The Coca-Cola Company', type: 'stock', exchange: 'NYSE' },
  { symbol: 'PFE', name: 'Pfizer Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'CRM', name: 'Salesforce Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'TMO', name: 'Thermo Fisher Scientific Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'ORCL', name: 'Oracle Corporation', type: 'stock', exchange: 'NYSE' },
  { symbol: 'ACN', name: 'Accenture plc', type: 'stock', exchange: 'NYSE' },
  { symbol: 'MCD', name: "McDonald's Corporation", type: 'stock', exchange: 'NYSE' },
  { symbol: 'ABT', name: 'Abbott Laboratories', type: 'stock', exchange: 'NYSE' },
  { symbol: 'DHR', name: 'Danaher Corporation', type: 'stock', exchange: 'NYSE' },
  { symbol: 'NKE', name: 'NIKE Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'DIS', name: 'The Walt Disney Company', type: 'stock', exchange: 'NYSE' },
  { symbol: 'VZ', name: 'Verizon Communications Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'WFC', name: 'Wells Fargo & Company', type: 'stock', exchange: 'NYSE' },
  { symbol: 'IBM', name: 'International Business Machines Corporation', type: 'stock', exchange: 'NYSE' },
  { symbol: 'PM', name: 'Philip Morris International Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'NEE', name: 'NextEra Energy Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'RTX', name: 'RTX Corporation', type: 'stock', exchange: 'NYSE' },
  { symbol: 'UNP', name: 'Union Pacific Corporation', type: 'stock', exchange: 'NYSE' },
  { symbol: 'CAT', name: 'Caterpillar Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'HON', name: 'Honeywell International Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'LOW', name: "Lowe's Companies Inc.", type: 'stock', exchange: 'NYSE' },
  { symbol: 'SPGI', name: 'S&P Global Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'BA', name: 'The Boeing Company', type: 'stock', exchange: 'NYSE' },
  { symbol: 'GE', name: 'General Electric Company', type: 'stock', exchange: 'NYSE' },
  { symbol: 'GS', name: 'The Goldman Sachs Group Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'BLK', name: 'BlackRock Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'AXP', name: 'American Express Company', type: 'stock', exchange: 'NYSE' },
  { symbol: 'SYK', name: 'Stryker Corporation', type: 'stock', exchange: 'NYSE' },
  { symbol: 'BKNG', name: 'Booking Holdings Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'ELV', name: 'Elevance Health Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'MMM', name: '3M Company', type: 'stock', exchange: 'NYSE' },
  { symbol: 'CVS', name: 'CVS Health Corporation', type: 'stock', exchange: 'NYSE' },
  { symbol: 'T', name: 'AT&T Inc.', type: 'stock', exchange: 'NYSE' },
  { symbol: 'SQ', name: 'Block Inc.', type: 'stock', exchange: 'NYSE' },
]

// Crypto assets
const cryptoAssets: Asset[] = [
  { symbol: 'BTC', name: 'Bitcoin', type: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', type: 'crypto' },
]

// Commodity assets
const commodityAssets: Asset[] = [
  { symbol: 'GOLD', name: 'Gold', type: 'commodity' },
  { symbol: 'SILVER', name: 'Silver', type: 'commodity' },
]

// All assets combined
export const allAssets: Asset[] = [
  ...cryptoAssets,
  ...commodityAssets,
  ...nasdaqStocks,
  ...nyseStocks,
]

// Search function for autocomplete
export function searchAssets(query: string): Asset[] {
  if (!query || query.length < 1) return []

  const lowerQuery = query.toLowerCase()

  return allAssets
    .filter(asset =>
      asset.symbol.toLowerCase().includes(lowerQuery) ||
      asset.name.toLowerCase().includes(lowerQuery)
    )
    .sort((a, b) => {
      // Prioritize exact symbol matches
      const aSymbolMatch = a.symbol.toLowerCase() === lowerQuery
      const bSymbolMatch = b.symbol.toLowerCase() === lowerQuery
      if (aSymbolMatch && !bSymbolMatch) return -1
      if (!aSymbolMatch && bSymbolMatch) return 1

      // Then prioritize symbol starts with query
      const aSymbolStarts = a.symbol.toLowerCase().startsWith(lowerQuery)
      const bSymbolStarts = b.symbol.toLowerCase().startsWith(lowerQuery)
      if (aSymbolStarts && !bSymbolStarts) return -1
      if (!aSymbolStarts && bSymbolStarts) return 1

      // Prioritize crypto and commodities at the top
      if (a.type !== 'stock' && b.type === 'stock') return -1
      if (a.type === 'stock' && b.type !== 'stock') return 1

      return a.symbol.localeCompare(b.symbol)
    })
    .slice(0, 15) // Limit results
}

export function getAssetBySymbol(symbol: string): Asset | undefined {
  return allAssets.find(a => a.symbol.toUpperCase() === symbol.toUpperCase())
}
