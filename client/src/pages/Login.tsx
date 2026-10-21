import { useForm } from 'react-hook-form';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'wouter';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';

import logoUrl from '@assets/Screenshot_2025-10-15_183825_1765652253224.png';
import illustrationUrl from '@assets/login_illustration_final.png';
import { User, Lock, Check, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  code: z.string().min(1, "Employee Code is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { login, user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [employeeCodeForReset, setEmployeeCodeForReset] = useState('');
  const [sending, setSending] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      code: '',
      password: '',
    }
  });

  useEffect(() => {
    if (user) {
      if (user.role === 'Admin') {
        setLocation('/admin/dashboard');
      } else if (user.role === 'HR') {
        setLocation('/admin/view-leaves');
      } else {
        setLocation('/employee/dashboard');
      }
    }
  }, [user, setLocation]);

  useEffect(() => {
    if (isLoading || !containerRef.current) return;
    const tl = gsap.timeline();
    tl.fromTo(
      containerRef.current,
      { opacity: 0, scale: 0.98, y: 30 },
      { opacity: 1, scale: 1, y: 0, duration: 0.8, ease: "power3.out" }
    ).fromTo(
      ".login-element",
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, stagger: 0.1, duration: 0.5 },
      "-=0.4"
    );
  }, [isLoading]);

  const onSubmit = async (data: LoginForm) => {
    const code = data.code.trim().toUpperCase();
    const password = data.password.trim();

    const success = await login(code, password);

    if (success) {
      toast({
        title: "Welcome back",
        description: "Login successful",
        className: "bg-primary/10 border-primary/20 text-primary font-medium"
      });
      return;
    }

    toast({
      title: "Login Failed",
      description: "Invalid Employee Code or Password",
      variant: "destructive",
    });
  };

  const handleForgotPassword = async () => {
    const code = employeeCodeForReset.trim().toUpperCase();

    if (!code) {
      toast({
        title: "Error",
        description: "Employee Code is required",
        variant: "destructive"
      });
      return;
    }

    try {
      setSending(true);

      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode: code })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message);
      }

      toast({
        title: "Success",
        description: "Reset link sent to your registered email",
        className: "bg-green-500/10 border-green-500/20 text-white"
      });

      setEmployeeCodeForReset('');
      setForgotPasswordOpen(false);

    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to send reset link",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/50 p-4 sm:p-6 font-sans">
      {/* Main Container mirroring the reference image */}
      <div
        ref={containerRef}
        className="bg-white w-full max-w-6xl rounded-2xl sm:rounded-3xl lg:rounded-[3rem] shadow-[0_25px_80px_-20px_rgba(0,0,0,0.15)] flex flex-col lg:flex-row overflow-hidden border border-slate-100/50"
      >
        {/* Left Section: Illustration & Quote (Desktop only for fast mobile access) */}
        <div className="hidden lg:flex w-full lg:w-1/2 p-12 lg:p-20 flex-col items-center justify-center bg-white border-r border-slate-50">
          <img
            src={illustrationUrl}
            alt="Leave Management Illustration"
            className="w-full h-auto mb-16 login-element max-w-md mx-auto"
          />
          <div className="text-center space-y-2 login-element">
            <h2 className="text-3xl font-display font-bold text-slate-800 tracking-tight leading-tight">
              Simplify Leave Tracking
            </h2>
            <h2 className="text-3xl font-display font-bold text-slate-800 tracking-tight leading-tight">
              & Boost Productivity.
            </h2>
          </div>
        </div>

        {/* Right Section: Form area */}
        <div className="w-full lg:w-1/2 p-4 sm:p-8 lg:p-16 flex flex-col items-center lg:items-stretch justify-center">
          {/* Logo area - Centered, Responsive */}
          <div className="flex flex-col items-center mb-6 sm:mb-10 login-element w-full">
            <div className="bg-black p-2.5 sm:p-3 px-8 sm:px-12 rounded-xl shadow-2xl mb-3 flex items-center justify-center">
              <img src={logoUrl} alt="Knockturn Private Limited" className="h-10 sm:h-14 w-auto object-contain" />
            </div>
            <p className="text-slate-400 font-bold text-[9px] sm:text-[10px] tracking-[0.25em] sm:tracking-[0.3em] uppercase opacity-70">Leave Management System</p>
          </div>

          <div className="max-w-md w-full mx-auto space-y-6 sm:space-y-8">
            <div className="text-center login-element">
              <h1 className="text-2xl sm:text-4xl font-display font-bold text-slate-900 mb-1.5 sm:mb-2 tracking-tight">Welcome Back!</h1>
              <p className="text-xs sm:text-base text-slate-500 font-medium tracking-tight">Simplify Leave Tracking & Boost Productivity.</p>
            </div>

            <Card className="bg-white/70 backdrop-blur-xl border border-slate-200/50 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.08)] rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 lg:p-10 login-element overflow-hidden">
              <CardContent className="p-0 space-y-6 sm:space-y-8">
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-2 group">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2.5 ml-1 transition-colors group-focus-within:text-primary">
                      <User className="w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                      Employee Code
                    </label>
                    <div className="relative">
                      <Input
                        {...form.register("code")}
                        placeholder="e.g. A0001 or E0041"
                        className="bg-slate-50 border-slate-200/60 text-slate-900 dark:text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all h-14 rounded-2xl px-5 font-bold text-lg shadow-sm"
                        autoCapitalize="characters"
                      />
                    </div>
                    {form.formState.errors.code && (
                      <p className="text-red-500 text-xs mt-1.5 ml-1 font-bold">{form.formState.errors.code.message}</p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2.5 ml-1 transition-colors group-focus-within:text-primary">
                      <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                      Password
                    </label>
                    <div className="relative">
                      <Input
                        {...form.register("password")}
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="bg-slate-50 border-slate-200/60 text-slate-900 dark:text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all h-14 rounded-2xl px-5 pr-12 font-bold text-lg shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {form.formState.errors.password && (
                      <p className="text-red-500 text-xs mt-1.5 ml-1 font-bold">{form.formState.errors.password.message}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 py-1 login-element">
                    <div
                      className="flex items-center gap-3 cursor-pointer select-none"
                      onClick={() => setRememberMe(!rememberMe)}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                        rememberMe ? "border-green-500 bg-green-500" : "border-slate-300 bg-white"
                      )}>
                        {rememberMe && <Check className="w-3.5 h-3.5 text-white stroke-[4px]" />}
                      </div>
                      <span className="text-sm font-bold text-slate-500">Remember me</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      className="w-full h-14 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xl tracking-wide rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
                      disabled={form.formState.isSubmitting}
                    >
                      {form.formState.isSubmitting ? "AUTHENTICATING..." : "LOGIN"}
                    </Button>
                  </div>

                  <div className="text-center pt-2 space-y-12">
                    <button
                      type="button"
                      onClick={() => setForgotPasswordOpen(true)}
                      className="text-[#2563EB] hover:underline text-sm font-bold transition-all"
                    >
                      Forgot Password?
                    </button>

                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] flex items-center justify-center opacity-80">
                      Restricted Access. Authorized Personal Only.
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogContent className="bg-white border-slate-100 text-slate-900 rounded-3xl p-8 max-w-md">
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-2">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight">
              Forgot Password
            </DialogTitle>
            <DialogDescription className="text-slate-500 font-medium">
              Enter your employee code to receive a reset link via your registered email.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-6">
            <div className="space-y-2.5">
              <Label className="text-slate-800 font-bold ml-1">Employee Code</Label>
              <Input
                value={employeeCodeForReset}
                onChange={(e) => setEmployeeCodeForReset(e.target.value)}
                placeholder="Enter your employee code"
                className="bg-slate-50 border-slate-100 text-slate-900 h-12 rounded-xl"
                autoCapitalize="characters"
              />
            </div>
          </div>

          <DialogFooter className="gap-3 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setForgotPasswordOpen(false)}
              className="rounded-xl h-12 border-slate-200 text-slate-600 font-bold px-6"
            >
              Cancel
            </Button>
            <Button
              onClick={handleForgotPassword}
              className="bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl px-6"
              disabled={sending}
            >
              {sending ? "Sending..." : "Send Reset Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}