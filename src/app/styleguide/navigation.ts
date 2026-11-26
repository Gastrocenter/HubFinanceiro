export interface NavItem {
  name: string;
  href: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    title: "Fundação",
    items: [{ name: "Design tokens", href: "/styleguide" }],
  },
  {
    title: "Componentes",
    items: [
      // Os componentes entram aqui pelo Prompt 2 (/styleguide/components/<nome>).
      { name: "Data Table", href: "/styleguide/components/data-table" },
    ],
  },
];
