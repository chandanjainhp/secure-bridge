import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Plus, Settings, LogOut, Menu, X, KeyRound, BarChart3 } from 'lucide-react';
import { useAuthStore } from '@/features/auth';
import { CreateProjectModal } from '@/features/projects/ui/CreateProjectModal';
import { useState } from 'react';

const links = [
  { to: '/dashboard', label: 'Workspace', icon: LayoutDashboard },
  { to: '/settings/api-key', label: 'API keys', icon: KeyRound },
  { to: '/settings/usage', label: 'Usage', icon: BarChart3 },
];

export function AppTopbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const initials = (user?.name || user?.email || 'U').split(/\s+/).map(v => v[0]).join('').slice(0, 2).toUpperCase();
  const active = to => location.pathname === to || location.pathname.startsWith(`${to}/`);

  const handleLogout = async () => { await logout(); navigate('/login', { replace: true }); };

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button className="btn-ghost px-2 lg:hidden" aria-label="Open navigation" onClick={() => setOpen(v => !v)}>{open ? <X size={18}/> : <Menu size={18}/>}</button>
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-mono text-xs font-bold text-primary-foreground">SB</div>
            <span className="hidden font-display text-sm font-bold tracking-tight sm:block">Secure Bridge</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${active(to) ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
              <Icon size={15}/>{label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <CreateProjectModal onSuccess={(project) => {
            if (project?.id) navigate(`/projects/${project.id}/chat`);
            else navigate('/dashboard');
          }}>
            <button className="btn-primary hidden h-10 sm:inline-flex"><Plus size={16}/> New project</button>
          </CreateProjectModal>
          <Link to="/profile" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-secondary text-xs font-bold" title={user?.email || 'Profile'}>{initials}</Link>
          <button className="btn-ghost px-2" onClick={handleLogout} title="Sign out"><LogOut size={16}/></button>
        </div>
      </div>
      {open && <div className="absolute inset-x-0 top-16 border-b border-border bg-background p-3 lg:hidden">
        <div className="grid gap-1">{links.map(({to,label,icon:Icon}) => <Link key={to} onClick={()=>setOpen(false)} to={to} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-secondary"><Icon size={17}/>{label}</Link>)}</div>
        <Link onClick={()=>setOpen(false)} to="/settings/preferences" className="mt-1 flex items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-secondary"><Settings size={17}/> Settings</Link>
      </div>}
    </header>
  );
}
