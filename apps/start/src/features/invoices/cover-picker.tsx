import type { Cover } from '@portfolio/invoices/model';
import { Slash } from 'lucide-react';
import { useId } from 'react';
import { coverArt, coverLabel, coverOptions } from '~/features/invoices/covers';

/** Radio group of cover swatches. Also used for the default in settings. */
export function CoverPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: Cover;
  onChange: (cover: Cover) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="iv-covers" disabled={disabled}>
      <legend className="iv-sr">Cover</legend>
      {coverOptions.map((cover) => (
        <label key={cover} className="iv-cover" data-checked={value === cover}>
          <input
            type="radio"
            className="iv-sr"
            name={name}
            value={cover}
            checked={value === cover}
            onChange={() => onChange(cover)}
          />
          <span className="iv-cover-swatch">
            {cover === 'none' ? (
              <Slash size={16} />
            ) : (
              <img src={coverArt[cover].backdrop} alt="" loading="lazy" />
            )}
          </span>
          {cover === 'none' ? 'None' : coverLabel(cover)}
        </label>
      ))}
    </fieldset>
  );
}
