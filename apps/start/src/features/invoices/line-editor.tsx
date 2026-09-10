import type { Line } from '@portfolio/invoices/model';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { memo, useState } from 'react';
import { Field, Select } from './ui';

type LineEditorProps = {
  line: Line;
  index: number;
  disabled: boolean;
  onChange: (line: Line) => void;
  onRemove: () => void;
  onMove: (offset: number) => void;
  last: boolean;
};

export const LineEditor = memo(function LineEditor({
  line,
  index,
  disabled,
  onChange,
  onRemove,
  onMove,
  last,
}: LineEditorProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.section className="iv-line" layout transition={{ duration: 0.18 }}>
      <div className="iv-line-heading">
        <span>Item {index + 1}</span>
        <div>
          <button
            aria-label="Move item up"
            disabled={disabled || index === 0}
            onClick={() => onMove(-1)}
          >
            <ChevronUp size={14} />
          </button>
          <button
            aria-label="Move item down"
            disabled={disabled || last}
            onClick={() => onMove(1)}
          >
            <ChevronDown size={14} />
          </button>
          <button
            aria-label="Delete item"
            disabled={disabled}
            onClick={onRemove}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <Field
        label="Description"
        value={line.description}
        disabled={disabled}
        onChange={(description) => onChange({ ...line, description })}
        placeholder="Describe the work or item"
        multiline
      />
      <div className="iv-line-amounts">
        <Field
          label="Quantity"
          value={line.quantity}
          disabled={disabled}
          onChange={(quantity) => onChange({ ...line, quantity })}
        />
        <Field
          label="Unit price"
          value={line.unitPrice}
          disabled={disabled}
          onChange={(unitPrice) => onChange({ ...line, unitPrice })}
        />
        <Select
          label="IGIC"
          value={line.tax.rate}
          disabled={disabled || line.tax.treatment !== 'taxable'}
          onChange={(rate) => onChange({ ...line, tax: { ...line.tax, rate } })}
          options={['0', '3', '5', '7', '9.5', '15', '20'].map(
            (rate) => [rate, `${rate}%`] as const,
          )}
        />
      </div>
      <button
        className="iv-disclosure"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Fewer options' : 'Item options'}
        <ChevronDown size={14} />
      </button>
      {expanded && (
        <div className="iv-line-options">
          <div className="iv-form-grid">
            <Select
              label="Item type"
              value={line.kind}
              disabled={disabled}
              onChange={(kind) => onChange({ ...line, kind })}
              options={[
                ['service', 'Service'],
                ['product', 'Product'],
                ['time', 'Time'],
                ['expense', 'Expense'],
                ['shipping', 'Shipping'],
                ['fee', 'Fee'],
                ['disbursement', 'Disbursement'],
                ['note', 'Note'],
              ]}
            />
            <Field
              label="Unit"
              value={line.unit}
              disabled={disabled}
              onChange={(unit) => onChange({ ...line, unit })}
            />
            <Select
              label="Tax treatment"
              value={line.tax.treatment}
              disabled={disabled}
              onChange={(treatment) =>
                onChange({
                  ...line,
                  tax: {
                    ...line.tax,
                    treatment,
                    rate: treatment === 'taxable' ? '7' : '0',
                  },
                })
              }
              options={[
                ['taxable', 'Taxable'],
                ['exempt', 'Exempt'],
                ['outside-scope', 'Outside scope'],
                ['reverse-charge', 'Reverse charge'],
              ]}
            />
            <Field
              label="Legal basis / exemption reason"
              value={line.tax.reason}
              disabled={disabled}
              onChange={(reason) =>
                onChange({ ...line, tax: { ...line.tax, reason } })
              }
            />
            <Select
              label="Discount type"
              value={line.discount.kind}
              disabled={disabled}
              onChange={(kind) =>
                onChange({ ...line, discount: { ...line.discount, kind } })
              }
              options={[
                ['percent', 'Percentage'],
                ['amount', 'Fixed amount'],
              ]}
            />
            <Field
              label="Discount"
              value={line.discount.value}
              disabled={disabled}
              onChange={(value) =>
                onChange({ ...line, discount: { ...line.discount, value } })
              }
            />
          </div>
        </div>
      )}
    </motion.section>
  );
});
