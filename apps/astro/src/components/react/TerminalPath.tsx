'use client';

import { PreviewCard } from '@base-ui/react/preview-card';
import { cn } from '@portfolio/ui';
import { LayoutGroup, motion } from 'framer-motion';
import { ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react';
import * as React from 'react';

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

type SegmentCore =
  | (FileNode & { displayPath: string })
  | {
      name: string;
      path: string;
      type: 'file';
      displayPath: string;
    };

type PathSegment = SegmentCore & {
  isRoot: boolean;
  isLast: boolean;
};

function findNodeByPath(root: FileNode, targetPath: string): FileNode | null {
  if (root.path === targetPath) return root;
  if (!root.children) return null;

  for (const child of root.children) {
    if (child.path === targetPath) return child;

    if (child.type === 'dir') {
      const prefix = child.path === '/' ? '/' : child.path + '/';
      if (targetPath === child.path || targetPath.startsWith(prefix)) {
        const found = findNodeByPath(child, targetPath);
        if (found) return found;
      }
    }
  }

  return null;
}

function getChildren(segment: PathSegment): FileNode[] {
  if (!('children' in segment)) return [];
  return segment.children ?? [];
}

function SegmentIcon({ type, isLast }: { type: string; isLast: boolean }) {
  if (type === 'dir') {
    return (
      <FolderOpen
        className={cn('w-3.5 h-3.5', isLast ? 'text-blue-400' : 'opacity-60')}
      />
    );
  }

  return (
    <FileText
      className={cn('w-3.5 h-3.5', isLast ? 'text-green-400' : 'opacity-60')}
    />
  );
}

function SharedPopup({
  activeSegmentName,
  activeChildren,
}: {
  activeSegmentName: string;
  activeChildren: FileNode[];
}) {
  return (
    <div className="relative bg-[#0A0A0A] border border-white/20 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] flex flex-col p-1 backdrop-blur-3xl">
      <div className="px-3 py-2 text-[9px] uppercase tracking-widest text-muted-foreground border-b border-white/10 mb-1 opacity-50 flex items-center gap-2">
        <Folder className="w-3 h-3" />
        <span>Contents of {activeSegmentName}</span>
      </div>

      <div className="max-h-75 overflow-y-auto custom-scrollbar">
        {activeChildren.map((child) => (
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
  );
}

function Segment({
  segment,
  interactive,
  setActivePath,
}: {
  segment: PathSegment;
  interactive: boolean;
  setActivePath: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const className = cn(
    'relative group flex items-center gap-2 px-2 py-1.5 rounded-sm transition-all duration-300 focus:outline-none',
    segment.isLast
      ? 'text-white bg-white/10 font-bold border border-white/10 shadow-sm cursor-default'
      : 'text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent cursor-pointer',
  );

  return (
    <div className="relative flex items-center shrink-0" role="none">
      {!segment.isRoot && (
        <ChevronRight className="w-3 h-3 text-white/10 mx-1 shrink-0" />
      )}

      {interactive ? (
        <PreviewCard.Trigger
          href={segment.path}
          delay={80}
          onMouseEnter={() => setActivePath(segment.path)}
          onFocus={() => setActivePath(segment.path)}
          className={className}
        >
          <span className="shrink-0 relative z-10">
            <SegmentIcon type={segment.type} isLast={segment.isLast} />
          </span>
          <span className="whitespace-nowrap relative z-10">
            {segment.name}
          </span>
        </PreviewCard.Trigger>
      ) : (
        <a href={segment.path} className={className}>
          <span className="shrink-0 relative z-10">
            <SegmentIcon type={segment.type} isLast={segment.isLast} />
          </span>
          <span className="whitespace-nowrap relative z-10">
            {segment.name}
          </span>
        </a>
      )}
    </div>
  );
}

export function TerminalPath({ initialPathname, fileTree }: TerminalPathProps) {
  const [pathname, setPathname] = React.useState(initialPathname);
  const [isHoveringContainer, setIsHoveringContainer] = React.useState(false);

  // Only selects what to show inside the shared popup.
  const [activePath, setActivePath] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleNavigation = () => {
      setPathname(window.location.pathname);
      setActivePath(null);
    };

    document.addEventListener('astro:page-load', handleNavigation);
    return () =>
      document.removeEventListener('astro:page-load', handleNavigation);
  }, []);

  const pathSegments = React.useMemo<PathSegment[]>(() => {
    const rawSegments = pathname.split('/').filter(Boolean);
    const segments: SegmentCore[] = [];

    segments.push({ ...fileTree, name: '~', displayPath: '/' });

    let currentBuildPath = '';
    for (const raw of rawSegments) {
      currentBuildPath += `/${raw}`;
      const node = findNodeByPath(fileTree, currentBuildPath);
      if (node) segments.push({ ...node, displayPath: currentBuildPath });
      else {
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

  const isDeepPath = pathSegments.length >= 3;

  const activeSegment = React.useMemo(() => {
    if (!activePath) return null;
    return pathSegments.find((s) => s.path === activePath) ?? null;
  }, [activePath, pathSegments]);

  const activeChildren = React.useMemo(() => {
    if (!activeSegment) return [];
    return getChildren(activeSegment);
  }, [activeSegment]);

  const defaultSegment = pathSegments[0];
  const effectiveSegmentName =
    activeSegment?.name ?? defaultSegment?.name ?? '';
  const effectiveChildren =
    activeChildren.length > 0 ? activeChildren : getChildren(defaultSegment);

  const PreviewScaffold = ({ children }: { children: React.ReactNode }) => (
    <PreviewCard.Root>
      {children}

      <PreviewCard.Portal>
        <PreviewCard.Positioner
          side="bottom"
          align="start"
          sideOffset={8}
          className="isolate z-9999"
        >
          <PreviewCard.Popup
            className={cn(
              'relative',
              'data-open:animate-in data-closed:animate-out',
              'data-open:fade-in-0 data-closed:fade-out-0',
              'data-open:zoom-in-95 data-closed:zoom-out-95',
              'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2',
              'z-9999 min-w-50 origin-(--transform-origin) outline-none',
              'pointer-events-auto',
              'duration-150',
            )}
          >
            {/* Safety bridge: prevents “gap close” when moving from trigger to popup */}
            <div
              aria-hidden="true"
              className={cn(
                'absolute left-0 right-0 bg-transparent pointer-events-auto',
                '-top-3 h-3',
              )}
            />

            <SharedPopup
              activeSegmentName={effectiveSegmentName}
              activeChildren={effectiveChildren}
            />
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );

  return (
    <div
      className="relative flex items-center h-full max-w-full font-mono text-sm group/path-container select-none"
      onMouseEnter={() => setIsHoveringContainer(true)}
      onMouseLeave={() => setIsHoveringContainer(false)}
      role="none"
    >
      <LayoutGroup>
        {isDeepPath ? (
          <>
            {/* Collapsed */}
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

              <div className="relative flex items-center shrink-0" role="none">
                <a
                  href={pathSegments[pathSegments.length - 1].path}
                  className={cn(
                    'relative group flex items-center gap-2 px-2 py-1.5 rounded-sm transition-all duration-300 focus:outline-none',
                    'text-white bg-white/10 font-bold border border-white/10 shadow-sm cursor-default',
                  )}
                >
                  <span className="shrink-0 relative z-10">
                    <SegmentIcon
                      type={pathSegments[pathSegments.length - 1].type}
                      isLast
                    />
                  </span>
                  <span className="whitespace-nowrap relative z-10">
                    {pathSegments[pathSegments.length - 1].name}
                  </span>
                </a>
              </div>
            </div>

            {/* Expanded overlay */}
            {isHoveringContainer && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, x: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95, x: -10 }}
                transition={{ duration: 0.2, ease: 'circOut' }}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-50 flex items-center p-1.5 -ml-1.5 bg-[#050505] border border-white/20 shadow-2xl rounded-md"
              >
                <PreviewScaffold>
                  {pathSegments.map((segment) => (
                    <Segment
                      key={segment.path}
                      segment={segment}
                      interactive={getChildren(segment).length > 0}
                      setActivePath={setActivePath}
                    />
                  ))}
                </PreviewScaffold>
              </motion.div>
            )}
          </>
        ) : (
          <PreviewScaffold>
            <nav className="flex items-center w-full">
              {pathSegments.map((segment) => (
                <Segment
                  key={segment.path}
                  segment={segment}
                  interactive={getChildren(segment).length > 0}
                  setActivePath={setActivePath}
                />
              ))}
            </nav>
          </PreviewScaffold>
        )}
      </LayoutGroup>
    </div>
  );
}
