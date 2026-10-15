'use client';

import { DropdownMenu } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export type DropdownEntry =
  | {
      type?: 'item';
      label: ReactNode;
      icon?: ReactNode;
      onSelect?: () => void;
      danger?: boolean;
      disabled?: boolean;
    }
  | { type: 'separator' }
  | { type: 'label'; label: ReactNode };

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownEntry[];
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function Dropdown({ trigger, items, align = 'start', className }: DropdownProps) {
  return (
    <DropdownMenu.Root dir="rtl">
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'z-50 min-w-48 overflow-hidden rounded-md border border-line bg-bg p-1 shadow-pop',
            'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
            className,
          )}
        >
          {items.map((entry, i) => {
            if (entry.type === 'separator') {
              return <DropdownMenu.Separator key={i} className="-mx-1 my-1 h-px bg-line" />;
            }
            if (entry.type === 'label') {
              return (
                <DropdownMenu.Label key={i} className="px-3 pb-1 pt-2 text-xs text-muted">
                  {entry.label}
                </DropdownMenu.Label>
              );
            }
            return (
              <DropdownMenu.Item
                key={i}
                disabled={entry.disabled}
                onSelect={entry.onSelect}
                className={cn(
                  'flex h-10 cursor-pointer select-none items-center gap-3 rounded-sm px-3 text-base outline-none',
                  'data-[highlighted]:bg-surface data-[disabled]:pointer-events-none data-[disabled]:text-faint',
                  entry.danger ? 'text-danger data-[highlighted]:bg-danger-soft' : 'text-ink',
                )}
              >
                {entry.icon && <span className="text-muted">{entry.icon}</span>}
                {entry.label}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
