'use client';

import { Menu, X } from 'lucide-react';
import { ReactNode, useMemo, useState } from 'react';

export interface SidebarItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface SidebarLayoutProps {
  title: string;
  items: SidebarItem[];
  activeId: string;
  onSelect: (id: string) => void;
  footerItems?: SidebarItem[];
  children: ReactNode;
}

const SidebarLayout = ({
  title,
  items,
  activeId,
  onSelect,
  footerItems,
  children,
}: SidebarLayoutProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSelect = (id: string) => {
    onSelect(id);
    setIsMenuOpen(false);
  };

  const renderItems = useMemo(
    () =>
      (list: SidebarItem[], activeClasses: string) => (
        <ul className="space-y-2">
          {list.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  activeId === item.id
                    ? activeClasses
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800'
                }`}
              >
                {item.icon ? <span className="text-lg">{item.icon}</span> : null}
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ),
    [activeId],
  );

  return (
    <div className="relative flex min-h-screen flex-col bg-zinc-100 text-zinc-900 md:flex-row md:items-stretch">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 md:hidden">
        <button
          type="button"
          aria-label="Toggle navigation"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="text-zinc-600"
        >
          {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <p className="text-lg font-semibold text-zinc-800">{title}</p>
      </header>

      {isMenuOpen ? (
        <div
          className="fixed inset-0 z-40 flex md:hidden"
          role="presentation"
          onClick={() => setIsMenuOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <aside
            className="relative z-50 h-full w-64 bg-white px-6 py-8 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="mb-8 text-2xl font-semibold text-zinc-800">{title}</header>
            <nav>{renderItems(items, 'bg-sky-100 text-sky-700')}</nav>
            {footerItems && footerItems.length > 0 ? (
              <nav className="mt-8">
                {renderItems(footerItems, 'bg-rose-100 text-rose-700')}
              </nav>
            ) : null}
          </aside>
        </div>
      ) : null}

      <aside className="hidden w-64 border-r border-zinc-200 bg-white px-6 py-8 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:justify-between md:overflow-y-auto">
        <div>
          <header className="mb-10 text-2xl font-semibold text-zinc-800">{title}</header>
          <nav>{renderItems(items, 'bg-sky-100 text-sky-700')}</nav>
        </div>
        {footerItems && footerItems.length > 0 ? (
          <nav>{renderItems(footerItems, 'bg-rose-100 text-rose-700')}</nav>
        ) : null}
      </aside>

      <section className="flex-1 bg-zinc-50 px-5 py-8 md:max-h-screen md:overflow-y-auto md:px-10 md:py-10">
        {children}
      </section>
    </div>
  );
};

SidebarLayout.displayName = 'SidebarLayout';

export default SidebarLayout;

