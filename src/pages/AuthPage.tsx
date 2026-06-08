import { LockKeyhole, Mail, UserPlus } from "lucide-react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { AmbientImage } from "../components/ui/AmbientImage";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";

type AuthPageProps = {
  mode: "login" | "register";
};

export function AuthPage({ mode }: AuthPageProps) {
  const isRegister = mode === "register";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <div className="mx-auto grid min-h-[calc(100dvh-9rem)] max-w-5xl place-items-center">
      <PageMeta
        title={isRegister ? "Register" : "Login"}
        description={
          isRegister
            ? "Create a thia.lol profile and prepare for the future API account flow."
            : "Return to thia.lol with the future API account flow."
        }
        path={isRegister ? "/register" : "/login"}
      />
      <Panel className="grid w-full overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px]">
        <form className="p-5 sm:p-8" onSubmit={handleSubmit}>
          <Badge tone={isRegister ? "warm" : "cool"}>
            {isRegister ? "register" : "login"}
          </Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text">
            {isRegister ? "Create your place in the platform." : "Return to the room."}
          </h1>
          <p className="mt-3 text-base leading-7 text-muted">
            {isRegister
              ? "Set up a profile, choose a handle, and start with quiet defaults."
              : "Use the future API account flow when the backend comes online."}
          </p>

          <div className="mt-6 space-y-4">
            {isRegister ? (
              <TextField
                id="handle"
                label="Handle"
                type="text"
                placeholder="@handle"
                autoComplete="username"
                icon={UserPlus}
              />
            ) : null}
            <TextField
              id="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              icon={Mail}
            />
            <TextField
              id="password"
              label="Password"
              type="password"
              placeholder="••••••••"
              autoComplete={isRegister ? "new-password" : "current-password"}
              icon={LockKeyhole}
            />
          </div>

          <Button type="submit" className="mt-6 w-full">
            {isRegister ? "Register" : "Login"}
          </Button>

          <p className="mt-5 text-center text-sm text-muted">
            {isRegister ? "Already have an account?" : "New here?"}{" "}
            <Link
              to={isRegister ? "/login" : "/register"}
              className="font-medium text-accent-strong underline-offset-4 hover:underline"
            >
              {isRegister ? "Login" : "Register"}
            </Link>
          </p>
        </form>

        <div className="relative min-h-72 overflow-hidden border-t border-line lg:border-l lg:border-t-0">
          <AmbientImage className="absolute inset-0" overlay />
          <div className="absolute inset-x-5 bottom-5 rounded-card border border-white/35 bg-surface/72 p-4 shadow-soft backdrop-blur-veil">
            <p className="text-sm font-semibold text-text">Sunveil / Frostveil</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Theme, room, and identity state are ready for the future API.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
