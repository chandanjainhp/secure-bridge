import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { MessageSquare, Settings, Trash2, MoreVertical, Clock } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/components/ui/alert-dialog';
import { useProjectsStore } from '@/features/projects';
import { useToast } from '@/shared/hooks/useToast';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/shared/utils/utils';

export function ProjectCard({ project, index }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();
  const { deleteProject, setCurrentProject } = useProjectsStore();
  const { toast } = useToast();

  const handleOpen = () => {
    setCurrentProject(project);
    navigate(`/projects/${project.id}/chat`);
  };

  const handleSettings = () => {
    setCurrentProject(project);
    navigate(`/projects/${project.id}/settings`);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    try {
      await deleteProject(project.id);
      setShowDeleteConfirm(false);
      toast({
        title: 'Project deleted',
        description: `${project.name} has been removed.`
      });
    } catch (error) {
      // Already toasted centrally for API failures.
      if (!error?.toastShown) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to delete project';
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive'
        });
      }
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.08, ease: [0.23, 1, 0.32, 1] }}
        className="group relative h-full flex"
      >
        <div
          className="relative flex flex-col w-full bg-card border-2 border-primary/60 transition-all duration-200 hover:border-primary hover:shadow-[0_0_24px_-6px_hsl(var(--primary)/0.45)] hover:-translate-y-0.5 cursor-pointer"
          onClick={handleOpen}
        >
          {/* Header */}
          <div className="p-6 flex-1 flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Project Icon */}
                <div className="w-[48px] h-[48px] shrink-0 border-2 border-primary/60 bg-secondary/50 flex items-center justify-center p-2 transition-colors">
                  <img src="/logo.png" alt={project.name} className="w-full h-full object-contain" />
                </div>

                {/* Project Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-sans font-bold text-[18px] tracking-[-0.2px] truncate transition-colors">
                    {project.name}
                  </h3>
                  <p className="font-body text-[14px] leading-[1.4] opacity-80 line-clamp-1 mt-0.5">
                    {project.description || 'No description'}
                  </p>
                </div>
              </div>

              {/* Actions Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-[32px] w-[32px] shrink-0 border-none hover:bg-background hover:text-foreground">
                    <MoreVertical size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[160px]">
                  <DropdownMenuItem onClick={e => { e.stopPropagation(); handleOpen(); }}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Open Chat
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={e => { e.stopPropagation(); handleSettings(); }}>
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={e => { e.stopPropagation(); handleDeleteClick(); }} className="text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Model Badge */}
            <div className="mt-auto pt-4">
              <Badge variant="outline" className="border-primary/60 bg-secondary/50 text-foreground">
                {project.model.split('/').pop()}
              </Badge>
            </div>
          </div>

          {/* Footer Stats */}
          <div className="px-6 py-4 border-t-2 border-primary/40 flex items-center justify-between transition-colors">
            <div className="flex items-center gap-2 font-mono uppercase tracking-[1.2px] text-[11px] font-bold">
              <MessageSquare size={12} />
              <span>{project.conversationCount} <span className="opacity-60">CHATS</span></span>
            </div>
            <div className="flex items-center gap-2 font-mono uppercase tracking-[1.2px] text-[11px] font-bold opacity-70">
              <Clock size={12} />
              <span>
                {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>DELETE PROJECT?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{project.name}" and all its conversations.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>CANCEL</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              DELETE
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
