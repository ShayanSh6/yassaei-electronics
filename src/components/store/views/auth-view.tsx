"use client";

import { useState } from "react";
import { Zap, User2, Lock, Phone, AtSign } from "lucide-react";
import { toast } from "sonner";
import { navigate } from "@/lib/store/router";
import { useAuth } from "@/lib/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AuthView({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const submitLogin = async () => {
    if (!username.trim() || !password) return toast.error("نام کاربری و رمز عبور را وارد کنید");
    setBusy(true);
    try {
      const user = await login(username.trim(), password);
      toast.success(`خوش آمدید، ${user.name}!`);
      navigate(user.role === "owner" || user.role === "staff" ? "/admin" : "/account");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ورود");
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async () => {
    if (name.trim().length < 2) return toast.error("نام کامل را وارد کنید");
    if (username.trim().length < 3) return toast.error("نام کاربری باید حداقل ۳ نویسه باشد");
    if (password.length < 4) return toast.error("رمز عبور باید حداقل ۴ نویسه باشد");
    if (phone && !/^0\d{10}$/.test(phone.trim())) return toast.error("شمارهٔ موبایل نامعتبر است (۰۹xxxxxxxxx)");
    setBusy(true);
    try {
      const user = await register({ name: name.trim(), username: username.trim(), phone: phone.trim(), password });
      toast.success(`حساب شما ساخته شد؛ خوش آمدید ${user.name}!`);
      navigate("/account");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ثبت‌نام");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="glass rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <span className="inline-grid place-items-center size-14 rounded-2xl bg-brand/15 text-brand">
            <Zap className="size-7" />
          </span>
          <h1 className="text-xl font-extrabold">
            {mode === "login" ? "ورود به فروشگاه یاسایی" : "ساخت حساب کاربری"}
          </h1>
          <p className="text-xs text-muted-foreground leading-5">
            {mode === "login"
              ? "برای پیگیری سفارش‌ها و خرید آسان‌تر وارد شوید."
              : "در کمتر از یک دقیقه عضو خانوادهٔ یاسایی شوید."}
          </p>
        </div>

        <Tabs value={mode} onValueChange={(v) => navigate(`/${v}`)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" className="text-xs">ورود</TabsTrigger>
            <TabsTrigger value="register" className="text-xs">ثبت‌نام</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">نام کاربری</Label>
              <div className="relative">
                <AtSign className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input value={username} onChange={(e) => setUsername(e.target.value)} className="h-11 pr-9 text-sm" placeholder="admin" dir="ltr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">رمز عبور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-9 text-sm" placeholder="••••••••" dir="ltr"
                  onKeyDown={(e) => e.key === "Enter" && submitLogin()}
                />
              </div>
            </div>
            <Button className="w-full h-11 font-bold" onClick={submitLogin} disabled={busy}>
              {busy ? "در حال ورود…" : "ورود به حساب"}
            </Button>
          </TabsContent>

          <TabsContent value="register" className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">نام و نام خانوادگی</Label>
              <div className="relative">
                <User2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 pr-9 text-sm" placeholder="علی محمدی" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">نام کاربری</Label>
              <div className="relative">
                <AtSign className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input value={username} onChange={(e) => setUsername(e.target.value)} className="h-11 pr-9 text-sm" placeholder="ali_m" dir="ltr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">موبایل (اختیاری)</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 pr-9 text-sm" placeholder="09123456789" dir="ltr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">رمز عبور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-9 text-sm" placeholder="••••••••" dir="ltr"
                  onKeyDown={(e) => e.key === "Enter" && submitRegister()}
                />
              </div>
            </div>
            <Button className="w-full h-11 font-bold" onClick={submitRegister} disabled={busy}>
              {busy ? "در حال ثبت…" : "ساخت حساب"}
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
