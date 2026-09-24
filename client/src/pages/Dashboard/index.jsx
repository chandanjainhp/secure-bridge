import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, FolderKanban, MessageSquare, ArrowUpRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { useProjectsStore } from '@/features/projects';
import { useAuthStore } from '@/features/auth';
import { CreateProjectModal, ProjectCard } from '@/features/projects';

export default function Dashboard() {
  const { projects, fetchProjects, isLoading } = useProjectsStore();
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [loadError, setLoadError] = useState(null);

  const load = async () => { setLoadError(null); try { await fetchProjects(); } catch (e) { setLoadError(e); } };
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => projects.filter(p => `${p.name} ${p.description || ''}`.toLowerCase().includes(query.toLowerCase())), [projects, query]);
  const conversations = projects.reduce((n, p) => n + Number(p.conversationCount || 0), 0);
  const remaining = user?.chatLimit ? Math.max(0, user.chatLimit - Number(user.chatUsageCount || 0)) : '∞';

  return <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:py-10">
    <div className="flex flex-col gap-6 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="eyebrow">Workspace overview</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Good to see you, {user?.name?.split(' ')[0] || 'there'}.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Manage projects, start conversations, and keep your model configuration organized.</p></div>
      <CreateProjectModal><button className="btn-primary"><Plus size={16}/> New project</button></CreateProjectModal>
    </div>

    <div className="grid gap-3 py-6 sm:grid-cols-3"><Stat icon={FolderKanban} label="Projects" value={projects.length}/><Stat icon={MessageSquare} label="Conversations" value={conversations}/><Stat label="Chat quota remaining" value={remaining}/></div>

    <div className="mb-5 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input className="field pl-10" placeholder="Search projects…" value={query} onChange={e=>setQuery(e.target.value)}/></div></div>

    {loadError && <div className="error-panel mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-destructive">Could not load your projects.</p><p className="mt-1 text-muted-foreground">{loadError.message || 'The server returned an unexpected error.'}</p></div><button className="btn-secondary h-10" onClick={load}><RefreshCw size={15}/> Retry</button></div>}
    {isLoading && projects.length === 0 ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Skeleton/><Skeleton/><Skeleton/></div> : visible.length === 0 ? <div className="panel flex min-h-64 flex-col items-center justify-center p-8 text-center"><FolderKanban size={28} className="text-muted-foreground"/><h2 className="mt-4 font-display text-lg font-semibold">{query ? 'No matching projects' : 'Your workspace is empty'}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{query ? 'Try another project name or description.' : 'Create a project to define a system prompt, choose settings, and start chatting.'}</p>{!query && <CreateProjectModal><button className="btn-primary mt-5"><Plus size={16}/> Create project</button></CreateProjectModal>}</div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((project,index)=><ProjectCard key={project.id || project._id || index} project={project} index={index}/>)}</div>}
  </div>;
}
function Stat({icon:Icon,label,value}){return <div className="panel flex items-center gap-4 p-4"><div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">{Icon?<Icon size={18}/>:<ArrowUpRight size={18}/>}</div><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-display text-xl font-semibold">{value}</p></div></div>}
function Skeleton(){return <div className="panel h-44 animate-pulse bg-secondary/40"/>}
