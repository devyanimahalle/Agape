import { useState } from 'react';

export default function StarRating({ value = 0, onChange, readonly = false, max = 5 }) {
  const [hovered, setHovered] = useState(0);

  const handleClick = (starIndex) => {
    if (!readonly && onChange) {
      onChange(starIndex);
    }
  };

  return (
    <div className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const starValue = i + 1;
        const isFilled = starValue <= (hovered || value);

        return (
          <span
            key={starValue}
            role={readonly ? 'img' : 'button'}
            aria-label={`${starValue} star${starValue > 1 ? 's' : ''}`}
            className={`text-xl select-none ${
              isFilled ? 'text-yellow-400' : 'text-gray-300'
            } ${!readonly ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
            onClick={() => handleClick(starValue)}
            onMouseEnter={() => !readonly && setHovered(starValue)}
            onMouseLeave={() => !readonly && setHovered(0)}
          >
            {isFilled ? '★' : '☆'}
          </span>
        );
      })}
      {value > 0 && (
        <span className="ml-1 text-sm text-gray-500">({value})</span>
      )}
    </div>
  );
}
