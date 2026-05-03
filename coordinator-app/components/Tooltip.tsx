'use client';

import { useState, useRef, useEffect } from 'react';
import { FiInfo } from 'react-icons/fi';

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  /** Show an ⓘ icon when no children provided */
  icon?: boolean;
}

export function Tooltip({ content, children, icon = false }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const hide = () => setVisible(false);
    document.addEventListener('scroll', hide, true);
    return () => document.removeEventListener('scroll', hide, true);
  }, []);

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center cursor-help"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
    >
      {children}
      {icon && <FiInfo size={12} className="ml-0.5 text-gray-400 flex-shrink-0" />}
      {visible && (
        <span className="absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg max-w-xs text-center leading-snug pointer-events-none">
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}
