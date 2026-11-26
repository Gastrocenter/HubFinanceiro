"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trilhaDe } from "@/dominio/menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/** Breadcrumb a partir da rota: seção › tela. A última etapa é a página atual. */
export function Trilha() {
  const passos = trilhaDe(usePathname());
  if (passos.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {passos.map((passo, i) => {
          const ultimo = i === passos.length - 1;
          return (
            <Fragment key={passo.rotulo}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {ultimo ? (
                  <BreadcrumbPage>{passo.rotulo}</BreadcrumbPage>
                ) : passo.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={passo.href}>{passo.rotulo}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span>{passo.rotulo}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
