'use client';

import { CaretDown, Check } from '@phosphor-icons/react/ssr';
import { Select as SelectPrimitive } from 'radix-ui';
import { useId, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { controlClass, FieldShell } from './field';

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
}

export function Select({
  options,
  placeholder = 'انتخاب کنید',
  label,
  hint,
  error,
  id,
  className,
  ...root
}: SelectProps) {
  const autoId = useId();
  const triggerId = id ?? autoId;
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      htmlFor={triggerId}
      errorId={`${triggerId}-error`}
      hintId={`${triggerId}-hint`}
      className={className}
    >
      <SelectPrimitive.Root dir="rtl" {...root}>
        <SelectPrimitive.Trigger
          id={triggerId}
          aria-invalid={error ? true : undefined}
          className={cn(
            controlClass,
            'group flex items-center justify-between gap-2 text-start data-[placeholder]:text-faint',
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon className="text-muted transition-transform duration-150 group-data-[state=open]:rotate-180">
            <CaretDown size={16} />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            collisionPadding={12}
            className={cn(
              'z-50 max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)]',
              'overflow-hidden rounded-md border border-line bg-bg shadow-pop',
              'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
            )}
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    'relative flex h-10 cursor-pointer select-none items-center justify-between gap-3 rounded-sm px-3 text-base text-ink outline-none',
                    'data-[highlighted]:bg-surface data-[state=checked]:font-medium',
                    'data-[disabled]:pointer-events-none data-[disabled]:text-faint',
                  )}
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="text-brand">
                    <Check size={16} weight="bold" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </FieldShell>
  );
}
