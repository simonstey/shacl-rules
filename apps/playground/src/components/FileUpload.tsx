'use client';

import { useCallback, useRef } from 'react';

interface FileUploadProps {
  onFileContent: (content: string, filename: string) => void;
  accept?: string;
}

// Includes .srl/.shacl so users can upload rule files, not just RDF data — the
// handler already branches on those extensions.
export function FileUpload({
  onFileContent,
  accept = '.srl,.shacl,.ttl,.turtle,.rdf,.jsonld,.json',
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onFileContent(content, file.name);
      };
      reader.readAsText(file);

      // Reset input
      event.target.value = '';
    },
    [onFileContent]
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      <button
        onClick={handleClick}
        className="px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 bg-surface-3 hover:bg-border text-ink-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Upload
      </button>
    </>
  );
}
