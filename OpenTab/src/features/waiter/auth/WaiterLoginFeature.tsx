// Autor: Milica Tadić ([student ID omitted]) - SSU11-15
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { routes } from "../../../app/routes";
import { GlassButton } from "../../../shared/ui/GlassButton";
import { useAuth } from "../../auth/AuthProvider";
import type { AuthRole } from "../../auth/session/authStorage";

type LoginRole = Extract<AuthRole, "owner" | "waiter">;

function getHomePath(role: LoginRole) {
  return role === "waiter" ? routes.waiter.tables : routes.owner.menu;
}

function getSafeNextPath(nextPath: string | null, role: LoginRole) {
  if (!nextPath) {
    return getHomePath(role);
  }

  if (role === "owner" && nextPath.startsWith("/owner")) {
    return nextPath;
  }

  if (role === "waiter" && nextPath.startsWith("/waiter")) {
    return nextPath;
  }

  return getHomePath(role);
}

export function WaiterLoginFeature() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, user } = useAuth();
  const initialRole = useMemo<LoginRole>(
    () => (location.pathname.startsWith(routes.waiter.login) ? "waiter" : "owner"),
    [location.pathname],
  );
  const [role, setRole] = useState<LoginRole>(initialRole);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.body.classList.add("opentab-login-active");

    return () => {
      document.body.classList.remove("opentab-login-active");
    };
  }, []);

  useEffect(() => {
    if (user?.role === "owner" || user?.role === "waiter") {
      navigate(getSafeNextPath(searchParams.get("next"), user.role), { replace: true });
    }
  }, [navigate, searchParams, user]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanIdentifier = identifier.trim();

    if (!cleanIdentifier) {
      setFormError("Unesi email ili korisnicko ime.");
      return;
    }

    if (!password) {
      setFormError("Unesi lozinku.");
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      await login({
        identifier: cleanIdentifier,
        password,
        role,
      });

      navigate(getSafeNextPath(searchParams.get("next"), role), { replace: true });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Prijava nije uspela.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleRole = () => {
    setRole((currentRole) => (currentRole === "owner" ? "waiter" : "owner"));
    setFormError(null);
  };

  return (
    <main className="page opentab-login-page">
      <section className="card opentab-login-card">
        <form className="form-panel opentab-login-form" onSubmit={submit} noValidate>
          <div className="brand opentab-login-brand">
            Open<span>Tab</span>
          </div>

          <div className="form-body opentab-login-body">
            <div className="opentab-login-copy">
              <h1 className="greeting">
                Dobrodosli<br />
                <em>nazad.</em>
              </h1>
              <p className="subtitle">
                {role === "waiter"
                  ? "Unesite kredencijale konobara za pristup aktivnim stolovima i narudzbinama."
                  : "Unesite kredencijale vlasnika da biste pristupili administraciji lokala."}
              </p>
            </div>

            <div className="fields">
              <label className="field login-field">
                <input
                  value={identifier}
                  placeholder="Email ili korisnicko ime"
                  autoComplete="username"
                  onChange={(event) => setIdentifier(event.target.value)}
                />
              </label>
              <label className="field login-field">
                <input
                  value={password}
                  placeholder="Lozinka"
                  type="password"
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            </div>

            <div
              className={`field-error-msg opentab-login-error ${formError ? "visible" : ""}`.trim()}
              role="alert"
              aria-live="polite"
            >
              {formError ?? " "}
            </div>

            <a href="#" className="forgot">Zaboravili ste lozinku?</a>

            <div className="login-role-actions">
              <GlassButton variant="primary" fullWidth type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Prijavljivanje..."
                  : role === "waiter"
                    ? "Prijavi se kao konobar"
                    : "Prijavi se kao vlasnik"}
              </GlassButton>

              <div className="divider">ili</div>

              <GlassButton
                variant="default"
                fullWidth
                type="button"
                onClick={toggleRole}
                disabled={isSubmitting}
              >
                {role === "waiter" ? "Prijava kao vlasnik" : "Prijava kao konobar"}
              </GlassButton>
            </div>
          </div>

          <p className="footer-note">
            Imate problem? <a href="#">Kontaktirajte podrsku</a><br />
            2025 OpenTab. Sva prava zadrzana.
          </p>
        </form>

        <div className="image-panel opentab-login-image" aria-hidden="true">
          <img src="/openTabLogIn.jpg" alt="Restoran" />
          <div className="image-badge">
            <div className="badge-label">OpenTab sistem</div>
            <div className="badge-title">Upravljajte stolovima<br />u realnom vremenu</div>
            <div className="badge-sub">Brze narudzbine, pracenje stolova i naplata - sve na jednom mestu.</div>
          </div>
        </div>
      </section>
    </main>
  );
}
