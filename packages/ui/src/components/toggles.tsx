'use client';

import { Check } from '@phosphor-icons/react/ssr';
import {
  Checkbox as CheckboxPrimitive,
  RadioGroup as RadioPrimitive,
  Switch as SwitchPrimitive,
} from 'radix-ui';
import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '../lib/cn';

const labelClass =
  'flex cursor-pointer items-start gap-3 text-base leading-6 text-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:text-faint';
const boxBase =
  'flex shrink-0 items-center justify-center border border-line-strong bg-bg transition-[background-color,border-color,box-shadow] duration-150 ' +
  'hover:border-ink-2 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgb(27_43_75/0.18)] ' +
  'disabled:cursor-not-allowed disabled:opacity-40';

export interface CheckboxProps extends Omit<
  ComponentProps<typeof CheckboxPrimitive.Root>,
  'children'
> {
  label?: ReactNode;
  description?: ReactNode;
}

export function Checkbox({ label, description, className, id, ...props }: CheckboxProps) {
  const autoId = useId();
  const checkboxId = id ?? autoId;
  return (
    <div className={cn(labelClass, 'cursor-default')}>
      <CheckboxPrimitive.Root
        id={checkboxId}
        className={cn(
          boxBase,
          'mt-0.5 size-5 rounded-sm data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand',
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="text-white data-[state=checked]:animate-fade-in">
          <Check size={14} weight="bold" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {(label || description) && (
        <label htmlFor={checkboxId} className="cursor-pointer">
          {label}
          {description && <span className="block text-sm text-muted">{description}</span>}
        </label>
      )}
    </div>
  );
}

export function RadioGroup({ className, ...props }: ComponentProps<typeof RadioPrimitive.Root>) {
  return (
    <RadioPrimitive.Root dir="rtl" className={cn('flex flex-col gap-3', className)} {...props} />
  );
}

export interface RadioProps extends Omit<ComponentProps<typeof RadioPrimitive.Item>, 'children'> {
  label?: ReactNode;
  description?: ReactNode;
}

export function Radio({ label, description, className, id, ...props }: RadioProps) {
  const autoId = useId();
  const radioId = id ?? autoId;
  return (
    <div className={cn(labelClass, 'cursor-default')}>
      <RadioPrimitive.Item
        id={radioId}
        className={cn(
          boxBase,
          'mt-0.5 size-5 rounded-full data-[state=checked]:border-brand',
          className,
        )}
        {...props}
      >
        <RadioPrimitive.Indicator className="size-2.5 rounded-full bg-brand data-[state=checked]:animate-pop-in" />
      </RadioPrimitive.Item>
      {(label || description) && (
        <label htmlFor={radioId} className="cursor-pointer">
          {label}
          {description && <span className="block text-sm text-muted">{description}</span>}
        </label>
      )}
    </div>
  );
}

export interface SwitchProps extends ComponentProps<typeof SwitchPrimitive.Root> {
  label?: ReactNode;
}

export function Switch({ label, className, id, ...props }: SwitchProps) {
  const autoId = useId();
  const switchId = id ?? autoId;
  return (
    <div className="flex items-center gap-3 text-base text-ink">
      <SwitchPrimitive.Root
        id={switchId}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border border-line-strong bg-surface-2 p-0.5',
          'transition-[background-color,border-color] duration-200 ease-out',
          'focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgb(27_43_75/0.18)]',
          'data-[state=checked]:border-brand data-[state=checked]:bg-brand',
          'disabled:cursor-not-allowed disabled:opacity-40',
          className,
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            'block size-4 rounded-full bg-white shadow-xs',
            'transition-transform duration-200 ease-out',
            // جهت حرکت در راست‌چین برعکس می‌شود
            'translate-x-0 data-[state=checked]:translate-x-5',
            'rtl:data-[state=checked]:-translate-x-5',
          )}
        />
      </SwitchPrimitive.Root>
      {label && (
        <label htmlFor={switchId} className="cursor-pointer">
          {label}
        </label>
      )}
    </div>
  );
}
