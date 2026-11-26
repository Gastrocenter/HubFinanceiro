import Image from "next/image";
import { FormularioDeLogin } from "./formulario";
import "./login.css";
import "./formulario.css";

export default function Login() {
  return (
    <main className="login-pagina">
      <Image
        src="/illustrations/auth-background.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="login-fundo"
        aria-hidden
      />
      <div className="login-veu" aria-hidden />

      <div className="login-conteudo">
        <div className="login-cartao">
          <div className="login-painelFormulario">
            <div className="login-marca">
              <span className="login-marcaSimbolo" aria-hidden>
                H
              </span>
              <span className="login-marcaTexto">Hub Financeiro</span>
            </div>
            <div className="login-titulo">
              <h1>Entrar</h1>
              <p>Gastrocenter. Acesso restrito.</p>
            </div>
            <FormularioDeLogin />
          </div>
          <div className="login-decorativo" aria-hidden />
        </div>
      </div>
    </main>
  );
}
