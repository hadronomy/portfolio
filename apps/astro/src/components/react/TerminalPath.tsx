'use client';

import { cn } from '@portfolio/ui';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react';
import * as React from 'react';

// --- Types ---

export interface FileNode {
  name: string;
  path: string;
  type: 'dir' | 'file';
  children?: FileNode[];
}

interface TerminalPathProps {
  initialPathname: string;
  fileTree: FileNode;
}

// Type for enriched path segments with additional metadata
type PathSegment = (
  | FileNode
  | {
      name: string;
      path: string;
      type: string;
      displayPath: string;
    }
) & {
  isRoot: boolean;
  isLast: boolean;
  displayPath: string;
};

// --- Helper: Find node ---
function findNodeByPath(root: FileNode, targetPath: string): FileNode | null {
  if (root.path === targetPath) return root;
  if (root.children) {
    for (const child of root.children) {
      if (child.path === targetPath) return child;
      if (
        child.type === 'dir' &&
        targetPath.startsWith(child.path === '/' ? '/ignore' : child.path)
      ) {
        const found = findNodeByPath(child, targetPath);
        if (found) return found;
      }
    }
  }
  return null;
}

export function TerminalPath({ initialPathname, fileTree }: TerminalPathProps) {
  const [pathname, setPathname] = React.useState(initialPathname);
  const [hoveredSegment, setHoveredSegment] = React.useState<string | null>(
    null,
  );
  const [isHoveringContainer, setIsHoveringContainer] = React.useState(false);

  // --- Navigation Listener ---
  React.useEffect(() => {
    const handleNavigation = () => {
      setPathname(window.location.pathname);
    };
    document.addEventListener('astro:page-load', handleNavigation);
    return () =>
      document.removeEventListener('astro:page-load', handleNavigation);
  }, []);

  // --- Segment Logic ---
  const pathSegments = React.useMemo(() => {
    const rawSegments = pathname.split('/').filter(Boolean);
    const segments = [];

    // Root
    segments.push({ ...fileTree, name: '~', displayPath: '/' });

    let currentBuildPath = '';
    for (const raw of rawSegments) {
      currentBuildPath += `/${raw}`;
      const node = findNodeByPath(fileTree, currentBuildPath);
      if (node) {
        segments.push({ ...node, displayPath: currentBuildPath });
      } else {
        segments.push({
          name: raw,
          path: currentBuildPath,
          type: 'file',
          displayPath: currentBuildPath,
        });
      }
    }

    return segments.map((s, i) => ({
      ...s,
      isRoot: i === 0,
      isLast: i === segments.length - 1,
    }));
  }, [pathname, fileTree]);

  // Threshold for "Deep Path" logic
  const isDeepPath = pathSegments.length >= 3;

  // --- Segment Renderer ---
  const renderSegment = (
    segment: PathSegment,
    _index: number,
    isOverlay = false,
  ) => {
    const isHovered = hoveredSegment === segment.path;
    const hasChildren =
      'children' in segment && segment.children && segment.children.length > 0;

    // If we are in the "Placeholder" view (not overlay), we only show the icon for non-last items
    // But since we are doing the "Show Last One" logic, this renderer is mostly used for the full list

    return (
      <div
        key={segment.path}
        className="relative flex items-center shrink-0"
        onMouseEnter={() => setHoveredSegment(segment.path)}
        onMouseLeave={() => setHoveredSegment(null)}
        role="none"
      >
        {/* Separator */}
        {!segment.isRoot && (
          <ChevronRight className="w-3 h-3 text-white/10 mx-1 shrink-0" />
        )}

        {/* The Link */}
        <a
          href={segment.path}
          onFocus={() => setHoveredSegment(segment.path)}
          className={cn(
            'relative group flex items-center gap-2 px-2 py-1.5 rounded-sm transition-all duration-300 focus:outline-none',
            segment.isLast
              ? 'text-white bg-white/10 font-bold border border-white/10 shadow-sm cursor-default'
              : 'text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent cursor-pointer',
          )}
        >
          <span className="shrink-0 relative z-10">
            {segment.type === 'dir' ? (
              <FolderOpen
                className={cn(
                  'w-3.5 h-3.5',
                  segment.isLast ? 'text-blue-400' : 'opacity-60',
                )}
              />
            ) : (
              <FileText
                className={cn(
                  'w-3.5 h-3.5',
                  segment.isLast ? 'text-green-400' : 'opacity-60',
                )}
              />
            )}
          </span>

          <span className="whitespace-nowrap relative z-10">
            {segment.name}
          </span>
        </a>

        {/* Dropdown (Children) - Only show if interactive overlay or normal mode */}
        <AnimatePresence>
          {isHovered && hasChildren && isOverlay && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute top-full left-0 mt-1 min-w-[200px] z-[60] pt-2"
            >
              <div className="bg-[#0A0A0A] border border-white/20 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] flex flex-col p-1 backdrop-blur-3xl">
                <div className="px-3 py-2 text-[9px] uppercase tracking-widest text-muted-foreground border-b border-white/10 mb-1 opacity-50 flex items-center gap-2">
                  <Folder className="w-3 h-3" />
                  <span>Contents of {segment.name}</span>
                </div>

                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                  {'children' in segment &&
                    segment.children?.map((child: FileNode) => (
                      <a
                        key={child.path}
                        href={child.path}
                        className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground hover:text-white hover:bg-white/10 transition-colors group/item focus:bg-white focus:text-black focus:outline-none rounded-sm"
                      >
                        {child.type === 'dir' ? (
                          <Folder className="w-3.5 h-3.5 opacity-50 group-hover/item:opacity-100 group-hover/item:text-blue-400 transition-colors" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 opacity-50 group-hover/item:opacity-100 group-hover/item:text-green-400 transition-colors" />
                        )}
                        <span className="truncate">{child.name}</span>
                      </a>
                    ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div
      className="relative flex items-center h-full max-w-full font-mono text-sm group/path-container select-none"
      onMouseEnter={() => setIsHoveringContainer(true)}
      onMouseLeave={() => setIsHoveringContainer(false)}
      role="none"
    >
      <LayoutGroup>
        {/* === SCENARIO 1: DEEP PATH (3+ Items) === */}
        {isDeepPath ? (
          <>
            {/* 1A. Placeholder (Default View) 
                Shows only the last item to maintain layout stability.
                Hidden visually when hovering to let the overlay take over.
            */}
            <div
              className={cn(
                'flex items-center transition-opacity duration-200',
                isHoveringContainer
                  ? 'opacity-0 pointer-events-none'
                  : 'opacity-100',
              )}
            >
              <span className="text-muted-foreground mr-2 text-xs opacity-50">
                ... /
              </span>
              {renderSegment(
                pathSegments[pathSegments.length - 1],
                pathSegments.length - 1,
                false,
              )}
            </div>

            {/* 1B. Floating Overlay (Hover View) 
                Absolutely positioned on top. Shows full path.
            */}
            <AnimatePresence>
              {isHoveringContainer && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, x: -10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95, x: -10 }}
                  transition={{ duration: 0.2, ease: 'circOut' }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-50 flex items-center p-1.5 -ml-1.5 bg-[#050505] border border-white/20 shadow-2xl rounded-md"
                >
                  {pathSegments.map((segment, index) =>
                    renderSegment(segment, index, true),
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          /* === SCENARIO 2: SHORT PATH (Normal View) === */
          <nav className="flex items-center w-full">
            {pathSegments.map((segment, index) =>
              renderSegment(segment, index, true),
            )}
          </nav>
        )}
      </LayoutGroup>
    </div>
  );
}
