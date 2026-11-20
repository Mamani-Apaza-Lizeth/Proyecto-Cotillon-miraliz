// Inicio de sesión, registro, recuperación y restablecimiento de contraseña (Supabase Auth).
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Eye, EyeOff, MailCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { InputField } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Feedback';
import { Logo } from '../../components/layout/Logo';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { sendPasswordReset, signIn, signOut, signUp, updatePassword } from '../../services/account';
import { errorMessage } from '../../lib/errors';
import { fieldErrors, loginSchema, registerSchema, resetPasswordSchema } from '../../lib/validation';
import { safeNext } from '../../lib/rules';

function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="confetti-bg flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <div className="mb-4 flex justify-center"><Logo /></div>
        <h1 className="text-center text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-center text-ink-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function PasswordField({ label, value, onChange, error, autoComplete }: {
  label: string; value: string; onChange: (value: string) => void; error?: string; autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  const requirements: [boolean, string][] = [
    [value.length >= 8, '8 caracteres'],
    [/[A-Z]/.test(value), 'Una mayúscula'],
    [/[a-z]/.test(value), 'Una minúscula'],
    [/[0-9]/.test(value), 'Un número'],
    [/[!@#$%^&*()_+=\[\]{};':"\\|<>?,./`~-]/.test(value), 'Un carácter especial'],
  ];
  return (
    <div>
      <div className="relative">
        <InputField label={label} type={visible ? 'text' : 'password'} autoComplete={autoComplete} value={value} error={error}
          className="pr-14" onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="absolute right-2 top-[2.05rem] rounded-lg p-2 text-ink-500 hover:bg-ink-50"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}>
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs" aria-label="Requisitos de contraseña">
        {requirements.map(([valid, text]) => <li key={text} className={valid ? 'font-bold text-mint-700' : 'text-ink-500'}>
          <span aria-hidden>{valid ? '✓' : '•'}</span> {text}
        </li>)}
      </ul>
    </div>
  );
}

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session, role } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = safeNext(params.get('next'));

  if (session && role) return <Navigate to={next !== '/' ? next : role === 'admin' ? '/admin' : role === 'empleado' ? '/empleado/tareas' : '/'} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
    setErrors({});
    setBusy(true);
    setError(null);
    try {
      await signIn(parsed.data.email, parsed.data.password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Ingresar" subtitle="Accede para comprar, cotizar y seguir tus pedidos.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error}</Notice>}
        <InputField label="Correo electrónico" type="email" autoComplete="email" value={form.email} error={errors.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <InputField label="Contraseña" type="password" autoComplete="current-password" value={form.password} error={errors.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>Ingresar</Button>
        <div className="flex justify-between text-sm">
          <Link to="/recuperar-contrasena" className="font-bold text-brand-700 hover:underline">¿Olvidó su contraseña?</Link>
          <Link to={`/registro${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-bold text-brand-700 hover:underline">Crear cuenta</Link>
        </div>
      </form>
    </AuthCard>
  );
}

export function RegisterPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
    setErrors({});
    setBusy(true);
    setError(null);
    try {
      const { needsConfirmation } = await signUp(parsed.data.email, parsed.data.password, parsed.data.fullName, parsed.data.phone);
      if (needsConfirmation) setSent(true);
      else navigate(safeNext(params.get('next')), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthCard title="Revise su correo">
        <div className="space-y-3 text-center">
          <MailCheck className="mx-auto h-12 w-12 text-mint-500" aria-hidden />
          <p>Enviamos un enlace de confirmación a <strong>{form.email}</strong>. Ábralo para activar su cuenta y luego inicie sesión.</p>
          <Link to="/ingresar" className="font-bold text-brand-700 hover:underline">Ir a ingresar</Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Crear cuenta" subtitle="Regístrese como cliente de la tienda.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error}</Notice>}
        <InputField label="Nombre completo" autoComplete="name" value={form.fullName} error={errors.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <InputField label="Correo electrónico" type="email" autoComplete="email" value={form.email} error={errors.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <InputField label="Teléfono / WhatsApp (opcional)" type="tel" autoComplete="tel" value={form.phone} error={errors.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <PasswordField label="Contraseña" autoComplete="new-password" value={form.password} error={errors.password}
          onChange={(password) => setForm({ ...form, password })} />
        <InputField label="Repita la contraseña" type="password" autoComplete="new-password" value={form.confirm} error={errors.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>Crear cuenta</Button>
        <p className="text-center text-sm">¿Ya tiene cuenta? <Link to="/ingresar" className="font-bold text-brand-700 hover:underline">Ingresar</Link></p>
      </form>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Ingrese un correo válido.'); return; }
    setBusy(true);
    setError(null);
    try {
      await sendPasswordReset(email.trim());
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Recuperar contraseña" subtitle="Le enviaremos un enlace para crear una nueva contraseña.">
      {done ? (
        <Notice tone="success">Si existe una cuenta con <strong>{email}</strong>, recibirá un correo con el enlace en unos minutos. Revise también la carpeta de spam.</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <Notice tone="danger">{error}</Notice>}
          <InputField label="Correo electrónico" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" size="lg" className="w-full" loading={busy}>Enviar enlace</Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm"><Link to="/ingresar" className="font-bold text-brand-700 hover:underline">Volver a ingresar</Link></p>
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const { session } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = resetPasswordSchema.safeParse(form);
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
    setErrors({});
    setBusy(true);
    try {
      await updatePassword(parsed.data.password);
      await signOut();
      toast.success('Contraseña actualizada.');
      navigate('/ingresar', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Nueva contraseña">
      {!session ? (
        <Notice tone="warning">El enlace no es válido o expiró. <Link to="/recuperar-contrasena" className="font-bold underline">Solicite uno nuevo</Link>.</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <Notice tone="danger">{error}</Notice>}
          <PasswordField label="Nueva contraseña" autoComplete="new-password" value={form.password} error={errors.password}
            onChange={(password) => setForm({ ...form, password })} />
          <InputField label="Repita la contraseña" type="password" autoComplete="new-password" value={form.confirm} error={errors.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          <Button type="submit" size="lg" className="w-full" loading={busy}>Guardar contraseña</Button>
        </form>
      )}
    </AuthCard>
  );
}

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="font-display text-7xl text-brand-500">404</p>
      <h1 className="mt-2 text-3xl">Página no encontrada</h1>
      <p className="mt-2 text-ink-500">La dirección no existe o fue movida.</p>
      <Link to="/" className="mt-6 inline-block font-bold text-brand-700 hover:underline">Volver al inicio</Link>
    </div>
  );
}
