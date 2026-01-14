'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Asset } from '@/types'
import { searchAssets } from '@/lib/data/assets'

interface AssetSearchProps {
  onSelect: (asset: Asset) => void
  selectedAsset: Asset | null
}

export default function AssetSearch({ onSelect, selectedAsset }: AssetSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Asset[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Search as user types
  useEffect(() => {
    if (query.length >= 1) {
      const filtered = searchAssets(query)
      setResults(filtered)
      setIsOpen(filtered.length > 0)
      setSelectedIndex(0)
    } else {
      setResults([])
      setIsOpen(false)
    }
  }, [query])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback((asset: Asset) => {
    setQuery('')
    setIsOpen(false)
    onSelect(asset)
  }, [onSelect])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }, [isOpen, results, selectedIndex, handleSelect])

  const getAssetBadgeClass = (type: string) => {
    switch (type) {
      case 'crypto':
        return 'asset-badge crypto'
      case 'commodity':
        return 'asset-badge commodity'
      default:
        return 'asset-badge stock'
    }
  }

  const getAssetTypeLabel = (asset: Asset) => {
    if (asset.type === 'stock' && asset.exchange) {
      return asset.exchange
    }
    return asset.type.charAt(0).toUpperCase() + asset.type.slice(1)
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 1 && results.length > 0 && setIsOpen(true)}
          placeholder={selectedAsset ? `${selectedAsset.symbol} - ${selectedAsset.name}` : "Search stocks, crypto, commodities..."}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <svg
            className="w-5 h-5 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="autocomplete-dropdown"
        >
          {results.map((asset, index) => (
            <div
              key={asset.symbol}
              className={`autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleSelect(asset)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex-shrink-0">
                <span className={getAssetBadgeClass(asset.type)}>
                  {getAssetTypeLabel(asset)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{asset.symbol}</span>
                </div>
                <div className="text-sm text-slate-400 truncate">{asset.name}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedAsset && !isOpen && (
        <div className="mt-2 flex items-center gap-2">
          <span className={getAssetBadgeClass(selectedAsset.type)}>
            {getAssetTypeLabel(selectedAsset)}
          </span>
          <span className="text-white font-semibold">{selectedAsset.symbol}</span>
          <span className="text-slate-400">-</span>
          <span className="text-slate-300">{selectedAsset.name}</span>
        </div>
      )}
    </div>
  )
}
