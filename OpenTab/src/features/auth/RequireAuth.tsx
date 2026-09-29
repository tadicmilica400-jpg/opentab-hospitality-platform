// Autori: Milica Tadić ([student ID omitted], SSU11), Boško Trifunović ([student ID omitted], SSU16-19)
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { routes } from "../../app/routes";
import { useAuth } from "./AuthProvider";
import type { AuthRole } from "./session/authStorage";

type RequireAuthProps = {
  role: Exclude<AuthRole, "guest">;
  children: ReactNode;
};

function getHomePath(role: AuthRole) {
  if (role === "owner") {
    return routes.owner.menu;
  }

  if (role === "waiter") {
    return routes.waiter.tables;
  }

  return routes.auth.login;
}

export function RequireAuth({ role, children }: RequireAuthProps) {
  const location = useLocation();
  const { user, isCheckingSession } = useAuth();

  if (isCheckingSession) {
    return (
      <main className="page opentab-login-page">
        <section className="card opentab-login-card">
          <div className="form-panel opentab-login-form">
            <div className="brand opentab-login-brand">
              Open<span>Tab</span>
            </div>
            <div className="form-body opentab-login-body">
              <p className="subtitle">Provera sesije...</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`${routes.auth.login}?next=${next}`} replace />;
  }

  if (user.role !== role) {
    return <Navigate to={getHomePath(user.role)} replace />;
  }

  return children;
}
