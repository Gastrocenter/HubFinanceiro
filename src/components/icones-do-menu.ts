import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardCheck,
  HandCoins,
  LayoutDashboard,
  ScrollText,
  Tags,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

const ICONES: Record<string, LucideIcon> = {
  "/painel": LayoutDashboard,
  "/receita": TrendingUp,
  "/repasses": HandCoins,
  "/contas/pagar": ArrowUpFromLine,
  "/contas/receber": ArrowDownToLine,
  "/conferencia": ClipboardCheck,
  "/cadastros": Users,
  "/cadastros/categorias": Tags,
  "/admin/auditoria": ScrollText,
};

/** Ícone da tela; um atalho com filtro (`/cadastros?tipo=…`) usa o da própria tela. */
export function iconeDe(href: string): LucideIcon | undefined {
  return ICONES[href.split("?")[0]];
}
