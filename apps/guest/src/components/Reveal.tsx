import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/** Content stays visible without animation support and to keyboard users. */
export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !('IntersectionObserver' in window)) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer: IntersectionObserver | undefined;
    const configure = () => {
      observer?.disconnect();
      element.removeAttribute('data-reveal');
      if (motion.matches) return;
      element.dataset.reveal = 'waiting';
      observer = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) {
          element.dataset.reveal = 'visible';
          observer?.disconnect();
        }
      }, { threshold: 0.08 });
      observer.observe(element);
    };
    configure();
    motion.addEventListener('change', configure);
    return () => { observer?.disconnect(); motion.removeEventListener('change', configure); };
  }, []);
  return <div ref={ref} className={`reveal ${className}`} style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}>{children}</div>;
}
