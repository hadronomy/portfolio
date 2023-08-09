'use client';

import React from 'react';
import {
  FileTabs,
  SandpackStack,
  useActiveCode,
  useSandpack,
} from '@codesandbox/sandpack-react';
import Editor, { useMonaco } from '@monaco-editor/react';

import { getLanguageOfFile } from '~/lib/utils';

const options = {
  autoIndent: 'full',
  contextmenu: true,
  fontFamily: 'monospace',
  fontSize: 16,
  hideCursorInOverviewRuler: true,
  matchBrackets: 'always',
  minimap: {
    enabled: false,
  },
  scrollbar: {
    horizontalSliderSize: 4,
    verticalSliderSize: 18,
  },
  selectOnLineNumbers: true,
  roundedSelection: false,
  readOnly: false,
  cursorStyle: 'line',
  cursorBlinking: 'expand',
  cursorSmoothCaretAnimation: 'on',
  automaticLayout: true,
  bracketPairColorization: { enabled: true },
} as const;

export function MonacoEditor() {
  const { code, updateCode } = useActiveCode();
  const { sandpack } = useSandpack();
  const languague = getLanguageOfFile(sandpack.activeFile);
  const monaco = useMonaco();
  React.useEffect(() => {
    if (!monaco) return;
    // compiler options
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      baseUrl: '.',
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowJs: true,
      lib: ['dom', 'dom.iterable', 'esnext'],
      skipLibCheck: true,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      resolveJsonModule: true,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      paths: {
        '~/*': ['./src/*'],
      },
      strict: true,
      esModuleInterop: true,
    });
  }, [monaco]);

  return (
    <SandpackStack className="h-full">
      <FileTabs />
      <div style={{ flex: 1, paddingTop: 8, background: '#1e1e1e' }}>
        <Editor
          width="100%"
          height="100%"
          theme="vs-dark"
          key={sandpack.activeFile}
          language={languague}
          defaultValue={code}
          onChange={(value) => updateCode(value ?? '')}
          options={options}
        />
      </div>
    </SandpackStack>
  );
}
