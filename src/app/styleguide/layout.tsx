"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { Moon, Sun } from "lucide-react";
import { navigation } from "./navigation";

export default function StyleguideLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [escuro, setEscuro] = useState(false);

  // O tema vai no <html> para alcançar menus em portal; sai ao deixar o styleguide.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", escuro);
    return () => document.documentElement.classList.remove("dark");
  }, [escuro]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="fixed top-0 left-0 flex h-screen w-64 flex-col gap-8 overflow-y-auto bg-sidebar p-6 text-sidebar-foreground">
        <Link href="/styleguide" className="text-2xl font-semibold tracking-tight">
          Hub<span className="text-sidebar-primary">.</span>
        </Link>

        <nav className="flex flex-col gap-6">
          {navigation.map((section) => (
            <div key={section.title}>
              <h3 className="mb-2 px-3 text-xs font-medium text-sidebar-foreground/60">
                {section.title}
              </h3>
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const ativo = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={ativo ? "page" : undefined}
                        className={cn(
                          "block rounded-lg border-l-2 px-3 py-2 text-sm transition-colors",
                          ativo
                            ? "border-sidebar-primary text-sidebar-primary"
                            : "border-transparent hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        )}
                      >
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setEscuro((v) => !v)}
          className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
        >
          {escuro ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {escuro ? "Tema claro" : "Tema escuro"}
        </button>
      </aside>

      <main className="ml-64 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
