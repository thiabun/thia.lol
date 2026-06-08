import { LockKeyhole, Mail, UserPlus } from "lucide-react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
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
              <AuthField
                id="handle"
                label="Handle"
                type="text"
                placeholder="@handle"
                icon={UserPlus}
              />
            ) : null}
            <AuthField
              id="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              icon={Mail}
            />
            <AuthField
              id="password"
              label="Password"
              type="password"
              placeholder="••••••••"
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
          <img
            src="/ambient-veil.png"
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-media-scrim" />
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

type AuthFieldProps = {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  icon: typeof Mail;
};

function AuthField({
  id,
  label,
  type,
  placeholder,
  icon: Icon,
}: AuthFieldProps) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
        <Icon aria-hidden="true" size={16} />
        {label}
      </span>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        className="min-h-12 w-full rounded-card border border-line bg-canvas/55 px-4 text-sm text-text shadow-inner-soft outline-none transition duration-fluid placeholder:text-muted/70 focus:border-line-strong focus:bg-surface"
      />
    </label>
  );
}
