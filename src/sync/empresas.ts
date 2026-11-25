/** Empresas com credencial completa do ProDoctor (PRODOCTOR_<EMPRESA>_APIKEY e _APIPASSWORD). */
export function empresasConfiguradas(ambiente: Record<string, string | undefined>): string[] {
  return Object.keys(ambiente)
    .map((chave) => /^PRODOCTOR_(.+)_APIKEY$/.exec(chave)?.[1])
    .filter((empresa): empresa is string => Boolean(empresa))
    .filter((empresa) => Boolean(ambiente[`PRODOCTOR_${empresa}_APIKEY`]) && Boolean(ambiente[`PRODOCTOR_${empresa}_APIPASSWORD`]))
    .sort();
}
