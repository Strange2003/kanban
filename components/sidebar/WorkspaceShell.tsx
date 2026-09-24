"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WorkspaceShell({
  sidebar,
  notifications,
  children,
}: {
  sidebar: React.ReactNode;
  notifications: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  function closeMenu() {
    setMenuOpen(false);
    menuRef.current?.focus();
  }

  const [previousPathname, setPreviousPathname] = useState(pathname);
  if (pathname !== previousPathname) {
    setPreviousPathname(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input:not([disabled])",
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first && last) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last && first) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <div className="flex h-dvh min-w-0 flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3 md:justify-end md:px-4">
        <Button
          ref={menuRef}
          type="button"
          size="icon"
          variant="ghost"
          className="md:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label="Open projects"
          aria-expanded={menuOpen}
          aria-controls="workspace-projects"
        >
          <Menu className="h-5 w-5" />
        </Button>
        {notifications}
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {menuOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/60 md:hidden"
            onClick={closeMenu}
            aria-label="Close projects"
            tabIndex={-1}
          />
        )}
        <div
          id="workspace-projects"
          ref={drawerRef}
          onClickCapture={(event) => {
            if (menuOpen && (event.target as HTMLElement).closest("a[href]")) setMenuOpen(false);
          }}
          role={menuOpen ? "dialog" : undefined}
          aria-modal={menuOpen ? true : undefined}
          aria-label={menuOpen ? "Projects" : undefined}
          className={`${menuOpen ? "fixed inset-y-0 left-0 z-40 flex" : "hidden"} w-64 flex-col bg-background md:static md:z-auto md:flex md:shrink-0`}
        >
          {menuOpen && (
            <div className="flex justify-end px-3 pt-2 md:hidden">
              <Button
                ref={closeRef}
                type="button"
                size="icon"
                variant="ghost"
                onClick={closeMenu}
                aria-label="Close projects"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {sidebar}
        </div>
        {children}
      </div>
    </div>
  );
}
