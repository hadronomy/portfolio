import { motion } from 'motion/react';

interface Props {
  active: boolean;
  text: string;
  width: number;
  height: number;
}

export default function CursorHint({ active, text, width, height }: Props) {
  return (
    <motion.div
      className="cursor-hint type-body-xs absolute top-0 left-0 flex items-center justify-center px-2.5 py-1 whitespace-nowrap text-foreground"
      data-hint-active={active}
      initial={false}
      animate={{
        x: active ? 16 : 7,
        y: active ? 14 : 12,
        scale: active ? 1 : 0,
        opacity: active ? 1 : 0,
      }}
      transition={{
        type: 'spring',
        stiffness: 560,
        damping: 36,
        mass: 0.7,
        opacity: { duration: active ? 0.12 : 0.08 },
      }}
      style={{
        width,
        height,
        transformOrigin: '0 0',
        borderRadius: '4px 10px 10px 10px',
        background:
          'color-mix(in srgb, hsl(var(--background)) 78%, hsl(var(--cursor)))',
        boxShadow: 'inset 0 1px 0 hsl(var(--foreground) / 0.06)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      {text}
    </motion.div>
  );
}
