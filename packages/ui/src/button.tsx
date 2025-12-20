import { Slot } from '@radix-ui/react-slot';
import * as React from 'react';
import { type VariantProps, tv } from 'tailwind-variants';
import { cn } from './utils/cn';

const buttonVariants = tv({
  base: 'inline-flex items-center justify-center whitespace-nowrap text-sm font-bold ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none',
  variants: {
    variant: {
      default:
        'border-2 border-foreground bg-primary text-primary-foreground shadow-[4px_4px_0_0_hsl(var(--foreground))] hover:translate-y-[-2px] hover:translate-x-[-2px] hover:shadow-[6px_6px_0_0_hsl(var(--foreground))]',
      destructive:
        'border-2 border-destructive bg-destructive text-destructive-foreground shadow-[4px_4px_0_0_hsl(var(--destructive))] hover:bg-destructive/90',
      outline:
        'border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-[4px_4px_0_0_hsl(var(--foreground))]',
      secondary:
        'bg-secondary text-secondary-foreground border-2 border-transparent hover:bg-secondary/80',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
      link: 'text-primary underline-offset-4 hover:underline',
      // ... keep other fancy variants if needed, or brutalize them
      linkHover2:
        'relative after:absolute after:bg-foreground after:bottom-1 after:h-[2px] after:w-full after:origin-bottom-right after:scale-x-0 hover:after:origin-bottom-left hover:after:scale-x-100 after:transition-transform after:ease-in-out after:duration-300 font-bold uppercase tracking-wide',
    },
    size: {
      default: 'h-10 px-6 py-2',
      sm: 'h-9 px-4',
      lg: 'h-12 px-10 text-base',
      icon: 'h-10 w-10',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

/* ... Rest of the file stays the same ... */
interface IconProps {
  Icon: React.ElementType;
  iconPlacement: 'left' | 'right';
}

interface IconRefProps {
  Icon?: never;
  iconPlacement?: undefined;
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export type ButtonIconProps = IconProps | IconRefProps;

const Button = React.forwardRef<
  React.ComponentRef<'button'>,
  ButtonProps & ButtonIconProps
>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      Icon,
      iconPlacement,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {Icon && iconPlacement === 'left' && (
          <div className="w-0 translate-x-[0%] pr-0 opacity-0 transition-all duration-200 group-hover:w-5 group-hover:translate-x-100 group-hover:pr-2 group-hover:opacity-100">
            <Icon />
          </div>
        )}
        {props.children}
        {Icon && iconPlacement === 'right' && (
          <div className="w-0 translate-x-[100%] pl-0 opacity-0 transition-all duration-200 group-hover:w-5 group-hover:translate-x-0 group-hover:pl-2 group-hover:opacity-100">
            <Icon />
          </div>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
