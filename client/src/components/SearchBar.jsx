import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'

const PRESET_ASSETS = [
  { symbol: 'BTC-USD', name: 'Bitcoin', type: 'Crypto' },
  { symbol: 'ETH-USD', name: 'Ethereum', type: 'Crypto' },
  { symbol: 'GC=F', name: 'Gold Futures', type: 'Commodity' },
  { symbol: 'SI=F', name: 'Silver Futures', type: 'Commodity' }
]

function SearchBar({ onSelect, selectedAsset }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const searchAssets = async () => {
      if (query.length < 1) {
        setResults(PRESET_ASSETS)
        return
      }

      setLoading(true)
      try {
        const response = await axios.get(`/api/search?q=${encodeURIComponent(query)}`)
        setResults(response.data.results || [])
      } catch (err) {
        console.error('Search error:', err)
        const filtered = PRESET_ASSETS.filter(
          a => a.symbol.toLowerCase().includes(query.toLowerCase()) ||
               a.name.toLowerCase().includes(query.toLowerCase())
        )
        setResults(filtered)
      } finally {
        setLoading(false)
      }
    }

    const debounce = setTimeout(searchAssets, 300)
    return () => clearTimeout(debounce)
  }, [query])

  const handleFocus = () => {
    setShowDropdown(true)
    if (query.length < 1) {
      setResults(PRESET_ASSETS)
    }
  }

  const handleSelect = (asset) => {
    setQuery(asset.symbol)
    setShowDropdown(false)
    onSelect(asset)
  }

  return (
    <div className="search-container">
      <input
        ref={inputRef}
        type="text"
        className="search-input"
        placeholder="Search stocks, crypto, commodities..."
        value={query}
        onChange={(e) => setQuery(e.target.value.toUpperCase())}
        onFocus={handleFocus}
      />
      
      {showDropdown && (
        <div className="autocomplete-dropdown" ref={dropdownRef}>
          {loading ? (
            <div className="autocomplete-item">
              <span>Searching...</span>
            </div>
          ) : results.length > 0 ? (
            results.map((asset, index) => (
              <div
                key={`${asset.symbol}-${index}`}
                className="autocomplete-item"
                onClick={() => handleSelect(asset)}
              >
                <div>
                  <span className="symbol">{asset.symbol}</span>
                  <span className="name"> - {asset.name}</span>
                </div>
                <span className="type">{asset.type}</span>
              </div>
            ))
          ) : (
            <div className="autocomplete-item">
              <span>No results found</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SearchBar
