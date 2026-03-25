"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { toast } from "sonner";
import { Check } from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegisterFormProps {
  redirectTo?: string;
}

export default function RegisterForm({ redirectTo }: RegisterFormProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const supabase = createClient();

  function validateName(value: string): boolean {
    if (!value) { setNameError(""); return false; }
    if (value.trim().length < 3) {
      setNameError("Mínimo de 3 caracteres.");
      return false;
    }
    if (!value.trim().includes(" ")) {
      setNameError("Informe nome e sobrenome.");
      return false;
    }
    setNameError("");
    return true;
  }

  function validateEmail(value: string): boolean {
    if (!value) { setEmailError(""); return false; }
    if (!EMAIL_REGEX.test(value)) {
      setEmailError("Formato de email inválido.");
      return false;
    }
    setEmailError("");
    return true;
  }

  function validateConfirmPassword(value: string): boolean {
    if (!value) { setConfirmError(""); return false; }
    if (value !== password) {
      setConfirmError("As senhas não coincidem.");
      return false;
    }
    setConfirmError("");
    return true;
  }

  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
  };

  const passwordValid = passwordChecks.length && passwordChecks.uppercase && passwordChecks.number;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const isNameValid = validateName(fullName);
    const isEmailValid = validateEmail(email);
    const isConfirmValid = validateConfirmPassword(confirmPassword);

    if (!isNameValid || !isEmailValid || !passwordValid || !isConfirmValid) {
      if (!passwordValid) toast.error("A senha não atende os requisitos mínimos.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // If email confirmation is disabled, user is auto-confirmed
    // and we can sign them in immediately
    if (data.session) {
      toast.success("Conta criada com sucesso!");
      window.location.href = redirectTo || "/formacao";
      return;
    }

    // If email confirmation is enabled, try to sign in directly
    // (works if Supabase has "Confirm email" disabled)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError) {
      toast.success("Conta criada com sucesso!");
      window.location.href = redirectTo || "/formacao";
      return;
    }

    // Fallback: email confirmation is required
    toast.success("Conta criada! Verifique seu email para confirmar.", { duration: 6000 });
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Nome completo"
        type="text"
        placeholder="Seu nome completo"
        value={fullName}
        onChange={(e) => {
          setFullName(e.target.value);
          if (nameError) validateName(e.target.value);
        }}
        onBlur={() => fullName && validateName(fullName)}
        error={nameError}
        required
        autoComplete="name"
      />
      <Input
        label="Email"
        type="email"
        placeholder="seu@email.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (emailError) validateEmail(e.target.value);
        }}
        onBlur={() => email && validateEmail(email)}
        error={emailError}
        required
        autoComplete="email"
      />
      <div>
        <Input
          label="Senha"
          type="password"
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (confirmPassword) validateConfirmPassword(confirmPassword);
          }}
          required
          minLength={8}
          autoComplete="new-password"
        />
        {password && (
          <div className="mt-2 space-y-1">
            {([
              { key: "length" as const, label: "Mínimo 8 caracteres" },
              { key: "uppercase" as const, label: "Uma letra maiúscula" },
              { key: "number" as const, label: "Um número" },
            ]).map(({ key, label }) => (
              <div key={key} className="flex items-center gap-1.5">
                <Check
                  className={`h-3 w-3 ${
                    passwordChecks[key] ? "text-[#2E9E8F]" : "text-cream/25"
                  }`}
                />
                <span
                  className={`text-xs ${
                    passwordChecks[key] ? "text-green-400" : "text-cream/40"
                  }`}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <Input
        label="Confirmar senha"
        type="password"
        placeholder="Repita a senha"
        value={confirmPassword}
        onChange={(e) => {
          setConfirmPassword(e.target.value);
          if (confirmError) validateConfirmPassword(e.target.value);
        }}
        onBlur={() => confirmPassword && validateConfirmPassword(confirmPassword)}
        error={confirmError}
        required
        autoComplete="new-password"
      />

      <Button type="submit" loading={loading} fullWidth size="lg">
        Criar conta
      </Button>
    </form>
  );
}
