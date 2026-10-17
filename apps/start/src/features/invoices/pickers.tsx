import { formatMoney } from '@portfolio/invoices/calculate';
import type { CatalogItem, Customer } from '@portfolio/invoices/model';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronsUpDown, Package, Search } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useState } from 'react';
import { Button, cn, layer } from '~/features/invoices/ui';

/** Arrow keys walk the options; the search box hands focus to the first one. */
function onListKey(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const options = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '.iv-menu-item:not(:disabled)',
    ),
  ];
  const at = options.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    event.key === 'ArrowDown'
      ? options[Math.min(at + 1, options.length - 1)]
      : at <= 0
        ? null
        : options[at - 1];
  event.preventDefault();
  if (next) next.focus();
  else
    event.currentTarget
      .querySelector<HTMLInputElement>('.iv-menu-search input')
      ?.focus();
}

function SearchMenu<T>({
  trigger,
  placeholder,
  items,
  text,
  render,
  onPick,
  empty,
  footer,
  align = 'start',
}: {
  trigger: ReactNode;
  placeholder: string;
  items: readonly T[];
  text: (item: T) => string;
  render: (item: T) => ReactNode;
  onPick: (item: T) => void;
  empty: string;
  footer?: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const shown = items.filter((item) =>
    text(item).toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          className={cn(layer, 'iv-menu')}
          style={{ width: 'var(--radix-popover-trigger-width)', minWidth: 260 }}
          onKeyDown={onListKey}
        >
          <label className="iv-menu-search">
            <Search size={14} />
            <input
              // biome-ignore lint/a11y/noAutofocus: the menu exists to search.
              autoFocus
              aria-label={placeholder}
              placeholder={placeholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                const first = shown[0];
                if (event.key === 'Enter' && first) {
                  event.preventDefault();
                  onPick(first);
                  setOpen(false);
                }
              }}
            />
          </label>
          {shown.map((item) => (
            <button
              key={text(item)}
              type="button"
              className="iv-menu-item"
              onClick={() => {
                onPick(item);
                setOpen(false);
              }}
            >
              {render(item)}
            </button>
          ))}
          {shown.length === 0 && <p className="iv-menu-empty">{empty}</p>}
          {footer?.(() => setOpen(false))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function CustomerPicker({
  customers,
  selected,
  onPick,
  onClear,
}: {
  customers: readonly Customer[];
  selected: string | null;
  onPick: (customer: Customer) => void;
  onClear: () => void;
}) {
  const current = customers.find((customer) => customer.id === selected);
  return (
    <div className="iv-field">
      <span className="iv-label">Saved customer</span>
      <SearchMenu
        trigger={
          <button type="button" className="iv-input iv-select">
            <span>
              {current?.name ??
                (customers.length ? 'Choose a customer' : 'No saved customers')}
            </span>
            <ChevronsUpDown size={14} className="iv-select-icon" />
          </button>
        }
        placeholder="Search customers"
        items={customers}
        text={(customer) => `${customer.name} ${customer.taxId} ${customer.id}`}
        render={(customer) => (
          <>
            {customer.name || 'Unnamed customer'}
            {customer.id === selected ? (
              <Check size={14} className="iv-menu-check" />
            ) : (
              <small>{customer.address.locality}</small>
            )}
          </>
        )}
        onPick={onPick}
        empty="No customer matches."
        footer={(close) =>
          selected ? (
            <button
              type="button"
              className="iv-menu-item"
              onClick={() => {
                onClear();
                close();
              }}
            >
              Enter details by hand
            </button>
          ) : null
        }
      />
    </div>
  );
}

export function CatalogMenu({
  items,
  onPick,
}: {
  items: readonly CatalogItem[];
  onPick: (item: CatalogItem) => void;
}) {
  return (
    <SearchMenu
      trigger={
        <Button disabled={!items.length}>
          <Package size={15} />
          From catalog
        </Button>
      }
      placeholder="Search the catalog"
      items={items}
      text={(item) => `${item.name} ${item.id}`}
      render={(item) => (
        <>
          {item.name}
          <small className="iv-num">
            {formatMoney(item.unitPrice, 'en')} / {item.unit}
          </small>
        </>
      )}
      onPick={onPick}
      empty="No item matches."
      align="end"
    />
  );
}
