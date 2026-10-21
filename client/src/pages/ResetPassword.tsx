import { useForm } from 'react-hook-form';
import { useLocation } from 'wouter';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useRef, useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import gsap from 'gsap';
import logoUrl from '@assets/Screenshot_2025-10-15_183825_1765652253224.png';

const resetPasswordSchema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const containerRef = useRef<HTMLDivElement>(null);
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Get token from URL
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get('token');

    const form = useForm<ResetPasswordForm>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: {
            password: '',
            confirmPassword: '',
        }
    });

    useEffect(() => {
        const tl = gsap.timeline();
        tl.fromTo(
            containerRef.current,
            { opacity: 0, scale: 0.95 },
            { opacity: 1, scale: 1, duration: 0.8, ease: "power3.out" }
        ).fromTo(
            ".reset-element",
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, stagger: 0.1, duration: 0.5 },
            "-=0.4"
        );
    }, []);

    const onSubmit = async (data: ResetPasswordForm) => {
        if (!token) {
            toast({
                title: "Error",
                description: "Invalid or missing reset token",
                variant: "destructive",
            });
            return;
        }

        try {
            setSubmitting(true);
            const res = await fetch("/api/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    newPassword: data.password
                })
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.message || "Failed to reset password");
            }

            toast({
                title: "Success",
                description: "Your password has been reset successfully. You can now login.",
                className: "bg-green-500/10 border-green-500/20 text-green-700 font-medium"
            });

            setTimeout(() => setLocation('/'), 2000);

        } catch (err: any) {
            toast({
                title: "Error",
                description: err.message || "An unexpected error occurred",
                variant: "destructive",
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white text-slate-900 p-4">
                <Card className="bg-white border-slate-200 p-6 text-center max-w-sm shadow-xl">
                    <CardTitle className="text-red-500 mb-4">Invalid Link</CardTitle>
                    <p className="text-slate-600 mb-6">The password reset link is invalid or has expired.</p>
                    <Button onClick={() => setLocation('/')} variant="outline" className="w-full border-slate-200">
                        Back to Login
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px]" />
            </div>

            <div ref={containerRef} className="w-full max-w-md px-4 relative z-10">
                <div className="mb-8 text-center reset-element flex flex-col items-center">
                    <img
                        src={logoUrl}
                        alt="Knockturn Logo"
                        className="w-64 h-auto object-contain mb-4 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                    />
                </div>

                <Card className="bg-white border-slate-200 shadow-2xl">
                    <CardHeader className="space-y-1 reset-element">
                        <CardTitle className="text-3xl text-center text-slate-900 font-display font-bold mb-2">
                            Reset Password
                        </CardTitle>
                        <CardDescription className="text-center text-slate-600">
                            Set a new secure password for your account
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="reset-element">
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">New Password</label>
                                <div className="relative group">
                                    <Input
                                        {...form.register("password")}
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        className="relative bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-primary/50 transition-all h-12 pr-10"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {form.formState.errors.password && (
                                    <p className="text-red-400 text-xs mt-1">{form.formState.errors.password.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Confirm Password</label>
                                <div className="relative group">
                                    <Input
                                        {...form.register("confirmPassword")}
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        className="relative bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-primary/50 transition-all h-12 pr-10"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {form.formState.errors.confirmPassword && (
                                    <p className="text-red-400 text-xs mt-1">{form.formState.errors.confirmPassword.message}</p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold tracking-wide shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-all duration-300 mt-6"
                                disabled={submitting}
                            >
                                {submitting ? "Resetting Password..." : "CONFIRM NEW PASSWORD"}
                            </Button>

                            <div className="text-center mt-4">
                                <button
                                    type="button"
                                    onClick={() => setLocation('/')}
                                    className="text-primary hover:text-primary/80 text-xs font-medium transition-colors"
                                >
                                    Back to Login
                                </button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
