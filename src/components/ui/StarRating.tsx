'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

interface StarRatingProps {
  value: number
  onChange: (v: number) => void
  size?: number
  max?: number
}

export default function StarRating({ value, onChange, size = 28, max = 10 }: StarRatingProps) {
  const [hover, setHover] = useState(0)
  const stars = Array.from({ length: max }, (_, i) => i + 1)

  return (
    <div className="flex flex-wrap gap-1">
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform duration-150 hover:scale-110"
        >
          <Star
            size={size}
            fill={(hover || value) >= star ? '#C84B31' : 'transparent'}
            stroke={(hover || value) >= star ? '#C84B31' : 'rgba(253,251,247,0.25)'}
            strokeWidth={1.5}
          />
        </button>
      ))}
      {(hover || value) > 0 && (
        <span className="font-dm text-xs self-center ml-1" style={{ color: 'rgba(253,251,247,0.4)' }}>
          {hover || value}/{max}
        </span>
      )}
    </div>
  )
}
