/* ================================================
   FILE: src/components/react/MobileMenu.tsx
   ================================================ */
'use client';

import { cn } from '@portfolio/ui';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import {
  ArrowRight,
  BatteryMedium,
  Cpu,
  ExternalLink,
  Menu,
  TerminalSquare,
  Wifi,
  X,
} from 'lucide-react';
import * as React from 'react';

interface NavLink {
  label: string;
  href: string;
  disabled?: boolean;
}

interface ExternalLinkItem {
  label: string;
  href: string;
  icon: string;
}

interface MobileMenuProps {
  currentPath?: string;
  navLinks?: NavLink[];
  externalLinks?: ExternalLinkItem[];
}

const defaultNavLinks: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Blog', href: '/blog' },
  { label: 'Experiments', href: '/experiments', disabled: true },
];

// --- Animation Variants ---

const containerVariants: Variants = {
  closed: {
    y: '-100%',
    borderRadius: '0% 0% 100% 100%',
    transition: {
      duration: 0.6,
      ease: [0.76, 0, 0.24, 1],
    },
  },
  open: {
    y: '0%',
    borderRadius: '0% 0% 0% 0%',
    transition: {
      y: { duration: 0.6, ease: [0.76, 0, 0.24, 1] },
      borderRadius: { duration: 0.5, ease: 'easeOut', delay: 0.1 },
    },
  },
};

const contentVariants: Variants = {
  closed: { opacity: 0 },
  open: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.3 },
  },
};

const itemVariants: Variants = {
  closed: { x: -50, opacity: 0 },
  open: { x: 0, opacity: 1, transition: { duration: 0.4 } },
};

// --- Component ---

