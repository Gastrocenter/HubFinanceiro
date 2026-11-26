"use client";

import { useActionState, useState } from "react";
import { entrar, type EstadoLogin } from "./acoes";

function IconeOlho({ aberto }: { aberto: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!aberto && <path d="M3 3l18 18" />}
    </svg>
  );
}

export function FormularioDeLogin() {
  const [estado, acao, enviando] = useActionState<EstadoLogin, FormData>(entrar, {});
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [aviso, setAviso] = useState("");

  return (
    <>
      <form action={acao} className="login-formulario">
        <div className="login-campos">
          <input
            className="login-entrada"
            name="email"
            type="email"
            placeholder="Digite seu e-mail"
            aria-label="Digite seu e-mail"
            autoComplete="username"
            required
          />
          <div className="login-campo">
            <input
              className="login-entrada login-entradaComOlho"
              name="senha"
              type={senhaVisivel ? "text" : "password"}
              placeholder="Digite sua senha"
              aria-label="Digite sua senha"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="login-olho"
              onClick={() => setSenhaVisivel((v) => !v)}
              aria-label={senhaVisivel ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={senhaVisivel}
            >
              <IconeOlho aberto={senhaVisivel} />
            </button>
          </div>
        </div>

        <div className="login-opcoes">
          <label className="login-lembrar">
            <input type="checkbox" name="lembrar" />
            Lembre-me
          </label>
          <button
            type="button"
            className="login-esqueceu"
            onClick={() => setAviso("Para redefinir sua senha, fale com o administrador do Gastrocenter.")}
          >
            Esqueceu a senha?
          </button>
        </div>

        {estado.erro && <p role="alert" className="login-erro">{estado.erro}</p>}
        {aviso && <p role="status" className="login-aviso">{aviso}</p>}

        <button type="submit" disabled={enviando} className="login-enviar">
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </>
  );
}
