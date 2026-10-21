import { Sidebar } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';
import { NotificationsBell } from '@/components/NotificationsBell';
import { Toaster } from '@/components/ui/toaster';
import { useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import gsap from 'gsap';
import { useLocation } from 'wouter';
import logoUrl from '@assets/Screenshot_2025-10-15_183825_1765652253224.png';

const MD_BREAKPOINT = 768;

export function Layout({ children }: { children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();

  // Close the drawer and reset scroll position to top after navigating
  useEffect(() => {
    setSidebarOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location]);

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= MD_BREAKPOINT) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Simple entry animation for page content
    if (contentRef.current) {
      gsap.fromTo(contentRef.current,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
      );
    }
  }, [children]);

  return (
    <div className="min-h-screen bg-background text-foreground flex font-sans overflow-x-hidden relative transition-colors duration-300">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[400px] sm:w-[500px] h-[400px] sm:h-[500px] bg-primary/5 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] sm:w-[600px] h-[500px] sm:h-[600px] bg-blue-100/10 dark:bg-blue-900/10 rounded-full blur-[120px]" />
      </div>

      {/* Desktop permanent sidebar */}
      <div className="hidden md:block md:w-64 md:fixed md:inset-y-0 md:left-0 md:z-30">
        <Sidebar />
      </div>

      {/* Mobile off-canvas drawer */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ${
          sidebarOpen ? 'pointer-events-auto visible' : 'pointer-events-none invisible'
        }`}
      >
        {/* Dark Backdrop */}
        <div
          className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            sidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />

        {/* Sliding Drawer */}
        <div
          className={`fixed inset-y-0 left-0 max-w-[85vw] transform transition-transform duration-300 ease-out shadow-2xl ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>
      </div>

      {/* Main app content area */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen min-w-0 relative z-10 overflow-x-hidden">
        {/* Top Header with Safe Area Inset to prevent overlapping status bar / timing */}
        <header className="sticky top-0 z-20 shrink-0 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-border pt-[env(safe-area-inset-top,0px)]">
          <div className="h-14 sm:h-16 flex items-center justify-between px-3.5 sm:px-6">
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Mobile Hamburger Menu Toggle */}
              <button
                type="button"
                aria-label="Open menu"
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-2 -ml-1 rounded-lg text-foreground hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all touch-manipulation focus:outline-none"
              >
                <Menu className="w-6 h-6" />
              </button>

              {/* Mobile branding */}
              <div className="flex items-center gap-2 md:hidden">
                <img src={logoUrl} alt="Knockturn" className="h-7 w-auto object-contain dark:mix-blend-screen" />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <NotificationsBell />
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Content View with mobile-optimized padding and bottom navigation safe area */}
        <div className="flex-1 px-3.5 sm:px-6 md:px-8 pt-4 sm:pt-6 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] max-w-7xl mx-auto w-full" ref={contentRef}>
          {children}
        </div>
      </main>

      <Toaster />
    </div>
  );
}
