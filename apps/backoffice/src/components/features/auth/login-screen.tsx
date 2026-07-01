'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Shield, Building, Car, Mail, Lock, User, Hash, Loader2, Eye, EyeOff } from 'lucide-react';

import { TaxiKiwiLogo } from '@/components/brand/taxi-kiwi-logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminStore } from '@/lib/state/admin-store';
import { cn } from '@/lib/utils';
import {
  groupementLoginSchema,
  platformLoginSchema,
  type GroupementLoginForm,
  type PlatformLoginForm,
} from '@/lib/validations/auth.schema';

export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authMode = useAdminStore((state) => state.authMode);
  const setAuthMode = useAdminStore((state) => state.setAuthMode);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [showPlatformPassword, setShowPlatformPassword] = useState(false);
  const [showGroupementPassword, setShowGroupementPassword] = useState(false);

  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'groupement' || mode === 'platform') {
      setAuthMode(mode);
    }
  }, [searchParams, setAuthMode]);

  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';

  const platformForm = useForm<PlatformLoginForm>({
    defaultValues: { email: '', password: '' },
  });
  const groupementForm = useForm<GroupementLoginForm>({
    defaultValues: { groupementCode: '', identifier: '', password: '' },
  });

  async function submitPlatform(values: PlatformLoginForm) {
    const parsed = platformLoginSchema.safeParse(values);
    if (!parsed.success) {
      applyFormIssues(platformForm, parsed.error.issues);
      return;
    }

    setLoading(true);
    const result = await signIn('platform', {
      ...parsed.data,
      callbackUrl,
      redirect: false,
      rememberMe: rememberMe ? 'true' : 'false',
    });
    setLoading(false);

    if (result?.error) {
      toast.error('Connexion refusée', { description: 'Email ou mot de passe invalide.' });
      return;
    }

    toast.success('Session plateforme ouverte');
    router.replace(result?.url ?? callbackUrl);
  }

  async function submitGroupement(values: GroupementLoginForm) {
    const parsed = groupementLoginSchema.safeParse(values);
    if (!parsed.success) {
      applyFormIssues(groupementForm, parsed.error.issues);
      return;
    }

    setLoading(true);
    const result = await signIn('groupement', {
      ...parsed.data,
      callbackUrl,
      redirect: false,
      rememberMe: rememberMe ? 'true' : 'false',
    });
    setLoading(false);

    if (result?.error) {
      toast.error('Connexion refusée', {
        description: 'Code groupement, identifiant ou mot de passe invalide.',
      });
      return;
    }

    toast.success('Session groupement ouverte');
    router.replace(result?.url ?? callbackUrl);
  }

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center p-6 sm:p-12">
      {/* Full screen Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <div
          aria-hidden
          className="h-full w-full bg-cover bg-center"
          style={{
            backgroundImage: "url('/images/login-bg.jpg')",
          }}
        />
        {/* Gradient overlay: dark on the left for text/logo legibility, fading to transparent to show the bright image */}
        <div className="absolute inset-0 hidden bg-gradient-to-r from-zinc-950/95 via-zinc-950/60 to-transparent lg:block" />
        {/* Mobile gradient overlay to ensure the form and logo are readable */}
        <div className="absolute inset-0 bg-zinc-950/40 lg:hidden" />
      </div>

      <div className="relative z-10 grid w-full max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-24">
        {/* Left section - Text Content */}
        <section className="hidden flex-col text-white lg:flex">
          <div className="mb-12">
            <TaxiKiwiLogo />
          </div>

          <div className="mb-6 inline-flex self-start items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur-md">
            <Shield className="h-4 w-4 text-emerald-400" />
            Accès Sécurisé
          </div>

          <h1 className="mb-6 text-5xl font-bold tracking-tight xl:text-6xl text-white drop-shadow-md">
            Pilotez votre flotte avec <span className="text-primary">excellence</span>.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-zinc-200 drop-shadow">
            La plateforme de gestion de référence pour les groupements de taxis. Centralisez vos
            opérations, suivez vos chauffeurs en temps réel et optimisez l&apos;expérience de vos
            clients.
          </p>

          <div className="mt-12 grid grid-cols-2 gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md shadow-lg border border-white/10">
                <Building className="h-6 w-6 text-white" />
              </div>
              <div className="flex flex-col drop-shadow">
                <span className="font-semibold text-white">Multi-Groupements</span>
                <span className="text-sm text-zinc-300">Gestion unifiée</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md shadow-lg border border-white/10">
                <Car className="h-6 w-6 text-white" />
              </div>
              <div className="flex flex-col drop-shadow">
                <span className="font-semibold text-white">Temps réel</span>
                <span className="text-sm text-zinc-300">Suivi précis</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right section - Form */}
        <section className="flex w-full flex-col items-center justify-center">
          <div className="mb-8 lg:hidden">
            <TaxiKiwiLogo />
          </div>

          <Card className="w-full max-w-[440px] border-white/10 bg-card/95 shadow-2xl backdrop-blur-xl dark:bg-card/70">
            <CardContent className="p-6 sm:p-8">
              <div className="mb-8 flex flex-col space-y-2 text-center lg:text-left">
                <h2 className="text-2xl font-bold tracking-tight">Bienvenue</h2>
                <p className="text-sm text-muted-foreground">
                  Veuillez sélectionner votre type d&apos;accès.
                </p>
              </div>

              <Tabs
                defaultValue={authMode}
                value={authMode}
                onValueChange={(value) => setAuthMode(value as typeof authMode)}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 mb-8">
                  <TabsTrigger value="platform" className="text-sm">
                    Plateforme
                  </TabsTrigger>
                  <TabsTrigger value="groupement" className="text-sm">
                    Groupement
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="platform" className="mt-0 space-y-6">
                  <form className="grid gap-5" onSubmit={platformForm.handleSubmit(submitPlatform)}>
                    <LoginField
                      label="Adresse Email"
                      message={platformForm.formState.errors.email?.message}
                    >
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className={cn(
                            'h-11 bg-background/50 pl-10 transition-colors',
                            platformForm.formState.errors.email &&
                              'border-destructive focus-visible:ring-destructive',
                          )}
                          placeholder="superadmin@taxikiwi.local"
                          {...platformForm.register('email')}
                        />
                      </div>
                    </LoginField>
                    <LoginField
                      label="Mot de passe"
                      message={platformForm.formState.errors.password?.message}
                    >
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className={cn(
                            'h-11 bg-background/50 pl-10 pr-10 transition-colors',
                            platformForm.formState.errors.password &&
                              'border-destructive focus-visible:ring-destructive',
                          )}
                          type={showPlatformPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          {...platformForm.register('password')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPlatformPassword(!showPlatformPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showPlatformPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </LoginField>
                    <RememberMeCheckbox checked={rememberMe} onChange={setRememberMe} />
                    <Button
                      disabled={loading}
                      type="submit"
                      className="h-11 w-full font-medium"
                      size="lg"
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {loading ? 'Connexion en cours...' : 'Connexion Super Admin'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="groupement" className="mt-0 space-y-6">
                  <form
                    className="grid gap-5"
                    onSubmit={groupementForm.handleSubmit(submitGroupement)}
                  >
                    <LoginField
                      label="Code groupement"
                      message={groupementForm.formState.errors.groupementCode?.message}
                    >
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className={cn(
                            'h-11 bg-background/50 pl-10 uppercase transition-colors',
                            groupementForm.formState.errors.groupementCode &&
                              'border-destructive focus-visible:ring-destructive',
                          )}
                          placeholder="TAXI-KIWI"
                          {...groupementForm.register('groupementCode')}
                        />
                      </div>
                    </LoginField>
                    <LoginField
                      label="Identifiant"
                      message={groupementForm.formState.errors.identifier?.message}
                    >
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className={cn(
                            'h-11 bg-background/50 pl-10 font-mono transition-colors',
                            groupementForm.formState.errors.identifier &&
                              'border-destructive focus-visible:ring-destructive',
                          )}
                          placeholder="T1"
                          {...groupementForm.register('identifier')}
                        />
                      </div>
                    </LoginField>
                    <LoginField
                      label="Mot de passe"
                      message={groupementForm.formState.errors.password?.message}
                    >
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className={cn(
                            'h-11 bg-background/50 pl-10 pr-10 transition-colors',
                            groupementForm.formState.errors.password &&
                              'border-destructive focus-visible:ring-destructive',
                          )}
                          type={showGroupementPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          {...groupementForm.register('password')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowGroupementPassword(!showGroupementPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showGroupementPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </LoginField>
                    <RememberMeCheckbox checked={rememberMe} onChange={setRememberMe} />
                    <Button
                      disabled={loading}
                      type="submit"
                      className="h-11 w-full font-medium"
                      size="lg"
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {loading ? 'Connexion en cours...' : 'Connexion Groupement'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="mt-8 text-center text-xs text-zinc-400">
            En vous connectant, vous acceptez nos{' '}
            <a href="#" className="underline underline-offset-4 hover:text-white transition-colors">
              Conditions de service
            </a>{' '}
            et notre{' '}
            <a href="#" className="underline underline-offset-4 hover:text-white transition-colors">
              Politique de confidentialité
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}

function LoginField({
  children,
  label,
  message,
}: {
  children: React.ReactNode;
  label: string;
  message?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {message && <p className="text-xs font-medium text-destructive">{message}</p>}
    </div>
  );
}

function RememberMeCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border bg-background/50 text-primary accent-primary focus:ring-primary/50"
      />
      <span className="text-sm text-muted-foreground">Se souvenir de moi</span>
    </label>
  );
}

function applyFormIssues<T extends Record<string, unknown>>(
  form: ReturnType<typeof useForm<T>>,
  issues: Array<{ message: string; path: PropertyKey[] }>,
) {
  for (const issue of issues) {
    const field = issue.path[0];

    if (typeof field === 'string') {
      form.setError(field as Parameters<typeof form.setError>[0], { message: issue.message });
    }
  }
}