export function MobileMenu({
  currentPath = '/',
  navLinks = defaultNavLinks,
  externalLinks = [],
}: MobileMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activePath, setActivePath] = React.useState(currentPath);
  const [time, setTime] = React.useState('');

  // Clock for the "System Header"
  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    };

    updateTime();

    const interval = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Lock body scroll when menu is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none'; // Prevent pull-to-refresh on mobile
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isOpen]);

  // Listen for view transitions/path changes
  React.useEffect(() => {
    const handlePathChange = ((e: CustomEvent) => {
      setActivePath(e.detail.pathname);
      setIsOpen(false);
    }) as EventListener;

    window.addEventListener('navbar:path-change', handlePathChange);
    return () =>
      window.removeEventListener('navbar:path-change', handlePathChange);
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return activePath === '/';
    return activePath?.startsWith(href);
  };

  return (
    <>
      {/* --- TRIGGER BUTTON --- */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'lg:hidden relative flex items-center justify-center',
          'h-10 w-10 border border-white/20 bg-black/40 backdrop-blur-md',
          'text-white hover:bg-white hover:text-black transition-all duration-300',
          'active:scale-95 z-[50]',
        )}
        aria-label="Open system menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* --- FULL SCREEN OVERLAY --- */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-[200] w-screen h-screen flex flex-col bg-[#050505] text-white overflow-hidden"
            initial="closed"
            animate="open"
            exit="closed"
            variants={containerVariants}
          >
            {/* Background Texture */}
            <div className="absolute inset-0 pointer-events-none opacity-20 z-0">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:20px_20px]"></div>
            </div>

            {/* --- HEADER --- */}
            <div className="relative z-10 h-16 shrink-0 border-b border-white/20 flex items-center justify-between px-6 bg-[#050505]">
              <div className="flex items-center gap-3">
                <TerminalSquare className="w-5 h-5 text-green-500 animate-pulse" />
                <div className="flex flex-col leading-none">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    System Menu
                  </span>
                  <span className="font-mono text-sm font-bold">
                    OVERRIDE_ACTIVE
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="group p-2 border border-white/20 hover:bg-white hover:text-black transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* --- MAIN CONTENT --- */}
            <motion.div
              className="relative z-10 flex-1 overflow-y-auto p-6 flex flex-col min-h-0"
              variants={contentVariants}
            >
              {/* Internal Navigation Group */}
              <div className="mb-10">
                <motion.div
                  variants={itemVariants}
                  className="flex items-center gap-3 mb-6 opacity-40"
                >
                  <div className="w-2 h-2 bg-white/50"></div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em]">
                    Navigation_Modules
                  </span>
                  <div className="h-px flex-1 bg-white/20"></div>
                </motion.div>

                <div className="flex flex-col gap-2">
                  {navLinks.map((link, i) => {
                    const active = isActive(link.href);
                    return (
                      <motion.a
                        key={link.href}
                        href={link.disabled ? undefined : link.href}
                        onClick={
                          link.disabled ? undefined : () => setIsOpen(false)
                        }
                        variants={itemVariants}
                        className={cn(
                          'relative group block w-full border border-white/10 transition-all duration-300',
                          active
                            ? 'bg-white text-black border-white'
                            : 'hover:bg-white/5 text-white hover:border-white/40',
                          link.disabled &&
                            'opacity-40 cursor-not-allowed hover:bg-transparent hover:border-white/10',
                        )}
                      >
                        <div className="flex items-center justify-between p-5">
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-xs opacity-50">
                              {(i + 1).toString().padStart(2, '0')}
                            </span>
                            <span className="font-mono text-2xl font-bold uppercase tracking-tight">
                              {link.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {active && (
                              <span className="hidden sm:inline-block text-[10px] bg-black text-white px-2 py-0.5 uppercase tracking-wider">
                                Current
                              </span>
                            )}
                            {link.disabled ? (
                              <span className="text-[10px] border border-current px-2 py-0.5 uppercase font-mono tracking-wider">
                                Locked
                              </span>
                            ) : (
                              <ArrowRight
                                className={cn(
                                  'w-5 h-5 transition-transform duration-300',
                                  !active && 'group-hover:-rotate-45',
                                )}
                              />
                            )}
                          </div>
                        </div>

                        {/* Loading bar effect on bottom */}
                        {active && (
                          <div className="absolute bottom-0 left-0 h-1 bg-green-500 w-full animate-pulse"></div>
                        )}
                      </motion.a>
                    );
                  })}
                </div>
              </div>

              {/* External Navigation Group */}
              <div>
                <motion.div
                  variants={itemVariants}
                  className="flex items-center gap-3 mb-6 opacity-40"
                >
                  <div className="w-2 h-2 bg-white/50"></div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em]">
                    External_Protocol
                  </span>
                  <div className="h-px flex-1 bg-white/20"></div>
                </motion.div>

                <div className="grid grid-cols-2 gap-3">
                  {externalLinks?.map((link) => (
                    <motion.a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      variants={itemVariants}
                      className="group relative p-4 border border-white/20 hover:bg-white hover:text-black hover:border-white transition-all duration-300"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                          <span className="font-mono text-[10px] uppercase opacity-60">
                            Link
                          </span>
                          <ExternalLink className="w-4 h-4 opacity-60 group-hover:opacity-100" />
                        </div>
                        <span className="font-mono text-sm font-bold uppercase tracking-wider">
                          {link.label}
                        </span>
                      </div>
                    </motion.a>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* --- FOOTER STATUS BAR --- */}
            <motion.div
              className="relative z-10 shrink-0 border-t border-white/20 bg-[#0A0A0A] p-4"
              variants={itemVariants}
            >
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex gap-4">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                    <Cpu className="w-3 h-3" />
                    <span>CORE: OK</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                    <Wifi className="w-3 h-3" />
                    <span className="text-green-500">NET: 100%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-white">
                  <BatteryMedium className="w-3 h-3" />
                  <span>{time}</span>
                </div>
              </div>

              {/* Marquee Effect */}
              <div className="border-t border-white/10 pt-2 overflow-hidden flex select-none">
                <motion.div
                  className="whitespace-nowrap text-[10px] text-white/30 font-mono tracking-[0.2em] flex gap-8 uppercase"
                  animate={{ x: [0, -1000] }}
                  transition={{
                    repeat: Infinity,
                    ease: 'linear',
                    duration: 30,
                  }}
                >
                  <span>Ready for Deployment</span>
                  <span>{/* */}</span>
                  <span>Full Stack Architecture</span>
                  <span>{/* */}</span>
                  <span>Interactive Experiences</span>
                  <span>{/* */}</span>
                  <span>System Status: Nominal</span>
                  <span>{/* */}</span>
                  <span>Ready for Deployment</span>
                  <span>{/* */}</span>
                  <span>Full Stack Architecture</span>
                  <span>{/* */}</span>
                  <span>Interactive Experiences</span>
                  <span>{/* */}</span>
                  <span>System Status: Nominal</span>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
